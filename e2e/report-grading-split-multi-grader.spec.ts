import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { reportJobsToCsv } from "../src/lib/grading-csv";
import { parseCsv, DEFAULT_ROSTER_SHEET_URL } from "../src/lib/presentation-roster";
import type { ReportEvaluation, ReportJobDetail } from "../src/lib/report-grading";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
test.use({ baseURL });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const runId = randomUUID();
const ta1Email = `split-ta1-${runId}@e2e.local`;
const ta2Email = `split-ta2-${runId}@e2e.local`;
const profEmail = `split-prof-${runId}@e2e.local`;

/** Builds a tiny valid 2-page PDF with selectable text so pdfjs-dist renders and highlights it. */
function buildSamplePdf(): Buffer {
  const page1Stream =
    "BT /F1 14 Tf 50 720 Td (General Physics II: Faraday Induction Report) Tj 0 -28 Td (We derive the induced EMF from Faraday law and Lenz rule.) Tj ET";
  const page2Stream =
    "BT /F1 14 Tf 50 720 Td (Section 2: Sanity Check and Limiting Case) Tj 0 -28 Td (The magnetic flux decays exponentially in the high resistance limit.) Tj ET";

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 7 0 R >> >> >>\nendobj\n",
    "4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(page1Stream)} >>\nstream\n${page1Stream}\nendstream\nendobj\n`,
    `6 0 obj\n<< /Length ${Buffer.byteLength(page2Stream)} >>\nstream\n${page2Stream}\nendstream\nendobj\n`,
    "7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

const sampleEvaluation: ReportEvaluation = {
  summary: "Solid derivation of Faraday's law with a clear high-resistance limiting case.",
  comments: [
    {
      reference: "Section 1, p. 1",
      comment: "Clear physical setup connecting Faraday's law and Lenz's rule.",
      page: 1,
      quote: "induced EMF from Faraday law",
      category: "strength",
      evidenceKind: "Text", criterion: "Physics correctness", needsStaffCheck: false,
    },
    {
      reference: "Section 2, p. 2",
      comment: "Check the time constant definition when stating exponential decay.",
      page: 2,
      quote: "magnetic flux decays exponentially",
      category: "issue",
      evidenceKind: "Text", criterion: "Sanity checks", needsStaffCheck: false,
    },
    {
      reference: "Section 1, p. 1",
      comment: "Uniform textbook phrasing; verify student understanding during Q&A.",
      page: 1,
      quote: "General Physics II: Faraday Induction Report",
      category: "ai_style",
      evidenceKind: null, criterion: null, needsStaffCheck: false,
    },
    {
      reference: "Page 2, hand-written limiting case", page: 2, quote: null, category: "note",
      comment: "Check the sign of the exponent against the original.",
      evidenceKind: "Equation", criterion: "Sanity checks", needsStaffCheck: true,
    },
  ],
  criterionScores: [
    {
      criterion: "Physics correctness",
      weightPercent: 60,
      score: 8.5,
      reason: "Core laws are stated accurately.",
    },
    {
      criterion: "Sanity checks",
      weightPercent: 40,
      score: 7.5,
      reason: "High-resistance limit is mentioned but needs a time constant check.",
    },
  ],
  suggestionChecks: [
    { suggestion: "Compare coil geometries", status: "not_addressed", evidence: "Not pursued." },
    { suggestion: "Investigate the resistance limit", status: "completed", evidence: "Section 2 derives the limiting case." },
  ],
};

let jobAId = "";
let jobBId = "";

test.beforeAll(async () => {
  const [ta1] = await Promise.all([
    prisma.user.create({ data: { name: "TA Alpha", email: ta1Email, role: "TA" } }),
    prisma.user.create({ data: { name: "TA Beta", email: ta2Email, role: "TA" } }),
    prisma.user.create({ data: { name: "Prof Gamma", email: profEmail, role: "PROFESSOR" } }),
  ]);
  const maxVer = await prisma.reportRubric.aggregate({ _max: { version: true } });
  const rubric = await prisma.reportRubric.create({
    data: {
      version: (maxVer._max.version ?? 0) + 1,
      content: "### Physics correctness (60%)\n### Sanity checks (40%)",
      updatedById: ta1.id,
    },
  });
  await prisma.presentationRoster.create({
    data: { sourceUrl: DEFAULT_ROSTER_SHEET_URL, importedById: ta1.id },
  });

  const now = Date.now();
  const older = await prisma.reportGradingJob.create({
    data: {
      title: `Faraday Report B ${runId}`,
      authors: "Student B",
      status: "DONE",
      reportBlobUrl: "https://example.public.blob.vercel-storage.com/faraday-b.pdf",
      reportFilename: "faraday-b.pdf",
      rubricId: rubric.id,
      createdById: ta1.id,
      resultJson: JSON.stringify(sampleEvaluation),
      createdAt: new Date(now + 10_000),
    },
  });
  const newer = await prisma.reportGradingJob.create({
    data: {
      title: `Faraday Report A ${runId}`,
      authors: "Student A",
      status: "DONE",
      reportBlobUrl: "https://example.public.blob.vercel-storage.com/faraday-a.pdf",
      reportFilename: "faraday-a.pdf",
      rubricId: rubric.id,
      createdById: ta1.id,
      resultJson: JSON.stringify(sampleEvaluation),
      createdAt: new Date(now + 20_000),
    },
  });
  jobAId = newer.id;
  jobBId = older.id;
});

test.afterAll(async () => {
  await prisma.reportGradingJob.deleteMany({ where: { id: { in: [jobAId, jobBId] } } });
  await prisma.$disconnect();
});

test("concurrent multi-TA grading, blind-by-default UI, PDF highlight, and bottom navigation", async ({
  browser,
}, testInfo) => {
  test.setTimeout(90_000);
  const samplePdf = buildSamplePdf();

  const ctx1 = await browser.newContext({ baseURL });
  const ctx2 = await browser.newContext({ baseURL });
  await ctx1.addCookies([{ name: "e2e-test-user-email", value: ta1Email, url: baseURL }]);
  await ctx2.addCookies([{ name: "e2e-test-user-email", value: ta2Email, url: baseURL }]);

  const jobUrl = `/api/report-grading/jobs/${jobAId}`;
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: ta1Email } });
  await prisma.reportHumanReview.create({ data: {
    jobId: jobAId, graderId: owner.id, slotKey: `user:${owner.id}`, total: 8, gradedAt: new Date(),
  } });
  const readMine = async () => ((await (await ctx1.request.get(jobUrl)).json()).data as ReportJobDetail);
  expect((await readMine()).human.total).toBe(80);
  for (const total of [0, 8, 89.7, 100]) {
    expect((await ctx1.request.put(`${jobUrl}/human-scores`, { data: { total } })).ok()).toBe(true);
    expect((await readMine()).human.total).toBe(total);
  }
  for (const total of [-1, 100.1, 89.74]) {
    expect((await ctx1.request.put(`${jobUrl}/human-scores`, { data: { total } })).status()).toBe(400);
  }
  expect((await ctx1.request.put(`${jobUrl}/human-scores`, { data: { scores: [
    { name: "Physics correctness", score: 6 }, { name: "Sanity checks", score: 10 },
  ] } })).ok()).toBe(true);
  const [itemsHeader, itemsRow] = parseCsv(reportJobsToCsv([await readMine()]).replace(/^\uFEFF/, ""));
  expect(itemsRow[itemsHeader.indexOf("Human total (0-100)")]).toBe("76.00");

  // 1. Concurrent API writes from TA 1 and TA 2 never overwrite each other.
  const [res1, res2] = await Promise.all([
    ctx1.request.put(`/api/report-grading/jobs/${jobAId}/human-scores`, {
      data: { total: 85, comments: "TA Alpha: solid work" },
    }),
    ctx2.request.put(`/api/report-grading/jobs/${jobAId}/human-scores`, {
      data: { total: 70, comments: "TA Beta: missing time constant" },
    }),
  ]);
  expect(res1.ok()).toBe(true);
  expect(res2.ok()).toBe(true);

  const detailRes = await ctx2.request.get(`/api/report-grading/jobs/${jobAId}`);
  expect(detailRes.ok()).toBe(true);
  const detail: ReportJobDetail = (await detailRes.json()).data;
  expect(detail.human.total).toBe(70);
  expect(detail.humanReviews?.length).toBe(2);

  // CSV includes both graders and their average.
  const csv = reportJobsToCsv([detail]);
  const [headers, row] = parseCsv(csv.replace(/^\uFEFF/, ""));
  expect(row[headers.indexOf("Human grader count")]).toBe("2");
  expect(row[headers.indexOf("Human average total (0-100)")]).toBe("77.50");
  expect(row[headers.indexOf("AI weighted total (0-100)")]).toBe("81.00");

  // 2. Open as Professor (who has not graded yet) to verify blind-by-default, PDF viewer, and nav.
  const ctxProf = await browser.newContext({ baseURL, permissions: ["clipboard-read", "clipboard-write"], viewport: { width: 1440, height: 900 } });
  await ctxProf.addCookies([{ name: "e2e-test-user-email", value: profEmail, url: baseURL }]);
  const page = await ctxProf.newPage();

  await page.route(`**/api/report-grading/jobs/*/pdf`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: samplePdf,
    })
  );

  await page.goto(`/report-grading/${jobAId}`);
  await expect(page.getByRole("heading", { name: `Faraday Report A ${runId}` })).toBeVisible({
    timeout: 30_000,
  });

  // Left PDF viewer renders both pages.
  await expect(page.locator('[data-pdf-page="1"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-pdf-page="2"]')).toBeVisible();

  // Status badges show prof has not graded yet, while 2 graders have scored.
  await expect(page.getByText("Not graded by you")).toBeVisible();
  await expect(page.getByText("2 graders")).toBeVisible();

  // AI scores & other graders are hidden by default.
  await expect(page.getByText(/Weighted total:/)).toHaveCount(0);
  await expect(page.locator("#human-total")).toHaveCount(0);
  const divider = page.getByRole("separator", { name: "Report width" });
  await divider.focus();
  await divider.press("ArrowRight");
  await expect(divider).toHaveAttribute("aria-valuenow", "52");
  await page.getByRole("button", { name: "Copy visible" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("Clear physical setup");
  expect(copied).not.toMatch(/Uniform textbook|coil geometries|8\.5\/10|Section 2, p\. 2|magnetic flux decays exponentially/);
  await expect(page.getByText("TA Alpha: solid work")).toHaveCount(0);
  await expect(page.getByText("TA Beta: missing time constant")).toHaveCount(0);

  const directions = page.locator("details").filter({ has: page.getByText("Optional presentation directions", { exact: true }) });
  await expect(directions.getByText("Compare coil geometries")).not.toBeVisible();
  await directions.locator("summary").click();
  await expect(directions.getByText("Not pursued", { exact: true })).toBeVisible();
  await expect(directions.getByText("Developed", { exact: true })).toBeVisible();
  await expect(directions.getByText(/\d+\s*\/\s*\d+ done/i)).toHaveCount(0);
  await directions.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("optional-report-directions.png") });
  await directions.locator("summary").click();

  // AI-style notes are toggled off by default and can be toggled on.
  const aiLayer = page.getByRole("button", { name: "AI-style (1)", exact: true });
  await expect(aiLayer).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("Uniform textbook phrasing")).toHaveCount(0);
  await aiLayer.click();
  await expect(page.getByText("Uniform textbook phrasing")).toBeVisible();
  await expect(page.getByText("Writing-style notes are not evidence", { exact: false })).toBeVisible();
  await aiLayer.click();
  await expect(page.getByText("Uniform textbook phrasing")).toHaveCount(0);

  // Clicking AI Note #2 highlights text on page 2.
  const pageTwo = page.locator("#report-page-2");
  await page.getByRole("button", { name: "Next page" }).first().click();
  await expect(pageTwo).toBeFocused();
  await page.getByRole("button", { name: "Previous page" }).last().click();
  await expect(page.locator("#report-page-1")).toBeFocused();
  const noteTwo = page.locator("#report-note-1");
  await noteTwo.focus();
  await noteTwo.press("Enter");
  await expect(page.locator('[aria-label="Jump to note #2"]').first()).toBeVisible();
  await page.locator('[aria-label="Jump to note #2"]').first().click();
  await expect(noteTwo).toBeFocused();
  const pageNotes = page.getByRole("region", { name: "Page 2 notes" });
  await expect(pageNotes.getByText("Page only · Needs staff review")).toBeVisible();
  const evidence = pageNotes.getByRole("button", { name: "Issue details for note 2" });
  const quote = pageNotes.getByText("“magnetic flux decays exponentially”");
  await expect(quote).toBeHidden();
  await evidence.focus();
  await evidence.press("Space");
  await expect(evidence).toBeFocused();
  await expect(quote).toBeVisible();
  await expect(pageNotes.getByText("Text · Sanity checks")).toBeVisible();
  await expect(pageNotes.getByText("Equation · Sanity checks")).toBeHidden();
  await page.getByRole("button", { name: "Copy visible" }).click();
  const expandedCopy = await page.evaluate(() => navigator.clipboard.readText());
  expect(expandedCopy).toContain("magnetic flux decays exponentially");
  expect(expandedCopy).not.toContain("hand-written limiting case");
  await evidence.click();
  await expect(evidence).toHaveAttribute("aria-expanded", "false");
  await expect(quote).toBeHidden();
  await expect(pageTwo.getByRole("button", { name: "Jump to note #4" })).toHaveCount(0);
  await expect.poll(async () => {
    const mark = await pageTwo.getByRole("button", { name: "Jump to note #2" }).first().boundingBox();
    const note = await noteTwo.boundingBox();
    return mark && note ? Math.abs(mark.y - note.y) : Infinity;
  }).toBeLessThan(12);
  await pageNotes.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("desktop-split-blind.png") });

  // Unfold other graders and AI scores.
  await page.getByText("End of report").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Show other scores" }).click();
  await expect(page.getByText("TA Alpha: solid work")).toBeVisible();
  await expect(page.getByText("TA Beta: missing time constant")).toBeVisible();
  await expect(page.getByText("Human average (2)")).toBeVisible();

  await page.getByRole("button", { name: "Rubric & scoring" }).click();
  await page.getByRole("button", { name: "Show AI scores" }).click();
  await expect(page.getByText("Weighted total: 81.00 / 100")).toBeVisible();

  // Add an extra flexible grader slot.
  await page.getByRole("button", { name: "Add another grader score" }).click();
  const extraForm = page.getByTestId("extra-grader-card");
  await extraForm.locator("#extra-grader-label").fill("Guest Grader");
  await extraForm.locator("#extra-human-total").fill("90");
  await extraForm.getByRole("button", { name: "Save scores and comments" }).click();
  await expect(page.getByRole("table").getByText("Guest Grader")).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("desktop-split-expanded.png") });

  // Mobile viewport: no horizontal overflow.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Page notes", exact: true }).click();
  await pageNotes.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("mobile-stacked.png") });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true);
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(divider).toBeHidden();
  await pageNotes.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("tablet-stacked.png") });

  // Bottom navigation jumps straight to next ungraded report (job B) without going back to list.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator("#human-total").fill("73");
  await page.locator("#human-comments").fill("Independent draft");
  const modes = page.getByRole("group", { name: "Review mode" });
  await expect(modes).toBeInViewport();
  await modes.getByRole("button", { name: "Rubric & scoring" }).click();
  await page.getByText("Consult rubric while scoring").click();
  await expect(page.locator("#human-comments")).toHaveValue("Independent draft");
  await page.getByRole("link", { name: "Next ungraded" }).click();
  await page.getByRole("button", { name: "Keep grading" }).click();
  await expect(page.locator("#human-comments")).toHaveValue("Independent draft");
  await page.getByRole("button", { name: "Save and go to next ungraded" }).click();
  await expect(page).toHaveURL(new RegExp(`/report-grading/${jobBId}$`));
  await expect(page.getByRole("heading", { name: `Faraday Report B ${runId}` })).toBeVisible();
  await expect(page.getByText("No scores yet")).toBeVisible();
  await expect(divider).toHaveAttribute("aria-valuenow", "52");
  await page.reload();
  await expect(divider).toHaveAttribute("aria-valuenow", "52");

  // List page shows grading badges and filters.
  await page.goto("/report-grading");
  await expect(page.getByRole("button", { name: "No scores yet" })).toBeVisible();
  await page.getByRole("button", { name: "No scores yet" }).click();
  await expect(page.getByRole("link", { name: new RegExp(`Faraday Report B ${runId}`) })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`Faraday Report A ${runId}`) })).toHaveCount(0);

  await ctx1.close();
  await ctx2.close();
  await ctxProf.close();
});

for (const hasPdf of [true, false]) {
  test(`the opt-in AI-style layer explains zero notes for ${hasPdf ? "PDF" : "pasted text"}`, async ({ page }) => {
    await page.context().addCookies([{ name: "e2e-test-user-email", value: profEmail, url: baseURL }]);
    await page.route(`**/api/report-grading/jobs/${jobBId}`, async route => {
      const response = await route.fetch();
      const payload = await response.json();
      await route.fulfill({ json: { ...payload, data: { ...payload.data,
        hasReportPdf: hasPdf, reportText: hasPdf ? null : "A text-only report.",
        resultJson: JSON.stringify({ ...sampleEvaluation, comments: [] }),
      } } });
    });
    await page.route("**/api/report-grading/jobs/*/pdf", route =>
      route.fulfill({ contentType: "application/pdf", body: buildSamplePdf() }));
    await page.goto(`/report-grading/${jobBId}`);
    const toggle = page.getByRole("button", { name: "AI-style (0)", exact: true });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "No AI-style passages were annotated" })).toBeVisible();
    await expect(page.locator('[id^="report-note-"]')).toHaveCount(0);
    await toggle.press("Enter");
    await expect(page.getByText("No AI-style passages", { exact: false })).toHaveCount(0);
  });
}
