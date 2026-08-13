import { prisma } from "@/lib/prisma";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { streamChat, SOCRATIC_SYSTEM_PROMPT, EXAM_MODE_SYSTEM_PROMPT, type ChatMessage, type AIProvider } from "@/lib/ai";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkContentFlags, handleContentFlag, trackRateLimitAbuse } from "@/lib/abuse-detection";
import { checkAndBanSpammer } from "@/lib/spam-guard";
import { logger } from "@/lib/logger";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: Request) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;
    const userId = auth.user.id;

    // Check if user is banned or restricted from using AI chat
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isBanned: true, isRestricted: true },
    });

    if (!user) {
      return Response.json(
        { error: "User not found. Please sign out and sign back in." },
        { status: 401 }
      );
    }

    if (user?.isBanned) {
      return Response.json(
        { error: "Your account has been suspended. Please contact an administrator." },
        { status: 403 }
      );
    }

    if (user?.isRestricted) {
      return Response.json(
        { error: "Your account has been restricted from using AI chat. Please contact your instructor." },
        { status: 403 }
      );
    }

    const userName = auth.user.name || "Unknown";

    const rateCheck = checkRateLimit(userId, user?.isRestricted || false);
    if (!rateCheck.allowed) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: "rate_limit_hit",
          details: { remaining: rateCheck.remaining, resetAt: new Date(rateCheck.resetAt).toISOString() },
        },
      });
      // Fire-and-forget: track rate limit abuse escalation
      trackRateLimitAbuse(userId, userName).catch((err) => console.error("[abuse] Failed to track rate limit abuse:", err));
      return Response.json(
        { error: `Rate limit exceeded. Please wait before sending more messages. Resets at ${new Date(rateCheck.resetAt).toLocaleTimeString()}.` },
        { status: 429 }
      );
    }

    const { conversationId, message, imageUrls, model, mode } = await req.json();

    // Validate message size to prevent abuse
    if (typeof message !== "string" || message.length > 50000) {
      return Response.json(
        { error: "Message is too long. Maximum 50,000 characters." },
        { status: 413 }
      );
    }

    // Fire-and-forget: check content for jailbreak/prompt injection patterns
    const contentFlags = checkContentFlags(message);
    if (contentFlags.length > 0) {
      handleContentFlag(userId, userName, message, contentFlags).catch((err) => console.error("[content-flag] Failed to handle content flag:", err));
    }

    let convId = conversationId;

    if (!convId) {
      // Enforce conversation limit (50 active conversations per user)
      const activeConvCount = await prisma.conversation.count({
        where: { userId, isDeleted: false },
      });
      if (activeConvCount >= 50) {
        return Response.json(
          { error: "You have reached the maximum of 50 conversations. Please delete some old conversations to create a new one." },
          { status: 429 }
        );
      }

      const conversation = await prisma.conversation.create({
        data: {
          userId,
          title: message.slice(0, 50) || "New Chat",
        },
      });
      convId = conversation.id;
    }

    await prisma.message.create({
      data: {
        conversationId: convId,
        role: "user",
        content: message,
        imageUrls: imageUrls || [],
        mode: mode || "normal",
      },
    });

    // Check for chat spam (30 messages/min auto-ban, non-blocking)
    checkAndBanSpammer({ userId, source: "chat" }).catch((err) => console.error("[spam] Failed to check spammer:", err));

    // Load last 50 messages for AI context (avoids unbounded query + token limits)
    const recentMessages = await prisma.message.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const previousMessages = recentMessages.reverse();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chatMessages: ChatMessage[] = previousMessages.map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      imageUrls: m.imageUrls?.length ? m.imageUrls : undefined,
    }));

    const provider: AIProvider = model?.startsWith("claude") ? "anthropic" : "openai";

    const aiConfig = await prisma.aIConfig.findFirst({
      where: { isActive: true },
    });

    // Check exam mode — enforced server-side for students
    const userRole = auth.user.role;
    let systemPrompt: string | undefined;

    if (userRole === "STUDENT") {
      const examMode = await prisma.examMode.findFirst({
        orderBy: { toggledAt: "desc" },
        select: { isActive: true },
      });
      if (examMode?.isActive) {
        systemPrompt = EXAM_MODE_SYSTEM_PROMPT;
      }
    }

    if (!systemPrompt) {
      systemPrompt = mode === "socratic" ? SOCRATIC_SYSTEM_PROMPT : (aiConfig?.systemPrompt || undefined);
    }

    // Stream response via SSE
    const encoder = new TextEncoder();
    let fullContent = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send conversationId as first event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "meta", conversationId: convId })}\n\n`));

          if (provider === "openai") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const stream = await streamChat(chatMessages, "openai", model || "gpt-5.2", systemPrompt) as any;
            for await (const event of stream) {
              if (event.type === "response.reasoning_summary_text.delta") {
                const delta = event.delta || "";
                if (delta) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "thinking", content: delta })}\n\n`));
                }
              } else if (event.type === "response.output_text.delta") {
                const delta = event.delta || "";
                if (delta) {
                  fullContent += delta;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`));
                }
              }
            }
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const stream = await streamChat(chatMessages, "anthropic", model, systemPrompt) as any;
            for await (const event of stream) {
              if (event.type === "content_block_delta" && event.delta?.text) {
                fullContent += event.delta.text;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", content: event.delta.text })}\n\n`));
              }
            }
          }
        } catch (aiError) {
          logger.error("AI streaming error", {
            route: "/api/chat",
            userId,
            error: aiError instanceof Error ? aiError.message : String(aiError),
          });

          if (aiError instanceof Error && (aiError.message.includes("rate limit") || aiError.message.includes("429"))) {
            fullContent = "The AI service is currently rate limited. Please wait a moment and try again.";
          } else if (aiError instanceof Error && (aiError.message.includes("401") || aiError.message.includes("authentication") || aiError.message.includes("API key") || aiError.message.includes("apiKey") || aiError.message.includes("credentials") || aiError.message.includes("not configured"))) {
            fullContent = "AI service authentication error. Please contact an administrator to check API key configuration.";
          } else {
            fullContent = "I'm sorry, I encountered an error while processing your request. Please try again shortly.";
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", content: fullContent })}\n\n`));
        }

        // Save to DB after stream completes
        try {
          await prisma.message.create({
            data: {
              conversationId: convId,
              role: "assistant",
              content: fullContent,
              model: model || "gpt-5.2",
              mode: mode || "normal",
            },
          });

          await prisma.conversation.update({
            where: { id: convId },
            data: { updatedAt: new Date() },
          });

        } catch (dbError) {
          logger.error("Failed to save assistant message to DB", {
            route: "/api/chat",
            userId,
            conversationId: convId,
            error: dbError instanceof Error ? dbError.message : String(dbError),
          });
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
        controller.close();

        // Generate AI title for new conversations (fire-and-forget, non-blocking)
        if (!conversationId && fullContent && process.env.ANTHROPIC_API_KEY) {
          (async () => {
            try {
              const titleClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
              const titleResponse = await titleClient.messages.create({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 50,
                messages: [{
                  role: "user",
                  content: `Generate a concise title (max 6 words) for this conversation. The title should accurately reflect the topic of the question. Reply with ONLY the title, no quotes.\n\nQuestion: ${message}\n\nAI answer (for context only): ${fullContent.slice(0, 100)}`,
                }],
              });
              const titleBlock = titleResponse.content[0];
              const generatedTitle = titleBlock.type === "text" ? titleBlock.text.trim() : null;
              if (generatedTitle) {
                await prisma.conversation.update({
                  where: { id: convId },
                  data: { title: generatedTitle },
                });
              }
            } catch (titleError) {
              logger.warn("Failed to generate conversation title", {
                route: "/api/chat",
                userId,
                conversationId: convId,
                error: titleError instanceof Error ? titleError.message : String(titleError),
              });
            }
          })();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    logger.error("Chat route error", {
      route: "/api/chat",
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (error instanceof Error) {
      if (error.message.includes("rate limit") || error.message.includes("429")) {
        return Response.json(
          { error: "AI service rate limited. Please try again in a moment." },
          { status: 429 }
        );
      }
      if (error.message.includes("401") || error.message.includes("API key") || error.message.includes("authentication")) {
        return Response.json(
          { error: "AI service configuration error. Please contact an administrator." },
          { status: 502 }
        );
      }
    }

    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
