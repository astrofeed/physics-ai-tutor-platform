import { test, expect } from "@playwright/test";
import type { GradableQuestion } from "../src/lib/auto-grade";
import {
  plannedRescores,
  totalAfterRescores,
  type AnswerToRegrade,
} from "../src/lib/services/regrade-service";
import { draftPredatesGrade } from "../src/hooks/useGradingDrafts";

const questions = new Map<string, GradableQuestion>([
  ["q1", { questionType: "MC", correctAnswer: "A", alsoAcceptedAnswers: ["B"], points: 10 }],
  ["q2", { questionType: "MC", correctAnswer: "C", points: 10 }],
  ["q3", { questionType: "FREE_RESPONSE", correctAnswer: null, points: 10 }],
]);

const answer = (overrides: Partial<AnswerToRegrade>): AnswerToRegrade => ({
  id: "a1",
  questionId: "q1",
  answer: "B",
  score: 0,
  autoGraded: true,
  hasResolvedAppeal: false,
  ...overrides,
});

test.describe("re-running auto-grading", () => {
  test("an answer that the widened key now accepts is raised to full marks", () => {
    expect(plannedRescores([answer({})], questions)).toEqual([
      { id: "a1", from: 0, to: 10 },
    ]);
  });

  test("a score a grader edited by hand is never re-scored", () => {
    expect(plannedRescores([answer({ autoGraded: false })], questions)).toEqual([]);
  });

  test("answers already matching the key are left untouched", () => {
    expect(plannedRescores([answer({ score: 10 })], questions)).toEqual([]);
  });

  test("a corrected key can also lower a score", () => {
    const lowered = plannedRescores(
      [answer({ questionId: "q2", answer: "A", score: 10 })],
      questions
    );
    expect(lowered).toEqual([{ id: "a1", from: 10, to: 0 }]);
  });

  test("free response and answers to deleted questions are skipped", () => {
    const skipped = [
      answer({ id: "free", questionId: "q3", answer: "Because energy is conserved" }),
      answer({ id: "gone", questionId: "deleted-question" }),
    ];
    expect(plannedRescores(skipped, questions)).toEqual([]);
  });

  test("a score granted by a resolved appeal is never re-scored", () => {
    expect(
      plannedRescores([answer({ score: 10, hasResolvedAppeal: true })], questions)
    ).toEqual([]);
  });

  test("the new total keeps every score the re-grade did not touch", () => {
    const answers = [
      answer({ id: "auto", score: 0 }),
      answer({ id: "byHand", questionId: "q3", score: 7, autoGraded: false }),
    ];
    const rescores = plannedRescores(answers, questions);
    expect(totalAfterRescores(answers, rescores, 7)).toBe(17);
  });

  test("an overall grade entered by hand keeps its offset from the answer sum", () => {
    const answers = [answer({ id: "auto", score: 0 })];
    const rescores = plannedRescores(answers, questions);
    // Released with an override of 5 while the answers sum to 0; +10 from the
    // re-grade lands on 15, not on the bare per-question sum of 10.
    expect(totalAfterRescores(answers, rescores, 5)).toBe(15);
  });

  test("with no stored total the answer sum is the starting point", () => {
    const answers = [answer({ id: "auto", score: 0 }), answer({ id: "kept", score: 10 })];
    expect(totalAfterRescores(answers, plannedRescores(answers, questions), null)).toBe(20);
  });
});

test.describe("stored grading drafts against server scores", () => {
  const savedAt = Date.parse("2026-08-16T10:00:00.000Z");

  test("a draft older than the grade is stale", () => {
    expect(draftPredatesGrade(savedAt, "2026-08-16T10:05:00.000Z")).toBe(true);
  });

  test("work done since the grade is kept", () => {
    expect(draftPredatesGrade(savedAt, "2026-08-16T09:55:00.000Z")).toBe(false);
  });

  test("an ungraded submission keeps its draft", () => {
    expect(draftPredatesGrade(savedAt, null)).toBe(false);
  });

  test("an unparseable timestamp is not treated as a newer grade", () => {
    expect(draftPredatesGrade(savedAt, "not a date")).toBe(false);
  });
});
