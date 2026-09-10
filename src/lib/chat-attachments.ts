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
/** PDF and Office files (PPTX, DOCX, XLSX). */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
/** Plain text, Markdown and CSV. */
export const MAX_TEXT_BYTES = 1 * 1024 * 1024;

export const MAX_IMAGES_PER_HOUR = 60;
export const MAX_DOCUMENTS_PER_DAY = 30;
export const MAX_DOCUMENT_BYTES_PER_DAY = 150 * 1024 * 1024;

/** Text handed to the model per document on the turn it is attached, and pages
 * read from a PDF. */
export const MAX_EXTRACTED_CHARS = 120_000;
export const MAX_PDF_PAGES = 100;
/** Documents from earlier turns are replayed in abbreviated form so a long
 * conversation full of files stays inside the model's context window. */
export const MAX_HISTORY_ATTACHMENT_CHARS = 30_000;

/** PDFs attached on the current turn are also shown to the model as files so it
 * sees figures and handwriting. OpenAI accepts at most ~32 MB and 100 pages of
 * files per request; anything past these budgets falls back to text only. */
export const MAX_NATIVE_PDF_BYTES_PER_REQUEST = 30 * 1024 * 1024;
export const MAX_NATIVE_PDF_PAGES_PER_REQUEST = 100;

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export const PDF_MIME_TYPE = "application/pdf";
export const PPTX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const OFFICE_MIME_TYPES = [PPTX_MIME_TYPE, DOCX_MIME_TYPE, XLSX_MIME_TYPE] as const;
export const TEXT_MIME_TYPES = ["text/markdown", "text/x-markdown", "text/plain", "text/csv"] as const;

export const DOCUMENT_MIME_TYPES = [PDF_MIME_TYPE, ...OFFICE_MIME_TYPES, ...TEXT_MIME_TYPES] as const;
export const ATTACHMENT_MIME_TYPES = [...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES] as const;

/** Shown wherever the user is told what they can attach. */
export const SUPPORTED_ATTACHMENTS_LABEL = "image, PDF, PPTX, DOCX, XLSX, CSV, .md or .txt";

/** `accept` attribute for the file picker. Markdown and CSV often arrive with an
 * empty or wrong MIME type, so extensions are listed alongside the MIME types. */
export const ATTACHMENT_ACCEPT = [
  ...ATTACHMENT_MIME_TYPES,
  ".md",
  ".markdown",
  ".txt",
  ".csv",
  ".pptx",
  ".docx",
  ".xlsx",
].join(",");

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
  csv: "text/csv",
  pdf: PDF_MIME_TYPE,
  pptx: PPTX_MIME_TYPE,
  docx: DOCX_MIME_TYPE,
  xlsx: XLSX_MIME_TYPE,
};

/** Browsers report Office files inconsistently (or as `application/zip`), so the
 * extension wins for them. */
const EXTENSION_OVERRIDES_MIME = new Set(["pptx", "docx", "xlsx", "csv"]);

function mimeTypeFor(filename: string, declaredType: string): string | null {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  if (EXTENSION_OVERRIDES_MIME.has(extension)) return EXTENSION_MIME_TYPES[extension];
  if ((ATTACHMENT_MIME_TYPES as readonly string[]).includes(declaredType)) return declaredType;
  return EXTENSION_MIME_TYPES[extension] ?? null;
}

/** Returns the rules for a file, or null when the type is not accepted. */
export function classifyAttachment(filename: string, declaredType: string): AttachmentSpec | null {
  const mimeType = mimeTypeFor(filename, declaredType);
  if (!mimeType) return null;

  if ((IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return { kind: "image", mimeType, maxBytes: MAX_IMAGE_BYTES };
  }
  if (mimeType === PDF_MIME_TYPE || (OFFICE_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return { kind: "document", mimeType, maxBytes: MAX_DOCUMENT_BYTES };
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

/** Rounds up to one decimal so a file just over a limit never prints as the
 * same number as the limit ("1.1 MB" vs "1 MB", never "1 MB" vs "1 MB"). */
export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${Math.ceil(mb * 10) / 10} MB`;
  return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}
