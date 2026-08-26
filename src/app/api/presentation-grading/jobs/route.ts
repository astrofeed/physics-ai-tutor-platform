import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { STAFF_ROLES } from "@/lib/constants";
import { consumeActionRateLimit } from "@/lib/services/action-rate-limit";
import {
  createPresentationJob,
  listPresentationJobs,
} from "@/lib/services/presentation-grading-service";
import {
  PRESENTATION_CONDITIONS,
  PRESENTATION_JOBS_PER_HOUR,
  PRESENTATION_TRACKS,
  PRESENTATION_TRANSCRIPT_MAX_CHARS,
  REASONING_EFFORT_OPTIONS,
} from "@/lib/presentation-grading";

const CreateJobSchema = z.object({
  topic: z.string().min(1).max(200),
  presenters: z.string().max(200).optional(),
  track: z.enum(PRESENTATION_TRACKS).optional(),
  condition: z.enum(PRESENTATION_CONDITIONS).optional(),
  audioBlobUrl: z.string().url().max(1000).optional(),
  transcript: z.string().min(1).max(PRESENTATION_TRANSCRIPT_MAX_CHARS).optional(),
  slidesBlobUrl: z.string().url().max(1000).optional(),
  slidesFilename: z.string().min(1).max(300).optional(),
  reasoningEffort: z.enum(REASONING_EFFORT_OPTIONS).default("high"),
}).refine(
  (input) => Boolean(input.audioBlobUrl) !== Boolean(input.transcript),
  { message: "Provide either an audio recording or a pasted transcript" }
);

export async function GET(request: Request) {
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize")) || 20));
  const query = (searchParams.get("q") ?? "").trim().slice(0, 200) || undefined;

  const result = await listPresentationJobs(page, pageSize, query);
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
