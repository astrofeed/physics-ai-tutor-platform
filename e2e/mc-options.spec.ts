import { test, expect } from "@playwright/test";
import {
  MAX_MC_OPTIONS,
  MIN_MC_OPTIONS,
  compactMcOptions,
  keysAfterOptionRemoval,
  normalizeMcAnswerKey,
} from "../src/lib/mc-answer-key";
import { applyQuestionEdit } from "../src/hooks/use-question-list";
import type { QuestionFormData } from "../src/types/assignment";

test.describe("blank multiple choice options", () => {
  test("trailing blanks are dropped and the answer key is unchanged", () => {
    expect(compactMcOptions(["2 m/s", "4 m/s", "", ""], "B")).toEqual({
      options: ["2 m/s", "4 m/s"],
      correctAnswer: "B",
      alsoAcceptedAnswers: [],
    });
  });

  test("a blank before the key moves the key to the letter students will see", () => {
    expect(compactMcOptions(["2 m/s", "", "4 m/s", "8 m/s"], "C")).toEqual({
      options: ["2 m/s", "4 m/s", "8 m/s"],
      correctAnswer: "B",
      alsoAcceptedAnswers: [],
    });
  });

  test("keys written as option text or a 1-based number survive compaction", () => {
    expect(compactMcOptions(["2 m/s", "", "4 m/s"], "4 m/s").correctAnswer).toBe("B");
    expect(compactMcOptions(["2 m/s", "", "4 m/s"], "3").correctAnswer).toBe("B");
  });

  test("whitespace-only options count as blank", () => {
    expect(compactMcOptions(["2 m/s", "   ", "4 m/s"], "A").options).toEqual([
      "2 m/s",
      "4 m/s",
    ]);
  });

  test("a key pointing at a blank option comes back empty so saving is rejected", () => {
    expect(compactMcOptions(["2 m/s", "", "4 m/s"], "B").correctAnswer).toBe("");
  });
});

test.describe("more than one accepted answer", () => {
  test("extra keys move with their option and drop the canonical duplicate", () => {
    expect(compactMcOptions(["2 m/s", "", "4 m/s", "8 m/s"], "C", ["D", "C"])).toEqual({
      options: ["2 m/s", "4 m/s", "8 m/s"],
      correctAnswer: "B",
      alsoAcceptedAnswers: ["C"],
    });
  });

  test("an extra key written as option text normalizes to a letter", () => {
    expect(
      compactMcOptions(["2 m/s", "4 m/s", "8 m/s"], "A", ["8 m/s"]).alsoAcceptedAnswers
    ).toEqual(["C"]);
  });

  test("an extra key pointing at a blank option is not re-pointed at its neighbour", () => {
    expect(
      compactMcOptions(["2 m/s", "", "4 m/s"], "A", ["B"]).alsoAcceptedAnswers
    ).toEqual([]);
  });
});

test.describe("deleting one option while editing", () => {
  test("letters after the deleted option shift down", () => {
    expect(keysAfterOptionRemoval(["2", "4", "8", "16"], 1, "C", ["D"])).toEqual({
      correctAnswer: "B",
      alsoAcceptedAnswers: ["C"],
    });
  });

  test("letters before the deleted option stay put", () => {
    expect(keysAfterOptionRemoval(["2", "4", "8"], 2, "A", ["B"])).toEqual({
      correctAnswer: "A",
      alsoAcceptedAnswers: ["B"],
    });
  });

  test("the deleted option's own key comes back empty", () => {
    expect(keysAfterOptionRemoval(["2", "4", "8"], 1, "B").correctAnswer).toBe("");
  });

  test("a blank option left earlier in the list does not move the key", () => {
    expect(keysAfterOptionRemoval(["", "O2", "O3", "O4"], 1, "D").correctAnswer).toBe("C");
  });
});

test.describe("changing a question's type", () => {
  const mcQuestion: QuestionFormData = {
    questionText: "Which is fastest?",
    questionType: "MC",
    options: ["2 m/s", "4 m/s"],
    correctAnswer: "A",
    alsoAcceptedAnswers: ["B"],
    points: 10,
    tolerance: null,
    toleranceUnit: "ABSOLUTE",
  };

  test("MC letters are dropped when the question becomes numeric", () => {
    expect(applyQuestionEdit(mcQuestion, "questionType", "NUMERIC")).toMatchObject({
      questionType: "NUMERIC",
      correctAnswer: "",
      alsoAcceptedAnswers: [],
    });
  });

  test("numeric values and tolerance are dropped when the question becomes MC", () => {
    const numeric: QuestionFormData = {
      ...mcQuestion,
      questionType: "NUMERIC",
      correctAnswer: "0.834",
      alsoAcceptedAnswers: ["0.83"],
      tolerance: 1,
      toleranceUnit: "PERCENT",
    };
    expect(applyQuestionEdit(numeric, "questionType", "MC")).toMatchObject({
      correctAnswer: "",
      alsoAcceptedAnswers: [],
      tolerance: null,
    });
  });

  test("editing another field keeps the answer key", () => {
    expect(applyQuestionEdit(mcQuestion, "points", 5)).toMatchObject({
      points: 5,
      correctAnswer: "A",
      alsoAcceptedAnswers: ["B"],
    });
  });
});

test.describe("answer keys across option counts", () => {
  test("the shortest and longest allowed lists both normalize", () => {
    const shortest = Array.from({ length: MIN_MC_OPTIONS }, (_, i) => `option ${i + 1}`);
    const longest = Array.from({ length: MAX_MC_OPTIONS }, (_, i) => `option ${i + 1}`);

    expect(normalizeMcAnswerKey("2", shortest)).toBe("B");
    expect(normalizeMcAnswerKey(`option ${MAX_MC_OPTIONS}`, longest)).toBe("H");
    expect(normalizeMcAnswerKey("H", shortest)).toBeNull();
  });
});
