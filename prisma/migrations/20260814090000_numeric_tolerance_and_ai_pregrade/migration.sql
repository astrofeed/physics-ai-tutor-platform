-- CreateEnum
CREATE TYPE "ToleranceUnit" AS ENUM ('ABSOLUTE', 'PERCENT');

-- AlterTable
ALTER TABLE "AssignmentQuestion" ADD COLUMN "tolerance" DECIMAL(12,6),
ADD COLUMN "toleranceUnit" "ToleranceUnit" NOT NULL DEFAULT 'ABSOLUTE';

-- AlterTable
ALTER TABLE "SubmissionAnswer" ADD COLUMN "aiSuggestedScore" DECIMAL(10,2),
ADD COLUMN "aiSuggestedFeedback" TEXT,
ADD COLUMN "aiSuggestedAt" TIMESTAMP(3);
