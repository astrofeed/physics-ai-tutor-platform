import type { PresentationFormState } from "@/types/presentation-grading";
import type { ResolvedSubmission } from "./SubmissionImport";

export const INITIAL_JOB_FORM: PresentationFormState = {
  topic: "",
  questionBankId: null,
  presenters: "",
  studentIds: "",
  track: "unknown",
  reasoningEffort: "high",
  source: "video",
  video: null,
  transcript: "",
  slides: null,
  submitProblem: null,
  importWarnings: [],
};

const MATERIAL_FIELDS: (keyof PresentationFormState)[] = ["source", "video", "transcript", "slides"];

export function jobFormReducer(
  state: PresentationFormState,
  patch: Partial<PresentationFormState>
): PresentationFormState {
  // A problem with the old video or slides says nothing about the new ones.
  const replacesMaterial = MATERIAL_FIELDS.some((field) => field in patch);
  return { ...state, ...(replacesMaterial ? { submitProblem: null } : {}), ...patch };
}

export function submissionWarnings(submission: ResolvedSubmission): string[] {
  const warnings: string[] = [];
  if (!submission.topicFromRoster) {
    warnings.push(
      `${submission.label} is not in the sign-up sheet — the topic was taken from the video filename. Please check it.`
    );
  }
  if (!submission.slides) {
    warnings.push("No slides in this archive — add them below, or the job is graded from the video only.");
  }
  return warnings;
}
