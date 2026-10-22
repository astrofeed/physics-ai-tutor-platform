import { randomUUID } from "node:crypto";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { presentationJobsToCsv, reportJobsToCsv } from "../src/lib/grading-csv";
import { parseCsv, DEFAULT_ROSTER_SHEET_URL } from "../src/lib/presentation-roster";
import type { PresentationEvaluation, PresentationJobDetail } from "../src/lib/presentation-grading";
import type { ReportEvaluation, ReportJobDetail } from "../src/lib/report-grading";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
test.use({ baseURL });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const runId = randomUUID();
const professorEmail = `comments-professor-${runId}@e2e.local`;
const studentEmail = `comments-student-${runId}@e2e.local`;
const comments = '推導缺少假設, 請說明「小角度」。\nCheck the "units" in the final equation.';
const jobs = { presentation: "", report: "" };
const presentation: PresentationEvaluation = {
  summary: "The model is appropriate, but the assumptions and units need clarification.",
  scorecard: [{ category: "Physics", maxPoints: 100, awardedPoints: 82, provisional: false, justification: "Check assumptions and units." }],
  totalScore: 82,
  physicsErrorLog: [], requiredElements: [], verifyInPerson: [], flags: [], strengths: [],
  guidingQuestions: [], qaQuestions: [], reportAdvice: "State the assumptions.", topicSuggestions: null,
};
const report: ReportEvaluation = {
  summary: "Check the assumptions in the derivation.", comments: [],
  criterionScores: [{ criterion: "Physics", weightPercent: 100, score: 8, reason: "Check assumptions." }],
  suggestionChecks: null,
};

async function readJob(request: APIRequestContext, url: string) {
  const response = await request.get(url);
  expect(response.ok()).toBe(true);
  const body: { data: PresentationJobDetail | ReportJobDetail } = await response.json();
  return body.data;
}

function jobToCsv(job: PresentationJobDetail | ReportJobDetail) {
  return "topic" in job ? presentationJobsToCsv([job]) : reportJobsToCsv([job]);
}

test.beforeAll(async () => {
  const professor = await prisma.user.create({ data: { name: "Professor Comments QA", email: professorEmail, role: "PROFESSOR" } });
  await prisma.user.create({ data: { name: "Comments Student QA", email: studentEmail, role: "STUDENT" } });
  const [presentationVersion, reportVersion] = await Promise.all([
    prisma.presentationRubric.aggregate({ _max: { version: true } }),
    prisma.reportRubric.aggregate({ _max: { version: true } }),
  ]);
  const presentationRubric = await prisma.presentationRubric.create({ data: {
    version: (presentationVersion._max.version ?? 0) + 1, content: "Comments QA rubric", updatedById: professor.id,
  } });
  const reportRubric = await prisma.reportRubric.create({ data: {
    version: (reportVersion._max.version ?? 0) + 1, content: "Comments QA rubric", updatedById: professor.id,
  } });
  await prisma.presentationRoster.create({ data: { sourceUrl: DEFAULT_ROSTER_SHEET_URL, importedById: professor.id } });
  const presentationJob = await prisma.presentationGradingJob.create({ data: {
    topic: `Comments QA ${runId}`, presenters: "QA Student", status: "DONE", rubricId: presentationRubric.id,
    createdById: professor.id, summaryJson: JSON.stringify(presentation), totalScore: 82,
  } });
  const reportJob = await prisma.reportGradingJob.create({ data: {
    title: `Comments QA ${runId}`, authors: "QA Student", status: "DONE", rubricId: reportRubric.id,
    createdById: professor.id, resultJson: JSON.stringify(report),
  } });
  jobs.presentation = presentationJob.id;
  jobs.report = reportJob.id;
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "e2e-test-user-email", value: professorEmail, url: baseURL }]);
});

for (const kind of ["presentation", "report"] as const) {
  test(`${kind}: optional comments persist, edit, cancel and clear`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const total = kind === "presentation" ? "85" : "8.5";
    const itemScore = kind === "presentation" ? "80" : "8";
    await page.goto(`/${kind}-grading/${jobs[kind]}`);
    const input = page.getByLabel("Comments (optional)");
    const save = page.getByRole("button", { name: "Save scores and comments" });
    const edit = page.getByRole("button", { name: "Edit scores and comments" });
    await expect(input).toBeVisible({ timeout: 30_000 });
    await expect(input).not.toHaveAttribute("required", "");
    await expect(input).toHaveAttribute("maxlength", "10000");
    await page.locator("#human-total").fill(total);
    await save.click();
    await expect(edit).toBeVisible();
    await page.reload();
    await edit.click();
    await expect(input).toHaveValue("");
    await input.fill(comments);
    await save.click();
    await expect(page.getByRole("region", { name: "Your comments" })).toContainText(comments);
    await page.reload();
    await expect(page.getByRole("region", { name: "Your comments" })).toContainText(comments);
    await edit.click();
    await expect(input).toHaveValue(comments);
    await input.fill("Unsaved change");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("region", { name: "Your comments" })).toContainText(comments);
    await edit.click();
    await page.getByRole("radio", { name: "Per item" }).click();
    await expect(input).toHaveValue(comments);
    await page.locator('[id="human-score-Physics"]').fill(itemScore);
    await input.fill(`${comments}\nExplain the limiting case.`);
    await save.click();
    await page.reload();
    await expect(page.getByRole("region", { name: "Your comments" })).toContainText("Explain the limiting case.");
    await edit.click();
    for (const width of [1280, 768, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await input.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`comments-${width}.png`) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await input.fill("");
    await save.click();
    await page.reload();
    await expect(edit).toBeVisible();
    await expect(page.getByRole("region", { name: "Your comments" })).toHaveCount(0);
    await edit.click();
    await expect(input).toHaveValue("");
  });

  test(`${kind}: API retains omitted comments and CSV round-trips text`, async ({ context }) => {
    const request = context.request;
    const url = `/api/${kind}-grading/jobs/${jobs[kind]}`;
    const total = kind === "presentation" ? 86 : 8.6;
    expect((await request.put(`${url}/human-scores`, { data: { total, comments } })).ok()).toBe(true);
    const initial = await readJob(request, url);
    expect(initial.human.comments).toBe(comments);
    expect((await request.put(`${url}/human-scores`, { data: { total: total - 1 } })).ok()).toBe(true);
    const saved = await readJob(request, url);
    expect(saved.human.comments).toBe(comments);
    expect(saved.human.gradedAt).toBe(initial.human.gradedAt);
    const csv = jobToCsv(saved);
    const [headers, row] = parseCsv(csv.replace(/^\uFEFF/, ""));
    expect(row).toHaveLength(headers.length);
    expect(row[headers.indexOf("Human comments")]).toBe(comments);
    for (const unsafe of ["=1+1", "+1+1", "-1+1", "@SUM(1)", "\t=1+1", "\n=1+1", "  =1+1"]) {
      saved.human.comments = unsafe;
      const protectedCsv = jobToCsv(saved);
      expect(parseCsv(protectedCsv.replace(/^\uFEFF/, ""))[1][headers.indexOf("Human comments")]).toBe(`'${unsafe}`);
    }
    for (const blank of [null, ""]) {
      saved.human.comments = blank;
      const blankCsv = jobToCsv(saved);
      expect(parseCsv(blankCsv.replace(/^\uFEFF/, ""))[1][headers.indexOf("Human comments")]).toBe("");
    }
    expect((await request.put(`${url}/human-scores`, { data: { total, comments: "x".repeat(10_001) } })).status()).toBe(400);
    expect((await request.put(`${url}/human-scores`, { data: { total: 1000, comments: "Must not save" } })).status()).toBe(400);
    expect((await readJob(request, url)).human.comments).toBe(comments);
    expect((await request.put(`${url}/human-scores`, { data: { total, comments: "  \n " } })).ok()).toBe(true);
    expect((await readJob(request, url)).human.comments).toBeNull();
  });

  test(`${kind}: downloaded CSV includes professor comments`, async ({ page, context }) => {
    const total = kind === "presentation" ? 85 : 8.5;
    const response = await context.request.put(`/api/${kind}-grading/jobs/${jobs[kind]}/human-scores`, {
      data: { total, comments },
    });
    expect(response.ok()).toBe(true);
    await page.goto(`/${kind}-grading`);
    await page.getByRole("checkbox", { name: `Select Comments QA ${runId} for CSV export` }).check();
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV (1)", exact: true }).click();
    const download = await downloading;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const [header, row] = parseCsv(Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, ""));
    expect(row[header.indexOf("Human comments")]).toBe(comments);
  });

  test(`${kind}: students cannot read or change staff comments`, async ({ context }) => {
    const request = context.request;
    await context.addCookies([{ name: "e2e-test-user-email", value: studentEmail, url: baseURL }]);
    const url = `/api/${kind}-grading/jobs/${jobs[kind]}`;
    expect((await request.get(url)).status()).toBe(403);
    expect((await request.put(`${url}/human-scores`, { data: { total: 5, comments: "Not allowed" } })).status()).toBe(403);
    await context.clearCookies();
    expect((await request.get(url)).status()).toBe(401);
    expect((await request.put(`${url}/human-scores`, { data: { total: 5 } })).status()).toBe(401);
  });
}

test("failed save keeps the professor's comment draft", async ({ page, context }) => {
  await context.request.put(`/api/presentation-grading/jobs/${jobs.presentation}/human-scores`, { data: { total: 85 } });
  await page.goto(`/presentation-grading/${jobs.presentation}`);
  await page.getByRole("button", { name: "Edit scores and comments" }).click();
  await page.getByLabel("Comments (optional)").fill(comments);
  await page.route("**/human-scores", (route) => route.fulfill({ status: 500, json: { error: "Save failed for test" } }));
  await page.getByRole("button", { name: "Save scores and comments" }).click();
  await expect(page.getByText("Save failed for test", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Comments (optional)")).toHaveValue(comments);
});
