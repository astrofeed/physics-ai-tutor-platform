import { test, expect } from "@playwright/test";
import {
  MAX_MC_OPTIONS,
  MIN_MC_OPTIONS,
  compactMcOptions,
  normalizeMcAnswerKey,
} from "../src/lib/mc-answer-key";

test.describe("blank multiple choice options", () => {
  test("trailing blanks are dropped and the answer key is unchanged", () => {
    expect(compactMcOptions(["2 m/s", "4 m/s", "", ""], "B")).toEqual({
      options: ["2 m/s", "4 m/s"],
      correctAnswer: "B",
    });
  });

  test("a blank before the key moves the key to the letter students will see", () => {
    expect(compactMcOptions(["2 m/s", "", "4 m/s", "8 m/s"], "C")).toEqual({
      options: ["2 m/s", "4 m/s", "8 m/s"],
      correctAnswer: "B",
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

  test("a key pointing at a blank option is left alone so saving is rejected", () => {
    expect(compactMcOptions(["2 m/s", "", "4 m/s"], "B").correctAnswer).toBe("B");
    expect(normalizeMcAnswerKey("B", ["2 m/s", "4 m/s"])).toBe("B");
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
