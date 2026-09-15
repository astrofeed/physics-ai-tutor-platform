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

function bulleted(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function joinSections(sections: (string | false | null)[]): string {
  return sections.filter((section): section is string => Boolean(section)).join("\n\n");
}

function topicSuggestionsText(
  suggestions: NonNullable<PresentationEvaluation["topicSuggestions"]>
): string {
  const lead =
    suggestions.verdict === "revise"
      ? "Before extending, please revise the report first: "
      : "Your report is on solid ground: ";
  const options = suggestions.options
    .map((option, i) => `${i + 1}. ${option.title}\n   ${option.direction}\n   Why: ${option.rationale}`)
    .join("\n");
  return `Suggested report topics\n${lead}${suggestions.assessment}\n\n${options}`;
}

/** Student-facing draft: summary, strengths, questions, report advice and topic suggestions. */
export function presentationFeedbackDraft(
  topic: string,
  evaluation: PresentationEvaluation,
  student: DraftStudent
): FeedbackDraft {
  const guiding = evaluation.guidingQuestions
    .map((group) => `${group.reference}\n${bulleted(group.questions)}`)
    .join("\n\n");
  return {
    subject: `Feedback on your presentation: ${topic}`,
    message: joinSections([
      greeting(student.name),
      `Here is the feedback on your presentation "${topic}".`,
      `Summary\n${evaluation.summary}`,
      evaluation.strengths.length > 0 && `What you did well\n${bulleted(evaluation.strengths)}`,
      guiding && `Questions to think about\n${guiding}`,
      `Advice for the report\n${evaluation.reportAdvice}`,
      evaluation.topicSuggestions && topicSuggestionsText(evaluation.topicSuggestions),
      signature(student.senderName),
    ]),
  };
}

/** Student-facing draft: summary and the evidence-referenced comments. */
export function reportFeedbackDraft(
  title: string,
  evaluation: ReportEvaluation,
  student: DraftStudent
): FeedbackDraft {
  const comments = evaluation.comments
    .map((comment) => `- ${comment.comment} (${comment.reference})`)
    .join("\n");
  return {
    subject: `Feedback on your report: ${title}`,
    message: joinSections([
      greeting(student.name),
      `Here is the feedback on your written report "${title}".`,
      `Summary\n${evaluation.summary}`,
      comments && `Comments\n${comments}`,
      signature(student.senderName),
    ]),
  };
}
