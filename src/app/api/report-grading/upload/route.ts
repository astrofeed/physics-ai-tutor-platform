import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getEffectiveSession } from "@/lib/impersonate";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/constants";
import { formatBytes } from "@/lib/chat-attachments";
import { REPORT_FILE_MAX_BYTES, REPORT_FILE_MIME_TYPES } from "@/lib/report-grading";
import { logger } from "@/lib/logger";

const ClientPayloadSchema = z.object({
  contentType: z.string().min(1).max(200),
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

/** Blob upload tokens for report-grading files (staff only). */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  // Access is checked before `handleUpload`, which turns anything thrown
  // inside it into a 400 and would hide the real status from the client.
  const session = await getEffectiveSession();
  const account = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true, isBanned: true, isDeleted: true },
      })
    : null;

  if (!account || account.isDeleted) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (account.isBanned || !isStaff(account.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const payload = parseClientPayload(clientPayload);
        if (!payload) {
          throw new Error("Upload metadata is missing or invalid");
        }
        if (!REPORT_FILE_MIME_TYPES.includes(payload.contentType)) {
          throw new Error("Reports must be a PDF file");
        }
        if (payload.sizeBytes > REPORT_FILE_MAX_BYTES) {
          throw new Error(`File exceeds the ${formatBytes(REPORT_FILE_MAX_BYTES)} limit`);
        }

        return {
          allowedContentTypes: [payload.contentType],
          maximumSizeInBytes: payload.sizeBytes,
        };
      },
      onUploadCompleted: async () => {
        // The client gets the URL directly from upload()
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = (error as Error).message;
    logger.warn("Upload token rejected", {
      route: "/api/report-grading/upload",
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
