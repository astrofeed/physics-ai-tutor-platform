import { test, expect } from "@playwright/test";
import {
  answerKeyChanged,
  unconfirmedKeysMessage,
  unconfirmedQuestionNumbers,
  type AnswerKey,
} from "../src/lib/key-review";

const key = (overrides: Partial<AnswerKey> = {}): AnswerKey => ({
  correctAnswer: "B",
  alsoAcceptedAnswers: [],
  options: ["1.0 A", "2.0 A"],
  tolerance: null,
  ...overrides,
});

test.describe("which questions still block publishing", () => {
  test("only the unconfirmed ones are listed, by question number", () => {
    expect(
      unconfirmedQuestionNumbers([
        { order: 2, keyConfirmedAt: null },
        { order: 0, keyConfirmedAt: new Date() },
        { order: 1, keyConfirmedAt: null },
      ])
    ).toEqual([2, 3]);
  });

  test("a fully reviewed assignment blocks nothing", () => {
    expect(
      unconfirmedQuestionNumbers([{ order: 0, keyConfirmedAt: "2026-08-16T00:00:00.000Z" }])
    ).toEqual([]);
  });

  test("the refusal names the questions to look at", () => {
    expect(unconfirmedKeysMessage([3])).toContain("Question 3");
    expect(unconfirmedKeysMessage([1, 4])).toContain("Questions 1, 4");
  });
});

test.describe("edits that withdraw a confirmation", () => {
  test("a different correct answer does", () => {
    expect(answerKeyChanged(key(), key({ correctAnswer: "C" }))).toBe(true);
  });

  test("accepting one more answer does", () => {
    expect(answerKeyChanged(key(), key({ alsoAcceptedAnswers: ["C"] }))).toBe(true);
  });

  test("rewriting the options does, since the key points at one of them", () => {
    expect(answerKeyChanged(key(), key({ options: ["1.0 A", "3.0 A"] }))).toBe(true);
  });

  test("widening a numeric tolerance does", () => {
    expect(answerKeyChanged(key({ tolerance: 1 }), key({ tolerance: 5 }))).toBe(true);
  });

  test("saving the same key again does not", () => {
    expect(answerKeyChanged(key({ alsoAcceptedAnswers: ["C"] }), key({ alsoAcceptedAnswers: ["C"] }))).toBe(
      false
    );
  });
});
