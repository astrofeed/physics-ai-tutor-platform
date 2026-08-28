import { NextResponse } from "next/server";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { STAFF_ROLES } from "@/lib/constants";
import {
  getReportJob,
  processReportJob,
  resetReportJobForRetry,
} from "@/lib/services/report-grading-service";

/** High-effort reasoning over a full report routinely takes several minutes. */
export const maxDuration = 800;

/**
 * Runs (or retries) the grading pipeline for one job. The client fires this
 * right after creating a job and does not need to stay on the page — the
 * function keeps running server-side and the job row tracks progress.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const job = await getReportJob(params.id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.status === "FAILED") {
    const retryable = await resetReportJobForRetry(params.id);
    if (!retryable) {
      return NextResponse.json(
        { error: "This job cannot be retried because its uploaded file was already deleted. Create a new job." },
        { status: 409 }
      );
    }
  }

  await processReportJob(params.id);
  const updated = await getReportJob(params.id);
  return NextResponse.json({ data: { status: updated?.status ?? "FAILED" } });
}
