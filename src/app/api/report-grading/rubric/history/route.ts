import { NextResponse } from "next/server";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { STAFF_ROLES } from "@/lib/constants";
import { listReportRubricVersions } from "@/lib/services/report-grading-service";

export async function GET() {
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const versions = await listReportRubricVersions();
  return NextResponse.json({
    data: versions.map((rubric) => ({
      version: rubric.version,
      content: rubric.content,
      updatedByName: rubric.updatedBy.name,
      updatedAt: rubric.createdAt.toISOString(),
    })),
  });
}
