import { test, expect } from "@playwright/test";
import { gradeSaveUpdate } from "../src/lib/services/grading-service";

test.describe("a grader's feedback file", () => {
  test("goes to its own column and never touches the student's upload", () => {
    const update = gradeSaveUpdate({
      total: 8,
      graderId: "ta-1",
      feedbackFileUrl: "/api/files/ta1?name=ta-feedback.pdf",
    });
    expect(update.feedbackFileUrl).toBe("/api/files/ta1?name=ta-feedback.pdf");
    expect(update).not.toHaveProperty("fileUrl");
  });

  test("is cleared only when the grader removes it", () => {
    expect(gradeSaveUpdate({ total: 8, graderId: "ta-1", feedbackFileUrl: null }).feedbackFileUrl).toBeNull();
    expect(gradeSaveUpdate({ total: 8, graderId: "ta-1" })).not.toHaveProperty("feedbackFileUrl");
  });

  test("a draft save keeps the grade out of the student's view", () => {
    const draft = gradeSaveUpdate({ total: 8, graderId: "ta-1", isDraft: true });
    expect(draft).toEqual({ draftTotalScore: 8 });
  });
});
