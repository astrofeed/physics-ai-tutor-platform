"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Pencil } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { unconfirmedQuestionNumbers } from "@/lib/key-review";
import { optionLetter } from "@/lib/mc-answer-key";
import type { AssignmentQuestion } from "@/types/assignment";

interface KeyReviewSectionProps {
  assignmentId: string;
  questions: AssignmentQuestion[];
  onQuestionChange: (question: AssignmentQuestion) => void;
}

/** How the answer key reads to a reviewer: the option's letter and its text. */
function keyText(question: AssignmentQuestion, key: string): string {
  if (question.questionType !== "MC") return key;
  const index = key.trim().toUpperCase().charCodeAt(0) - 65;
  const option = question.options?.[index];
  return option ? `${optionLetter(index)}. ${option}` : key;
}

export function KeyReviewSection({
  assignmentId,
  questions,
  onQuestionChange,
}: KeyReviewSectionProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const unconfirmed = unconfirmedQuestionNumbers(
    questions.map((q) => ({ order: q.order, keyConfirmedAt: q.keyConfirmedAt ?? null }))
  );

  const setConfirmed = async (question: AssignmentQuestion, confirmed: boolean) => {
    setPendingId(question.id);
    try {
      const res = await fetch(
        `/api/assignments/${assignmentId}/questions/${question.id}/confirm-key`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmed }),
        }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error || "Failed to save the confirmation");
        return;
      }
      onQuestionChange({
        ...question,
        keyConfirmedAt: body.question.keyConfirmedAt,
        keyConfirmedBy: body.question.keyConfirmedBy,
      });
    } catch {
      toast.error("Failed to save the confirmation");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          Answer keys written by AI — confirm each one to publish
        </CardTitle>
        <p className="text-sm text-neutral-500">
          {unconfirmed.length === 0
            ? "Every answer key is confirmed. This assignment can be published."
            : `${unconfirmed.length} of ${questions.length} still to confirm: ${unconfirmed
                .map((n) => `Q${n}`)
                .join(", ")}.`}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {questions.map((question) => {
          const confirmed = question.keyConfirmedAt != null;
          return (
            <div
              key={question.id}
              className={`rounded-lg border p-4 space-y-2 ${
                confirmed
                  ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30"
                  : "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-semibold">Question {question.order + 1}</span>
                {confirmed ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Confirmed by {question.keyConfirmedBy?.name || "staff"} on{" "}
                    {new Date(question.keyConfirmedAt as string).toLocaleString()}
                  </span>
                ) : (
                  <span className="text-xs text-amber-700 dark:text-amber-400">Not confirmed</span>
                )}
              </div>

              <MarkdownContent content={question.questionText} className="text-sm" />

              {question.questionType === "MC" && question.options && (
                <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-0.5">
                  {question.options.map((option, index) => (
                    <li key={index}>
                      {optionLetter(index)}. {option}
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-sm">
                <span className="font-medium">Answer key:</span>{" "}
                {question.correctAnswer ? keyText(question, question.correctAnswer) : "—"}
                {question.questionType === "NUMERIC" && question.tolerance != null && (
                  <span className="text-neutral-500">
                    {" "}
                    (±{question.tolerance}
                    {question.toleranceUnit === "PERCENT" ? "%" : ""})
                  </span>
                )}
              </p>

              {question.alsoAcceptedAnswers && question.alsoAcceptedAnswers.length > 0 && (
                <p className="text-sm">
                  <span className="font-medium">Also accepted:</span>{" "}
                  {question.alsoAcceptedAnswers
                    .map((answer) => keyText(question, answer))
                    .join(", ")}
                </p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant={confirmed ? "outline" : "default"}
                  disabled={pendingId === question.id}
                  onClick={() => setConfirmed(question, !confirmed)}
                >
                  {pendingId === question.id && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  )}
                  {confirmed ? "Undo confirmation" : "Confirm answer"}
                </Button>
                <Link href={`/assignments/${assignmentId}/edit`}>
                  <Button size="sm" variant="ghost">
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    Fix the key
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
