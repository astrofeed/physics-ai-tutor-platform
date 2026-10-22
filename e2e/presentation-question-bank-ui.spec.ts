import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { loginAsTestUser } from "./helpers";
import { QUESTION_BANK_SOURCE_URL } from "../src/data/presentation-question-bank";
import { DEFAULT_ROSTER_SHEET_URL } from "../src/lib/presentation-roster";

const databaseUrl = process.env.QUESTION_BANK_TEST_DATABASE_URL;
const YUKAWA_ID = "gp2-f26-v1-01-09";
const YUKAWA_TITLE = "Screened Coulomb forces and the Yukawa form";
const YUKAWA_TEXT = "Compare the ordinary 1/r Coulomb potential with exp(-r/lambda)/r and determine how screening changes forces and long-range behavior.";
const EVALUATION = JSON.stringify({
  summary: "The student compares screened and unscreened Coulomb forces.",
  scorecard: [{ category: "Physics", maxPoints: 100, awardedPoints: 82, provisional: false, justification: "Correct limiting case." }],
  totalScore: 82, physicsErrorLog: [], requiredElements: [], verifyInPerson: [], flags: [], strengths: [],
  guidingQuestions: [], qaQuestions: [], reportAdvice: "Explore the long-range limit.", topicSuggestions: null,
});
let prisma: PrismaClient;
let staff: { id: string; email: string };
let student: { id: string; email: string };
let rubricId: string;

test.use({ baseURL: process.env.QUESTION_BANK_TEST_BASE_URL ?? "http://localhost:3900" });
test.skip(!databaseUrl, "Set QUESTION_BANK_TEST_DATABASE_URL to a local question_bank_qa scratch database.");

test.beforeAll(async () => {
  const url = new URL(databaseUrl!);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/question_bank_qa") {
    throw new Error("Question Bank UI tests require the local question_bank_qa scratch database");
  }
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const suffix = `${Date.now()}`;
  staff = await prisma.user.create({ data: { email: `qb-ta-${suffix}@e2e.local`, name: "Question Bank QA", role: "TA" } });
  student = await prisma.user.create({ data: { email: `qb-student-${suffix}@e2e.local`, role: "STUDENT" } });
  const latest = await prisma.presentationRubric.findFirst({ orderBy: { version: "desc" } });
  const rubric = await prisma.presentationRubric.create({ data: { version: (latest?.version ?? 0) + 1, content: "QA rubric", updatedById: staff.id } });
  rubricId = rubric.id;
  await prisma.presentationRoster.create({ data: { sourceUrl: DEFAULT_ROSTER_SHEET_URL, importedById: staff.id } });
});

test.afterAll(async () => { await prisma?.$disconnect(); });

async function createJob(topic: string, questionBankId: string | null = null) {
  return prisma.presentationGradingJob.create({ data: {
    topic, questionBankId, presenters: "QA Presenter", createdById: staff.id, rubricId,
    status: "DONE", summaryJson: EVALUATION, totalScore: 82, humanTotal: 87,
    transcript: "QA transcript", slidesFilename: "qa-slides.pdf", completedAt: new Date(), aiRevealedAt: new Date(),
  } });
}

test("exact titles show source text, persist confirmation, and keep scores intact", async ({ page }, testInfo) => {
  const job = await createJob(YUKAWA_TITLE);
  await loginAsTestUser(page.context(), staff.email);
  await page.goto(`/presentation-grading/${job.id}`);
  const section = page.getByRole("region", { name: "What to do" });
  await expect(section.getByText(YUKAWA_TEXT, { exact: true })).toBeVisible();
  await expect(section.getByText("Exact title match · not yet confirmed")).toBeVisible();
  await expect(section.getByRole("link", { name: "View original document" })).toHaveAttribute("href", QUESTION_BANK_SOURCE_URL);
  await section.getByRole("button", { name: "Confirm problem", exact: true }).click();
  await expect(section.getByText("Confirmed problem", { exact: true })).toBeVisible();
  await page.reload();
  await expect(section.getByText("Confirmed problem", { exact: true })).toBeVisible();
  const saved = await prisma.presentationGradingJob.findUniqueOrThrow({ where: { id: job.id } });
  expect(saved.questionBankId).toBe(YUKAWA_ID);
  expect(saved.summaryJson).toBe(EVALUATION);
  expect(Number(saved.totalScore)).toBe(82);
  expect(Number(saved.humanTotal)).toBe(87);
  expect(saved.status).toBe("DONE");
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("confirmed-desktop.png") });
});

test("typo requires selection, cancellation does not save, and renaming preserves the link", async ({ page }, testInfo) => {
  const job = await createJob("Screened Coulumb forces and Yukawa form");
  await loginAsTestUser(page.context(), staff.email);
  await page.goto(`/presentation-grading/${job.id}`);
  const section = page.getByRole("region", { name: "What to do" });
  await expect(section.getByText(YUKAWA_TEXT, { exact: true })).toHaveCount(0);
  await section.getByRole("button", { name: "Choose Question Bank problem" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Confirm problem", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: new RegExp(YUKAWA_TITLE) }).click();
  await expect(dialog.getByText(YUKAWA_TEXT, { exact: false })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await prisma.presentationGradingJob.findUniqueOrThrow({ where: { id: job.id } })).questionBankId).toBeNull();
  await section.getByRole("button", { name: "Choose Question Bank problem" }).click();
  await dialog.getByRole("button", { name: new RegExp(YUKAWA_TITLE) }).click();
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("candidate-desktop.png") });
  await dialog.getByRole("button", { name: "Confirm problem", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(section.getByText(YUKAWA_TEXT, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Question Bank problem / topic").fill("Renamed talk on screening");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Renamed talk on screening");
  await page.reload();
  await expect(section.getByText(YUKAWA_TEXT, { exact: true })).toBeVisible();
  expect((await prisma.presentationGradingJob.findUniqueOrThrow({ where: { id: job.id } })).questionBankId).toBe(YUKAWA_ID);
});

test("failed save keeps the old link and allows retry; empty search browses the catalog", async ({ page }) => {
  const job = await createJob(YUKAWA_TITLE, YUKAWA_ID);
  await loginAsTestUser(page.context(), staff.email);
  await page.goto(`/presentation-grading/${job.id}`);
  await page.getByRole("button", { name: "Change linked problem" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Search Question Bank").fill("zzzzzzzzzz");
  await expect(dialog.getByText(/No close matches/)).toBeVisible();
  await dialog.getByLabel("Search Question Bank").fill("");
  await expect(dialog.getByRole("listitem")).toHaveCount(143);
  await dialog.getByLabel("Search Question Bank").fill("Rotating-coil generator");
  await dialog.getByRole("button", { name: /Rotating-coil generator/ }).click();
  await page.route(`**/api/presentation-grading/jobs/${job.id}`, async (route) => {
    if (route.request().method() === "PATCH") await route.fulfill({ status: 500, json: { error: "QA save failure" } });
    else await route.continue();
  });
  await dialog.getByRole("button", { name: "Confirm problem", exact: true }).click();
  await expect(page.getByText("Could not save the problem. Your previous selection has not changed.")).toBeVisible();
  await expect(dialog).toBeVisible();
  expect((await prisma.presentationGradingJob.findUniqueOrThrow({ where: { id: job.id } })).questionBankId).toBe(YUKAWA_ID);
  await page.unroute(`**/api/presentation-grading/jobs/${job.id}`);
  await dialog.getByRole("button", { name: "Confirm problem", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("region", { name: "What to do" })).toContainText("Derive sinusoidal emf");
});

for (const width of [375, 768]) {
  test(`result and picker fit ${width}px with keyboard selection`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const job = await createJob("Deriving the impedence formula for series R-L circuit using Laplace transform");
    await loginAsTestUser(page.context(), staff.email);
    await page.goto(`/presentation-grading/${job.id}`);
    await page.getByRole("button", { name: "Choose Question Bank problem" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /series R-L circuit/ }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toContainText("Set up the series R-L circuit equation");
    await page.screenshot({ animations: "disabled", path: testInfo.outputPath(`picker-${width}.png`) });
    await dialog.getByRole("button", { name: "Confirm problem", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("region", { name: "What to do" })).toContainText("Set up the series R-L circuit equation");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ animations: "disabled", path: testInfo.outputPath(`result-${width}.png`) });
  });
}

test("new job saves the selected ID without changing a custom title or running AI", async ({ page }) => {
  await loginAsTestUser(page.context(), staff.email);
  await page.route("**/api/presentation-grading/jobs/*/process", (route) => route.fulfill({ status: 202, json: { data: { ok: true } } }));
  await page.goto("/presentation-grading");
  await page.getByLabel("Question Bank problem / topic").fill("My screened Coulomb talk");
  await page.getByLabel("Presenter name").fill("QA Presenter");
  await page.getByRole("button", { name: "Choose Question Bank problem" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Search Question Bank").fill("Yukawa");
  await dialog.getByRole("button", { name: new RegExp(YUKAWA_TITLE) }).click();
  await dialog.getByRole("button", { name: "Confirm problem", exact: true }).click();
  await page.getByRole("button", { name: "Paste transcript" }).click();
  await page.getByLabel("Transcript", { exact: true }).fill("A short local QA transcript.");
  const created = page.waitForResponse((response) => response.url().endsWith("/api/presentation-grading/jobs") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Start grading", exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const { data } = await response.json();
  const job = await prisma.presentationGradingJob.findUniqueOrThrow({ where: { id: data.id } });
  expect(job.questionBankId).toBe(YUKAWA_ID);
  expect(job.topic).toBe("My screened Coulomb talk");
  expect(job.status).toBe("QUEUED");
  expect(job.summaryJson).toBeNull();
});

test("API rejects unknown IDs and students cannot change links", async ({ page, browser, baseURL }) => {
  const job = await createJob(YUKAWA_TITLE, YUKAWA_ID);
  await loginAsTestUser(page.context(), staff.email);
  const response = await page.request.patch(`/api/presentation-grading/jobs/${job.id}`, { data: { questionBankId: "unknown-id" } });
  expect(response.status()).toBe(400);
  const invalidCreate = await page.request.post("/api/presentation-grading/jobs", { data: { topic: "QA", transcript: "QA", questionBankId: "unknown-id" } });
  expect(invalidCreate.status()).toBe(400);
  const studentContext = await browser.newContext({ baseURL });
  await loginAsTestUser(studentContext, student.email);
  const forbidden = await studentContext.request.patch(`/api/presentation-grading/jobs/${job.id}`, { data: { questionBankId: "gp2-f26-v1-07-05" } });
  expect(forbidden.status()).toBe(403);
  await studentContext.close();
  expect((await prisma.presentationGradingJob.findUniqueOrThrow({ where: { id: job.id } })).questionBankId).toBe(YUKAWA_ID);
});

test("results search, pagination, empty state, and detail navigation still work", async ({ page }) => {
  const prefix = `QBRegression${Date.now()}`;
  await Promise.all(Array.from({ length: 21 }, (_, index) => createJob(`${prefix} talk-${String(index).padStart(2, "0")}`)));
  await loginAsTestUser(page.context(), staff.email);
  await page.goto("/presentation-grading");
  const search = page.getByRole("textbox", { name: "Search by presenter name, student ID, problem/topic, group or presentation date" });
  const rows = page.getByRole("link", { name: new RegExp(prefix) });
  const filtered = page.waitForResponse((response) => new URL(response.url()).searchParams.get("q") === prefix);
  await search.fill(prefix);
  await filtered;
  await expect(rows).toHaveCount(20);
  await page.getByRole("button", { name: "2", exact: true }).click();
  await expect(rows).toHaveCount(1);
  await search.fill(`${prefix} talk-07`);
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("talk-07");
  await rows.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${prefix} talk-07`);
  await page.getByRole("link", { name: "All jobs", exact: true }).click();
  await search.fill(`${prefix} nonexistent`);
  await expect(page.getByRole("heading", { name: "No matching results" })).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Results/ })).toBeVisible();
});

test("rubric saves a new version, refreshes history, and leaves existing jobs unchanged", async ({ page }, testInfo) => {
  const job = await createJob(YUKAWA_TITLE, YUKAWA_ID);
  const content = `QA regression rubric ${Date.now()}. ` + "Assess correct physics and a clear derivation. ".repeat(4);
  await loginAsTestUser(page.context(), staff.email);
  await page.goto("/presentation-grading");
  await page.getByRole("button", { name: "Rubric", exact: true }).click();
  const editor = page.locator("textarea");
  await expect(editor).toHaveValue("QA rubric");
  let releaseHistory!: () => void;
  let markCaptured!: () => void;
  const release = new Promise<void>((resolve) => { releaseHistory = resolve; });
  const captured = new Promise<void>((resolve) => { markCaptured = resolve; });
  let historyReads = 0;
  await page.route("**/api/presentation-grading/rubric/history", async (route) => {
    if (++historyReads !== 1) return route.continue();
    const response = await route.fetch();
    const body = await response.json();
    markCaptured();
    await release;
    await route.fulfill({ json: body, headers: { "x-qa-stale-history": "true" } });
  });
  await page.getByRole("button", { name: "Version history", exact: true }).click();
  await captured;
  await editor.fill(content);
  await page.getByRole("button", { name: "Save as new version", exact: true }).click();
  await expect(page.getByText(/Rubric saved as version/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save as new version", exact: true })).toBeDisabled();
  const latest = await prisma.presentationRubric.findFirstOrThrow({ orderBy: { version: "desc" } });
  expect(latest.content).toBe(content);
  const staleHistory = page.waitForResponse((response) => response.headers()["x-qa-stale-history"] === "true");
  releaseHistory();
  await (await staleHistory).finished();
  const currentVersion = page.getByRole("listitem").filter({ hasText: `v${latest.version}current` });
  await expect(currentVersion).toBeVisible();
  await currentVersion.scrollIntoViewIfNeeded();
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("rubric-history.png") });
  await page.reload();
  await page.getByRole("button", { name: "Rubric", exact: true }).click();
  await expect(editor).toHaveValue(content);
  const saved = await prisma.presentationGradingJob.findUniqueOrThrow({ where: { id: job.id } });
  expect(saved.rubricId).toBe(job.rubricId);
  expect(saved.summaryJson).toBe(EVALUATION);
  expect(saved.questionBankId).toBe(YUKAWA_ID);
});

test("blank-title selection fills the canonical title and dark mode stays readable", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await loginAsTestUser(page.context(), staff.email);
  await page.goto("/presentation-grading");
  await page.getByRole("button", { name: "Choose Question Bank problem" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Search Question Bank").fill("Yukawa");
  await dialog.getByRole("button", { name: new RegExp(YUKAWA_TITLE) }).click();
  await dialog.getByRole("button", { name: "Confirm problem", exact: true }).click();
  await expect(page.getByLabel("Question Bank problem / topic")).toHaveValue(YUKAWA_TITLE);
  const job = await createJob(YUKAWA_TITLE, YUKAWA_ID);
  await page.goto(`/presentation-grading/${job.id}`);
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("region", { name: "What to do" })).toContainText(YUKAWA_TEXT);
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("confirmed-dark.png") });
});

test("anonymous access is denied and unknown saved IDs never fall back to a matching title", async ({ page, browser, baseURL }) => {
  const job = await createJob(YUKAWA_TITLE, "unavailable-snapshot-id");
  const anonymous = await browser.newContext({ baseURL });
  expect((await anonymous.request.get(`/api/presentation-grading/jobs/${job.id}`)).status()).toBe(401);
  expect((await anonymous.request.patch(`/api/presentation-grading/jobs/${job.id}`, { data: { questionBankId: YUKAWA_ID } })).status()).toBe(401);
  await anonymous.close();
  await loginAsTestUser(page.context(), student.email);
  await page.goto(`/presentation-grading/${job.id}`);
  await expect(page.getByRole("heading", { name: "This page is for course staff" })).toBeVisible();
  await loginAsTestUser(page.context(), staff.email);
  await page.reload();
  const section = page.getByRole("region", { name: "What to do" });
  await expect(section).toContainText("The saved problem is unavailable");
  await expect(section.getByText(YUKAWA_TEXT, { exact: true })).toHaveCount(0);
});

test("an older polling response cannot undo a newly confirmed problem", async ({ page }) => {
  const job = await createJob(YUKAWA_TITLE);
  await prisma.presentationGradingJob.update({ where: { id: job.id }, data: { status: "GRADING" } });
  await loginAsTestUser(page.context(), staff.email);
  let readCount = 0;
  let releaseResponse!: () => void;
  let markCaptured!: () => void;
  const release = new Promise<void>((resolve) => { releaseResponse = resolve; });
  const captured = new Promise<void>((resolve) => { markCaptured = resolve; });
  await page.route(`**/api/presentation-grading/jobs/${job.id}`, async (route) => {
    if (route.request().method() !== "GET" || ++readCount !== 2) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const body = await response.json();
    markCaptured();
    await release;
    await route.fulfill({ json: body, headers: { "x-qa-stale": "true" } });
  });
  await page.goto(`/presentation-grading/${job.id}`);
  const section = page.getByRole("region", { name: "What to do" });
  await expect(section).toContainText("Exact title match");
  await captured;
  await section.getByRole("button", { name: "Confirm problem", exact: true }).click();
  await expect(section.getByText("Confirmed problem", { exact: true })).toBeVisible();
  const staleResponse = page.waitForResponse((response) => response.headers()["x-qa-stale"] === "true");
  releaseResponse();
  await (await staleResponse).finished();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(section.getByText("Confirmed problem", { exact: true })).toBeVisible({ timeout: 1000 });
  expect((await prisma.presentationGradingJob.findUniqueOrThrow({ where: { id: job.id } })).questionBankId).toBe(YUKAWA_ID);
});
