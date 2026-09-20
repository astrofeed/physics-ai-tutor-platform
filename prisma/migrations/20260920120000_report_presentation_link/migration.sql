-- AlterTable
ALTER TABLE "ReportGradingJob" ADD COLUMN     "presentationJobId" TEXT;

-- CreateIndex
CREATE INDEX "ReportGradingJob_presentationJobId_idx" ON "ReportGradingJob"("presentationJobId");

-- AddForeignKey
ALTER TABLE "ReportGradingJob" ADD CONSTRAINT "ReportGradingJob_presentationJobId_fkey" FOREIGN KEY ("presentationJobId") REFERENCES "PresentationGradingJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
