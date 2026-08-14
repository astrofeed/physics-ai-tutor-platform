import { NextResponse } from "next/server";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import {
  canReadUploadedFile,
  loadUploadedFile,
  readFileBytes,
} from "@/lib/services/file-storage";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiAuth();
  if (isErrorResponse(auth)) return auth;

  const file = await loadUploadedFile(params.id);
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!canReadUploadedFile(file, auth.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bytes = await readFileBytes(file);
  if (!bytes) {
    return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `inline; filename="${file.filename}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
