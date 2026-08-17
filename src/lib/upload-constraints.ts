/** Shared between `/api/upload` and the upload UIs so both agree on limits. */

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
];

export const ALLOWED_UPLOAD_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "gif", "webp"];

export const UPLOAD_ACCEPT_ATTRIBUTE = ALLOWED_UPLOAD_EXTENSIONS.map((e) => `.${e}`).join(",");

/**
 * Attachments are a mix of photos and PDFs, and a PDF cannot render in an <img>.
 * `/api/files/<id>` hides the extension, so the filename it carries is checked too.
 */
export function isPdfUrl(url: string): boolean {
  return (fileNameFromUrl(url) ?? "").toLowerCase().endsWith(".pdf");
}

/**
 * The filename an upload URL carries, for naming an attachment restored from the
 * server (where only the URL is known, not the `File` the grader picked).
 */
export function fileNameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const parsed = new URL(url, "http://local");
  const name = parsed.searchParams.get("name") ?? parsed.pathname.split("/").pop();
  return name || null;
}

export const UPLOAD_LIMITS_HINT =
  "One file, up to 20 MB. Accepted formats: PDF, PNG, JPEG, GIF, WebP.";
