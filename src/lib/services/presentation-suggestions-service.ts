/**
 * Finds the report-topic suggestions the presentation AI made for a student,
 * so the written-report grader can check whether the report acted on them.
 */

import { prisma } from "@/lib/prisma";
import {
  parseEvaluation,
  studentIdsOf,
  type TopicSuggestions,
} from "@/lib/presentation-grading";

export interface PresentationSuggestionsSource {
  presentationJobId: string;
  topic: string;
  suggestions: TopicSuggestions;
}

/** Candidates whose free-text presenter field merely contains the ID; the exact match is checked in code. */
const CANDIDATE_LIMIT = 10;

/**
 * The most recently completed presentation of this student that produced
 * topic suggestions; null when they have none (unrostered, older grading
 * output, or the talk has not been graded yet).
 */
export async function latestTopicSuggestionsForStudent(
  studentId: string
): Promise<PresentationSuggestionsSource | null> {
  const candidates = await prisma.presentationGradingJob.findMany({
    where: { status: "DONE", studentIds: { contains: studentId } },
    orderBy: { completedAt: "desc" },
    take: CANDIDATE_LIMIT,
    select: { id: true, topic: true, studentIds: true, summaryJson: true },
  });
  for (const job of candidates) {
    if (!studentIdsOf(job).includes(studentId)) continue;
    const suggestions = parseEvaluation(job.summaryJson)?.topicSuggestions;
    if (suggestions && suggestions.options.length > 0) {
      return { presentationJobId: job.id, topic: job.topic, suggestions };
    }
  }
  return null;
}
