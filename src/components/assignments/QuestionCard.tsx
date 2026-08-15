"use client";

import React from "react";
import {
  Trash2,
  ImagePlus,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { getDiagramContent } from "@/lib/diagram-utils";
import {
  MAX_MC_OPTIONS,
  MIN_MC_OPTIONS,
  normalizeMcAnswerKey,
  optionLetter,
} from "@/lib/mc-answer-key";
import dynamic from "next/dynamic";
import type { QuestionFormData } from "@/types/assignment";

const MermaidDiagram = dynamic(() => import("@/components/chat/MermaidDiagram"), { ssr: false });

interface QuestionCardProps {
  question: QuestionFormData;
  index: number;
  totalQuestions: number;
  showDiagrams: boolean;
  onUpdate: (field: keyof QuestionFormData, value: unknown) => void;
  onUpdateOption: (optionIndex: number, value: string) => void;
  onAddOption: () => void;
  onRemoveOption: (optionIndex: number) => void;
  onMove: (direction: "up" | "down") => void;
  onRemove: () => void;
  onImageUpload: (file: File) => void;
  onRemoveImage: () => void;
}

export function QuestionCard({
  question: q,
  index: qIndex,
  totalQuestions,
  showDiagrams,
  onUpdate,
  onUpdateOption,
  onAddOption,
  onRemoveOption,
  onMove,
  onRemove,
  onImageUpload,
  onRemoveImage,
}: QuestionCardProps) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => onMove("up")}
                disabled={qIndex === 0}
                className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Move up"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onMove("down")}
                disabled={qIndex === totalQuestions - 1}
                className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Move down"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <span className="text-sm font-medium text-neutral-500">
              Question {qIndex + 1}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-red-500 h-8 w-8"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Question Text (supports Markdown and LaTeX: $...$)</Label>
          <Textarea
            value={q.questionText}
            onChange={(e) => onUpdate("questionText", e.target.value)}
            placeholder="Enter the question (supports Markdown and LaTeX: $...$)"
            rows={2}
          />
          {q.questionText && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 text-sm overflow-x-auto">
              <p className="text-xs text-gray-400 mb-1.5">Preview</p>
              <MarkdownContent content={q.questionText} />
            </div>
          )}
        </div>

        {showDiagrams && (() => {
          const diag = getDiagramContent(q.diagram);
          if (!diag) return null;
          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Generated Diagram</Label>
                <button
                  type="button"
                  onClick={() => onUpdate("diagram", null)}
                  className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  Remove
                </button>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 overflow-auto max-w-full flex justify-center [&_svg]:w-full [&_svg]:h-auto">
                {diag.type === "svg" ? (
                  <div
                    className="w-full"
                    dangerouslySetInnerHTML={{ __html: diag.content }}
                  />
                ) : (
                  <MermaidDiagram content={diag.content} />
                )}
              </div>
            </div>
          );
        })()}

        <div className="space-y-2">
          <Label>Question Image (optional)</Label>
          {q.imagePreview || q.imageUrl ? (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={q.imagePreview || q.imageUrl || ""}
                alt="Question image"
                className="rounded-lg border border-gray-200 dark:border-gray-700 max-h-40"
              />
              <button
                type="button"
                onClick={onRemoveImage}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors w-fit">
              <ImagePlus className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Add image</span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImageUpload(file);
                }}
              />
            </label>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={q.questionType}
              onValueChange={(v) => onUpdate("questionType", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MC">Multiple Choice</SelectItem>
                <SelectItem value="NUMERIC">Numeric Answer</SelectItem>
                <SelectItem value="FREE_RESPONSE">Free Response</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Points</Label>
            <Input
              type="number"
              value={q.points}
              onChange={(e) => onUpdate("points", Number(e.target.value))}
            />
          </div>
        </div>

        {q.questionType === "MC" && (
          <div className="space-y-2">
            <Label>Options</Label>
            {q.options.map((opt, oIndex) => (
              <div key={oIndex}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium w-6">{optionLetter(oIndex)}.</span>
                  <Input
                    value={opt}
                    onChange={(e) => onUpdateOption(oIndex, e.target.value)}
                    placeholder={`Option ${optionLetter(oIndex)}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveOption(oIndex)}
                    disabled={q.options.length <= MIN_MC_OPTIONS}
                    title={
                      q.options.length <= MIN_MC_OPTIONS
                        ? `A question needs at least ${MIN_MC_OPTIONS} options`
                        : `Remove option ${optionLetter(oIndex)}`
                    }
                    className="shrink-0 text-gray-400 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {opt.includes("$") && (
                  <div className="ml-8 mt-1 text-sm overflow-x-auto">
                    <MarkdownContent content={opt} />
                  </div>
                )}
              </div>
            ))}
            {q.options.length < MAX_MC_OPTIONS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddOption}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add option
              </Button>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Options left blank are dropped when the assignment is saved.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label>Correct Answer</Label>
          {q.questionType === "MC" ? (
            <Select
              value={normalizeMcAnswerKey(q.correctAnswer, q.options) ?? ""}
              onValueChange={(value) => onUpdate("correctAnswer", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select the correct option" />
              </SelectTrigger>
              <SelectContent>
                {q.options.map((opt, oIndex) =>
                  opt.trim() ? (
                    <SelectItem key={oIndex} value={optionLetter(oIndex)}>
                      {optionLetter(oIndex)} — {opt}
                    </SelectItem>
                  ) : null
                )}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={q.correctAnswer}
              onChange={(e) => onUpdate("correctAnswer", e.target.value)}
              placeholder={
                q.questionType === "NUMERIC"
                  ? "e.g., 9.8"
                  : "Sample answer (for reference)"
              }
            />
          )}
          {q.questionType !== "MC" && q.correctAnswer.includes("$") && (
            <div className="text-sm mt-1 overflow-x-auto">
              <MarkdownContent content={q.correctAnswer} />
            </div>
          )}
        </div>

        {q.questionType === "NUMERIC" && (
          <div className="space-y-2">
            <Label>Accepted tolerance (optional)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                step="any"
                value={q.tolerance ?? ""}
                onChange={(e) =>
                  onUpdate("tolerance", e.target.value === "" ? null : Number(e.target.value))
                }
                placeholder="Blank = exact match"
              />
              <Select
                value={q.toleranceUnit}
                onValueChange={(value) => onUpdate("toleranceUnit", value)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ABSOLUTE">± absolute</SelectItem>
                  <SelectItem value="PERCENT">± percent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {q.tolerance
                ? q.toleranceUnit === "PERCENT"
                  ? `Answers within ${q.tolerance}% of ${q.correctAnswer || "the answer"} are marked correct.`
                  : `Answers within ±${q.tolerance} of ${q.correctAnswer || "the answer"} are marked correct.`
                : "Trailing zeros and spaces are always ignored (9.8 = 9.80), but significant figures are not enforced."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
