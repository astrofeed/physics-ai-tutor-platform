import { del } from "@vercel/blob";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isUploadedBlobUrl } from "@/lib/chat-attachments";
import { DEFAULT_PRESENTATION_RUBRIC } from "@/lib/default-presentation-rubric";
import {
  PRESENTATION_GRADING_MODEL,
  studentIdsOf,
  type PresentationJobDetail,
  type PresentationJobSummary,
} from "@/lib/presentation-grading";
import { parseRosterSearch, type JobListFilter, type RosterSearch } from "@/lib/presentation-roster";
import { gradePresentation, loadSlides, transcribeAudio } from "@/lib/services/presentation-grading-ai";
import type { CreatePresentationJobInput, UpdatePresentationJobInput } from "@/types/presentation-grading";
import { logger } from "@/lib/logger";
import { toHumanGrading } from "@/lib/services/human-grading-service";
import { toFeedbackEmailStatus } from "@/lib/services/feedback-email-service";
import {
  rosterScheduleByStudentId,
  rosterStudentIdsMatching,
  type RosterSchedule,
} from "@/lib/services/presentation-roster-service";

/** The current shared rubric; seeds the default on first use. */
export async function getCurrentRubric() {
  const rubric = await prisma.presentationRubric.findFirst({
    orderBy: { version: "desc" },
    include: { updatedBy: { select: { name: true } } },
  });
  if (rubric) return rubric;
  return null;
}

const RUBRIC_HISTORY_LIMIT = 30;

/** Recent rubric versions, newest first, for the editor's history panel. */
export async function listRubricVersions() {
  return prisma.presentationRubric.findMany({
    orderBy: { version: "desc" },
    take: RUBRIC_HISTORY_LIMIT,
    include: { updatedBy: { select: { name: true } } },
  });
}

export async function saveRubric(content: string, userId: string) {
  const latest = await prisma.presentationRubric.findFirst({
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return prisma.presentationRubric.create({
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
  const current = await getCurrentRubric();
  if (current) return current;
  return saveRubric(DEFAULT_PRESENTATION_RUBRIC, userId);
}

export async function createPresentationJob(
  userId: string,
  input: CreatePresentationJobInput
) {
  if (!input.audioBlobUrl && !input.transcript) {
    throw new Error("A recording or a transcript is required");
  }
  if (input.audioBlobUrl && !isUploadedBlobUrl(input.audioBlobUrl)) {
    throw new Error("Audio URL is not an uploaded file");
  }
  if (input.slidesBlobUrl && !isUploadedBlobUrl(input.slidesBlobUrl)) {
    throw new Error("Slides URL is not an uploaded file");
  }
  const rubric = await rubricForNewJob(userId);
  return prisma.presentationGradingJob.create({
    data: {
      topic: input.topic,
      questionBankId: input.questionBankId,
      presenters: input.presenters,
      studentIds: input.studentIds,
      track: input.track,
      audioBlobUrl: input.audioBlobUrl,
      transcript: input.transcript,
      slidesBlobUrl: input.slidesBlobUrl,
      slidesFilename: input.slidesFilename,
      reasoningEffort: input.reasoningEffort,
      model: PRESENTATION_GRADING_MODEL,
      rubricId: rubric.id,
      createdById: userId,
    },
  });
}

type JobRecord = NonNullable<
  Awaited<ReturnType<typeof prisma.presentationGradingJob.findUnique>>
>;

async function rubricVersionOf(rubricId: string): Promise<number | null> {
  const rubric = await prisma.presentationRubric.findUnique({
    where: { id: rubricId },
    select: { version: true },
  });
  return rubric?.version ?? null;
}

/** English name / group / date of the job's first rostered student, resolved at read time so re-imports stay in sync. */
async function scheduleForJobs(
  jobs: { studentIds: string | null }[]
): Promise<(RosterSchedule | null)[]> {
  const schedule = await rosterScheduleByStudentId(jobs.flatMap(studentIdsOf));
  return jobs.map(
    (job) => studentIdsOf(job).map((id) => schedule.get(id)).find((entry) => entry) ?? null
  );
}

function toSummary(
  job: JobRecord & { createdBy?: { name: string | null } },
  rubricVersion: number | null,
  schedule: RosterSchedule | null
): PresentationJobSummary {
  return {
    id: job.id,
    topic: job.topic,
    presenters: job.presenters,
    studentIds: job.studentIds,
    englishName: schedule?.englishName ?? null,
    groupLabel: schedule?.groupLabel ?? null,
    presentationDate: schedule?.presentationDate ?? null,
    track: job.track,
    status: job.status,
    error: job.error,
    totalScore: job.totalScore === null ? null : Number(job.totalScore),
    model: job.model,
    reasoningEffort: job.reasoningEffort,
    gradingDurationMs: job.gradingDurationMs,
    rubricVersion,
    createdByName: job.createdBy?.name ?? null,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}

/** Jobs of exactly the students the roster search names (a group or a date). */
async function rosterJobFilter(search: RosterSearch): Promise<Prisma.PresentationGradingJobWhereInput> {
  const ids = await rosterStudentIdsMatching(search);
  return ids.length > 0
    ? { OR: ids.map((id) => ({ studentIds: { contains: id } })) }
    : { id: { in: [] } };
}

/**
 * A search that names a roster group or date ("Group 1", "9/15") lists exactly
 * those students' jobs; anything else is a substring match on topic,
 * presenters and student IDs.
 */
async function jobSearchFilter(query: string): Promise<Prisma.PresentationGradingJobWhereInput> {
  const rosterSearch = parseRosterSearch(query);
  if (rosterSearch) return rosterJobFilter(rosterSearch);
  return {
    OR: [
      { topic: { contains: query, mode: "insensitive" } },
      { presenters: { contains: query, mode: "insensitive" } },
      { studentIds: { contains: query, mode: "insensitive" } },
    ],
  };
}

export async function listPresentationJobs(
  page: number,
  pageSize: number,
  filter: JobListFilter = {}
) {
  const conditions = await Promise.all([
    ...(filter.query ? [jobSearchFilter(filter.query)] : []),
    ...(filter.group !== undefined
      ? [rosterJobFilter({ kind: "group", number: filter.group })]
      : []),
  ]);
  const where = conditions.length > 0 ? { AND: conditions } : undefined;
  const [jobs, totalCount] = await Promise.all([
    prisma.presentationGradingJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.presentationGradingJob.count({ where }),
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

export async function getPresentationJob(
  id: string
): Promise<PresentationJobDetail | null> {
  const job = await prisma.presentationGradingJob.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      humanGradedBy: { select: { name: true } },
      humanScores: { select: { category: true, score: true } },
    },
  });
  if (!job) return null;
  const [rubricVersion, [schedule]] = await Promise.all([
    rubricVersionOf(job.rubricId),
    scheduleForJobs([job]),
  ]);
  return {
    ...toSummary(job, rubricVersion, schedule),
    ...toFeedbackEmailStatus(job, schedule?.email ?? null),
    questionBankId: job.questionBankId,
    transcript: job.transcript,
    slidesText: job.slidesText,
    slidesFilename: job.slidesFilename,
    partIOutput: job.partIOutput,
    partIIOutput: job.partIIOutput,
    summaryJson: job.summaryJson,
    human: toHumanGrading(
      job,
      job.humanScores.map((row) => ({ name: row.category, score: row.score }))
    ),
  };
}

async function deleteBlobQuietly(url: string | null) {
  if (!url) return;
  try {
    await del(url);
  } catch (error) {
    logger.warn("Presentation grading: blob cleanup failed", {
      error: (error as Error).message,
    });
  }
}

/**
 * Runs the whole pipeline for one job: transcribe, read slides, grade, store
 * results, then delete the uploaded media so nothing heavy is retained.
 * Safe to call again on a FAILED job (retry).
 */
export async function processPresentationJob(id: string): Promise<void> {
  const job = await prisma.presentationGradingJob.findUnique({ where: { id } });
  if (!job) throw new Error("Job not found");
  if (job.status === "DONE") return;
  if (job.status === "TRANSCRIBING" || job.status === "GRADING") {
    // Another invocation owns it — unless that invocation died. Serverless
    // functions have hard time limits, so anything older than this is stale.
    const staleAfterMs = 15 * 60 * 1000;
    const startedAgo = Date.now() - (job.gradingStartedAt?.getTime() ?? 0);
    if (startedAgo < staleAfterMs) return;
  }

  const startedAt = new Date();
  try {
    await prisma.presentationGradingJob.update({
      where: { id },
      data: { status: "TRANSCRIBING", error: null, gradingStartedAt: startedAt },
    });

    if (!job.transcript && !job.audioBlobUrl) {
      throw new Error("This job has neither a transcript nor a recording");
    }
    const transcript = job.transcript ?? (await transcribeAudio(job.audioBlobUrl ?? ""));
    const slides = await loadSlides(job);
    await prisma.presentationGradingJob.update({
      where: { id },
      data: { status: "GRADING", transcript, slidesText: slides.text },
    });

    const { json, evaluation } = await gradePresentation(job, transcript, slides);
    const total = evaluation.totalScore;
    const totalScore = Number.isFinite(total) && total >= 0 && total <= 100 ? total : null;

    await prisma.presentationGradingJob.update({
      where: { id },
      data: {
        status: "DONE",
        summaryJson: json,
        totalScore,
        completedAt: new Date(),
        gradingDurationMs: Date.now() - startedAt.getTime(),
        audioBlobUrl: null,
        slidesBlobUrl: null,
      },
    });
    await deleteBlobQuietly(job.audioBlobUrl);
    await deleteBlobQuietly(job.slidesBlobUrl);
  } catch (error) {
    const message = (error as Error).message;
    logger.error("Presentation grading job failed", { jobId: id, error: message });
    await prisma.presentationGradingJob.update({
      where: { id },
      data: { status: "FAILED", error: message },
    });
  }
}

export async function updatePresentationJob(
  id: string,
  input: UpdatePresentationJobInput
): Promise<boolean> {
  const job = await prisma.presentationGradingJob.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!job) return false;
  await prisma.presentationGradingJob.update({
    where: { id },
    data: {
      ...(input.topic !== undefined ? { topic: input.topic } : {}),
      ...(input.questionBankId !== undefined ? { questionBankId: input.questionBankId } : {}),
      ...(input.presenters !== undefined ? { presenters: input.presenters } : {}),
      ...(input.studentIds !== undefined ? { studentIds: input.studentIds } : {}),
    },
  });
  return true;
}

/** Hard-deletes the job row and any media still uploaded for it. */
export async function deletePresentationJob(id: string): Promise<boolean> {
  const job = await prisma.presentationGradingJob.findUnique({
    where: { id },
    select: { audioBlobUrl: true, slidesBlobUrl: true },
  });
  if (!job) return false;
  await prisma.presentationGradingJob.delete({ where: { id } });
  await deleteBlobQuietly(job.audioBlobUrl);
  await deleteBlobQuietly(job.slidesBlobUrl);
  return true;
}

/** Puts a FAILED job back in the queue so `processPresentationJob` accepts it. */
export async function resetJobForRetry(id: string): Promise<boolean> {
  const job = await prisma.presentationGradingJob.findUnique({
    where: { id },
    select: { status: true, audioBlobUrl: true, transcript: true },
  });
  if (!job || job.status !== "FAILED") return false;
  if (!job.audioBlobUrl && !job.transcript) return false; // media already deleted
  await prisma.presentationGradingJob.update({
    where: { id },
    data: { status: "QUEUED", error: null },
  });
  return true;
}
