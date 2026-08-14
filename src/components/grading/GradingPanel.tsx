"use client";

import React from "react";
import {
  Loader2,
  Sparkles,
  MessageSquare,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { ImageUpload } from "@/components/ui/image-upload";
import { AppealThread } from "./AppealThread";
import type { SubmissionAnswer, Appeal } from "./types";

interface GradingPanelProps {
  answers: SubmissionAnswer[];
  grades: Record<string, { score: number; feedback: string }>;
  onGradeChange: (
    answerId: string,
    field: "score" | "feedback",
    value: number | string
  ) => void;
  confirmedAnswers: Set<string>;
  onToggleConfirm: (answerId: string) => void;
  aiLoading: string | null;
  onAIGrade: (answerId: string) => void;
  /** Stored AI recommendations, keyed by answer id. */
  suggestions: Record<string, { score: number; feedback: string }>;
  onApplySuggestion: (answerId: string) => void;
  feedbackImages: Record<string, string[]>;
  onFeedbackImagesChange: (answerId: string, images: string[]) => void;
  onUploadImage: (file: File) => Promise<string | null>;
  uploadingImage: boolean;
  /** Appeal thread state */
  appealMessages: Record<string, string>;
  onAppealMessageChange: (appealId: string, value: string) => void;
  appealImages: Record<string, string[]>;
  onAppealImagesChange: (appealId: string, images: string[]) => void;
  appealNewScores: Record<string, string>;
  onAppealNewScoreChange: (appealId: string, value: string) => void;
  expandedAppeals: Record<string, boolean>;
  onToggleAppealExpand: (appealId: string) => void;
  resolvingAppeal: string | null;
  onResolveAppeal: (
    appealId: string,
    status: "RESOLVED" | "REJECTED" | "OPEN"
  ) => void;
  onSendAppealMessage: (appealId: string) => void;
}

function ReferenceAnswer({ answer }: { answer: string }) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-4">
      <div className="flex items-center gap-1.5">
        <KeyRound className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
          Reference answer
        </p>
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:underline"
        >
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {visible && (
        <MarkdownContent
          content={answer}
          className="mt-2 text-sm text-emerald-900 dark:text-emerald-100"
        />
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  maxPoints,
  onApply,
}: {
  suggestion: { score: number; feedback: string };
  maxPoints: number;
  onApply: () => void;
}) {
  return (
    <div className="rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/30 p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">
          AI suggestion: {suggestion.score}/{maxPoints} — not counted until you apply and save it
        </p>
        <Button size="sm" variant="outline" onClick={onApply} className="rounded-lg">
          Apply
        </Button>
      </div>
      {suggestion.feedback && (
        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
          {suggestion.feedback}
        </p>
      )}
    </div>
  );
}

export function GradingPanel({
  answers,
  grades,
  onGradeChange,
  confirmedAnswers,
  onToggleConfirm,
  aiLoading,
  onAIGrade,
  suggestions,
  onApplySuggestion,
  feedbackImages,
  onFeedbackImagesChange,
  onUploadImage,
  uploadingImage,
  appealMessages,
  onAppealMessageChange,
  appealImages,
  onAppealImagesChange,
  appealNewScores,
  onAppealNewScoreChange,
  expandedAppeals,
  onToggleAppealExpand,
  resolvingAppeal,
  onResolveAppeal,
  onSendAppealMessage,
}: GradingPanelProps) {
  /**
   * Enter in a score box confirms that question and moves to the next one, so a
   * submission can be graded without reaching for the mouse; Alt+F fills the max.
   */
  const handleScoreKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    answer: SubmissionAnswer,
    index: number
  ) => {
    if (event.altKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      onGradeChange(answer.id, "score", answer.maxPoints);
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!answer.autoGraded && !confirmedAnswers.has(answer.id)) {
      onToggleConfirm(answer.id);
    }
    const next = document.querySelector<HTMLInputElement>(
      `[data-score-input="${index + 1}"]`
    );
    next?.focus();
    next?.select();
  };

  return (
    <>
      {answers.map((answer, index) => (
        <div
          key={answer.id}
          className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm"
        >
          {/* Question Header */}
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold">
                {index + 1}
              </span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Question {index + 1}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                ({answer.maxPoints} pts)
              </span>
            </div>
            {answer.autoGraded && (
              <Badge className="bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 text-xs">
                Auto-graded — edit the score to override
              </Badge>
            )}
          </div>

          <div className="p-5 space-y-4">
            <MarkdownContent
              content={answer.questionText}
              className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
            />

            {/* Student Answer */}
            <div
              className={`rounded-lg p-4 border ${
                answer.leftBlank
                  ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
                  : "bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-800"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Student Answer
                </p>
              </div>
              {answer.leftBlank ? (
                <p className="text-sm text-red-600 dark:text-red-400 italic">
                  Student left this question blank
                </p>
              ) : (
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  {answer.answer || "No typed answer provided"}
                </p>
              )}
              {answer.answerImageUrls &&
                (answer.answerImageUrls as string[]).length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {(answer.answerImageUrls as string[]).map(
                      (url: string, i: number) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={url}
                            alt={`Answer image ${i + 1}`}
                            className="h-20 w-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity"
                          />
                        </a>
                      )
                    )}
                  </div>
                )}
            </div>

            {/* Score + Confirm + AI Assist */}
            <div className="flex items-end gap-4">
              <div className="space-y-1.5 flex-1 max-w-[200px]">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                  Score (max {answer.maxPoints})
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={answer.maxPoints}
                    data-score-input={index}
                    value={grades[answer.id]?.score || 0}
                    onChange={(e) =>
                      onGradeChange(answer.id, "score", Number(e.target.value))
                    }
                    onKeyDown={(e) => handleScoreKeyDown(e, answer, index)}
                    className="font-semibold text-center"
                  />
                  {!answer.autoGraded && (
                    <button
                      type="button"
                      onClick={() => onToggleConfirm(answer.id)}
                      className={`shrink-0 h-8 w-8 rounded-md border-2 flex items-center justify-center transition-colors ${
                        confirmedAnswers.has(answer.id)
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-gray-300 dark:border-gray-600 hover:border-emerald-400"
                      }`}
                      title={
                        confirmedAnswers.has(answer.id)
                          ? "Unconfirm score"
                          : "Confirm score"
                      }
                    >
                      {confirmedAnswers.has(answer.id) && (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
              {!answer.autoGraded && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAIGrade(answer.id)}
                  disabled={aiLoading === answer.id}
                  className="gap-1.5 rounded-lg"
                >
                  {aiLoading === answer.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  AI Assist
                </Button>
              )}
            </div>

            {answer.referenceAnswer && (
              <ReferenceAnswer answer={answer.referenceAnswer} />
            )}

            {suggestions[answer.id] && (
              <SuggestionCard
                suggestion={suggestions[answer.id]}
                maxPoints={answer.maxPoints}
                onApply={() => onApplySuggestion(answer.id)}
              />
            )}

            {/* Feedback */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                Feedback
              </label>
              <Textarea
                value={grades[answer.id]?.feedback || ""}
                onChange={(e) => onGradeChange(answer.id, "feedback", e.target.value)}
                placeholder="Add feedback for the student..."
                rows={2}
                className="resize-none"
              />
              <ImageUpload
                images={feedbackImages[answer.id] || []}
                onImagesChange={(imgs) => onFeedbackImagesChange(answer.id, imgs)}
                onUpload={onUploadImage}
                uploading={uploadingImage}
                maxImages={3}
              />
            </div>

            {/* Appeals for this question */}
            {answer.appeals.length > 0 && (
              <div className="space-y-2">
                {answer.appeals.map((appeal: Appeal) => (
                  <AppealThread
                    key={appeal.id}
                    appeal={appeal}
                    isExpanded={expandedAppeals[appeal.id] || false}
                    onToggleExpand={() => onToggleAppealExpand(appeal.id)}
                    maxPoints={answer.maxPoints}
                    message={appealMessages[appeal.id] || ""}
                    onMessageChange={(v) => onAppealMessageChange(appeal.id, v)}
                    images={appealImages[appeal.id] || []}
                    onImagesChange={(imgs) =>
                      onAppealImagesChange(appeal.id, imgs)
                    }
                    onUploadImage={onUploadImage}
                    uploadingImage={uploadingImage}
                    newScore={appealNewScores[appeal.id] || ""}
                    onNewScoreChange={(v) =>
                      onAppealNewScoreChange(appeal.id, v)
                    }
                    resolving={resolvingAppeal === appeal.id}
                    onResolve={(status) => onResolveAppeal(appeal.id, status)}
                    onSendMessage={() => onSendAppealMessage(appeal.id)}
                    showPreview
                    viewerRole="TA"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
