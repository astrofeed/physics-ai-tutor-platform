import { del } from "@vercel/blob";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  type ReportJobDetail,
  type ReportJobNavigation,
  type ReportJobSummary,
} from "@/lib/report-grading";
import { logger } from "@/lib/logger";
import { parseRosterSearch, type JobListFilter, type RosterSearch } from "@/lib/presentation-roster";
import {
  emptyHumanGrading,
  personalSlotKey,
  toReportHumanReviewDetail,
} from "@/lib/services/human-grading-service";
import { toFeedbackEmailStatus } from "@/lib/services/feedback-email-service";
import { gradeReport, loadReport } from "@/lib/services/report-grading-ai";
import { latestTopicSuggestionsForStudent } from "@/lib/services/presentation-suggestions-service";
import {
  rosterScheduleByStudentId,
  rosterStudentIdsMatching,
  type RosterSchedule,
} from "@/lib/services/presentation-roster-service";

export { createReportJob, getCurrentReportRubric, listReportRubricVersions, saveReportRubric,
  type CreateReportJobInput } from "./report-job-creation";

export type JobRecord = NonNullable<
  Awaited<ReturnType<typeof prisma.reportGradingJob.findUnique>>
>;

async function rubricVersionOf(rubricId: string): Promise<number | null> {
  const rubric = await prisma.reportRubric.findUnique({
    where: { id: rubricId },
    select: { version: true },
  });
  return rubric?.version ?? null;
}

/** English name / group / date from the sign-up sheet, resolved at read time so re-imports stay in sync. */
async function scheduleForJobs(
  jobs: { studentId: string | null }[]
): Promise<(RosterSchedule | null)[]> {
  const ids = jobs.map((job) => job.studentId).filter((id): id is string => id !== null);
  const schedule = await rosterScheduleByStudentId(ids);
  return jobs.map((job) => (job.studentId ? schedule.get(job.studentId) ?? null : null));
}

export type ReportReviewFilter = "all" | "my_ungraded" | "none_graded";

export interface ReportJobListFilter extends JobListFilter {
  reviewFilter?: ReportReviewFilter;
}

interface ReviewCounts {
  humanReviewCount: number;
  myGradedAt: string | null;
}

function summarizeReviews(
  reviews: { slotKey: string; gradedAt: Date | null }[] | undefined,
  viewerUserId?: string
): ReviewCounts {
  if (!reviews) return { humanReviewCount: 0, myGradedAt: null };
  let humanReviewCount = 0;
  let myGradedAt: string | null = null;
  const myKey = viewerUserId ? personalSlotKey(viewerUserId) : null;
  for (const r of reviews) {
    if (r.gradedAt) {
      humanReviewCount++;
      if (myKey && r.slotKey === myKey) {
        myGradedAt = r.gradedAt.toISOString();
      }
    }
  }
  return { humanReviewCount, myGradedAt };
}

function toSummary(
  job: JobRecord & {
    createdBy?: { name: string | null };
    humanReviews?: { slotKey: string; gradedAt: Date | null }[];
  },
  rubricVersion: number | null,
  schedule: RosterSchedule | null,
  viewerUserId?: string
): ReportJobSummary {
  const { humanReviewCount, myGradedAt } = summarizeReviews(job.humanReviews, viewerUserId);
  return {
    id: job.id,
    title: job.title,
    authors: job.authors,
    studentId: job.studentId,
    assignedQuestion: job.assignedQuestion,
    englishName: schedule?.englishName ?? null,
    groupLabel: schedule?.groupLabel ?? null,
    presentationDate: schedule?.presentationDate ?? null,
    status: job.status,
    error: job.error,
    model: job.model,
    reasoningEffort: job.reasoningEffort,
    gradingDurationMs: job.gradingDurationMs,
    rubricVersion,
    createdByName: job.createdBy?.name ?? null,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
    humanReviewCount,
    myGradedAt,
  };
}

/** Reports of exactly the students the roster search names (a group or a date). */
async function rosterJobFilter(search: RosterSearch): Promise<Prisma.ReportGradingJobWhereInput> {
  const ids = await rosterStudentIdsMatching(search);
  return ids.length > 0 ? { studentId: { in: ids } } : { id: { in: [] } };
}

/**
 * A search that names a roster group or date ("Group 1", "9/15") lists exactly
 * those students' reports; anything else is a substring match on title,
 * authors and student ID.
 */
async function jobSearchFilter(query: string): Promise<Prisma.ReportGradingJobWhereInput> {
  const rosterSearch = parseRosterSearch(query);
  if (rosterSearch) return rosterJobFilter(rosterSearch);
  return {
    OR: [
      { title: { contains: query, mode: "insensitive" } },
      { authors: { contains: query, mode: "insensitive" } },
      { studentId: { contains: query, mode: "insensitive" } },
    ],
  };
}

export async function listReportJobs(
  page: number,
  pageSize: number,
  filter: ReportJobListFilter = {},
  viewerUserId?: string
) {
  const reviewConditions: Prisma.ReportGradingJobWhereInput[] = [];
  if (filter.reviewFilter === "my_ungraded" && viewerUserId) {
    reviewConditions.push({
      status: "DONE",
      humanReviews: {
        none: { slotKey: personalSlotKey(viewerUserId), gradedAt: { not: null } },
      },
    });
  } else if (filter.reviewFilter === "none_graded") {
    reviewConditions.push({
      status: "DONE",
      humanReviews: { none: { gradedAt: { not: null } } },
    });
  }

  const conditions = await Promise.all([
    ...(filter.query ? [jobSearchFilter(filter.query)] : []),
    ...(filter.group !== undefined
      ? [rosterJobFilter({ kind: "group", number: filter.group })]
      : []),
  ]);
  const allConditions = [...conditions, ...reviewConditions];
  const where = allConditions.length > 0 ? { AND: allConditions } : undefined;
  const [jobs, totalCount] = await Promise.all([
    prisma.reportGradingJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        createdBy: { select: { name: true } },
        humanReviews: { select: { slotKey: true, gradedAt: true } },
      },
    }),
    prisma.reportGradingJob.count({ where }),
  ]);
  const [versions, schedules] = await Promise.all([
    Promise.all(jobs.map((j) => rubricVersionOf(j.rubricId))),
    scheduleForJobs(jobs),
  ]);
  return {
    jobs: jobs.map((job, i) => toSummary(job, versions[i], schedules[i], viewerUserId)),
    totalCount,
  };
}

async function computeReportNavigation(
  currentId: string,
  viewerUserId?: string
): Promise<ReportJobNavigation> {
  const doneJobs = await prisma.reportGradingJob.findMany({
    where: { status: "DONE" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      humanReviews: {
        where: { gradedAt: { not: null } },
        select: { slotKey: true },
      },
    },
  });
  const totalDone = doneJobs.length;
  const myKey = viewerUserId ? personalSlotKey(viewerUserId) : null;
  let myGradedDone = 0;
  for (const j of doneJobs) {
    if (myKey && j.humanReviews.some((r) => r.slotKey === myKey)) {
      myGradedDone++;
    }
  }
  const idx = doneJobs.findIndex((j) => j.id === currentId);
  const prevId = idx > 0 ? doneJobs[idx - 1].id : null;
  const nextId = idx >= 0 && idx < totalDone - 1 ? doneJobs[idx + 1].id : null;

  const orderedAfterCurrent =
    idx >= 0
      ? [...doneJobs.slice(idx + 1), ...doneJobs.slice(0, idx)]
      : doneJobs;

  const nextUngradedId =
    orderedAfterCurrent.find(
      (j) => !myKey || !j.humanReviews.some((r) => r.slotKey === myKey)
    )?.id ?? null;

  const nextCompletelyUngradedId =
    orderedAfterCurrent.find((j) => j.humanReviews.length === 0)?.id ?? null;

  return {
    prevId,
    nextId,
    nextUngradedId,
    nextCompletelyUngradedId,
    position: idx >= 0 ? idx + 1 : null,
    totalDone,
    myGradedDone,
  };
}

export async function getReportJob(
  id: string,
  viewerUserId?: string
): Promise<ReportJobDetail | null> {
  const job = await prisma.reportGradingJob.findUnique({
    where: { id },
    include: {
      rubric: { select: { version: true, content: true } },
      createdBy: { select: { name: true } },
      humanReviews: {
        orderBy: { createdAt: "asc" },
        include: {
          grader: { select: { name: true, role: true } },
          scores: { select: { criterion: true, score: true } },
        },
      },
    },
  });
  if (!job) return null;
  const [[schedule], navigation] = await Promise.all([
    scheduleForJobs([job]),
    computeReportNavigation(job.id, viewerUserId),
  ]);
  const reviews = job.humanReviews.map((row) =>
    toReportHumanReviewDetail(row, viewerUserId)
  );
  const mine = reviews.find((r) => r.isMine);
  return {
    ...toSummary(job, job.rubric.version, schedule, viewerUserId),
    rubricContent: job.rubric.content,
    ...toFeedbackEmailStatus(job, schedule?.email ?? null),
    reportText: job.reportText,
    reportFilename: job.reportFilename,
    hasReportPdf: Boolean(job.reportBlobUrl),
    resultJson: job.resultJson,
    presentationJobId: job.presentationJobId,
    human: mine
      ? {
          scores: mine.scores,
          total: mine.total,
          comments: mine.comments,
          gradedAt: mine.gradedAt,
          gradedByName: mine.gradedByName,
          aiRevealedAt: mine.aiRevealedAt,
        }
      : emptyHumanGrading(),
    humanReviews: reviews,
    navigation,
  };
}

async function deleteBlobQuietly(url: string | null) {
  if (!url) return;
  try {
    await del(url);
  } catch (error) {
    logger.warn("Report grading: blob cleanup failed", {
      error: (error as Error).message,
    });
  }
}

/**
 * Runs the whole pipeline for one job: load the report, grade it, and store the
 * result. Keeps `reportBlobUrl` so staff can read the PDF side by side during
 * grading; the blob is deleted when the job itself is deleted.
 * Safe to call again on a FAILED job (retry).
 */
export async function processReportJob(id: string): Promise<void> {
  const job = await prisma.reportGradingJob.findUnique({ where: { id } });
  if (!job) throw new Error("Job not found");
  if (job.status === "DONE") return;
  if (job.status === "GRADING") {
    // Another invocation owns it — unless that invocation died. Serverless
    // functions have hard time limits, so anything older than this is stale.
    const staleAfterMs = 15 * 60 * 1000;
    const startedAgo = Date.now() - (job.gradingStartedAt?.getTime() ?? 0);
    if (startedAgo < staleAfterMs) return;
  }

  const startedAt = new Date();
  try {
    await prisma.reportGradingJob.update({
      where: { id },
      data: { status: "GRADING", error: null, gradingStartedAt: startedAt },
    });

    const report = await loadReport(job);
    const suggestions = job.studentId
      ? await latestTopicSuggestionsForStudent(job.studentId)
      : null;
    const { json } = await gradeReport(job, report, suggestions);

    await prisma.reportGradingJob.update({
      where: { id },
      data: {
        status: "DONE",
        resultJson: json,
        presentationJobId: suggestions?.presentationJobId ?? null,
        completedAt: new Date(),
        gradingDurationMs: Date.now() - startedAt.getTime(),
      },
    });
  } catch (error) {
    const message = (error as Error).message;
    logger.error("Report grading job failed", { jobId: id, error: message });
    await prisma.reportGradingJob.update({
      where: { id },
      data: { status: "FAILED", error: message },
    });
  }
}

export interface UpdateReportJobInput {
  title?: string;
  authors?: string | null;
  studentId?: string | null;
}

export async function updateReportJob(
  id: string,
  input: UpdateReportJobInput
): Promise<boolean> {
  const job = await prisma.reportGradingJob.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!job) return false;
  await prisma.reportGradingJob.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.authors !== undefined ? { authors: input.authors } : {}),
      ...(input.studentId !== undefined ? { studentId: input.studentId } : {}),
    },
  });
  return true;
}

/** Hard-deletes the job row and any file still uploaded for it. */
export async function deleteReportJob(id: string): Promise<boolean> {
  const job = await prisma.reportGradingJob.findUnique({
    where: { id },
    select: { reportBlobUrl: true },
  });
  if (!job) return false;
  await prisma.reportGradingJob.delete({ where: { id } });
  await deleteBlobQuietly(job.reportBlobUrl);
  return true;
}

/** Puts a FAILED job back in the queue so `processReportJob` accepts it. */
export async function resetReportJobForRetry(id: string): Promise<boolean> {
  const job = await prisma.reportGradingJob.findUnique({
    where: { id },
    select: { status: true, reportBlobUrl: true, reportText: true },
  });
  if (!job || job.status !== "FAILED") return false;
  if (!job.reportBlobUrl && !job.reportText) return false; // file already deleted
  await prisma.reportGradingJob.update({
    where: { id },
    data: { status: "QUEUED", error: null },
  });
  return true;
}
