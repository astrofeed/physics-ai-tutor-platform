-- Assignments built from AI-generated problems need every answer key confirmed
-- by a human before they can be published.
ALTER TABLE "Assignment" ADD COLUMN "requiresKeyReview" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AssignmentQuestion" ADD COLUMN "keyConfirmedAt" TIMESTAMP(3);
ALTER TABLE "AssignmentQuestion" ADD COLUMN "keyConfirmedById" TEXT;

CREATE INDEX "AssignmentQuestion_keyConfirmedById_idx" ON "AssignmentQuestion"("keyConfirmedById");

ALTER TABLE "AssignmentQuestion"
  ADD CONSTRAINT "AssignmentQuestion_keyConfirmedById_fkey"
  FOREIGN KEY ("keyConfirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
