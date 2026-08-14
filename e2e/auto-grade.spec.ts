import { test, expect } from "@playwright/test";
import {
  autoGradeAnswer,
  validateTolerance,
  MAX_TOLERANCE_PERCENT,
  type GradableQuestion,
} from "../src/lib/auto-grade";

const numeric = (overrides: Partial<GradableQuestion> = {}): GradableQuestion => ({
  questionType: "NUMERIC",
  correctAnswer: "9.8",
  points: 10,
  ...overrides,
});

test.describe("numeric auto-grading", () => {
  test("exact value, trailing zeros, whitespace and exponent form all match", () => {
    for (const answer of ["9.8", "9.80", " 9.8 ", "9.8000", "0.98e1"]) {
      expect(autoGradeAnswer(answer, numeric())).toEqual({ autoGraded: true, score: 10 });
    }
  });

  test("without tolerance a different value scores zero", () => {
    expect(autoGradeAnswer("9.81", numeric())).toEqual({ autoGraded: true, score: 0 });
  });

  test("absolute tolerance accepts the boundary and rejects just outside", () => {
    const question = numeric({ tolerance: 0.05, toleranceUnit: "ABSOLUTE" });
    expect(autoGradeAnswer("9.85", question).score).toBe(10);
    expect(autoGradeAnswer("9.75", question).score).toBe(10);
    expect(autoGradeAnswer("9.86", question).score).toBe(0);
  });

  test("percent tolerance scales with the answer key", () => {
    const question = numeric({ correctAnswer: "200", tolerance: 1, toleranceUnit: "PERCENT" });
    expect(autoGradeAnswer("202", question).score).toBe(10);
    expect(autoGradeAnswer("198", question).score).toBe(10);
    expect(autoGradeAnswer("202.1", question).score).toBe(0);
  });

  test("a non-numeric answer scores zero rather than crashing", () => {
    expect(autoGradeAnswer("9.8 m/s^2", numeric())).toEqual({ autoGraded: true, score: 0 });
  });
});

test.describe("multiple choice auto-grading", () => {
  const mc = (): GradableQuestion => ({
    questionType: "MC",
    correctAnswer: "B",
    points: 5,
  });

  test("letter comparison ignores case and whitespace", () => {
    expect(autoGradeAnswer(" b ", mc()).score).toBe(5);
    expect(autoGradeAnswer("C", mc()).score).toBe(0);
  });
});

test("free response is never auto-graded", () => {
  const result = autoGradeAnswer("Energy is conserved because...", {
    questionType: "FREE_RESPONSE",
    correctAnswer: "Reference answer",
    points: 20,
  });
  expect(result).toEqual({ autoGraded: false, score: null });
});

test.describe("tolerance validation", () => {
  test("accepts an unset tolerance and rejects invalid values", () => {
    expect(validateTolerance("NUMERIC", null, "ABSOLUTE")).toBeNull();
    expect(validateTolerance("NUMERIC", 0.5, "ABSOLUTE")).toBeNull();
    expect(validateTolerance("NUMERIC", -1, "ABSOLUTE")).toContain("zero or a positive");
    expect(validateTolerance("NUMERIC", Number.NaN, "ABSOLUTE")).toContain("zero or a positive");
    expect(validateTolerance("MC", 1, "ABSOLUTE")).toContain("numeric questions");
    expect(validateTolerance("NUMERIC", MAX_TOLERANCE_PERCENT + 1, "PERCENT")).toContain(
      "at most"
    );
  });
});
