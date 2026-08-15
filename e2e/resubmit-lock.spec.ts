import { test, expect } from "@playwright/test";
import { humanGradingStarted } from "../src/lib/services/submission-service";

const auto = (score: number | null) => ({ score, autoGraded: true });
const byHand = (score: number | null) => ({ score, autoGraded: false });

test.describe("what locks a submitted quiz", () => {
  test("auto-graded scores alone leave it editable", () => {
    expect(
      humanGradingStarted({ gradedAt: null, answers: [auto(10), byHand(null)] })
    ).toBe(false);
  });

  test("a grader's score locks it", () => {
    expect(
      humanGradingStarted({ gradedAt: null, answers: [auto(10), byHand(4)] })
    ).toBe(true);
  });

  test("release locks it whatever the answers say", () => {
    expect(
      humanGradingStarted({ gradedAt: new Date(), answers: [auto(10)] })
    ).toBe(true);
  });

  test("an ungraded submission is editable", () => {
    expect(humanGradingStarted({ gradedAt: null, answers: [] })).toBe(false);
  });
});
