-- AlterTable
ALTER TABLE "PresentationGradingJob" ADD COLUMN     "humanComments" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ReportGradingJob" ADD COLUMN     "humanComments" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
