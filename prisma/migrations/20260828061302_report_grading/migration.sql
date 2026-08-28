-- CreateEnum
CREATE TYPE "ReportJobStatus" AS ENUM ('QUEUED', 'GRADING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "ReportRubric" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportRubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportGradingJob" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT,
    "status" "ReportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "reportBlobUrl" TEXT,
    "reportFilename" TEXT,
    "reportText" TEXT,
    "resultJson" TEXT,
    "model" TEXT,
    "reasoningEffort" TEXT NOT NULL DEFAULT 'high',
    "gradingStartedAt" TIMESTAMP(3),
    "gradingDurationMs" INTEGER,
    "rubricId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReportGradingJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportRubric_version_key" ON "ReportRubric"("version");

-- CreateIndex
CREATE INDEX "ReportGradingJob_rubricId_idx" ON "ReportGradingJob"("rubricId");

-- CreateIndex
CREATE INDEX "ReportGradingJob_status_createdAt_idx" ON "ReportGradingJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ReportGradingJob_createdById_createdAt_idx" ON "ReportGradingJob"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "ReportRubric" ADD CONSTRAINT "ReportRubric_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportGradingJob" ADD CONSTRAINT "ReportGradingJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportGradingJob" ADD CONSTRAINT "ReportGradingJob_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "ReportRubric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
