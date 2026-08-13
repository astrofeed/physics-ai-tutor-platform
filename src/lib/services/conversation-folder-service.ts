import { prisma } from "@/lib/prisma";

export const MAX_FOLDERS_PER_USER = 30;

export async function listFolders(userId: string) {
  return prisma.conversationFolder.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
}

export async function createFolder(userId: string, name: string) {
  const count = await prisma.conversationFolder.count({ where: { userId } });
  if (count >= MAX_FOLDERS_PER_USER) {
    return { error: `Folder limit of ${MAX_FOLDERS_PER_USER} reached` as const };
  }
  const folder = await prisma.conversationFolder.create({
    data: { userId, name },
    select: { id: true, name: true },
  });
  return { folder };
}

export async function renameFolder(userId: string, folderId: string, name: string) {
  const folder = await prisma.conversationFolder.findUnique({ where: { id: folderId } });
  if (!folder || folder.userId !== userId) return null;
  return prisma.conversationFolder.update({
    where: { id: folderId },
    data: { name },
    select: { id: true, name: true },
  });
}

export async function deleteFolder(userId: string, folderId: string) {
  const folder = await prisma.conversationFolder.findUnique({ where: { id: folderId } });
  if (!folder || folder.userId !== userId) return false;
  // Conversations inside are unfiled (folderId set to null) via ON DELETE SET NULL
  await prisma.conversationFolder.delete({ where: { id: folderId } });
  return true;
}

export async function moveConversationToFolder(
  userId: string,
  conversationId: string,
  folderId: string | null
) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation || conversation.userId !== userId || conversation.isDeleted) return null;
  if (folderId) {
    const folder = await prisma.conversationFolder.findUnique({ where: { id: folderId } });
    if (!folder || folder.userId !== userId) return null;
  }
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { folderId },
    select: { id: true, folderId: true },
  });
}
