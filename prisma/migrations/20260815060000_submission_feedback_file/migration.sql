-- Graders used to have their feedback attachment written into
-- "Submission"."fileUrl", overwriting the student's own upload.
ALTER TABLE "Submission" ADD COLUMN "feedbackFileUrl" TEXT;
