-- AlterTable
ALTER TABLE "PresentationGradingJob" ADD COLUMN     "aiRevealedAt" TIMESTAMP(3),
ADD COLUMN     "humanGradedAt" TIMESTAMP(3),
ADD COLUMN     "humanGradedById" TEXT;

-- AlterTable
ALTER TABLE "ReportGradingJob" ADD COLUMN     "aiRevealedAt" TIMESTAMP(3),
ADD COLUMN     "humanGradedAt" TIMESTAMP(3),
ADD COLUMN     "humanGradedById" TEXT;

-- CreateTable
CREATE TABLE "ReportHumanScore" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "criterion" TEXT NOT NULL,
    "score" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ReportHumanScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresentationHumanScore" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "score" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PresentationHumanScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportHumanScore_jobId_criterion_key" ON "ReportHumanScore"("jobId", "criterion");

-- CreateIndex
CREATE UNIQUE INDEX "PresentationHumanScore_jobId_category_key" ON "PresentationHumanScore"("jobId", "category");

-- AddForeignKey
ALTER TABLE "ReportGradingJob" ADD CONSTRAINT "ReportGradingJob_humanGradedById_fkey" FOREIGN KEY ("humanGradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportHumanScore" ADD CONSTRAINT "ReportHumanScore_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ReportGradingJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentationGradingJob" ADD CONSTRAINT "PresentationGradingJob_humanGradedById_fkey" FOREIGN KEY ("humanGradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentationHumanScore" ADD CONSTRAINT "PresentationHumanScore_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "PresentationGradingJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
