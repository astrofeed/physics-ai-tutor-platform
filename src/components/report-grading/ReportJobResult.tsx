"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { cn } from "@/lib/utils";
import { weightedAverage } from "@/lib/human-grading";
import {
  COMMENT_CATEGORIES,
  parseReportEvaluation,
  type ReportCommentCategory,
  type ReportJobDetail,
} from "@/lib/report-grading";
import { COMMENT_CATEGORY_META, effectiveCategory } from "./report-comment-categories";
import { reportEvaluationToText } from "./report-job-format";
import { ReportSuggestionChecks } from "./ReportSuggestionChecks";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Could not copy to the clipboard");
        }
      }}
    >
      {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
      Copy
    </Button>
  );
}

interface Props {
  job: ReportJobDetail;
  activeCommentIndex: number | null;
  onSelectComment: (index: number | null) => void;
  aiScoresVisible: boolean;
  onToggleAiScores: () => void;
  visibleCategories: Set<ReportCommentCategory>;
  onToggleCategory: (category: ReportCommentCategory) => void;
}

export function ReportJobResult({
  job,
  activeCommentIndex,
  onSelectComment,
  aiScoresVisible,
  onToggleAiScores,
  visibleCategories,
  onToggleCategory,
}: Props) {
  const evaluation = parseReportEvaluation(job.resultJson);
  const noteRefs = useRef<Map<number, HTMLLIElement>>(new Map());

  useEffect(() => {
    if (activeCommentIndex === null) return;
    noteRefs.current.get(activeCommentIndex)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [activeCommentIndex]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<ReportCommentCategory, number>();
    for (const c of evaluation?.comments ?? []) {
      const cat = effectiveCategory(c.category);
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return counts;
  }, [evaluation?.comments]);

  if (!evaluation) {
    return (
      <p className="py-6 text-sm text-gray-500">
        The result could not be parsed. Retry the job to regrade the report.
      </p>
    );
  }

  const aiTotal = evaluation.criterionScores
    ? weightedAverage(
        evaluation.criterionScores.map((c) => ({ name: c.criterion, score: c.score })),
        (name) => evaluation.criterionScores?.find((c) => c.criterion === name)?.weightPercent
      )
    : null;

  const visibleNotes = evaluation.comments
    .map((comment, index) => ({ comment, index }))
    .filter(({ comment }) => visibleCategories.has(effectiveCategory(comment.category)));

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            AI Notes &amp; Review
          </h2>
          <CopyButton text={reportEvaluationToText(evaluation)} />
        </div>
        <MarkdownContent content={evaluation.summary} className="text-sm leading-relaxed" />
      </section>

      {evaluation.suggestionChecks && evaluation.suggestionChecks.length > 0 ? (
        <ReportSuggestionChecks
          checks={evaluation.suggestionChecks}
          presentationJobId={job.presentationJobId}
        />
      ) : null}

      <section className="space-y-3 border-t border-gray-200 pt-5 dark:border-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            AI Notes ({visibleNotes.length}
            {visibleNotes.length !== evaluation.comments.length
              ? ` / ${evaluation.comments.length}`
              : ""}
            )
          </h3>
          {!job.hasReportPdf && evaluation.comments.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1">
              {COMMENT_CATEGORIES.map((cat) => {
                const count = categoryCounts.get(cat) ?? 0;
                if (count === 0) return null;
                const active = visibleCategories.has(cat);
                const meta = COMMENT_CATEGORY_META[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onToggleCategory(cat)}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                      active
                        ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                        : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    )}
                  >
                    {meta.label} ({count})
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {visibleNotes.length === 0 ? (
          <p className="text-sm text-gray-500">
            {evaluation.comments.length === 0
              ? "No comments."
              : "No notes match the selected highlight types."}
          </p>
        ) : (
          <ol className="divide-y divide-gray-200/80 dark:divide-gray-800">
            {visibleNotes.map(({ comment, index }) => {
              const isActive = activeCommentIndex === index;
              const cat = effectiveCategory(comment.category);
              const meta = COMMENT_CATEGORY_META[cat];
              return (
                <li
                  key={index}
                  ref={(el) => {
                    if (el) noteRefs.current.set(index, el);
                    else noteRefs.current.delete(index);
                  }}
                  onClick={() => onSelectComment(isActive ? null : index)}
                  className={cn(
                    "border-l-2 py-3 pl-3 pr-2 text-sm space-y-1.5 transition-colors cursor-pointer",
                    isActive
                      ? "border-l-gray-900 bg-gray-50 dark:border-l-gray-100 dark:bg-gray-900/60"
                      : "border-l-transparent hover:bg-gray-50/70 dark:hover:bg-gray-900/40"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-gray-700 dark:text-gray-300 tabular-nums">
                        #{index + 1}
                      </span>
                      <span>·</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {meta.label}
                      </span>
                      <span>·</span>
                      <span>{comment.reference}</span>
                    </div>
                    {comment.page ? (
                      <span className="tabular-nums">p. {comment.page}</span>
                    ) : null}
                  </div>
                  {comment.quote ? (
                    <p className="text-xs italic text-gray-500 dark:text-gray-400">
                      “{comment.quote}”
                    </p>
                  ) : null}
                  <MarkdownContent content={comment.comment} className="text-sm" />
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {evaluation.criterionScores ? (
        <section className="space-y-3 border-t border-gray-200 pt-5 dark:border-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                AI Criterion Scores
              </h3>
              {aiScoresVisible && aiTotal !== null ? (
                <Badge variant="secondary" className="tabular-nums">
                  Weighted total: {aiTotal.toFixed(2)} / 10
                </Badge>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onToggleAiScores}
              aria-expanded={aiScoresVisible}
            >
              {aiScoresVisible ? (
                <>
                  <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                  Hide AI scores
                  <ChevronDown className="ml-1 h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  Show AI scores
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>

          {aiScoresVisible ? (
            <ol className="divide-y divide-gray-200/80 dark:divide-gray-800">
              {evaluation.criterionScores.map((entry, i) => (
                <li key={i} className="py-2.5 text-sm space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {entry.criterion}
                      <span className="ml-1.5 text-xs font-normal text-gray-500">
                        ({entry.weightPercent}%)
                      </span>
                    </p>
                    <span className="shrink-0 text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                      {entry.score}/10
                    </span>
                  </div>
                  <MarkdownContent content={entry.reason} className="text-sm text-gray-600 dark:text-gray-400" />
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-gray-500">
              Hidden by default so AI scores do not anchor your grading.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
