import { test, expect } from "@playwright/test";
import {
  overallGradePayload,
  overrideConfirmAction,
  sumQuestionScores,
} from "../src/lib/grade-release";
import type { OverallGradeState } from "../src/components/grading/types";

const blank: OverallGradeState = { score: null, feedback: "", confirmed: false };

test.describe("overall grade override", () => {
  test("an untouched overall field cannot release a score", () => {
    expect(overallGradePayload(blank)).toBeNull();
    expect(overrideConfirmAction(blank, 14, "per-question")).toBe("reject-blank");
  });

  test("a score that differs from the per-question total warns first", () => {
    const state = { ...blank, score: 0 };
    expect(overrideConfirmAction(state, 14, "per-question")).toBe("warn-differs");
    expect(overrideConfirmAction({ ...state, score: 14 }, 14, "per-question")).toBe("confirm");
  });

  test("overall-only grading needs no comparison warning", () => {
    expect(overrideConfirmAction({ ...blank, score: 32 }, 0, "overall")).toBe("confirm");
  });

  test("confirming again clears the override", () => {
    expect(overrideConfirmAction({ score: 40, feedback: "", confirmed: true }, 14, "per-question")).toBe(
      "clear"
    );
  });

  test("only a confirmed, non-null score is sent to the server", () => {
    expect(overallGradePayload({ score: 40, feedback: "ok", confirmed: false })).toBeNull();
    expect(overallGradePayload({ score: null, feedback: "ok", confirmed: true })).toBeNull();
    expect(overallGradePayload({ score: 40, feedback: "ok", confirmed: true })).toEqual({
      overallScore: 40,
      overallFeedback: "ok",
    });
  });
});

test("per-question total ignores non-numeric entries", () => {
  expect(sumQuestionScores([{ score: 8 }, { score: 6 }])).toBe(14);
  expect(sumQuestionScores([{ score: 8 }, { score: Number.NaN }])).toBe(8);
});
