-- One live submission per student per assignment. Soft-deleted rows are excluded
-- so a student can submit again after staff remove a submission.
DELETE FROM "SubmissionAnswer"
WHERE "submissionId" IN (
  SELECT id FROM (
    SELECT id,
           row_number() OVER (
             PARTITION BY "assignmentId", "userId"
             ORDER BY "isDraft" ASC, "submittedAt" DESC, id DESC
           ) AS rn
    FROM "Submission"
    WHERE "isDeleted" = false
  ) ranked
  WHERE rn > 1
);

DELETE FROM "Submission"
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           row_number() OVER (
             PARTITION BY "assignmentId", "userId"
             ORDER BY "isDraft" ASC, "submittedAt" DESC, id DESC
           ) AS rn
    FROM "Submission"
    WHERE "isDeleted" = false
  ) ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX "Submission_assignmentId_userId_live_key"
  ON "Submission" ("assignmentId", "userId")
  WHERE "isDeleted" = false;
