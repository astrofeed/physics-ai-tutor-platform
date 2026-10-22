import { test, expect } from "@playwright/test";
import { PRESENTATION_QUESTION_BANK } from "../src/data/presentation-question-bank";
import { findQuestionBankCandidates, normalizeQuestionTitle, resolveQuestionBankMatch } from "../src/lib/question-bank";
import { CreatePresentationJobSchema, UpdatePresentationJobSchema } from "../src/lib/validators/presentation-job";

const YUKAWA_ID = "gp2-f26-v1-01-09";
const YUKAWA_TITLE = "Screened Coulomb forces and the Yukawa form";

test("catalog has all 143 questions with unique permanent IDs and source text", () => {
  expect(PRESENTATION_QUESTION_BANK).toHaveLength(143);
  expect(new Set(PRESENTATION_QUESTION_BANK.map((q) => q.id)).size).toBe(143);
  expect(new Set(PRESENTATION_QUESTION_BANK.map((q) => q.chapter)).size).toBe(12);
  for (const question of PRESENTATION_QUESTION_BANK) {
    expect(question.title.length).toBeLessThanOrEqual(200);
    expect(question.whatToDo.length).toBeGreaterThan(10);
    expect(resolveQuestionBankMatch(question.title, null).question?.id).toBe(question.id);
  }
});

test("normalizes typography without erasing meaningful words or formula symbols", () => {
  expect(normalizeQuestionTitle("  COULOMB’S   law  ")).toBe("coulomb's law");
  expect(normalizeQuestionTitle("R–L circuit")).toBe("r-l circuit");
  expect(normalizeQuestionTitle("p=2h/lambda")).not.toBe(normalizeQuestionTitle("p=h/lambda"));
  expect(normalizeQuestionTitle("R-L")).not.toBe(normalizeQuestionTitle("R-L-C"));
  expect(normalizeQuestionTitle("E<V0")).not.toBe(normalizeQuestionTitle("E>V0"));
});

test("unique exact titles show original instructions without claiming manual confirmation", () => {
  const match = resolveQuestionBankMatch(`  ${YUKAWA_TITLE.toUpperCase()} `, null);
  expect(match.status).toBe("exact");
  expect(match.question?.id).toBe(YUKAWA_ID);
  expect(match.question?.whatToDo).toBe("Compare the ordinary 1/r Coulomb potential with exp(-r/lambda)/r and determine how screening changes forces and long-range behavior.");
});

test("typos rank the right candidate but never attach it automatically", () => {
  const title = "Screened Coulumb forces and Yukawa form";
  expect(findQuestionBankCandidates(title)[0].question.id).toBe(YUKAWA_ID);
  expect(resolveQuestionBankMatch(title, null)).toEqual({ status: "unmatched", question: null });
});

test("shortened titles and chapter numbers do not silently confirm a problem", () => {
  for (const title of ["Topic 8", "Deriving impedance formula R-L circuit Laplace transform", "Coulomb"])
    expect(resolveQuestionBankMatch(title, null).question).toBeNull();
});

test("series/parallel and R-L/R-L-C stay distinct even when nearly identical", () => {
  const circuits = PRESENTATION_QUESTION_BANK.filter((q) => q.id.match(/08-0[4-7]$/));
  expect(circuits).toHaveLength(4);
  for (const question of circuits) {
    expect(resolveQuestionBankMatch(question.title, null).question?.id).toBe(question.id);
    const typo = question.title.replace("impedance", "impedence");
    expect(findQuestionBankCandidates(typo)[0].question.id).toBe(question.id);
    expect(resolveQuestionBankMatch(typo, null).question).toBeNull();
  }
});

test("confirmed ID wins over a renamed title, even another exact title", () => {
  const match = resolveQuestionBankMatch("Rotating-coil generator", YUKAWA_ID);
  expect(match.status).toBe("confirmed");
  expect(match.question?.id).toBe(YUKAWA_ID);
});

test("an unknown saved ID is not replaced by a guess", () => {
  expect(resolveQuestionBankMatch(YUKAWA_TITLE, "unknown-id")).toEqual({ status: "unavailable", question: null });
});

test("blank and unrelated searches produce no suggestions", () => {
  for (const query of ["", "  ", "zzzzzzzzzz", "未知題目"])
    expect(findQuestionBankCandidates(query)).toEqual([]);
});

test("search can find an explicit ID and never returns more than five candidates", () => {
  expect(findQuestionBankCandidates(YUKAWA_ID)[0].question.id).toBe(YUKAWA_ID);
  expect(findQuestionBankCandidates("electric").length).toBeLessThanOrEqual(5);
});

test("job inputs accept known IDs, reject unknown IDs, and preserve legacy input", () => {
  const input = { topic: YUKAWA_TITLE, transcript: "QA transcript" };
  expect(CreatePresentationJobSchema.safeParse(input).success).toBe(true);
  expect(CreatePresentationJobSchema.safeParse({ ...input, questionBankId: YUKAWA_ID }).success).toBe(true);
  expect(UpdatePresentationJobSchema.safeParse({ questionBankId: YUKAWA_ID }).success).toBe(true);
  for (const questionBankId of ["unknown", "x".repeat(81), "", 5]) {
    expect(CreatePresentationJobSchema.safeParse({ ...input, questionBankId }).success).toBe(false);
    expect(UpdatePresentationJobSchema.safeParse({ questionBankId }).success).toBe(false);
  }
  expect(UpdatePresentationJobSchema.parse({ topic: "Renamed" })).not.toHaveProperty("questionBankId");
  expect(UpdatePresentationJobSchema.safeParse({ topic: " " }).success).toBe(false);
  expect(UpdatePresentationJobSchema.safeParse({ questionBankId: null }).success).toBe(true);
});
