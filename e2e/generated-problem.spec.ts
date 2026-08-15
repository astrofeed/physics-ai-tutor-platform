import { test, expect } from "@playwright/test";
import { autoGradeAnswer } from "../src/lib/auto-grade";
import {
  GENERATED_NUMERIC_TOLERANCE_PERCENT,
  generatedTolerance,
  keyContradictsSolution,
  mcKeyFromValue,
  problemPreview,
  stripOptionLabels,
} from "../src/lib/generated-problem";

test.describe("resolving an MC key from the answer's value", () => {
  const options = ["1.20 A", "2.00 A", "3.00 A", "4.00 A"];

  test("the value wins over the letter the model states", () => {
    expect(mcKeyFromValue("2.00 A", options)).toBe("B");
  });

  test("LaTeX and spacing differences still match", () => {
    expect(mcKeyFromValue("$2.00\\ \\mathrm{A}$", options)).toBe("B");
  });

  test("a value matching no option leaves the caller with the stated letter", () => {
    expect(mcKeyFromValue("2.5 A", options)).toBeNull();
    expect(mcKeyFromValue("", options)).toBeNull();
  });

  test("an ambiguous partial match is refused", () => {
    expect(mcKeyFromValue("1", ["1 A", "1 mA", "2 A"])).toBeNull();
  });
});

test.describe("keys that contradict their own solution", () => {
  const options = ["11.0 V", "10.9 V", "8.10 V", "9.00 V"];
  const solution = "Terminal voltage: $V = 12.0 - (1.00)(1.00) = 11.0\\ \\mathrm{V}$";

  test("a key on a value the solution never derives is flagged", () => {
    expect(
      keyContradictsSolution({ questionType: "MC", options, correctAnswer: "B", solution })
    ).toBe(true);
  });

  test("a key the solution derives is not flagged", () => {
    expect(
      keyContradictsSolution({ questionType: "MC", options, correctAnswer: "A", solution })
    ).toBe(false);
  });

  test("numeric keys are checked against the solution too", () => {
    expect(
      keyContradictsSolution({ questionType: "NUMERIC", correctAnswer: "20.6", solution: "…gives 20.6 m" })
    ).toBe(false);
    expect(
      keyContradictsSolution({ questionType: "NUMERIC", correctAnswer: "20.6", solution: "…gives 24.0 m" })
    ).toBe(true);
  });

  test("a value the solution explicitly rejects does not count as support", () => {
    expect(
      keyContradictsSolution({
        questionType: "MC",
        options: ["0.900 A", "1.20 A", "1.80 A", "3.00 A"],
        correctAnswer: "B",
        solution:
          "The total current is $1.636\\ \\mathrm{A}$, so the correct option is 1.80 A, not 1.20 A.",
      })
    ).toBe(true);
  });

  test("a rejected value in an earlier sentence does not silence a later derivation", () => {
    expect(
      keyContradictsSolution({
        questionType: "NUMERIC",
        correctAnswer: "1.80",
        solution: "This is not a series circuit. The current is therefore 1.80 A.",
      })
    ).toBe(false);
  });

  test("nothing to compare means no flag", () => {
    expect(
      keyContradictsSolution({
        questionType: "MC",
        options: ["north", "south"],
        correctAnswer: "A",
        solution: "The field points north.",
      })
    ).toBe(false);
    expect(
      keyContradictsSolution({ questionType: "FREE_RESPONSE", correctAnswer: "9.8", solution: "" })
    ).toBe(false);
  });
});

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
