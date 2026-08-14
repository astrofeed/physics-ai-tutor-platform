"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { ImageUpload } from "@/components/ui/image-upload";
import dynamic from "next/dynamic";

const MermaidDiagram = dynamic(() => import("@/components/chat/MermaidDiagram"), { ssr: false });
import { getDiagramContent } from "@/lib/diagram-utils";
import type { AssignmentQuestion } from "@/types/assignment";
import { MAX_ANSWER_LENGTH } from "@/lib/answer-limits";

interface QuestionRendererProps {
  question: AssignmentQuestion;
  index: number;
  answer: string;
  onAnswerChange: (questionId: string, value: string) => void;
  answerImages: string[];
  onAnswerImagesChange: (questionId: string, images: string[]) => void;
  onUploadImage: (file: File) => Promise<string | null>;
  uploadingImage: boolean;
}

export function QuestionRenderer({
  question,
  index,
  answer,
  onAnswerChange,
  answerImages,
  onAnswerImagesChange,
  onUploadImage,
  uploadingImage,
}: QuestionRendererProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Question {index + 1}{" "}
          <span className="text-neutral-400 font-normal">
            ({question.points} pts)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <MarkdownContent content={question.questionText} className="text-sm" />

        {(() => {
          const diag = getDiagramContent(question.diagram);
          if (!diag) return null;
          return (
            <div className="my-3 flex justify-center">
              {diag.type === "svg" ? (
                <div
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 overflow-auto max-w-full [&_svg]:w-full [&_svg]:h-auto"
                  dangerouslySetInnerHTML={{ __html: diag.content }}
                />
              ) : (
                <MermaidDiagram content={diag.content} />
              )}
            </div>
          );
        })()}

        {question.imageUrl && (
          <div className="my-3">
            <img
              src={question.imageUrl}
              alt="Question diagram"
              className="rounded-lg max-w-full border border-gray-200 dark:border-gray-700"
            />
          </div>
        )}

        {question.questionType === "MC" && question.options && (
          <div className="space-y-2">
            {(question.options as string[]).map((opt, oIndex) => (
              <label
                key={oIndex}
                className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-neutral-50 transition-colors"
              >
                <input
                  type="radio"
                  name={`q-${question.id}`}
                  value={String.fromCharCode(65 + oIndex)}
                  checked={answer === String.fromCharCode(65 + oIndex)}
                  onChange={(e) =>
                    onAnswerChange(question.id, e.target.value)
                  }
                  className="shrink-0"
                />
                <MarkdownContent
                  content={`${String.fromCharCode(65 + oIndex)}. ${opt}`}
                  className="text-sm"
                />
              </label>
            ))}
          </div>
        )}

        {question.questionType === "NUMERIC" && (
          <div className="space-y-2">
            <Label>Your Answer</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={answer}
              onChange={(e) => onAnswerChange(question.id, e.target.value)}
              placeholder="Enter a numeric value"
            />
            {answer.trim() !== "" && !Number.isFinite(Number(answer.trim())) && (
              <p className="text-xs text-red-600 dark:text-red-400">
                This question is graded as a number, so &quot;{answer.trim()}&quot; will not
                match the answer key.
              </p>
            )}
          </div>
        )}

        {question.questionType === "FREE_RESPONSE" && (
          <div className="space-y-2">
            <Label>Your Answer</Label>
            <Textarea
              value={answer}
              onChange={(e) => onAnswerChange(question.id, e.target.value)}
              placeholder="Write your answer... (supports LaTeX: $...$)"
              rows={4}
              maxLength={MAX_ANSWER_LENGTH}
            />
            {answer.length > MAX_ANSWER_LENGTH - 500 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
                {answer.length} / {MAX_ANSWER_LENGTH}
              </p>
            )}
          </div>
        )}

        {(question.questionType === "NUMERIC" ||
          question.questionType === "FREE_RESPONSE") && (
          <div className="space-y-1 mt-2">
            <Label className="text-xs text-gray-500">
              Attach images (up to 3)
            </Label>
            <ImageUpload
              images={answerImages}
              onImagesChange={(imgs) =>
                onAnswerImagesChange(question.id, imgs)
              }
              onUpload={onUploadImage}
              uploading={uploadingImage}
              maxImages={3}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
