-- CreateEnum
CREATE TYPE "PresentationJobStatus" AS ENUM ('QUEUED', 'TRANSCRIBING', 'GRADING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "PresentationRubric" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresentationRubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresentationGradingJob" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "track" TEXT,
    "condition" TEXT,
    "status" "PresentationJobStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "audioBlobUrl" TEXT,
    "slidesBlobUrl" TEXT,
    "slidesFilename" TEXT,
    "transcript" TEXT,
    "slidesText" TEXT,
    "partIOutput" TEXT,
    "partIIOutput" TEXT,
    "summaryJson" TEXT,
    "totalScore" DECIMAL(10,2),
    "model" TEXT,
    "reasoningEffort" TEXT NOT NULL DEFAULT 'high',
    "gradingStartedAt" TIMESTAMP(3),
    "gradingDurationMs" INTEGER,
    "rubricId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PresentationGradingJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PresentationRubric_version_key" ON "PresentationRubric"("version");

-- CreateIndex
CREATE INDEX "PresentationGradingJob_rubricId_idx" ON "PresentationGradingJob"("rubricId");

-- CreateIndex
CREATE INDEX "PresentationGradingJob_status_createdAt_idx" ON "PresentationGradingJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PresentationGradingJob_createdById_createdAt_idx" ON "PresentationGradingJob"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "PresentationRubric" ADD CONSTRAINT "PresentationRubric_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentationGradingJob" ADD CONSTRAINT "PresentationGradingJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentationGradingJob" ADD CONSTRAINT "PresentationGradingJob_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "PresentationRubric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
