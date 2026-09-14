"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  parseEvaluation,
  type PresentationEvaluation,
  type PresentationJobDetail,
} from "@/lib/presentation-grading";
import { ChecksCard } from "./ChecksCard";
import { CopyButton } from "./CopyButton";
import { LiveQaCard, StudentFeedbackCard } from "./FeedbackCards";
import { LegacyResult } from "./LegacyResult";
import { ScoreCard } from "./ScoreCard";

export function JobResult({ job }: { job: PresentationJobDetail }) {
  const evaluation = parseEvaluation(job.summaryJson);
  if (evaluation) {
    return <StructuredResult job={job} evaluation={evaluation} />;
  }
  return <LegacyResult job={job} />;
}

/** Score first, then what to check, then material for the live session and the student. */
function StructuredResult({
  job,
  evaluation,
}: {
  job: PresentationJobDetail;
  evaluation: PresentationEvaluation;
}) {
  return (
    <div className="space-y-6">
      <ScoreCard evaluation={evaluation} />
      <ChecksCard evaluation={evaluation} />
      <LiveQaCard evaluation={evaluation} />
      <StudentFeedbackCard evaluation={evaluation} />
      <SourceTextCard transcript={job.transcript} slidesText={job.slidesText} />
    </div>
  );
}

type SourceKind = "transcript" | "slides";

/** Raw transcript and slide text, folded away because graders rarely need them. */
function SourceTextCard({
  transcript,
  slidesText,
}: {
  transcript: string | null;
  slidesText: string | null;
}) {
  const [open, setOpen] = useState<SourceKind | null>(null);
  const sources: Array<[SourceKind, string, string | null]> = [
    ["transcript", "Transcript", transcript],
    ["slides", "Slides text", slidesText],
  ];
  const available = sources.filter(([, , text]) => text !== null);
  if (available.length === 0) return null;
  const openText = available.find(([kind]) => kind === open)?.[2] ?? null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-gray-500" />
          Source material
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {available.map(([kind, label]) => {
            const active = open === kind;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => setOpen(active ? null : kind)}
                aria-expanded={active}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900"
                )}
              >
                {active ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {label}
              </button>
            );
          })}
          {openText ? <CopyButton text={openText} label="Copy" /> : null}
        </div>
        {openText ? (
          <pre className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-4 text-sm leading-relaxed dark:bg-gray-900">
            {openText}
          </pre>
        ) : null}
      </CardContent>
    </Card>
  );
}
