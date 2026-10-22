import { NextResponse } from "next/server";
import { CreatePresentationJobSchema } from "@/lib/validators/presentation-job";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { STAFF_ROLES } from "@/lib/constants";
import { parseJobListFilter } from "@/lib/presentation-roster";
import { consumeActionRateLimit } from "@/lib/services/action-rate-limit";
import {
  createPresentationJob,
  listPresentationJobs,
} from "@/lib/services/presentation-grading-service";
import { PRESENTATION_JOBS_PER_HOUR } from "@/lib/presentation-grading";

export async function GET(request: Request) {
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize")) || 20));

  const result = await listPresentationJobs(page, pageSize, parseJobListFilter(searchParams));
  return NextResponse.json({ data: result });
}

export async function POST(request: Request) {
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const parsed = CreatePresentationJobSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid job input" }, { status: 400 });
  }

  const rate = await consumeActionRateLimit({
    userId: auth.user.id,
    action: "presentation_grading_job",
    limit: PRESENTATION_JOBS_PER_HOUR,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many grading jobs this hour. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const job = await createPresentationJob(auth.user.id, parsed.data);
    return NextResponse.json({ data: { id: job.id } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
