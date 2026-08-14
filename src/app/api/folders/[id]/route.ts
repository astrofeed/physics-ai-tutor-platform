import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { deleteFolder, renameFolder } from "@/lib/services/conversation-folder-service";

const RenameFolderSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;

    const parsed = RenameFolderSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Folder name must be 1-200 characters" }, { status: 400 });
    }

    const folder = await renameFolder(auth.user.id, params.id, parsed.data.name);
    if (!folder) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ folder });
  } catch (error) {
    console.error("[folders] Rename failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;

    const deleted = await deleteFolder(auth.user.id, params.id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[folders] Delete failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
