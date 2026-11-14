/**
 * Outcome of submitting a grading job. `problem` is the sentence to show the
 * grader; callers keep it on screen until it is dismissed or fixed, because a
 * toast disappears before it can be read.
 */
export type JobSubmitResult = { ok: true } | { ok: false; problem: string };
