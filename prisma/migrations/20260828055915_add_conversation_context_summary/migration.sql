-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "contextSummary" TEXT,
ADD COLUMN     "contextSummaryCount" INTEGER NOT NULL DEFAULT 0;
