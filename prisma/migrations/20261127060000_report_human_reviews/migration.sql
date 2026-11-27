-- CreateTable
CREATE TABLE "ReportHumanReview" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "graderId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "graderLabel" TEXT,
    "total" DECIMAL(10,2),
    "comments" TEXT,
    "gradedAt" TIMESTAMP(3),
    "aiRevealedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportHumanReview_pkey" PRIMARY KEY ("id")
);

-- Backfill one review per existing report job that already has human scores,
-- comments, or an AI-reveal timestamp so no historical data is lost.
INSERT INTO "ReportHumanReview" (
    "id",
    "jobId",
    "graderId",
    "slotKey",
    "total",
    "comments",
    "gradedAt",
    "aiRevealedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'rhr_' || j."id",
    j."id",
    COALESCE(j."humanGradedById", j."createdById"),
    'user:' || COALESCE(j."humanGradedById", j."createdById"),
    j."humanTotal",
    j."humanComments",
    j."humanGradedAt",
    j."aiRevealedAt",
    COALESCE(j."humanGradedAt", j."createdAt"),
    COALESCE(j."updatedAt", CURRENT_TIMESTAMP)
FROM "ReportGradingJob" j
WHERE j."humanGradedById" IS NOT NULL
   OR j."humanGradedAt" IS NOT NULL
   OR j."humanTotal" IS NOT NULL
   OR j."humanComments" IS NOT NULL
   OR j."aiRevealedAt" IS NOT NULL
   OR EXISTS (
       SELECT 1 FROM "ReportHumanScore" s WHERE s."jobId" = j."id"
   );

-- AlterTable
ALTER TABLE "ReportHumanScore" ADD COLUMN "reviewId" TEXT;

UPDATE "ReportHumanScore"
SET "reviewId" = 'rhr_' || "jobId"
WHERE "reviewId" IS NULL;

ALTER TABLE "ReportHumanScore" ALTER COLUMN "reviewId" SET NOT NULL;

-- DropIndex
DROP INDEX "ReportHumanScore_jobId_criterion_key";

-- CreateIndex
CREATE UNIQUE INDEX "ReportHumanReview_jobId_slotKey_key" ON "ReportHumanReview"("jobId", "slotKey");

-- CreateIndex
CREATE INDEX "ReportHumanReview_jobId_idx" ON "ReportHumanReview"("jobId");

-- CreateIndex
CREATE INDEX "ReportHumanReview_graderId_idx" ON "ReportHumanReview"("graderId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportHumanScore_reviewId_criterion_key" ON "ReportHumanScore"("reviewId", "criterion");

-- CreateIndex
CREATE INDEX "ReportHumanScore_jobId_idx" ON "ReportHumanScore"("jobId");

-- AddForeignKey
ALTER TABLE "ReportHumanReview" ADD CONSTRAINT "ReportHumanReview_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ReportGradingJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportHumanReview" ADD CONSTRAINT "ReportHumanReview_graderId_fkey" FOREIGN KEY ("graderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportHumanScore" ADD CONSTRAINT "ReportHumanScore_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ReportHumanReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
