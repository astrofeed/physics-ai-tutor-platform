import { test, expect, type APIRequestContext } from "@playwright/test";
import { TEST_STUDENT_EMAIL, TEST_TA_EMAIL } from "./helpers";

const PARALLEL_SAVES = 6;

function asUser(request: APIRequestContext, email: string) {
  return { headers: { cookie: `e2e-test-user-email=${email}` } };
}

test.describe("Concurrent autosave", () => {
  test("parallel draft saves keep one submission per student", async ({ request }) => {
    const created = await request.post("/api/assignments", {
      ...asUser(request, TEST_TA_EMAIL),
      data: {
        title: `E2E Autosave Race ${Date.now()}`,
        type: "QUIZ",
        questions: [
          { questionText: "Numeric one", questionType: "NUMERIC", correctAnswer: "9.8", points: 10 },
          { questionText: "Explain why", questionType: "FREE_RESPONSE", points: 10 },
        ],
      },
    });
    expect(created.ok()).toBeTruthy();
    const assignment = (await created.json()).assignment;

    const published = await request.patch(`/api/assignments/${assignment.id}`, {
      ...asUser(request, TEST_TA_EMAIL),
      data: { published: true },
    });
    expect(published.ok()).toBeTruthy();

    const answersFor = (revision: number) =>
      assignment.questions.map((q: { id: string; questionType: string }) => ({
        questionId: q.id,
        answer: q.questionType === "NUMERIC" ? "9.8" : `revision ${revision}`,
      }));

    const saves = await Promise.all(
      Array.from({ length: PARALLEL_SAVES }, (_, revision) =>
        request.post("/api/submissions", {
          ...asUser(request, TEST_STUDENT_EMAIL),
          data: { assignmentId: assignment.id, answers: answersFor(revision), isDraft: true },
        })
      )
    );
    for (const save of saves) expect(save.status()).toBe(200);

    const draft = await request.get(`/api/submissions?assignmentId=${assignment.id}`, {
      ...asUser(request, TEST_STUDENT_EMAIL),
    });
    const draftBody = await draft.json();
    expect(draftBody.submission.isDraft).toBe(true);
    expect(draftBody.submission.answers).toHaveLength(assignment.questions.length);

    const finals = await Promise.all(
      Array.from({ length: PARALLEL_SAVES }, () =>
        request.post("/api/submissions", {
          ...asUser(request, TEST_STUDENT_EMAIL),
          data: { assignmentId: assignment.id, answers: answersFor(99), isDraft: false },
        })
      )
    );
    // Resubmission stays allowed, so every attempt either wins or is rejected
    // for a stated reason — none may crash or duplicate the submission.
    for (const final of finals) expect([200, 403, 409]).toContain(final.status());

    const submitted = await request.get(`/api/submissions?assignmentId=${assignment.id}`, {
      ...asUser(request, TEST_STUDENT_EMAIL),
    });
    const submittedBody = await submitted.json();
    expect(submittedBody.submission.isDraft).toBe(false);
    expect(submittedBody.submission.answers).toHaveLength(assignment.questions.length);
  });
});
