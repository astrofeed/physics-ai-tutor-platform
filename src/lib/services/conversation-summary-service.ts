import { prisma } from "@/lib/prisma";
import { summarizeConversation } from "@/lib/ai";

/** Must match the `take` used when loading recent messages in /api/chat. */
export const CONTEXT_WINDOW_MESSAGES = 50;
/** How many messages must age out of the window before re-summarizing. */
const SUMMARY_BATCH = 10;
const MAX_CHARS_PER_MESSAGE = 4000;

/**
 * Maintains a rolling summary of messages that have aged out of the AI
 * context window. Summarizes in batches so the AI call runs at most once
 * every SUMMARY_BATCH messages, folding each batch into the prior summary.
 */
export async function refreshContextSummary(conversationId: string): Promise<void> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { contextSummary: true, contextSummaryCount: true },
  });
  if (!conversation) return;

  const totalMessages = await prisma.message.count({
    where: { conversationId },
  });
  const agedOutCount = totalMessages - CONTEXT_WINDOW_MESSAGES;
  if (agedOutCount < conversation.contextSummaryCount + SUMMARY_BATCH) return;

  const newlyAgedOut = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    skip: conversation.contextSummaryCount,
    take: agedOutCount - conversation.contextSummaryCount,
    select: { role: true, content: true },
  });
  if (newlyAgedOut.length === 0) return;

  const transcript = newlyAgedOut.map((m) => ({
    role: m.role,
    content: m.content.slice(0, MAX_CHARS_PER_MESSAGE),
  }));

  const summary = await summarizeConversation(
    transcript,
    conversation.contextSummary ?? undefined
  );
  if (!summary) return;

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { contextSummary: summary, contextSummaryCount: agedOutCount },
  });
}
