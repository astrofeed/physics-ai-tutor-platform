import { test, expect, type Page } from "@playwright/test";
import JSZip from "jszip";
import { loginAndGoto, TEST_TA_EMAIL } from "./helpers";

const TOAST_LIFETIME_MS = 3000;
const OVERSIZED_FILE = Buffer.alloc(31 * 1024 * 1024);
const PDF_MIME_TYPE = "application/pdf";
const ZIP_MIME_TYPE = "application/zip";

async function zipOf(files: Record<string, Buffer>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function openGradeTab(page: Page) {
  await loginAndGoto(page, TEST_TA_EMAIL, "/presentation-grading");
  await expect(page.getByText("New grading job")).toBeVisible();
}

async function dropArchive(page: Page, name: string, buffer: Buffer) {
  await page
    .getByLabel("eeClass exports (.zip)", { exact: true })
    .setInputFiles({ name, mimeType: ZIP_MIME_TYPE, buffer });
}

async function openReportForm(page: Page) {
  await loginAndGoto(page, TEST_TA_EMAIL, "/report-grading");
  await expect(page.getByRole("heading", { name: "Grade written reports", exact: true })).toBeVisible();
  return page.getByLabel("Report PDFs or eeClass exports (.zip)");
}

/** A toast would be gone by now; a notice the grader has to read must not be. */
async function outlastToast(page: Page) {
  await page.waitForTimeout(TOAST_LIFETIME_MS + 1500);
}

test.describe("Presentation grading: problems stay on screen", () => {
  test("a slides problem stays until the slides are replaced", async ({ page }) => {
    await openGradeTab(page);
    await page.locator("#job-topic").fill("QB-12 — Induced emf");
    await page.locator("#job-presenters").fill("E2E Presenter");
    await page.getByRole("button", { name: "Paste transcript" }).click();
    await page.getByPlaceholder("Paste what was said in the presentation…").fill("Today I derive the induced emf.");
    await page
      .locator('input[type="file"][accept*=".pptx"]')
      .setInputFiles({ name: "slides.pdf", mimeType: PDF_MIME_TYPE, buffer: OVERSIZED_FILE });

    await page.getByRole("button", { name: "Start grading" }).click();

    const problem = page.getByRole("alert").filter({ hasText: "Could not start grading" });
    await expect(problem).toContainText("The slides file is 31 MB; the maximum is 30 MB.");
    await outlastToast(page);
    await expect(problem).toBeVisible();

    await page.getByRole("button", { name: "Remove slides" }).click();
    await expect(problem).toBeHidden();
  });

  test("an unreadable archive is reported until dismissed", async ({ page }) => {
    await openGradeTab(page);
    await dropArchive(page, "broken.zip", Buffer.from("this is not a zip archive"));

    const problem = page.getByRole("alert").filter({ hasText: "Not everything could be imported" });
    await expect(problem).toContainText("Could not read broken.zip as a .zip file.");
    await outlastToast(page);
    await expect(problem).toBeVisible();

    await page.getByRole("button", { name: "Dismiss: Not everything could be imported" }).click();
    await expect(problem).toBeHidden();
  });

  test("import warnings about the roster and missing slides stay on screen", async ({ page }) => {
    await openGradeTab(page);
    await dropArchive(
      page,
      "900000001 (Notice Fixture).zip",
      await zipOf({ "900000001 (Notice Fixture)/Induced emf.mp4": Buffer.from("not a real video") })
    );

    const warnings = page.getByRole("status").filter({ hasText: "Check before grading" });
    await expect(warnings).toContainText("900000001 (Notice Fixture) is not in the sign-up sheet");
    await expect(warnings).toContainText("No slides in this archive");
    await expect(page.locator("#job-topic")).toHaveValue("Induced emf");
    await outlastToast(page);
    await expect(warnings).toBeVisible();
  });

  test("a failed batch row keeps the reason it failed", async ({ page }) => {
    await openGradeTab(page);
    await dropArchive(
      page,
      "bulk-export.zip",
      await zipOf({
        "900000001 (Batch One)/Induced emf.mp4": Buffer.from("not a real video"),
        "900000001 (Batch One)/slides.pdf": OVERSIZED_FILE,
        "900000002 (Batch Two)/Lenz law.mp4": Buffer.from("not a real video"),
        "900000002 (Batch Two)/slides.pdf": OVERSIZED_FILE,
      })
    );

    await page.getByRole("button", { name: "Grade all (2)" }).click();

    const reasons = page.getByRole("alert").filter({ hasText: "The slides file is 31 MB; the maximum is 30 MB." });
    await expect(reasons).toHaveCount(2);
    await outlastToast(page);
    await expect(reasons).toHaveCount(2);
  });
});

test.describe("Report grading: problems stay on screen", () => {
  test("an oversized report is reported until it is removed", async ({ page }) => {
    const dropZone = await openReportForm(page);
    await dropZone.setInputFiles({ name: "900000001_report.pdf", mimeType: PDF_MIME_TYPE, buffer: OVERSIZED_FILE });

    await page.getByRole("button", { name: "Start grading" }).click();

    const problem = page.getByRole("alert").filter({ hasText: "Could not start grading" });
    await expect(problem).toContainText('"900000001_report.pdf" is 31 MB; the maximum is 30 MB.');
    await outlastToast(page);
    await expect(problem).toBeVisible();

    await page.getByRole("button", { name: "Remove 900000001_report.pdf" }).click();
    await expect(problem).toBeHidden();
  });

  test("files that were skipped are listed until dismissed", async ({ page }) => {
    const dropZone = await openReportForm(page);
    await dropZone.setInputFiles([
      { name: "broken.zip", mimeType: ZIP_MIME_TYPE, buffer: Buffer.from("this is not a zip archive") },
      { name: "empty.zip", mimeType: ZIP_MIME_TYPE, buffer: await zipOf({ "notes/readme.txt": Buffer.from("no report") }) },
      { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a report") },
    ]);

    const problem = page.getByRole("alert").filter({ hasText: "Not everything could be imported" });
    await expect(problem).toContainText("Could not read broken.zip as a .zip file.");
    await expect(problem).toContainText("No PDF found in empty.zip.");
    await expect(problem).toContainText('"notes.txt" is not a PDF or .zip and was skipped.');
    await outlastToast(page);
    await expect(problem).toBeVisible();

    await page.getByRole("button", { name: "Dismiss: Not everything could be imported" }).click();
    await expect(problem).toBeHidden();
  });
});
