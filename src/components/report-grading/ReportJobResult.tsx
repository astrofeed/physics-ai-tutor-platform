"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, Eye, EyeOff, FileText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { cn } from "@/lib/utils";
import { weightedAverage } from "@/lib/human-grading";
import {
  parseReportEvaluation,
  type ReportCommentCategory,
  type ReportJobDetail,
} from "@/lib/report-grading";
import { reportEvaluationToText } from "./report-job-format";
import { ReportSuggestionChecks } from "./ReportSuggestionChecks";

const CATEGORY_STYLES: Record<ReportCommentCategory, { label: string; className: string }> = {
  strength: {
    label: "Strength",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  issue: {
    label: "Issue",
    className:
      "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300",
  },
  note: {
    label: "Note",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {children}
    </section>
  );
}

interface Props {
  job: ReportJobDetail;
  activeCommentIndex: number | null;
  onSelectComment: (index: number | null) => void;
  aiScoresVisible: boolean;
  onToggleAiScores: () => void;
}

export function ReportJobResult({
  job,
  activeCommentIndex,
  onSelectComment,
  aiScoresVisible,
  onToggleAiScores,
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

  if (!evaluation) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-gray-500">
          The result could not be parsed. Retry the job to regrade the report.
        </CardContent>
      </Card>
    );
  }

  const aiTotal = evaluation.criterionScores
    ? weightedAverage(
        evaluation.criterionScores.map((c) => ({ name: c.criterion, score: c.score })),
        (name) => evaluation.criterionScores?.find((c) => c.criterion === name)?.weightPercent
      )
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">AI Notes &amp; Review</CardTitle>
        <CopyButton text={reportEvaluationToText(evaluation)} />
      </CardHeader>
      <CardContent className="space-y-6">
        <Section title="Summary">
          <MarkdownContent content={evaluation.summary} className="text-sm" />
        </Section>

        {evaluation.suggestionChecks && evaluation.suggestionChecks.length > 0 ? (
          <ReportSuggestionChecks
            checks={evaluation.suggestionChecks}
            presentationJobId={job.presentationJobId}
          />
        ) : null}

        <Section title={`AI Notes (${evaluation.comments.length})`}>
          {evaluation.comments.length === 0 ? (
            <p className="text-sm text-gray-500">No comments.</p>
          ) : (
            <ol className="space-y-2.5">
              {evaluation.comments.map((comment, i) => {
                const isActive = activeCommentIndex === i;
                const categoryStyle = comment.category ? CATEGORY_STYLES[comment.category] : null;
                const clickable = Boolean(comment.page || comment.quote);
                return (
                  <li
                    key={i}
                    ref={(el) => {
                      if (el) noteRefs.current.set(i, el);
                      else noteRefs.current.delete(i);
                    }}
                    onClick={() => onSelectComment(isActive ? null : i)}
                    className={cn(
                      "rounded-lg border p-3 text-sm space-y-1.5 transition-colors cursor-pointer",
                      isActive
                        ? "border-amber-400 bg-amber-50/70 ring-1 ring-amber-300 dark:border-amber-500 dark:bg-amber-950/30"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/70 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-gray-900/50"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-500 tabular-nums">
                          #{i + 1}
                        </span>
                        {categoryStyle ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                              categoryStyle.className
                            )}
                          >
                            {categoryStyle.label}
                          </span>
                        ) : null}
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          {comment.reference}
                        </span>
                      </div>
                      {comment.page ? (
                        <Badge variant="outline" className="gap-1 text-[11px] font-normal">
                          <FileText className="h-3 w-3" />
                          p. {comment.page}
                        </Badge>
                      ) : clickable ? (
                        <span className="text-[11px] text-amber-700 dark:text-amber-300">
                          Click to highlight
                        </span>
                      ) : null}
                    </div>
                    {comment.quote ? (
                      <blockquote className="border-l-2 border-amber-300 pl-2 text-xs italic text-gray-600 dark:border-amber-700 dark:text-gray-400">
                        “{comment.quote}”
                      </blockquote>
                    ) : null}
                    <MarkdownContent content={comment.comment} className="text-sm" />
                  </li>
                );
              })}
            </ol>
          )}
        </Section>

        {evaluation.criterionScores ? (
          <section className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
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
                variant="outline"
                size="sm"
                onClick={onToggleAiScores}
                aria-expanded={aiScoresVisible}
              >
                {aiScoresVisible ? (
                  <>
                    <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                    Hide AI scores
                  </>
                ) : (
                  <>
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    Show AI scores
                    {aiScoresVisible ? (
                      <ChevronDown className="ml-1 h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    )}
                  </>
                )}
              </Button>
            </div>

            {aiScoresVisible ? (
              <ol className="space-y-3">
                {evaluation.criterionScores.map((entry, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 text-sm space-y-1"
                  >
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
                    <MarkdownContent content={entry.reason} className="text-sm" />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/70 px-3 py-2.5 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900/50">
                AI scores are collapsed by default so they do not anchor your grading. Click
                &ldquo;Show AI scores&rdquo; whenever you want to compare.
              </p>
            )}
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
