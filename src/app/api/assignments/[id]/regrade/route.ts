import { NextResponse } from "next/server";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { RegradeError, regradeAssignment } from "@/lib/services/regrade-service";
import { logger } from "@/lib/logger";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;

    const result = await regradeAssignment(
      { id: auth.user.id, role: auth.user.role },
      params.id
    );
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof RegradeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error("Regrade assignment error", { assignmentId: params.id, error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
