import { del } from "@vercel/blob";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isUploadedBlobUrl } from "@/lib/chat-attachments";
import { DEFAULT_REPORT_RUBRIC } from "@/lib/default-report-rubric";
import {
  REPORT_GRADING_MODEL,
  type ReportJobDetail,
  type ReportJobSummary,
  type ReportReasoningEffort,
} from "@/lib/report-grading";
import { logger } from "@/lib/logger";
import { parseRosterSearch } from "@/lib/presentation-roster";
import { toHumanGrading } from "@/lib/services/human-grading-service";
import { gradeReport, loadReport } from "@/lib/services/report-grading-ai";
import {
  rosterScheduleByStudentId,
  rosterStudentIdsMatching,
  type RosterSchedule,
} from "@/lib/services/presentation-roster-service";

/** The current shared report rubric, or null before the first save. */
export async function getCurrentReportRubric() {
  return prisma.reportRubric.findFirst({
    orderBy: { version: "desc" },
    include: { updatedBy: { select: { name: true } } },
  });
}

const RUBRIC_HISTORY_LIMIT = 30;

/** Recent rubric versions, newest first, for the editor's history panel. */
export async function listReportRubricVersions() {
  return prisma.reportRubric.findMany({
    orderBy: { version: "desc" },
    take: RUBRIC_HISTORY_LIMIT,
    include: { updatedBy: { select: { name: true } } },
  });
}

export async function saveReportRubric(content: string, userId: string) {
  const latest = await prisma.reportRubric.findFirst({
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return prisma.reportRubric.create({
    data: {
      content,
      version: (latest?.version ?? 0) + 1,
      updatedById: userId,
    },
    include: { updatedBy: { select: { name: true } } },
  });
}

/** The rubric a new job grades with, creating the seed version if needed. */
async function rubricForNewJob(userId: string) {
  const current = await getCurrentReportRubric();
  if (current) return current;
  return saveReportRubric(DEFAULT_REPORT_RUBRIC, userId);
}

export interface CreateReportJobInput {
  title: string;
  authors?: string;
  studentId?: string;
  assignedQuestion?: string;
  reportBlobUrl?: string;
  reportFilename?: string;
  /** A report the grader pasted directly instead of uploading a PDF. */
  reportText?: string;
  reasoningEffort: ReportReasoningEffort;
}

export async function createReportJob(userId: string, input: CreateReportJobInput) {
  if (!input.reportBlobUrl && !input.reportText) {
    throw new Error("A report PDF or pasted report text is required");
  }
  if (input.reportBlobUrl && !isUploadedBlobUrl(input.reportBlobUrl)) {
    throw new Error("Report URL is not an uploaded file");
  }
  const rubric = await rubricForNewJob(userId);
  return prisma.reportGradingJob.create({
    data: {
      title: input.title,
      authors: input.authors,
      studentId: input.studentId,
      assignedQuestion: input.assignedQuestion,
      reportBlobUrl: input.reportBlobUrl,
      reportFilename: input.reportFilename,
      reportText: input.reportText,
      reasoningEffort: input.reasoningEffort,
      model: REPORT_GRADING_MODEL,
      rubricId: rubric.id,
      createdById: userId,
    },
  });
}

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

/** Group / date from the sign-up sheet, resolved at read time so re-imports stay in sync. */
async function scheduleForJobs(
  jobs: { studentId: string | null }[]
): Promise<(RosterSchedule | null)[]> {
  const ids = jobs.map((job) => job.studentId).filter((id): id is string => id !== null);
  const schedule = await rosterScheduleByStudentId(ids);
  return jobs.map((job) => (job.studentId ? schedule.get(job.studentId) ?? null : null));
}

function toSummary(
  job: JobRecord & { createdBy?: { name: string | null } },
  rubricVersion: number | null,
  schedule: RosterSchedule | null
): ReportJobSummary {
  return {
    id: job.id,
    title: job.title,
    authors: job.authors,
    studentId: job.studentId,
    assignedQuestion: job.assignedQuestion,
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
  };
}

/**
 * A search that names a roster group or date ("Group 1", "9/15") lists exactly
 * those students' reports; anything else is a substring match on title,
 * authors and student ID.
 */
async function jobSearchFilter(query: string): Promise<Prisma.ReportGradingJobWhereInput> {
  if (parseRosterSearch(query)) {
    const ids = await rosterStudentIdsMatching(query);
    return ids.length > 0 ? { studentId: { in: ids } } : { id: { in: [] } };
  }
  return {
    OR: [
      { title: { contains: query, mode: "insensitive" } },
      { authors: { contains: query, mode: "insensitive" } },
      { studentId: { contains: query, mode: "insensitive" } },
    ],
  };
}

export async function listReportJobs(page: number, pageSize: number, query?: string) {
  const where = query ? await jobSearchFilter(query) : undefined;
  const [jobs, totalCount] = await Promise.all([
    prisma.reportGradingJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.reportGradingJob.count({ where }),
  ]);
  const [versions, schedules] = await Promise.all([
    Promise.all(jobs.map((j) => rubricVersionOf(j.rubricId))),
    scheduleForJobs(jobs),
  ]);
  return {
    jobs: jobs.map((job, i) => toSummary(job, versions[i], schedules[i])),
    totalCount,
  };
}

export async function getReportJob(id: string): Promise<ReportJobDetail | null> {
  const job = await prisma.reportGradingJob.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      humanGradedBy: { select: { name: true } },
      humanScores: { select: { criterion: true, score: true } },
    },
  });
  if (!job) return null;
  const [version, [schedule]] = await Promise.all([
    rubricVersionOf(job.rubricId),
    scheduleForJobs([job]),
  ]);
  return {
    ...toSummary(job, version, schedule),
    reportText: job.reportText,
    reportFilename: job.reportFilename,
    resultJson: job.resultJson,
    human: toHumanGrading(
      job,
      job.humanScores.map((row) => ({ name: row.criterion, score: row.score }))
    ),
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
 * Runs the whole pipeline for one job: load the report, grade it, store the
 * result, then delete the uploaded file so nothing heavy is retained.
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
    const { json } = await gradeReport(job, report);

    await prisma.reportGradingJob.update({
      where: { id },
      data: {
        status: "DONE",
        resultJson: json,
        completedAt: new Date(),
        gradingDurationMs: Date.now() - startedAt.getTime(),
        reportBlobUrl: null,
      },
    });
    await deleteBlobQuietly(job.reportBlobUrl);
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
