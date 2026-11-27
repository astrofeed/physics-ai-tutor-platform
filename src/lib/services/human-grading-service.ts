/**
 * Staff (human) scores recorded beside the AI result of report and
 * presentation grading jobs, plus the "AI revealed" timestamp that lets the
 * end-of-term analysis separate blind human grades from AI-informed ones.
 *
 * Report jobs support unlimited independent reviews per job (`ReportHumanReview`),
 * keyed by `(jobId, slotKey)` so multiple TAs/professors can grade the same
 * report concurrently without overwriting each other.
 */

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  HumanGrading,
  HumanGradingRow,
  HumanScoreRow,
  HumanScoresInput,
  ReportHumanReviewDetail,
  SaveHumanScoresResult,
} from "@/types/human-grading";
import { parseReportEvaluation, REPORT_CRITERION_MAX_SCORE } from "@/lib/report-grading";
import { parseEvaluation } from "@/lib/presentation-grading";

export type { SaveHumanScoresResult } from "@/types/human-grading";

export function personalSlotKey(graderId: string): string {
  return `user:${graderId}`;
}

export function extraSlotKey(): string {
  return `extra:${randomUUID()}`;
}

export function emptyHumanGrading(): HumanGrading {
  return {
    scores: [],
    total: null,
    comments: null,
    gradedAt: null,
    gradedByName: null,
    aiRevealedAt: null,
  };
}

export function toHumanGrading(
  job: HumanGradingRow,
  scores: HumanScoreRow[]
): HumanGrading {
  return {
    scores: scores.map((row) => ({ name: row.name, score: Number(row.score) })),
    total: job.humanTotal === null ? null : Number(job.humanTotal),
    comments: job.humanComments,
    gradedAt: job.humanGradedAt?.toISOString() ?? null,
    gradedByName: job.humanGradedBy?.name ?? null,
    aiRevealedAt: job.aiRevealedAt?.toISOString() ?? null,
  };
}

export interface ReportReviewRecord {
  id: string;
  slotKey: string;
  graderId: string;
  graderLabel: string | null;
  total: Prisma.Decimal | null;
  comments: string | null;
  gradedAt: Date | null;
  aiRevealedAt: Date | null;
  grader: { name: string | null; role: string } | null;
  scores: { criterion: string; score: Prisma.Decimal }[];
}

export function toReportHumanReviewDetail(
  row: ReportReviewRecord,
  viewerUserId?: string
): ReportHumanReviewDetail {
  const isExtraSlot = row.slotKey.startsWith("extra:");
  const displayName = row.graderLabel?.trim() || row.grader?.name || null;
  return {
    id: row.id,
    slotKey: row.slotKey,
    graderId: row.graderId,
    graderName: row.grader?.name ?? null,
    graderRole: row.grader?.role ?? null,
    graderLabel: row.graderLabel,
    isMine: Boolean(viewerUserId && row.slotKey === personalSlotKey(viewerUserId)),
    isExtraSlot,
    scores: row.scores.map((s) => ({ name: s.criterion, score: Number(s.score) })),
    total: row.total === null ? null : Number(row.total),
    comments: row.comments,
    gradedAt: row.gradedAt?.toISOString() ?? null,
    gradedByName: displayName,
    aiRevealedAt: row.aiRevealedAt?.toISOString() ?? null,
  };
}

/**
 * Checks the submitted scores against the names and upper bounds the AI
 * result defines (so human and AI scores pair up one-to-one), or a directly
 * entered total against the scale's maximum.
 */
function validateAgainst(
  input: HumanScoresInput,
  maxByName: Map<string, number>,
  maxTotal: number
): SaveHumanScoresResult {
  if ("total" in input) {
    if (input.total > maxTotal) {
      return { ok: false, status: 400, error: `Total must be between 0 and ${maxTotal}` };
    }
    return { ok: true };
  }
  const seen = new Set<string>();
  for (const entry of input.scores) {
    const max = maxByName.get(entry.name);
    if (max === undefined) {
      return { ok: false, status: 400, error: `Unknown item: ${entry.name}` };
    }
    if (seen.has(entry.name)) {
      return { ok: false, status: 400, error: `Duplicate item: ${entry.name}` };
    }
    if (entry.score > max) {
      return {
        ok: false,
        status: 400,
        error: `"${entry.name}" must be between 0 and ${max}`,
      };
    }
    seen.add(entry.name);
  }
  return { ok: true };
}

/** A total replaces any per-item scores and vice versa; `humanGradedAt` keeps its first value. */
function gradingUpdate(input: HumanScoresInput, graderId: string, gradedAt: Date | null) {
  return {
    humanGradedById: graderId,
    humanGradedAt: gradedAt ?? new Date(),
    humanTotal: "total" in input ? input.total : null,
    humanComments: input.comments === undefined ? undefined : input.comments.trim() || null,
  };
}

async function loadAndValidateReportCriteria(
  jobId: string,
  input: HumanScoresInput
): Promise<SaveHumanScoresResult> {
  const job = await prisma.reportGradingJob.findUnique({
    where: { id: jobId },
    select: { status: true, resultJson: true },
  });
  if (!job) return { ok: false, status: 404, error: "Job not found" };
  const criteria = parseReportEvaluation(job.resultJson)?.criterionScores;
  if (job.status !== "DONE" || !criteria) {
    return { ok: false, status: 409, error: "The AI review must finish first" };
  }
  return validateAgainst(
    input,
    new Map(criteria.map((c) => [c.criterion, REPORT_CRITERION_MAX_SCORE])),
    REPORT_CRITERION_MAX_SCORE
  );
}

export interface SaveReportReviewOptions {
  reviewId?: string;
  graderLabel?: string;
}

/**
 * Saves a staff member's own review (default) or updates a specific review slot
 * by `reviewId`. Concurrent saves by different graders touch distinct rows and
 * never overwrite each other.
 */
export async function saveReportHumanScores(
  jobId: string,
  graderId: string,
  input: HumanScoresInput,
  options: SaveReportReviewOptions = {}
): Promise<SaveHumanScoresResult & { reviewId?: string }> {
  const valid = await loadAndValidateReportCriteria(jobId, input);
  if (!valid.ok) return valid;

  const trimmedComments =
    input.comments === undefined ? undefined : input.comments.trim() || null;
  const trimmedLabel =
    options.graderLabel === undefined ? undefined : options.graderLabel.trim() || null;
  const now = new Date();

  const savedId = await prisma.$transaction(async (tx) => {
    let reviewId: string;
    if (options.reviewId) {
      const existing = await tx.reportHumanReview.findFirst({
        where: { id: options.reviewId, jobId },
        select: { id: true, gradedAt: true },
      });
      if (!existing) return null;
      await tx.reportHumanReview.update({
        where: { id: existing.id },
        data: {
          total: "total" in input ? input.total : null,
          comments: trimmedComments,
          ...(trimmedLabel !== undefined ? { graderLabel: trimmedLabel } : {}),
          gradedAt: existing.gradedAt ?? now,
        },
      });
      reviewId = existing.id;
    } else {
      const slotKey = personalSlotKey(graderId);
      const existing = await tx.reportHumanReview.findUnique({
        where: { jobId_slotKey: { jobId, slotKey } },
        select: { id: true, gradedAt: true },
      });
      if (existing) {
        await tx.reportHumanReview.update({
          where: { id: existing.id },
          data: {
            total: "total" in input ? input.total : null,
            comments: trimmedComments,
            gradedAt: existing.gradedAt ?? now,
          },
        });
        reviewId = existing.id;
      } else {
        const created = await tx.reportHumanReview.create({
          data: {
            jobId,
            graderId,
            slotKey,
            total: "total" in input ? input.total : null,
            comments: trimmedComments ?? null,
            gradedAt: now,
          },
          select: { id: true },
        });
        reviewId = created.id;
      }
    }

    await tx.reportHumanScore.deleteMany({ where: { reviewId } });
    if ("scores" in input) {
      await tx.reportHumanScore.createMany({
        data: input.scores.map((s) => ({
          jobId,
          reviewId,
          criterion: s.name,
          score: s.score,
        })),
      });
    }

    // Keep legacy summary columns populated for any older tooling.
    const jobRow = await tx.reportGradingJob.findUnique({
      where: { id: jobId },
      select: { humanGradedAt: true },
    });
    if (jobRow) {
      await tx.reportGradingJob.update({
        where: { id: jobId },
        data: gradingUpdate(input, graderId, jobRow.humanGradedAt),
      });
    }

    return reviewId;
  });

  if (!savedId) {
    return { ok: false, status: 404, error: "Review slot not found" };
  }
  return { ok: true, reviewId: savedId };
}

/** Creates an additional flexible grader slot on a report (for extra TA/professor entries). */
export async function createExtraReportHumanReview(
  jobId: string,
  graderId: string,
  input: HumanScoresInput,
  graderLabel?: string
): Promise<SaveHumanScoresResult & { reviewId?: string }> {
  const valid = await loadAndValidateReportCriteria(jobId, input);
  if (!valid.ok) return valid;

  const trimmedComments =
    input.comments === undefined ? null : input.comments.trim() || null;
  const trimmedLabel = graderLabel?.trim() || null;
  const now = new Date();

  const reviewId = await prisma.$transaction(async (tx) => {
    const created = await tx.reportHumanReview.create({
      data: {
        jobId,
        graderId,
        slotKey: extraSlotKey(),
        graderLabel: trimmedLabel,
        total: "total" in input ? input.total : null,
        comments: trimmedComments,
        gradedAt: now,
      },
      select: { id: true },
    });
    if ("scores" in input) {
      await tx.reportHumanScore.createMany({
        data: input.scores.map((s) => ({
          jobId,
          reviewId: created.id,
          criterion: s.name,
          score: s.score,
        })),
      });
    }
    return created.id;
  });

  return { ok: true, reviewId };
}

export async function deleteReportHumanReview(
  jobId: string,
  reviewId: string,
  requesterId: string,
  requesterRole: string
): Promise<{ ok: true } | { ok: false; status: 403 | 404; error: string }> {
  const existing = await prisma.reportHumanReview.findFirst({
    where: { id: reviewId, jobId },
    select: { id: true, graderId: true },
  });
  if (!existing) {
    return { ok: false, status: 404, error: "Review not found" };
  }
  const canDelete =
    existing.graderId === requesterId ||
    requesterRole === "PROFESSOR" ||
    requesterRole === "ADMIN";
  if (!canDelete) {
    return { ok: false, status: 403, error: "You can only delete your own review" };
  }
  await prisma.reportHumanReview.delete({ where: { id: existing.id } });
  return { ok: true };
}

export async function savePresentationHumanScores(
  jobId: string,
  graderId: string,
  input: HumanScoresInput
): Promise<SaveHumanScoresResult> {
  const job = await prisma.presentationGradingJob.findUnique({
    where: { id: jobId },
    select: { status: true, summaryJson: true, humanGradedAt: true },
  });
  if (!job) return { ok: false, status: 404, error: "Job not found" };
  const scorecard = parseEvaluation(job.summaryJson)?.scorecard;
  if (job.status !== "DONE" || !scorecard) {
    return { ok: false, status: 409, error: "The AI grading must finish first" };
  }

  const valid = validateAgainst(
    input,
    new Map(scorecard.map((c) => [c.category, c.maxPoints])),
    scorecard.reduce((sum, c) => sum + c.maxPoints, 0)
  );
  if (!valid.ok) return valid;

  await prisma.$transaction([
    prisma.presentationHumanScore.deleteMany({ where: { jobId } }),
    prisma.presentationHumanScore.createMany({
      data:
        "scores" in input
          ? input.scores.map((s) => ({ jobId, category: s.name, score: s.score }))
          : [],
    }),
    prisma.presentationGradingJob.update({
      where: { id: jobId },
      data: gradingUpdate(input, graderId, job.humanGradedAt),
    }),
  ]);
  return { ok: true };
}

/**
 * Records the first time this staff member opened the AI scores on a report
 * (idempotent per grader, so blind vs AI-informed grading is tracked per TA).
 */
export async function revealReportAi(jobId: string, graderId?: string): Promise<boolean> {
  const exists = await prisma.reportGradingJob.count({ where: { id: jobId } });
  if (exists === 0) return false;

  const now = new Date();
  await prisma.reportGradingJob.updateMany({
    where: { id: jobId, aiRevealedAt: null },
    data: { aiRevealedAt: now },
  });

  if (graderId) {
    const slotKey = personalSlotKey(graderId);
    const existing = await prisma.reportHumanReview.findUnique({
      where: { jobId_slotKey: { jobId, slotKey } },
      select: { id: true, aiRevealedAt: true },
    });
    if (!existing) {
      await prisma.reportHumanReview.create({
        data: { jobId, graderId, slotKey, aiRevealedAt: now },
      });
    } else if (existing.aiRevealedAt === null) {
      await prisma.reportHumanReview.update({
        where: { id: existing.id },
        data: { aiRevealedAt: now },
      });
    }
  }
  return true;
}

export async function revealPresentationAi(jobId: string): Promise<boolean> {
  const { count } = await prisma.presentationGradingJob.updateMany({
    where: { id: jobId, aiRevealedAt: null },
    data: { aiRevealedAt: new Date() },
  });
  if (count > 0) return true;
  return (await prisma.presentationGradingJob.count({ where: { id: jobId } })) > 0;
}
