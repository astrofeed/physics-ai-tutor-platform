import { expect, test } from "@playwright/test";
import { DEFAULT_REPORT_RUBRIC } from "../src/lib/default-report-rubric";
import { canManageReview } from "../src/lib/human-score-validation";
import { parseReportEvaluation, reportRubricCriteria } from "../src/lib/report-grading";

test("only the complete bound rubric can produce an AI total", () => {
  const expected = reportRubricCriteria(DEFAULT_REPORT_RUBRIC);
  expect(expected).toHaveLength(7);
  const scores = expected.map(({ name, weight }) => ({
    criterion: name, weightPercent: weight, score: 8, reason: "Synthetic evidence",
  }));
  const parse = (criterionScores: typeof scores, rubric = DEFAULT_REPORT_RUBRIC) =>
    parseReportEvaluation(JSON.stringify({ summary: "Review", comments: [], criterionScores }), rubric);
  expect(parse(scores)?.criterionScores).toEqual(scores);
  expect(parse(scores, "No weighted headings")?.criterionScores).toBeNull();
  for (const invalid of [
    scores.slice(0, 1), [], [{ ...scores[0], weightPercent: 100 }],
    scores.map((s, i) => i === 1 ? scores[0] : s),
    scores.map((s, i) => ({ ...s, weightPercent: scores[(i + 1) % scores.length].weightPercent })),
    scores.map((s, i) => ({ ...s, criterion: i === 0 ? "Wrong" : s.criterion })),
  ]) {
    expect(parse(invalid)).toMatchObject({ summary: "Review", criterionScores: null });
  }
  const custom = [{ ...scores[0], criterion: "Interpretation", weightPercent: 100 }];
  expect(parse(custom, "### Interpretation (100%)")?.criterionScores).toEqual(custom);
});

test("review edits and deletes share the same ownership policy", () => {
  expect(canManageReview("first", "first", "TA")).toBe(true);
  expect(canManageReview("first", "second", "TA")).toBe(false);
  expect(canManageReview("first", "second")).toBe(false);
  for (const role of ["PROFESSOR", "ADMIN"]) expect(canManageReview("first", "second", role)).toBe(true);
});
