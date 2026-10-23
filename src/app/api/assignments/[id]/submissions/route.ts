import { NextResponse } from "next/server";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { AssignmentError } from "@/lib/services/assignment-service";
import { getAssignmentSubmissions } from "@/lib/services/assignment-submissions-service";
import type { RouteContext } from "@/types/route";

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;
    const { id } = await params;
    return NextResponse.json(await getAssignmentSubmissions(id));
  } catch (error) {
    if (error instanceof AssignmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[assignments:submissions]", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
