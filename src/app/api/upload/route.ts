import { NextResponse } from "next/server";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import {
  FileStorageUnavailableError,
  storeUploadedFile,
  visibilityForUploader,
} from "@/lib/services/file-storage";
import { logger } from "@/lib/logger";
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
} from "@/lib/upload-constraints";

export async function POST(req: Request) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // NOTE: File size is checked after the request body has been fully read into memory.
    // For production hardening, consider using presigned upload URLs (e.g., Vercel Blob
    // client uploads or S3 presigned URLs) so the server never buffers the full file.
    // This is a known limitation; the current check still prevents storage of oversized files.
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File exceeds the 20 MB size limit" }, { status: 413 });
    }

    if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PDF, PNG, JPEG, GIF, WebP" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "Invalid file extension. Allowed: .pdf, .png, .jpg, .jpeg, .gif, .webp" },
        { status: 400 }
      );
    }

    const stored = await storeUploadedFile({
      file,
      userId: auth.user.id,
      visibility: visibilityForUploader(auth.user.role),
    });

    return NextResponse.json({ url: stored.url });
  } catch (error) {
    if (error instanceof FileStorageUnavailableError) {
      logger.error("Upload rejected: no object store configured", { route: "/api/upload" });
      return NextResponse.json(
        { error: "File storage is not configured. Ask an administrator to set it up." },
        { status: 503 }
      );
    }
    logger.error("Upload failed", {
      route: "/api/upload",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
