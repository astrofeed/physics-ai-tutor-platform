-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT,
    "storageUrl" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'RESTRICTED',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UploadedFile_userId_createdAt_idx" ON "UploadedFile"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN "isLate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "dueDateAtSubmission" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN "draftTotalScore" DOUBLE PRECISION;
