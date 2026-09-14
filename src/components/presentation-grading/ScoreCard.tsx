"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { cn } from "@/lib/utils";
import type { PresentationEvaluation } from "@/lib/presentation-grading";
import { CopyButton } from "./CopyButton";
import { analysisToText } from "./job-format";

type ScoreRow = PresentationEvaluation["scorecard"][number];

function barColor(row: ScoreRow): string {
  if (row.provisional) return "bg-amber-400 dark:bg-amber-500";
  const ratio = row.maxPoints > 0 ? row.awardedPoints / row.maxPoints : 0;
  if (ratio >= 0.8) return "bg-emerald-500";
  if (ratio >= 0.5) return "bg-gray-700 dark:bg-gray-300";
  return "bg-red-500";
}

function ScoreLine({ row }: { row: ScoreRow }) {
  const width = row.maxPoints > 0 ? Math.min(100, (row.awardedPoints / row.maxPoints) * 100) : 0;
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {row.category}
          {row.provisional ? (
            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              provisional
            </span>
          ) : null}
        </p>
        <p className="shrink-0 text-sm tabular-nums">
          <span className="font-semibold">{row.awardedPoints}</span>
          <span className="text-gray-500"> / {row.maxPoints}</span>
        </p>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div className={cn("h-full rounded-full", barColor(row))} style={{ width: `${width}%` }} />
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
        {row.justification}
      </p>
    </li>
  );
}

/** Total, summary and per-category scores — the first thing a grader needs. */
export function ScoreCard({ evaluation }: { evaluation: PresentationEvaluation }) {
  const provisionalCount = evaluation.scorecard.filter((row) => row.provisional).length;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-4">
        <CardTitle className="text-base">AI score</CardTitle>
        <CopyButton text={analysisToText(evaluation)} label="Copy analysis" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
          <div className="rounded-lg border border-gray-200 px-5 py-4 text-center dark:border-gray-800 sm:min-w-[9rem]">
            <p className="eyebrow">Total</p>
            <p className="mt-1 text-display font-semibold tabular-nums text-gray-900 dark:text-gray-100">
              {evaluation.totalScore}
            </p>
            <p className="text-caption text-gray-500">out of 100</p>
            {provisionalCount > 0 ? (
              <p className="mt-2 text-caption text-amber-700 dark:text-amber-400">
                {provisionalCount} provisional
              </p>
            ) : null}
          </div>
          <div>
            <p className="eyebrow mb-1.5">Summary</p>
            <MarkdownContent content={evaluation.summary} className="text-sm leading-relaxed" />
          </div>
        </div>

        <div>
          <p className="eyebrow mb-2">By category</p>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {evaluation.scorecard.map((row, i) => (
              <ScoreLine key={i} row={row} />
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
