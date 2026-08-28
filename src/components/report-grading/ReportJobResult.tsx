"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { parseReportEvaluation, type ReportJobDetail } from "@/lib/report-grading";
import { reportEvaluationToText } from "./report-job-format";

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

export function ReportJobResult({ job }: { job: ReportJobDetail }) {
  const evaluation = parseReportEvaluation(job.resultJson);
  if (!evaluation) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-gray-500">
          The result could not be parsed. Retry the job to regrade the report.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Review</CardTitle>
        <CopyButton text={reportEvaluationToText(evaluation)} />
      </CardHeader>
      <CardContent className="space-y-6">
        <Section title="Summary">
          <MarkdownContent content={evaluation.summary} className="text-sm" />
        </Section>

        <Section title="Comments">
          {evaluation.comments.length === 0 ? (
            <p className="text-sm text-gray-500">No comments.</p>
          ) : (
            <ol className="space-y-3">
              {evaluation.comments.map((comment, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 text-sm space-y-1"
                >
                  <p className="text-xs font-medium text-gray-500">{comment.reference}</p>
                  <MarkdownContent content={comment.comment} className="text-sm" />
                </li>
              ))}
            </ol>
          )}
        </Section>

        {evaluation.criterionScores ? (
          <Section title="Criterion scores">
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
                    <span className="shrink-0 text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {entry.score}/10
                    </span>
                  </div>
                  <MarkdownContent content={entry.reason} className="text-sm" />
                </li>
              ))}
            </ol>
          </Section>
        ) : null}
      </CardContent>
    </Card>
  );
}
