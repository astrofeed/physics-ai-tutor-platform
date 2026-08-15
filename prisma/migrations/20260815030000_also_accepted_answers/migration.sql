-- Extra answers that also score full marks alongside `correctAnswer`.
ALTER TABLE "AssignmentQuestion"
  ADD COLUMN "alsoAcceptedAnswers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
