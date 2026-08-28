import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { STAFF_ROLES } from "@/lib/constants";
import { DEFAULT_REPORT_RUBRIC } from "@/lib/default-report-rubric";
import {
  getCurrentReportRubric,
  saveReportRubric,
} from "@/lib/services/report-grading-service";

const RubricInputSchema = z.object({
  content: z.string().min(100).max(100_000),
});

export async function GET() {
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const rubric = await getCurrentReportRubric();
  return NextResponse.json({
    data: rubric
      ? {
          version: rubric.version,
          content: rubric.content,
          updatedByName: rubric.updatedBy.name,
          updatedAt: rubric.createdAt.toISOString(),
        }
      : {
          version: 0,
          content: DEFAULT_REPORT_RUBRIC,
          updatedByName: null,
          updatedAt: null,
        },
  });
}

export async function PUT(request: Request) {
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const parsed = RubricInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Grading instructions must be between 100 and 100,000 characters" },
      { status: 400 }
    );
  }

  const rubric = await saveReportRubric(parsed.data.content, auth.user.id);
  return NextResponse.json({
    data: {
      version: rubric.version,
      content: rubric.content,
      updatedByName: rubric.updatedBy.name,
      updatedAt: rubric.createdAt.toISOString(),
    },
  });
}
