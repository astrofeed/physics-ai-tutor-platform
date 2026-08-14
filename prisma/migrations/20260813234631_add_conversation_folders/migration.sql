-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "ConversationFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationFolder_userId_createdAt_idx" ON "ConversationFolder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_folderId_idx" ON "Conversation"("folderId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ConversationFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationFolder" ADD CONSTRAINT "ConversationFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
