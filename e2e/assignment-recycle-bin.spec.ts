import { test, expect } from "@playwright/test";
import { loginAsTestUser, TEST_STUDENT_EMAIL, TEST_TA_EMAIL } from "./helpers";

const TITLE = `E2E Recycle Bin ${Date.now()}`;

interface ListResponse {
  assignments: Array<{ id: string; title: string; deletedAt?: string | null }>;
}

test.describe("Deleted assignment recycle bin", () => {
  test("delete hides the assignment everywhere, restore brings it back", async ({ page }) => {
    await loginAsTestUser(page.context(), TEST_TA_EMAIL);

    const created = await page.request.post("/api/assignments", {
      data: {
        title: TITLE,
        description: "recycle bin flow",
        type: "QUIZ",
        totalPoints: 10,
        questions: [
          {
            questionText: "What is 2 + 2?",
            questionType: "NUMERIC",
            correctAnswer: "4",
            points: 10,
          },
        ],
      },
    });
    expect(created.ok()).toBeTruthy();
    const assignmentId = (await created.json()).assignment.id as string;

    const deleted = await page.request.delete(`/api/assignments/${assignmentId}`);
    expect(deleted.ok()).toBeTruthy();

    const activeList: ListResponse = await (
      await page.request.get("/api/assignments?pageSize=100")
    ).json();
    expect(activeList.assignments.map((a) => a.id)).not.toContain(assignmentId);

    const deletedList: ListResponse = await (
      await page.request.get("/api/assignments?filter=deleted&pageSize=100")
    ).json();
    const inBin = deletedList.assignments.find((a) => a.id === assignmentId);
    expect(inBin).toBeTruthy();
    expect(inBin?.deletedAt).toBeTruthy();

    // Grading and detail views are closed while the assignment sits in the bin
    expect((await page.request.get(`/api/assignments/${assignmentId}`)).status()).toBe(404);
    expect(
      (await page.request.get(`/api/assignments/${assignmentId}/submissions`)).status()
    ).toBe(404);

    const csv = await (await page.request.get("/api/grading/export")).text();
    expect(csv).not.toContain(TITLE);

    const restored = await page.request.post(`/api/assignments/${assignmentId}/restore`);
    expect(restored.ok()).toBeTruthy();

    const afterRestore: ListResponse = await (
      await page.request.get("/api/assignments?pageSize=100")
    ).json();
    expect(afterRestore.assignments.map((a) => a.id)).toContain(assignmentId);
    expect((await page.request.get(`/api/assignments/${assignmentId}`)).status()).toBe(200);

    // A second restore has nothing to restore
    expect((await page.request.post(`/api/assignments/${assignmentId}/restore`)).status()).toBe(404);

    await page.request.delete(`/api/assignments/${assignmentId}`);
  });

  test("students cannot list or restore deleted assignments", async ({ page }) => {
    await loginAsTestUser(page.context(), TEST_TA_EMAIL);
    const created = await page.request.post("/api/assignments", {
      data: { title: `${TITLE} student`, type: "QUIZ", totalPoints: 10, questions: [] },
    });
    const assignmentId = (await created.json()).assignment.id as string;
    await page.request.delete(`/api/assignments/${assignmentId}`);

    await page.context().clearCookies();
    await loginAsTestUser(page.context(), TEST_STUDENT_EMAIL);

    const studentList: ListResponse = await (
      await page.request.get("/api/assignments?filter=deleted&pageSize=100")
    ).json();
    expect(studentList.assignments.map((a) => a.id)).not.toContain(assignmentId);

    // Their own submission is unreachable too, scores included
    const ownSubmission = await page.request.get(
      `/api/submissions?assignmentId=${assignmentId}`
    );
    expect(ownSubmission.status()).toBe(200);
    expect((await ownSubmission.json()).submission).toBeNull();

    expect((await page.request.post(`/api/assignments/${assignmentId}/restore`)).status()).toBe(403);
  });
});
