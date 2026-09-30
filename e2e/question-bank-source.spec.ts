import { test, expect } from "@playwright/test";
import { PRESENTATION_QUESTION_BANK, QUESTION_BANK_SOURCE_URL } from "../src/data/presentation-question-bank";

test("opt-in audit of the snapshot against the current Google document", async ({ request }) => {
  test.skip(process.env.VERIFY_QUESTION_BANK_SOURCE !== "true", "The source document can change independently of a pinned snapshot.");
  const url = new URL(QUESTION_BANK_SOURCE_URL);
  url.pathname = url.pathname.replace(/\/edit$/, "/export");
  url.search = "format=txt";
  const response = await request.get(url.toString());
  expect(response.ok()).toBe(true);
  const lines = (await response.text()).split(/\r?\n/).map((line) => line.trim());
  const expected = [];
  let chapter = 0;
  for (let i = 0; i < lines.length; i++) {
    const heading = /^Topic (\d+):/.exec(lines[i]);
    if (heading) chapter = Number(heading[1]);
    const problem = /^• (.*?)\s+-\s+Track (A \+ B|A|B)$/.exec(lines[i]);
    if (!problem) continue;
    expect(lines[i + 1]).toMatch(/^What to do: /);
    expected.push({ chapter, title: problem[1], track: problem[2], whatToDo: lines[i + 1].slice("What to do: ".length) });
  }
  expect(expected).toHaveLength(143);
  expect(PRESENTATION_QUESTION_BANK.map(({ chapter, title, track, whatToDo }) => ({ chapter, title, track, whatToDo }))).toEqual(expected);
});
