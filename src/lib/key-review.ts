/**
 * Answer-key review rules for assignments built from AI-generated problems.
 *
 * A model writes those keys, and it gets them wrong often enough that students
 * would be marked down for correct work. So such an assignment cannot be
 * published until a human has confirmed every question's key, and any edit to a
 * key withdraws the confirmation it was given for.
 */

export interface KeyReviewQuestion {
  order: number;
  keyConfirmedAt: Date | string | null;
}

/** The answer key as a student's score depends on it. */
export interface AnswerKey {
  correctAnswer: string | null;
  alsoAcceptedAnswers: string[];
  options: string[] | null;
  tolerance: number | null;
}

/** 1-based question numbers still waiting for a confirmation, in display order. */
export function unconfirmedQuestionNumbers(questions: KeyReviewQuestion[]): number[] {
  return questions
    .filter((question) => question.keyConfirmedAt == null)
    .map((question) => question.order + 1)
    .sort((a, b) => a - b);
}

export function unconfirmedKeysMessage(questionNumbers: number[]): string {
  const list = questionNumbers.join(", ");
  return questionNumbers.length === 1
    ? `Question ${list} still needs its answer key confirmed before this assignment can be published.`
    : `Questions ${list} still need their answer keys confirmed before this assignment can be published.`;
}

/**
 * Whether an edit changed anything a score depends on. Wording and images do
 * not invalidate a confirmation; the key, the accepted answers, the options a
 * key points at, and a numeric tolerance all do.
 */
export function answerKeyChanged(before: AnswerKey, after: AnswerKey): boolean {
  return (
    (before.correctAnswer ?? "") !== (after.correctAnswer ?? "") ||
    before.alsoAcceptedAnswers.join("\u0000") !== after.alsoAcceptedAnswers.join("\u0000") ||
    (before.options ?? []).join("\u0000") !== (after.options ?? []).join("\u0000") ||
    (before.tolerance ?? null) !== (after.tolerance ?? null)
  );
}
