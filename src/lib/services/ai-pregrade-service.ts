import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { aiAssistedGrading, type AIProvider } from "@/lib/ai";
import { toDataUri } from "@/lib/services/file-storage";
import { GradingError } from "@/lib/services/grading-service";
import { isPdfUrl } from "@/lib/upload-constraints";

export interface PregradeSuggestion {
  answerId: string;
  suggestedScore: number;
  suggestedFeedback: string;
  suggestedAt: Date;
}

const SuggestionSchema = z.object({
  score: z.coerce.number().finite(),
  feedback: z.string().default(""),
});

function parseSuggestion(raw: string, maxPoints: number) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GradingError("The AI returned a response that could not be read", 502);
  }

  const result = SuggestionSchema.safeParse(parsed);
  if (!result.success) {
    throw new GradingError("The AI returned a response that could not be read", 502);
  }

  const { score, feedback } = result.data;
  if (score < 0 || score > maxPoints) {
    throw new GradingError(
      `The AI suggested a score outside 0–${maxPoints}; grade this answer manually`,
      502
    );
  }

  return { score, feedback };
}

/**
 * Produces an AI grading suggestion for one answer and stores it beside — never
 * in — the official score. Nothing here touches `score` or `totalScore`: a
 * grader has to accept the suggestion for it to count.
 */
export async function suggestAnswerGrade(answerId: string): Promise<PregradeSuggestion> {
  const answer = await prisma.submissionAnswer.findUnique({
    where: { id: answerId },
    include: { question: { include: { rubrics: true } } },
  });
  if (!answer) {
    throw new GradingError("Answer not found", 404);
  }

  const aiConfig = await prisma.aIConfig.findFirst({ where: { isActive: true } });
  const provider = (aiConfig?.provider as AIProvider) || "openai";

  const rubricDesc = answer.question.rubrics
    .map((r) => `${r.description} (${r.points} pts)`)
    .join("\n");

  // Attachments may include a scanned PDF, which the vision models reject.
  const storedImageUrls = (
    Array.isArray(answer.answerImageUrls) ? (answer.answerImageUrls as string[]) : []
  ).filter((url) => !isPdfUrl(url));
  // Answer images live behind an authenticated route, so the model cannot fetch
  // them by URL — inline them as data URIs instead.
  const imageUrls = (await Promise.all(storedImageUrls.map(toDataUri))).filter(
    (url): url is string => Boolean(url)
  );

  const raw = await aiAssistedGrading(
    answer.question.questionText,
    answer.question.correctAnswer || "",
    answer.answer || "",
    rubricDesc || "Grade based on correctness and completeness",
    answer.question.points,
    provider,
    imageUrls.length > 0 ? imageUrls : undefined
  );
  if (!raw) {
    throw new GradingError("AI grading is unavailable right now", 502);
  }

  const { score, feedback } = parseSuggestion(raw, answer.question.points);
  const suggestedAt = new Date();

  await prisma.submissionAnswer.update({
    where: { id: answerId },
    data: {
      aiSuggestedScore: score,
      aiSuggestedFeedback: feedback,
      aiSuggestedAt: suggestedAt,
    },
  });

  return { answerId, suggestedScore: score, suggestedFeedback: feedback, suggestedAt };
}
