import { NextResponse } from "next/server";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { AssignmentError } from "@/lib/services/assignment-service";
import { buildAssignmentLatex } from "@/lib/services/assignment-latex-service";
import type { RouteContext } from "@/types/route";

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;
    const { id } = await params;
    const archive = await buildAssignmentLatex(id);
    return new NextResponse(archive.buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${archive.filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof AssignmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[assignments:export-latex]", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
