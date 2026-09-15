/**
 * Emailing the AI's feedback to a student from a grading result page. Pure
 * helpers shared by the dialog (draft text) and the API (input validation).
 */

import { z } from "zod";
import type { PresentationEvaluation } from "@/lib/presentation-grading";
import type { ReportEvaluation } from "@/lib/report-grading";

export const FEEDBACK_EMAIL_SUBJECT_MAX = 500;
export const FEEDBACK_EMAIL_MESSAGE_MAX = 10_000;

export const FeedbackEmailInputSchema = z.object({
  to: z.string().trim().toLowerCase().email().max(200),
  subject: z.string().trim().min(1).max(FEEDBACK_EMAIL_SUBJECT_MAX),
  message: z.string().trim().min(1).max(FEEDBACK_EMAIL_MESSAGE_MAX),
});

export type FeedbackEmailInput = z.infer<typeof FeedbackEmailInputSchema>;

/** Where the feedback last went; both null until staff send it once. */
export interface FeedbackEmailStatus {
  /** Student's address from the sign-up sheet; null when the ID is not rostered or the sheet has no email. */
  studentEmail: string | null;
  feedbackSentAt: string | null;
  feedbackSentTo: string | null;
}

export interface FeedbackDraft {
  subject: string;
  message: string;
}

/** `GET …/feedback-email`: the draft, and whether a model rewrote it as a letter (false = raw template). */
export interface FeedbackDraftResponse {
  draft: FeedbackDraft;
  rewritten: boolean;
}

export interface DraftStudent {
  name: string | null;
  senderName: string;
}

function greeting(name: string | null): string {
  return name ? `Hi ${name},` : "Hi,";
}

function signature(senderName: string): string {
  return `Best regards,\n${senderName}`;
}

function joinSections(sections: (string | false | null)[]): string {
  return sections.filter((section): section is string => Boolean(section)).join("\n\n");
}

function topicSuggestionsText(
  suggestions: NonNullable<PresentationEvaluation["topicSuggestions"]>
): string {
  const lead =
    suggestions.verdict === "revise"
      ? "For the written report, please address the points above first. "
      : "For the written report, you are in a good position to go further. ";
  const options = suggestions.options
    .map((option, i) => `${i + 1}. ${option.title} — ${option.direction}`)
    .join("\n");
  return `${lead}${suggestions.assessment} A few directions you could take:\n${options}`;
}

/**
 * Template draft (summary + suggested report directions, no section labels).
 * The API normally replaces the middle with a model-written letter; this is
 * what staff see when no model is available.
 */
export function presentationFeedbackDraft(
  topic: string,
  evaluation: PresentationEvaluation,
  student: DraftStudent
): FeedbackDraft {
  return {
    subject: `Feedback on your presentation: ${topic}`,
    message: joinSections([
      greeting(student.name),
      `Here is my feedback on your presentation "${topic}".`,
      evaluation.summary,
      evaluation.topicSuggestions && topicSuggestionsText(evaluation.topicSuggestions),
      signature(student.senderName),
    ]),
  };
}

/** Template draft for a report: the summary alone. */
export function reportFeedbackDraft(
  title: string,
  evaluation: ReportEvaluation,
  student: DraftStudent
): FeedbackDraft {
  return {
    subject: `Feedback on your report: ${title}`,
    message: joinSections([
      greeting(student.name),
      `Here is my feedback on your written report "${title}".`,
      evaluation.summary,
      signature(student.senderName),
    ]),
  };
}
