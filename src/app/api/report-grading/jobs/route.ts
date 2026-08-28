import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { STAFF_ROLES } from "@/lib/constants";
import { consumeActionRateLimit } from "@/lib/services/action-rate-limit";
import {
  createReportJob,
  listReportJobs,
} from "@/lib/services/report-grading-service";
import {
  REASONING_EFFORT_OPTIONS,
  REPORT_JOBS_PER_HOUR,
  REPORT_STUDENT_ID_MAX_CHARS,
  REPORT_TEXT_MAX_CHARS,
} from "@/lib/report-grading";

const CreateJobSchema = z.object({
  title: z.string().min(1).max(200),
  authors: z.string().max(200).optional(),
  studentId: z.string().max(REPORT_STUDENT_ID_MAX_CHARS).optional(),
  reportBlobUrl: z.string().url().max(1000).optional(),
  reportFilename: z.string().min(1).max(300).optional(),
  reportText: z.string().min(1).max(REPORT_TEXT_MAX_CHARS).optional(),
  reasoningEffort: z.enum(REASONING_EFFORT_OPTIONS).default("high"),
}).refine(
  (input) => Boolean(input.reportBlobUrl) !== Boolean(input.reportText),
  { message: "Provide either an uploaded report PDF or pasted report text" }
);

export async function GET(request: Request) {
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize")) || 20));
  const query = (searchParams.get("q") ?? "").trim().slice(0, 200) || undefined;

  const result = await listReportJobs(page, pageSize, query);
  return NextResponse.json({ data: result });
}

export async function POST(request: Request) {
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const parsed = CreateJobSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid job input" }, { status: 400 });
  }

  const rate = await consumeActionRateLimit({
    userId: auth.user.id,
    action: "report_grading_job",
    limit: REPORT_JOBS_PER_HOUR,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many grading jobs this hour. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const job = await createReportJob(auth.user.id, parsed.data);
    return NextResponse.json({ data: { id: job.id } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
