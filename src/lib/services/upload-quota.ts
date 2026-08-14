import { prisma } from "@/lib/prisma";
import {
  MAX_DOCUMENTS_PER_DAY,
  MAX_DOCUMENT_BYTES_PER_DAY,
  MAX_IMAGES_PER_HOUR,
  formatBytes,
  type AttachmentKind,
} from "@/lib/chat-attachments";

export interface QuotaDecision {
  allowed: boolean;
  error?: string;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Decides whether a user may upload one more attachment. Counts are read from
 * `UploadEvent` so the quota holds across serverless instances.
 */
export async function checkUploadQuota(
  userId: string,
  kind: AttachmentKind,
  sizeBytes: number
): Promise<QuotaDecision> {
  if (kind === "image") {
    const since = new Date(Date.now() - HOUR_MS);
    const recent = await prisma.uploadEvent.count({
      where: { userId, kind: "image", createdAt: { gte: since } },
    });
    if (recent >= MAX_IMAGES_PER_HOUR) {
      return {
        allowed: false,
        error: `Image upload limit reached (${MAX_IMAGES_PER_HOUR} per hour). Please try again later.`,
      };
    }
    return { allowed: true };
  }

  const since = new Date(Date.now() - DAY_MS);
  const usage = await prisma.uploadEvent.aggregate({
    where: { userId, kind: "document", createdAt: { gte: since } },
    _count: { _all: true },
    _sum: { sizeBytes: true },
  });

  if (usage._count._all >= MAX_DOCUMENTS_PER_DAY) {
    return {
      allowed: false,
      error: `Document upload limit reached (${MAX_DOCUMENTS_PER_DAY} files per day). Please try again tomorrow.`,
    };
  }

  const usedBytes = usage._sum.sizeBytes ?? 0;
  if (usedBytes + sizeBytes > MAX_DOCUMENT_BYTES_PER_DAY) {
    return {
      allowed: false,
      error: `Daily document upload budget reached (${formatBytes(MAX_DOCUMENT_BYTES_PER_DAY)} per day). Please try again tomorrow.`,
    };
  }

  return { allowed: true };
}

export interface UploadQuotaStatus {
  imagesLastHour: number;
  documentsToday: number;
  documentBytesToday: number;
}

/** Current usage, so the client can explain a rejection before uploading. */
export async function getUploadQuotaStatus(userId: string): Promise<UploadQuotaStatus> {
  const [imagesLastHour, documents] = await Promise.all([
    prisma.uploadEvent.count({
      where: { userId, kind: "image", createdAt: { gte: new Date(Date.now() - HOUR_MS) } },
    }),
    prisma.uploadEvent.aggregate({
      where: { userId, kind: "document", createdAt: { gte: new Date(Date.now() - DAY_MS) } },
      _count: { _all: true },
      _sum: { sizeBytes: true },
    }),
  ]);

  return {
    imagesLastHour,
    documentsToday: documents._count._all,
    documentBytesToday: documents._sum.sizeBytes ?? 0,
  };
}

export async function recordUpload(params: {
  userId: string;
  kind: AttachmentKind;
  mimeType: string;
  filename: string;
  sizeBytes: number;
}): Promise<void> {
  await prisma.uploadEvent.create({ data: params });
}
