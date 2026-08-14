import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;
    const { user } = auth;
    const userId = user.id;
    const userRole = user.role;

    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 200,
          include: {
            attachments: {
              select: { url: true, filename: true, mimeType: true, sizeBytes: true },
            },
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (conversation.userId !== userId && userRole !== "ADMIN" && userRole !== "PROFESSOR" && userRole !== "TA") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        imageUrls: m.imageUrls,
        documents: m.attachments,
        model: m.model,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error("Messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
