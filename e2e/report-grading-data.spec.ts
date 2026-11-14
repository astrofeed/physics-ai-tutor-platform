import { test, expect, type Page } from "@playwright/test";
import { loginAndGoto, TEST_TA_EMAIL } from "./helpers";

// Every report-grading API call is answered here, so nothing is read from or written to the database.

const POLL_TIMEOUT_MS = 12_000;

function reportJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "e2e-report-job",
    title: "Coulomb's law from Maxwell",
    authors: "E2E Author",
    studentId: "900000001",
    assignedQuestion: null,
    englishName: null,
    groupLabel: null,
    presentationDate: null,
    status: "DONE",
    error: null,
    model: "e2e-model",
    reasoningEffort: "high",
    gradingDurationMs: 60_000,
    rubricVersion: 3,
    createdByName: "E2E TA",
    createdAt: "2026-11-01T00:00:00.000Z",
    completedAt: "2026-11-01T00:01:00.000Z",
    ...overrides,
  };
}

function reportJobDetail(overrides: Record<string, unknown> = {}) {
  return {
    ...reportJob(),
    reportText: null,
    reportFilename: "report.pdf",
    resultJson: null,
    presentationJobId: null,
    studentEmail: null,
    feedbackSentAt: null,
    feedbackSentTo: null,
    human: { scores: [], total: null, comments: null, gradedAt: null, gradedByName: null, aiRevealedAt: null },
    ...overrides,
  };
}

function rubricVersion(version: number, content = `Version ${version} instructions`) {
  return { version, content, updatedByName: "E2E TA", updatedAt: `2026-11-0${version}T00:00:00.000Z` };
}

async function stubRubric(page: Page) {
  const versions = [rubricVersion(3), rubricVersion(2)];
  await page.route("**/api/report-grading/rubric", (route) => {
    if (route.request().method() !== "PUT") return route.fulfill({ json: { data: versions[0] } });
    const { content } = route.request().postDataJSON();
    if (content.includes("REJECT")) {
      return route.fulfill({ status: 400, json: { error: "Instructions are too short" } });
    }
    versions.unshift(rubricVersion(versions[0].version + 1, content));
    return route.fulfill({ json: { data: versions[0] } });
  });
  await page.route("**/api/report-grading/rubric/history", (route) => route.fulfill({ json: { data: versions } }));
}

test.describe("Report grading data loading", () => {
  test("the job list polls while a job is grading and searches by text", async ({ page }) => {
    let grading = true;
    const listRequests: URLSearchParams[] = [];
    await page.route("**/api/report-grading/jobs?*", (route) => {
      const params = new URL(route.request().url()).searchParams;
      listRequests.push(params);
      const jobs = params.get("q")
        ? [reportJob({ id: "e2e-search-hit", title: "Lenz's law report" })]
        : [reportJob({ status: grading ? "GRADING" : "DONE" })];
      return route.fulfill({ json: { data: { jobs, totalCount: jobs.length } } });
    });

    await loginAndGoto(page, TEST_TA_EMAIL, "/report-grading");
    const row = page.getByRole("link", { name: /Coulomb's law from Maxwell/ });
    await expect(row).toContainText("Grading");

    grading = false;
    await expect(row).toContainText("Done", { timeout: POLL_TIMEOUT_MS });

    await page.getByPlaceholder("Search title, author, student ID, group, or date…").fill("Lenz");
    await expect(page.getByRole("link", { name: /Lenz's law report/ })).toBeVisible();
    await expect(row).toHaveCount(0);
    const searchRequest = listRequests.find((params) => params.get("q") === "Lenz");
    expect(searchRequest?.get("page")).toBe("1");
    expect(searchRequest?.get("pageSize")).toBe("20");
  });

  test("grading instructions save as a new version and the open history follows", async ({ page }) => {
    await stubRubric(page);
    await loginAndGoto(page, TEST_TA_EMAIL, "/report-grading");
    await page.getByRole("button", { name: "Grading instructions" }).click();

    const editor = page.locator("textarea");
    await expect(editor).toHaveValue("Version 3 instructions");
    await expect(page.getByText("Saving creates version 4")).toBeVisible();

    await page.getByRole("button", { name: "Version history" }).click();
    const history = page.getByRole("listitem").filter({ hasText: /^v\d/ });
    await expect(history).toHaveCount(2);
    await expect(history.first()).toContainText("v3current");

    await editor.fill("Version 4 instructions");
    await page.getByRole("button", { name: "Save as new version" }).click();
    await expect(page.getByText("Grading instructions saved as version 4")).toBeVisible();
    await expect(page.getByText("Saving creates version 5")).toBeVisible();
    await expect(history).toHaveCount(3);
    await expect(history.first()).toContainText("v4current");

    await editor.fill("REJECT");
    await page.getByRole("button", { name: "Save as new version" }).click();
    await expect(page.getByText("Instructions are too short")).toBeVisible();
    await expect(page.getByText("Saving creates version 5")).toBeVisible();
  });

  test("a job page follows the job while it is in progress", async ({ page }) => {
    let failed = false;
    await page.route("**/api/report-grading/jobs/e2e-report-job", (route) =>
      route.fulfill({
        json: { data: reportJobDetail(failed ? { status: "FAILED", error: "Model timed out." } : { status: "GRADING" }) },
      })
    );

    await loginAndGoto(page, TEST_TA_EMAIL, "/report-grading/e2e-report-job");
    await expect(page.getByRole("heading", { name: "Coulomb's law from Maxwell" })).toBeVisible();
    await expect(page.getByText("The AI is reviewing the report")).toBeVisible();

    failed = true;
    await expect(page.getByText("Model timed out. You can retry it from the job list.")).toBeVisible({
      timeout: POLL_TIMEOUT_MS,
    });
  });

  test("a missing job says so, and a failing server is reported", async ({ page }) => {
    await page.route("**/api/report-grading/jobs/e2e-missing-job", (route) =>
      route.fulfill({ status: 404, json: { error: "Job not found" } })
    );
    await page.route("**/api/report-grading/jobs/e2e-broken-job", (route) =>
      route.fulfill({ status: 500, json: { error: "Internal server error" } })
    );

    await loginAndGoto(page, TEST_TA_EMAIL, "/report-grading/e2e-missing-job");
    await expect(page.getByText("Job not found")).toBeVisible();
    await expect(page.getByText("Failed to load the job")).toHaveCount(0);

    await page.goto("/report-grading/e2e-broken-job");
    await expect(page.getByText("Failed to load the job")).toBeVisible();
  });

  test("editing and deleting a job go through the API and the page follows", async ({ page }) => {
    let title = "Coulomb's law from Maxwell";
    await page.route("**/api/report-grading/jobs/e2e-report-job", (route) => {
      const request = route.request();
      if (request.method() === "GET") {
        return route.fulfill({ json: { data: reportJobDetail({ title, status: "FAILED", error: "Model timed out." }) } });
      }
      if (request.method() === "DELETE") return route.fulfill({ json: { data: { deleted: true } } });
      const body = request.postDataJSON();
      if (body.title.includes("REJECT")) {
        return route.fulfill({ status: 400, json: { error: "Title is not allowed" } });
      }
      title = body.title;
      return route.fulfill({ json: { data: { id: "e2e-report-job" } } });
    });
    await page.route("**/api/report-grading/jobs?*", (route) =>
      route.fulfill({ json: { data: { jobs: [], totalCount: 0 } } })
    );

    await loginAndGoto(page, TEST_TA_EMAIL, "/report-grading/e2e-report-job");
    await page.getByRole("button", { name: "Edit" }).click();
    await page.locator("#edit-report-title").fill("Renamed report");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Job updated")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Renamed report" })).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).click();
    await page.locator("#edit-report-title").fill("REJECT");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Title is not allowed")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Record deleted")).toBeVisible();
    await expect(page).toHaveURL(/\/report-grading$/);
  });
});
