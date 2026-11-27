import { NextResponse } from "next/server";
import type { RouteContext } from "@/types/route";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { STAFF_ROLES } from "@/lib/constants";
import { ReportHumanReviewInputSchema } from "@/lib/human-grading";
import {
  createExtraReportHumanReview,
  deleteReportHumanReview,
  saveReportHumanScores,
} from "@/lib/services/human-grading-service";

/** Saves the signed-in staff member's own review, or updates an existing review by `reviewId`. */
export async function PUT(
  request: Request,
  { params: routeParams }: RouteContext
) {
  const params = await routeParams;
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const body = ReportHumanReviewInputSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { reviewId, graderLabel, ...scoresInput } = body.data;
  const result = await saveReportHumanScores(params.id, auth.user.id, scoresInput, {
    reviewId,
    graderLabel,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ data: { ok: true, reviewId: result.reviewId } });
}

/** Creates an additional flexible grader score slot on the report. */
export async function POST(
  request: Request,
  { params: routeParams }: RouteContext
) {
  const params = await routeParams;
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const body = ReportHumanReviewInputSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { graderLabel, ...scoresInput } = body.data;
  const result = await createExtraReportHumanReview(
    params.id,
    auth.user.id,
    scoresInput,
    graderLabel
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ data: { ok: true, reviewId: result.reviewId } }, { status: 201 });
}

/** Deletes a review slot by `?reviewId=...` (owner, professor, or admin). */
export async function DELETE(
  request: Request,
  { params: routeParams }: RouteContext
) {
  const params = await routeParams;
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const reviewId = new URL(request.url).searchParams.get("reviewId");
  if (!reviewId) {
    return NextResponse.json({ error: "Missing reviewId" }, { status: 400 });
  }
  const result = await deleteReportHumanReview(
    params.id,
    reviewId,
    auth.user.id,
    auth.user.role
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ data: { ok: true } });
}
