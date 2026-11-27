import { prisma } from "@/lib/prisma";
import { DEFAULT_REPORT_RUBRIC } from "@/lib/default-report-rubric";
import { isUploadedBlobUrl } from "@/lib/chat-attachments";
import { hasWeightedReportCriteria, REPORT_GRADING_MODEL, RUBRIC_WEIGHT_HINT, type ReportReasoningEffort } from "@/lib/report-grading";

export async function getCurrentReportRubric() {
  return prisma.reportRubric.findFirst({
    orderBy: { version: "desc" },
    include: { updatedBy: { select: { name: true } } },
  });
}

export async function listReportRubricVersions() {
  return prisma.reportRubric.findMany({
    orderBy: { version: "desc" },
    take: 30,
    include: { updatedBy: { select: { name: true } } },
  });
}

export async function saveReportRubric(content: string, userId: string) {
  const latest = await prisma.reportRubric.findFirst({
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return prisma.reportRubric.create({
    data: { content, version: (latest?.version ?? 0) + 1, updatedById: userId },
    include: { updatedBy: { select: { name: true } } },
  });
}

export interface CreateReportJobInput {
  title: string;
  authors?: string;
  studentId?: string;
  assignedQuestion?: string;
  reportBlobUrl?: string;
  reportFilename?: string;
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
  const rubric = (await getCurrentReportRubric()) ?? await saveReportRubric(DEFAULT_REPORT_RUBRIC, userId);
  if (!hasWeightedReportCriteria(rubric.content)) throw new Error(`Update the grading rubric first. ${RUBRIC_WEIGHT_HINT}`);
  return prisma.reportGradingJob.create({
    data: {
      ...input,
      model: REPORT_GRADING_MODEL,
      rubricId: rubric.id,
      createdById: userId,
    },
  });
}
