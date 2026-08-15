import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { streamGenerateProblems, type AIProvider } from "@/lib/ai";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { normalizeMcAnswerKey } from "@/lib/mc-answer-key";
import { mcKeyFromValue, stripOptionLabels } from "@/lib/generated-problem";

const GenerateSchema = z.object({
  topic: z.string().min(1).max(200),
  difficulty: z.number().int().min(1).max(5),
  count: z.number().int().min(1).max(20),
  questionType: z.enum(["MC", "NUMERIC", "FREE_RESPONSE"]),
  customInstructions: z.string().max(5000).optional(),
});

/**
 * Aligns a generated answer key with what the auto-grader expects. For MC the
 * answer's value wins over the letter the model states, because the letter is
 * the field it gets wrong (a solution deriving option B ending "Option C").
 */
function normalizeGeneratedAnswer(
  answer: string,
  questionType: string,
  options: string[] | null,
  answerValue?: string
): string {
  if (questionType === "MC") {
    const fromValue = answerValue ? mcKeyFromValue(answerValue, options ?? []) : null;
    return fromValue ?? normalizeMcAnswerKey(answer, options ?? []) ?? answer.trim();
  }
  if (questionType === "NUMERIC") {
    const numeric = answer.replace(/\$/g, "").match(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/);
    return numeric ? numeric[0] : answer.trim();
  }
  return answer;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeDiagram(raw: any): { type: string; content: string } | null {
  if (!raw) return null;

  // Standard format: { type: "svg"|"mermaid", content: "..." }
  if (typeof raw === "object" && raw.content && typeof raw.content === "string") {
    return { type: String(raw.type || "svg").toLowerCase(), content: raw.content };
  }

  // Alternative: { svg: "<svg>..." } or { mermaid: "graph ..." }
  if (typeof raw === "object") {
    if (raw.svg && typeof raw.svg === "string") return { type: "svg", content: raw.svg };
    if (raw.mermaid && typeof raw.mermaid === "string") return { type: "mermaid", content: raw.mermaid };
    // { code: "..." } with type
    if (raw.code && typeof raw.code === "string") return { type: String(raw.type || "svg").toLowerCase(), content: raw.code };
  }

  // Raw SVG string
  if (typeof raw === "string" && raw.trim().startsWith("<svg")) {
    return { type: "svg", content: raw.trim() };
  }

  return null;
}

// Extract inline SVG from questionText and move it to the diagram field
function extractSvgFromText(text: string): { cleanText: string; diagram: { type: string; content: string } | null } {
  // Check for ```svg code blocks
  const svgBlockMatch = text.match(/```svg\s*([\s\S]*?)```/i);
  if (svgBlockMatch && svgBlockMatch[1].trim().startsWith("<svg")) {
    return {
      cleanText: text.replace(svgBlockMatch[0], "").trim(),
      diagram: { type: "svg", content: svgBlockMatch[1].trim() },
    };
  }

  // Check for raw <svg>...</svg> in text
  const rawSvgMatch = text.match(/(<svg[\s\S]*?<\/svg>)/i);
  if (rawSvgMatch) {
    return {
      cleanText: text.replace(rawSvgMatch[0], "").trim(),
      diagram: { type: "svg", content: rawSvgMatch[1].trim() },
    };
  }

  return { cleanText: text, diagram: null };
}

export async function GET() {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;

    const problemSets = await prisma.problemSet.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        problems: true,
        createdBy: { select: { name: true } },
      },
    });

    return Response.json({
      problemSets: problemSets.map((ps) => ({
        id: ps.id,
        topic: ps.topic,
        difficulty: ps.difficulty,
        questionType: ps.questionType,
        createdBy: ps.createdBy.name,
        createdById: ps.createdById,
        createdAt: ps.createdAt.toISOString(),
        // Sets generated before option labels were stripped are cleaned on read,
        // so reusing an old set doesn't carry "A. A." into a new assignment.
        problems: ps.problems.map((problem) => ({
          ...problem,
          options: Array.isArray(problem.options)
            ? stripOptionLabels(problem.options.map(String))
            : problem.options,
        })),
      })),
    });
  } catch (error) {
    console.error("Problem sets fetch error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;
    const userId = auth.user.id;
    const userRole = auth.user.role;

    const { id } = await req.json();
    if (!id) {
      return Response.json({ error: "Missing problem set ID" }, { status: 400 });
    }

    const problemSet = await prisma.problemSet.findUnique({ where: { id } });
    if (!problemSet) {
      return Response.json({ error: "Problem set not found" }, { status: 404 });
    }

    // ADMIN/PROFESSOR can delete any; TA can only delete their own
    if (userRole !== "ADMIN" && userRole !== "PROFESSOR" && problemSet.createdById !== userId) {
      return Response.json({ error: "Forbidden: you can only delete your own problem sets" }, { status: 403 });
    }

    // Cascade delete: GeneratedProblem has onDelete: Cascade in schema
    await prisma.problemSet.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete problem set error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;
    const userId = auth.user.id;

    const parseResult = GenerateSchema.safeParse(await req.json());
    if (!parseResult.success) {
      return Response.json(
        { error: parseResult.error.issues[0]?.message || "Invalid request" },
        { status: 400 }
      );
    }
    const { topic, difficulty, count, questionType, customInstructions } = parseResult.data;

    const aiConfig = await prisma.aIConfig.findFirst({
      where: { isActive: true },
    });

    const provider = (aiConfig?.provider as AIProvider) || "openai";

    const encoder = new TextEncoder();
    let fullContent = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          if (provider === "openai") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const stream = await streamGenerateProblems(topic, difficulty, count, questionType, "openai", customInstructions) as any;
            for await (const event of stream) {
              if (event.type === "response.output_text.delta") {
                const delta = event.delta || "";
                if (delta) {
                  fullContent += delta;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`));
                }
              }
            }
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const stream = await streamGenerateProblems(topic, difficulty, count, questionType, "anthropic", customInstructions) as any;
            for await (const event of stream) {
              if (event.type === "content_block_delta" && event.delta?.text) {
                fullContent += event.delta.text;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", content: event.delta.text })}\n\n`));
              }
            }
          }
        } catch (aiError) {
          console.error("AI Error:", aiError);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: "Problem generation failed" })}\n\n`));
          controller.close();
          return;
        }

        // Parse JSON and persist
        try {
          // Extract JSON from possible markdown code fence
          let jsonStr = fullContent.trim();
          const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (fenceMatch) jsonStr = fenceMatch[1].trim();

          const parsed = JSON.parse(jsonStr);
          const problems = parsed.problems || parsed.questions || [parsed];

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const normalizedProblems = problems.map((p: any) => {
            let diagram = normalizeDiagram(p.diagram);
            let questionText = p.questionText || "";

            // If no diagram field, check if SVG is embedded in questionText
            if (!diagram) {
              const extracted = extractSvgFromText(questionText);
              if (extracted.diagram) {
                diagram = extracted.diagram;
                questionText = extracted.cleanText;
              }
            }

            const type = p.questionType || questionType;
            const options: string[] | null = Array.isArray(p.options)
              ? stripOptionLabels(p.options.map(String))
              : null;

            return {
              questionText,
              questionType: type,
              options,
              correctAnswer: normalizeGeneratedAnswer(
                String(p.correctAnswer || ""),
                type,
                options,
                p.correctAnswerValue ? String(p.correctAnswerValue) : undefined
              ),
              solution: p.solution || "",
              points: p.points || 10,
              diagram,
            };
          });

          const problemSet = await prisma.problemSet.create({
            data: {
              topic,
              difficulty,
              questionType,
              createdById: userId,
              problems: {
                create: normalizedProblems,
              },
            },
            include: { problems: true },
          });

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", problemSetId: problemSet.id, problems: problemSet.problems })}\n\n`));
        } catch (parseError) {
          console.error("Parse/save error:", parseError);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: "Failed to parse generated problems" })}\n\n`));
        }

        controller.close();
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
    console.error("Problem generation error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
