import { test, expect } from "@playwright/test";
import { autoGradeAnswer } from "../src/lib/auto-grade";
import {
  GENERATED_NUMERIC_TOLERANCE_PERCENT,
  generatedTolerance,
  problemPreview,
  stripOptionLabels,
} from "../src/lib/generated-problem";

test.describe("option labels the model writes into the option text", () => {
  test("a label matching the option's own position is dropped", () => {
    expect(stripOptionLabels(["A. 0.50 A", "B. 1.0 A", "C) 2.0 A", "(D) 4.0 A"])).toEqual([
      "0.50 A",
      "1.0 A",
      "2.0 A",
      "4.0 A",
    ]);
  });

  test("unlabelled options are left alone", () => {
    expect(stripOptionLabels(["0.50 A", "1.0 A"])).toEqual(["0.50 A", "1.0 A"]);
  });

  test("a letter that is the answer, not a label, survives", () => {
    // "B. " on the first option is content, not that option's label.
    expect(stripOptionLabels(["B. is the correct choice", "A"])).toEqual([
      "B. is the correct choice",
      "A",
    ]);
  });
});

test.describe("tolerance for generated questions", () => {
  test("a generated numeric answer accepts correctly rounded work", () => {
    const question = {
      questionType: "NUMERIC",
      correctAnswer: "0.834",
      points: 20,
      ...generatedTolerance("NUMERIC"),
    };
    expect(autoGradeAnswer("0.83", question).score).toBe(20);
    expect(autoGradeAnswer("0.9", question).score).toBe(0);
  });

  test("only numeric questions get a tolerance", () => {
    expect(generatedTolerance("MC")).toEqual({ tolerance: null, toleranceUnit: "ABSOLUTE" });
    expect(generatedTolerance("NUMERIC")).toEqual({
      tolerance: GENERATED_NUMERIC_TOLERANCE_PERCENT,
      toleranceUnit: "PERCENT",
    });
  });
});

test.describe("staging list preview", () => {
  test("markdown and math are reduced to readable text", () => {
    expect(problemPreview("**Problem 3 (Voltage divider)**: find $V_2$ when $R_1 = 2\\ \\Omega$")).toBe(
      "Problem 3 (Voltage divider): find … when …"
    );
  });

  test("long text is cut at the limit", () => {
    expect(problemPreview("a".repeat(200))).toHaveLength(121);
  });
});
