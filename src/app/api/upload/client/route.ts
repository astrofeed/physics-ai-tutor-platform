import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getEffectiveSession } from "@/lib/impersonate";
import { prisma } from "@/lib/prisma";
import { classifyAttachment, formatBytes } from "@/lib/chat-attachments";
import { checkUploadQuota, recordUpload } from "@/lib/services/upload-quota";
import { BANNED_MESSAGE, DELETED_MESSAGE } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

const ClientPayloadSchema = z.object({
  filename: z.string().min(1).max(300),
  contentType: z.string().max(200).default(""),
  sizeBytes: z.number().int().positive(),
});

function parseClientPayload(clientPayload: string | null) {
  if (!clientPayload) return null;
  try {
    return ClientPayloadSchema.parse(JSON.parse(clientPayload));
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  // Access is checked before `handleUpload`, which turns anything thrown inside
  // it into a 400 and would hide the real status from the client.
  const session = await getEffectiveSession();
  const account = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          isBanned: true,
          isDeleted: true,
          emailVerified: true,
        },
      })
    : null;

  // This route cannot use requireApiAuth: handleUpload needs the raw session,
  // so the account-state checks are repeated here.
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (account.isDeleted) {
    return NextResponse.json({ error: DELETED_MESSAGE }, { status: 401 });
  }
  if (account.isBanned) {
    return NextResponse.json({ error: BANNED_MESSAGE }, { status: 403 });
  }
  if (!account.emailVerified) {
    return NextResponse.json(
      { error: "Please verify your email address before uploading files" },
      { status: 403 }
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = parseClientPayload(clientPayload);
        if (!payload) {
          throw new Error("Upload metadata is missing or invalid");
        }
        const { filename, contentType, sizeBytes } = payload;

        const spec = classifyAttachment(filename || pathname, contentType);
        if (!spec) {
          throw new Error("Unsupported file type. Allowed: JPEG, PNG, GIF, WebP, PDF, Markdown, plain text");
        }
        if (sizeBytes > spec.maxBytes) {
          throw new Error(`"${filename}" exceeds the ${formatBytes(spec.maxBytes)} limit for this file type`);
        }

        const quota = await checkUploadQuota(account.id, spec.kind, sizeBytes);
        if (!quota.allowed) {
          throw new Error(quota.error ?? "Upload quota exceeded");
        }

        // The declared size is what the quota was charged for, so make it the
        // hard ceiling for the token: a larger file is rejected by Blob itself.
        await recordUpload({
          userId: account.id,
          kind: spec.kind,
          mimeType: spec.mimeType,
          filename: filename.slice(0, 300),
          sizeBytes,
        });

        return {
          allowedContentTypes: [spec.mimeType],
          maximumSizeInBytes: sizeBytes,
        };
      },
      onUploadCompleted: async () => {
        // No action needed — the client gets the URL directly from upload()
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = (error as Error).message;
    logger.warn("Upload token rejected", { route: "/api/upload/client", error: message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
