-- AlterTable
ALTER TABLE "PresentationGradingJob" ADD COLUMN     "feedbackSentAt" TIMESTAMP(3),
ADD COLUMN     "feedbackSentTo" TEXT;

-- AlterTable
ALTER TABLE "PresentationRosterEntry" ADD COLUMN     "email" TEXT;

-- AlterTable
ALTER TABLE "ReportGradingJob" ADD COLUMN     "feedbackSentAt" TIMESTAMP(3),
ADD COLUMN     "feedbackSentTo" TEXT;
