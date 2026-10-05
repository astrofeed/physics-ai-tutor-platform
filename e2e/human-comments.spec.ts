import { test, expect } from "@playwright/test";
import { HumanScoresInputSchema } from "../src/lib/human-grading";

for (const scores of [{ total: 85 }, { scores: [{ name: "Physics", score: 40 }] }]) {
  test.describe(`optional human comments: ${"total" in scores ? "total" : "per item"}`, () => {
    test("keeps comments alongside scores", () => {
      const input = { ...scores, comments: '推導缺少假設, 請說明「小角度」。\nCheck the units.' };
      expect(HumanScoresInputSchema.parse(input)).toEqual(input);
    });

    test("allows omitted and empty comments", () => {
      expect(HumanScoresInputSchema.parse(scores)).toEqual(scores);
      expect(HumanScoresInputSchema.parse({ ...scores, comments: "" })).toEqual({
        ...scores, comments: "",
      });
    });

    test("limits comments to 10,000 characters", () => {
      expect(HumanScoresInputSchema.safeParse({ ...scores, comments: "x".repeat(10_000) }).success).toBe(true);
      expect(HumanScoresInputSchema.safeParse({ ...scores, comments: "x".repeat(10_001) }).success).toBe(false);
    });

    test("rejects non-text comments", () => {
      for (const comments of [null, 123, {}, []]) {
        expect(HumanScoresInputSchema.safeParse({ ...scores, comments }).success).toBe(false);
      }
    });
  });
}
