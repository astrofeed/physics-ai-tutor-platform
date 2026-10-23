import { NextResponse } from "next/server";
import type { RouteContext } from "@/types/route";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { restoreAssignment } from "@/lib/services/assignment-service";
import { logger } from "@/lib/logger";

export async function POST(
  _req: Request,
  { params: routeParams }: RouteContext
) {
  const params = await routeParams;
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;

    const result = await restoreAssignment(params.id, {
      id: auth.user.id,
      role: auth.user.role,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Restore assignment error", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
