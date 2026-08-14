import { NextResponse } from "next/server";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { compressAndContinueConversation } from "@/lib/services/conversation-compress-service";
import { logger } from "@/lib/logger";
import { z } from "zod";

const ParamsSchema = z.object({ id: z.string().min(1).max(100) });

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;

    const parsed = ParamsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid conversation id" }, { status: 400 });
    }

    const result = await compressAndContinueConversation(auth.user.id, parsed.data.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      conversation: result.conversation,
      summaryMessage: result.summaryMessage,
    });
  } catch (error) {
    logger.error("Conversation compress error", {
      route: "/api/conversations/[id]/compress",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
