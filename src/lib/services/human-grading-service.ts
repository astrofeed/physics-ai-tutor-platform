/**
 * Staff (human) scores recorded beside the AI result of report and
 * presentation grading jobs, plus the "AI revealed" timestamp that lets the
 * end-of-term analysis separate blind human grades from AI-informed ones.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { HumanGrading, HumanScoresInput } from "@/lib/human-grading";
import { parseReportEvaluation, REPORT_CRITERION_MAX_SCORE } from "@/lib/report-grading";
import { parseEvaluation } from "@/lib/presentation-grading";

interface HumanGradingRow {
  aiRevealedAt: Date | null;
  humanGradedAt: Date | null;
  humanTotal: Prisma.Decimal | null;
  humanGradedBy: { name: string | null } | null;
}

interface ScoreRow {
  score: Prisma.Decimal;
}

export function toHumanGrading(
  job: HumanGradingRow,
  scores: Array<ScoreRow & { name: string }>
): HumanGrading {
  return {
    scores: scores.map((row) => ({ name: row.name, score: Number(row.score) })),
    total: job.humanTotal === null ? null : Number(job.humanTotal),
    gradedAt: job.humanGradedAt?.toISOString() ?? null,
    gradedByName: job.humanGradedBy?.name ?? null,
    aiRevealedAt: job.aiRevealedAt?.toISOString() ?? null,
  };
}

export type SaveHumanScoresResult =
  | { ok: true }
  | { ok: false; status: 404 | 409 | 400; error: string };

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
  };
}

export async function saveReportHumanScores(
  jobId: string,
  graderId: string,
  input: HumanScoresInput
): Promise<SaveHumanScoresResult> {
  const job = await prisma.reportGradingJob.findUnique({
    where: { id: jobId },
    select: { status: true, resultJson: true, humanGradedAt: true },
  });
  if (!job) return { ok: false, status: 404, error: "Job not found" };
  const criteria = parseReportEvaluation(job.resultJson)?.criterionScores;
  if (job.status !== "DONE" || !criteria) {
    return { ok: false, status: 409, error: "The AI review must finish first" };
  }

  const valid = validateAgainst(
    input,
    new Map(criteria.map((c) => [c.criterion, REPORT_CRITERION_MAX_SCORE])),
    REPORT_CRITERION_MAX_SCORE
  );
  if (!valid.ok) return valid;

  await prisma.$transaction([
    prisma.reportHumanScore.deleteMany({ where: { jobId } }),
    prisma.reportHumanScore.createMany({
      data:
        "scores" in input
          ? input.scores.map((s) => ({ jobId, criterion: s.name, score: s.score }))
          : [],
    }),
    prisma.reportGradingJob.update({
      where: { id: jobId },
      data: gradingUpdate(input, graderId, job.humanGradedAt),
    }),
  ]);
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

/** Records the first time staff opened the AI result; later calls are no-ops. */
export async function revealReportAi(jobId: string): Promise<boolean> {
  const { count } = await prisma.reportGradingJob.updateMany({
    where: { id: jobId, aiRevealedAt: null },
    data: { aiRevealedAt: new Date() },
  });
  if (count > 0) return true;
  return (await prisma.reportGradingJob.count({ where: { id: jobId } })) > 0;
}

export async function revealPresentationAi(jobId: string): Promise<boolean> {
  const { count } = await prisma.presentationGradingJob.updateMany({
    where: { id: jobId, aiRevealedAt: null },
    data: { aiRevealedAt: new Date() },
  });
  if (count > 0) return true;
  return (await prisma.presentationGradingJob.count({ where: { id: jobId } })) > 0;
}
