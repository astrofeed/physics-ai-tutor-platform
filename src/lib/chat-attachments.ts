/**
 * Chat attachment rules, shared by the client (pre-flight checks and UI copy)
 * and the server (authoritative enforcement in `/api/upload/client`).
 *
 * Images are capped by frequency (per message, per hour); documents are capped
 * by a daily count and daily byte budget, because they are the expensive ones
 * to store and to feed to the model.
 */

export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_TEXT_BYTES = 1 * 1024 * 1024;

export const MAX_IMAGES_PER_HOUR = 60;
export const MAX_DOCUMENTS_PER_DAY = 30;
export const MAX_DOCUMENT_BYTES_PER_DAY = 150 * 1024 * 1024;

/** Text handed to the model per document, and pages read from a PDF. */
export const MAX_EXTRACTED_CHARS = 30_000;
export const MAX_PDF_PAGES = 30;

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export const PDF_MIME_TYPE = "application/pdf";
export const TEXT_MIME_TYPES = ["text/markdown", "text/x-markdown", "text/plain"] as const;

export const DOCUMENT_MIME_TYPES = [PDF_MIME_TYPE, ...TEXT_MIME_TYPES] as const;
export const ATTACHMENT_MIME_TYPES = [...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES] as const;

/** `accept` attribute for the file picker. Markdown often arrives with an empty
 * or wrong MIME type, so extensions are listed alongside the MIME types. */
export const ATTACHMENT_ACCEPT = [...ATTACHMENT_MIME_TYPES, ".md", ".markdown", ".txt"].join(",");

export type AttachmentKind = "image" | "document";

export interface AttachmentSpec {
  kind: AttachmentKind;
  mimeType: string;
  maxBytes: number;
}

const EXTENSION_MIME_TYPES: Record<string, string> = {
  md: "text/markdown",
  markdown: "text/markdown",
  txt: "text/plain",
  pdf: PDF_MIME_TYPE,
};

function mimeTypeFor(filename: string, declaredType: string): string | null {
  if ((ATTACHMENT_MIME_TYPES as readonly string[]).includes(declaredType)) return declaredType;
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MIME_TYPES[extension] ?? null;
}

/** Returns the rules for a file, or null when the type is not accepted. */
export function classifyAttachment(filename: string, declaredType: string): AttachmentSpec | null {
  const mimeType = mimeTypeFor(filename, declaredType);
  if (!mimeType) return null;

  if ((IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return { kind: "image", mimeType, maxBytes: MAX_IMAGE_BYTES };
  }
  if (mimeType === PDF_MIME_TYPE) {
    return { kind: "document", mimeType, maxBytes: MAX_PDF_BYTES };
  }
  return { kind: "document", mimeType, maxBytes: MAX_TEXT_BYTES };
}

/** Documents are fetched server-side for text extraction, so only URLs from
 * our own Blob store are accepted. */
export function isUploadedBlobUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export function isImageMimeType(mimeType: string): boolean {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${Math.round(mb)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
