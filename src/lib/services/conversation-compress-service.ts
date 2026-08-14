import { prisma } from "@/lib/prisma";
import { summarizeConversation, getActiveChatModel } from "@/lib/ai";

const MAX_MESSAGES_TO_SUMMARIZE = 100;
const MAX_CHARS_PER_MESSAGE = 4000;
const CONVERSATION_LIMIT = 50;

export type CompressResult =
  | { ok: true; conversation: { id: string; title: string; updatedAt: Date }; summaryMessage: { id: string; role: string; content: string } }
  | { ok: false; status: number; error: string };

export async function compressAndContinueConversation(
  userId: string,
  conversationId: string
): Promise<CompressResult> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation || conversation.userId !== userId || conversation.isDeleted) {
    return { ok: false, status: 404, error: "Conversation not found" };
  }

  const recentMessages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: MAX_MESSAGES_TO_SUMMARIZE,
    select: { role: true, content: true },
  });
  if (recentMessages.length === 0) {
    return { ok: false, status: 400, error: "Conversation has no messages to compress" };
  }

  const activeConvCount = await prisma.conversation.count({
    where: { userId, isDeleted: false },
  });
  if (activeConvCount >= CONVERSATION_LIMIT) {
    return {
      ok: false,
      status: 429,
      error: `You have reached the maximum of ${CONVERSATION_LIMIT} conversations. Please delete some old conversations first.`,
    };
  }

  const transcript = recentMessages.reverse().map((m) => ({
    role: m.role,
    content: m.content.slice(0, MAX_CHARS_PER_MESSAGE),
  }));

  const summary = await summarizeConversation(transcript);
  if (!summary) {
    return { ok: false, status: 502, error: "Failed to generate conversation summary" };
  }

  const title = `${conversation.title.slice(0, 180)} (continued)`;
  const summaryContent = `**Summary of previous conversation** (compressed from "${conversation.title}"):\n\n${summary}`;

  const newConversation = await prisma.conversation.create({
    data: {
      userId,
      title,
      messages: {
        create: {
          role: "assistant",
          content: summaryContent,
          model: getActiveChatModel(),
        },
      },
    },
    include: { messages: true },
  });

  return {
    ok: true,
    conversation: {
      id: newConversation.id,
      title: newConversation.title,
      updatedAt: newConversation.updatedAt,
    },
    summaryMessage: {
      id: newConversation.messages[0].id,
      role: newConversation.messages[0].role,
      content: newConversation.messages[0].content,
    },
  };
}
