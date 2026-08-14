"use client";

import React from "react";
import {
  Loader2,
  Upload,
  FileText,
  X,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface OverallGradeFormProps {
  totalPoints: number;
  /** `null` when no override is set. */
  overallScore: number | null;
  onOverallScoreChange: (score: number | null) => void;
  /** Total of the per-question scores currently entered. */
  perQuestionTotal: number;
  overallFeedback: string;
  onOverallFeedbackChange: (feedback: string) => void;
  overallGradeConfirmed: boolean;
  onToggleOverallConfirm: () => void;
  /** Feedback file attachment */
  feedbackFileUrl: string | null;
  feedbackFileName: string | null;
  uploadingFeedback: boolean;
  onUploadFeedbackFile: (file: File) => void;
  onClearFeedbackFile: () => void;
}

export function OverallGradeForm({
  totalPoints,
  overallScore,
  onOverallScoreChange,
  perQuestionTotal,
  overallFeedback,
  onOverallFeedbackChange,
  overallGradeConfirmed,
  onToggleOverallConfirm,
  feedbackFileUrl,
  feedbackFileName,
  uploadingFeedback,
  onUploadFeedbackFile,
  onClearFeedbackFile,
}: OverallGradeFormProps) {
  return (
    <>
      {/* Overall score & feedback */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Overall Grade
          </h4>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            Leave blank to release the per-question total
          </span>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Per-question total:{" "}
          <span className="font-semibold text-gray-800 dark:text-gray-200">
            {perQuestionTotal}/{totalPoints}
          </span>
          {overallScore !== null && overallScore !== perQuestionTotal && (
            <span className="ml-2 text-amber-600 dark:text-amber-400">
              Override will release {overallScore}/{totalPoints} instead.
            </span>
          )}
        </p>
        <div className="flex items-end gap-4">
          <div className="space-y-1.5 w-48">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              Score (max {totalPoints})
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={totalPoints}
                value={overallScore ?? ""}
                placeholder="—"
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  onOverallScoreChange(raw === "" ? null : Number(raw));
                }}
                className="font-semibold text-center"
              />
              <button
                type="button"
                onClick={onToggleOverallConfirm}
                className={`shrink-0 h-8 w-8 rounded-md border-2 flex items-center justify-center transition-colors ${
                  overallGradeConfirmed
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "border-gray-300 dark:border-gray-600 hover:border-emerald-400"
                }`}
                title={
                  overallGradeConfirmed
                    ? "Remove the override"
                    : "Use this score instead of the per-question total"
                }
              >
                {overallGradeConfirmed && <CheckCircle2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            Feedback
          </label>
          <Textarea
            value={overallFeedback}
            onChange={(e) => onOverallFeedbackChange(e.target.value)}
            placeholder="Overall feedback for the student..."
            rows={4}
            className="resize-none"
          />
        </div>
      </div>

      {/* Attach feedback file */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Attach Feedback File (Optional)
        </p>
        {feedbackFileUrl ? (
          <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg">
            <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-sm text-emerald-700 dark:text-emerald-400 truncate flex-1">
              {feedbackFileName || "File attached"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500"
              onClick={onClearFeedbackFile}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            {uploadingFeedback ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            ) : (
              <Upload className="h-4 w-4 text-gray-400" />
            )}
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {uploadingFeedback
                ? "Uploading..."
                : "Upload annotated PDF or feedback file"}
            </span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadFeedbackFile(f);
              }}
            />
          </label>
        )}
      </div>
    </>
  );
}
