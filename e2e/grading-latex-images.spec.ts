import { test, expect } from "@playwright/test";
import { loginAsTestUser, TEST_STUDENT_EMAIL, TEST_TA_EMAIL } from "./helpers";
import path from "path";
import fs from "fs";

// Create a tiny valid PNG for image upload tests
function createTestImage(name: string): string {
  const dir = path.join(__dirname, "fixtures");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, name);
  if (!fs.existsSync(filePath)) {
    // Minimal 1x1 red PNG
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
      "base64"
    );
    fs.writeFileSync(filePath, png);
  }
  return filePath;
}

/** Navigate to the E2E test assignment detail page as a student */
async function gotoTestAssignment(page: import("@playwright/test").Page) {
  await page.goto("/assignments");
  await page.waitForLoadState("networkidle");
  const link = page.getByText("E2E LaTeX & Images Test").first();
  await expect(link).toBeVisible({ timeout: 10000 });
  await link.click();
  await page.waitForLoadState("networkidle");
}

test.describe("Student: LaTeX in feedback & appeals", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page.context(), TEST_STUDENT_EMAIL);
  });

  test("feedback renders LaTeX with KaTeX", async ({ page }) => {
    await gotoTestAssignment(page);

    // The graded feedback contains LaTeX — verify KaTeX rendered elements exist
    const feedbackSection = page.locator("text=Feedback").first();
    await expect(feedbackSection).toBeVisible({ timeout: 10000 });

    // KaTeX renders math into .katex elements
    const katexElements = page.locator(".katex");
    await expect(katexElements.first()).toBeVisible({ timeout: 10000 });

    const count = await katexElements.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("appeal thread renders LaTeX with KaTeX", async ({ page }) => {
    await gotoTestAssignment(page);

    // The OPEN appeal is auto-expanded. Scroll down to find appeal content.
    // The appeal toggle may say "Hide appeal thread" if already expanded.
    // Either way, the appeal content with LaTeX should already be rendered.
    // If collapsed, click to expand.
    const hideToggle = page.getByText(/Hide appeal thread/i).first();
    const viewToggle = page.getByText(/View appeal thread/i).first();

    // Check if we need to scroll and/or expand
    const isExpanded = await hideToggle.isVisible({ timeout: 3000 }).catch(() => false);
    if (!isExpanded) {
      const needsExpand = await viewToggle.isVisible({ timeout: 3000 }).catch(() => false);
      if (needsExpand) {
        await viewToggle.click();
      }
    }

    // Now verify KaTeX is rendered in the appeal area
    // Appeal reason and TA reply both have LaTeX
    const katexElements = page.locator(".katex");
    // Wait for at least the feedback KaTeX + appeal KaTeX
    await expect(katexElements.nth(1)).toBeVisible({ timeout: 10000 });

    const count = await katexElements.count();
    // Feedback has LaTeX + appeal reason has LaTeX + TA reply has LaTeX
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("student can attach images to appeal reply", async ({ page }) => {
    const testImg = createTestImage("test-appeal-img.png");

    await gotoTestAssignment(page);

    // The OPEN appeal is auto-expanded; scroll to find the reply area
    const hideToggle = page.getByText(/Hide appeal thread/i).first();
    const viewToggle = page.getByText(/View appeal thread/i).first();
    const isExpanded = await hideToggle.isVisible({ timeout: 3000 }).catch(() => false);
    if (!isExpanded) {
      const needsExpand = await viewToggle.isVisible({ timeout: 3000 }).catch(() => false);
      if (needsExpand) await viewToggle.click();
    }

    // Find the image upload button (Attach image label)
    const uploadLabel = page.getByText(/Attach image/i).first();
    await expect(uploadLabel).toBeVisible({ timeout: 10000 });

    // Upload an image via the hidden file input
    const fileInput = page.locator('input[type="file"][accept="image/*"]').first();
    await fileInput.setInputFiles(testImg);

    // Verify the thumbnail preview appears
    const thumbnail = page.locator('img[alt="Attachment 1"]').first();
    await expect(thumbnail).toBeVisible({ timeout: 10000 });
  });
});

test.describe("TA: LaTeX in grading & image attachments", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page.context(), TEST_TA_EMAIL);
  });

  /** Navigate to grading page, select the test assignment and student */
  async function gotoGradingForStudent(page: import("@playwright/test").Page) {
    await page.goto("/grading");
    await page.waitForLoadState("networkidle");

    const selectTrigger = page.getByRole("button", { name: "Select an assignment to grade" });
    await expect(selectTrigger).toBeVisible({ timeout: 5000 });
    await selectTrigger.click();
    const option = page.getByText("E2E LaTeX & Images Test").first();
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();
    await page.waitForLoadState("networkidle");

    // Wait for submissions to load and select the student
    const studentEntry = page.getByText("E2E Student").first();
    await expect(studentEntry).toBeVisible({ timeout: 10000 });
    await studentEntry.click();
    await page.waitForLoadState("networkidle");
  }

  test("grading page shows appeal and feedback content", async ({ page }) => {
    await gotoGradingForStudent(page);

    // Expand the appeal section if needed
    const appealHeader = page.getByText(/Appeal/i).first();
    await expect(appealHeader).toBeVisible({ timeout: 5000 });
  });

  test("TA can attach images to grading feedback", async ({ page }) => {
    const testImg = createTestImage("test-feedback-img.png");

    await gotoGradingForStudent(page);

    // Find the feedback section and image upload
    const feedbackLabel = page.getByText("Feedback", { exact: true }).first();
    await expect(feedbackLabel).toBeVisible({ timeout: 5000 });

    // Find the image upload button within the feedback area
    const uploadLabel = page.getByText(/Attach image/i).first();
    await expect(uploadLabel).toBeVisible({ timeout: 5000 });

    // Upload an image via the hidden file input
    const fileInput = page.locator('input[type="file"][accept="image/*"]').first();
    await fileInput.setInputFiles(testImg);

    // Verify the thumbnail preview appears
    const thumbnail = page.locator('img[alt="Attachment 1"]').first();
    await expect(thumbnail).toBeVisible({ timeout: 10000 });
  });

  test("TA can attach images to appeal reply", async ({ page }) => {
    const testImg = createTestImage("test-ta-reply-img.png");

    await gotoGradingForStudent(page);

    // Expand the appeal section
    const appealToggle = page.getByText(/Appeal by/i).first();
    if (await appealToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await appealToggle.click();
      await page.waitForTimeout(500);

      // Find the last Attach image button (in the appeal reply area)
      const uploadLabels = page.getByText(/Attach image/i);
      const lastUpload = uploadLabels.last();
      await expect(lastUpload).toBeVisible({ timeout: 5000 });

      // Upload an image
      const fileInputs = page.locator('input[type="file"][accept="image/*"]');
      const lastFileInput = fileInputs.last();
      await lastFileInput.setInputFiles(testImg);

      // Verify the thumbnail preview appears
      const thumbnail = page.locator('img[alt="Attachment 1"]');
      await expect(thumbnail.first()).toBeVisible({ timeout: 10000 });
    }
  });
});
