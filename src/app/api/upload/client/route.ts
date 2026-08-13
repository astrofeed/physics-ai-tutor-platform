import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getEffectiveSession } from "@/lib/impersonate";
import { prisma } from "@/lib/prisma";
import { classifyAttachment, formatBytes } from "@/lib/chat-attachments";
import { checkUploadQuota, recordUpload } from "@/lib/services/upload-quota";
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

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await getEffectiveSession();
        if (!session?.user?.id) {
          throw new Error("Unauthorized");
        }

        const account = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { isBanned: true, emailVerified: true },
        });
        if (!account || account.isBanned) {
          throw new Error("Unauthorized");
        }
        if (!account.emailVerified) {
          throw new Error("Please verify your email address before uploading files");
        }

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

        const quota = await checkUploadQuota(session.user.id, spec.kind, sizeBytes);
        if (!quota.allowed) {
          throw new Error(quota.error ?? "Upload quota exceeded");
        }

        // The declared size is what the quota was charged for, so make it the
        // hard ceiling for the token: a larger file is rejected by Blob itself.
        await recordUpload({
          userId: session.user.id,
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
