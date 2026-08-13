import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { createFolder, listFolders } from "@/lib/services/conversation-folder-service";

const CreateFolderSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export async function GET() {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;

    const folders = await listFolders(auth.user.id);
    return NextResponse.json({ folders });
  } catch (error) {
    console.error("[folders] List failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;

    const parsed = CreateFolderSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Folder name must be 1-200 characters" }, { status: 400 });
    }

    const result = await createFolder(auth.user.id, parsed.data.name);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ folder: result.folder }, { status: 201 });
  } catch (error) {
    console.error("[folders] Create failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
