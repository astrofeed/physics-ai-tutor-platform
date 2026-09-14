"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { cn } from "@/lib/utils";
import type { PresentationEvaluation } from "@/lib/presentation-grading";

type ElementStatus = PresentationEvaluation["requiredElements"][number]["status"];

const ELEMENT_STATUS: Record<ElementStatus, { mark: string; label: string; className: string }> = {
  present: { mark: "✓", label: "present", className: "text-emerald-700 dark:text-emerald-400" },
  weak: { mark: "△", label: "weak", className: "text-amber-700 dark:text-amber-400" },
  missing: { mark: "✗", label: "missing", className: "text-red-700 dark:text-red-400" },
};

const FLAG_CONFIDENCE_VARIANT = {
  low: "secondary",
  medium: "warning",
  high: "destructive",
} as const;

export function ReferenceChip({ reference }: { reference: string }) {
  if (!reference.trim()) return null;
  return (
    <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">
      {reference}
    </span>
  );
}

function SubSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="eyebrow mb-2">
        {title}
        {count !== undefined ? <span className="ml-1.5 text-gray-400">{count}</span> : null}
      </p>
      {children}
    </section>
  );
}

function ErrorEntry({
  index,
  entry,
}: {
  index: number;
  entry: PresentationEvaluation["physicsErrorLog"][number];
}) {
  const rows: Array<[string, string]> = [
    ["Check", entry.check],
    ["Correct", entry.correction],
    ["Ask", entry.guidingQuestion],
  ];
  return (
    <li className="rounded-lg border border-red-200 bg-red-50/40 p-3 dark:border-red-900/50 dark:bg-red-950/20">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-semibold text-white">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <ReferenceChip reference={entry.reference} />
          <MarkdownContent content={entry.error} className="text-sm font-medium" />
        </div>
      </div>
      <dl className="mt-2.5 grid gap-y-2 border-t border-red-200/70 pt-2.5 text-sm dark:border-red-900/40 sm:ml-[1.875rem] sm:grid-cols-[4.5rem_1fr] sm:gap-x-2 sm:gap-y-1">
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 sm:pt-0.5">
              {label}
            </dt>
            <dd className="-mt-1.5 text-gray-700 dark:text-gray-300 sm:mt-0">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </li>
  );
}

function ElementList({ elements }: { elements: PresentationEvaluation["requiredElements"] }) {
  return (
    <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
      {elements.map((el, i) => {
        const status = ELEMENT_STATUS[el.status];
        return (
          <li key={i} className="flex items-start gap-2">
            <span className={cn("w-4 shrink-0 text-center font-semibold", status.className)}>
              {status.mark}
            </span>
            <span className="min-w-0">
              <span className={el.status === "present" ? "" : "font-medium"}>{el.element}</span>
              {el.reference ? (
                <span className="ml-1.5">
                  <ReferenceChip reference={el.reference} />
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function FlagList({ flags }: { flags: PresentationEvaluation["flags"] }) {
  return (
    <ul className="space-y-2">
      {flags.map((flag, i) => (
        <li
          key={i}
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {flag.concern}
            </p>
            <Badge variant={FLAG_CONFIDENCE_VARIANT[flag.confidence]} className="font-medium">
              {flag.confidence} confidence
            </Badge>
          </div>
          <p className="mt-1.5 text-amber-900/80 dark:text-amber-200/80">{flag.evidence}</p>
        </li>
      ))}
    </ul>
  );
}

function elementSummary(elements: PresentationEvaluation["requiredElements"]): string {
  const count = (status: ElementStatus) => elements.filter((el) => el.status === status).length;
  return `${count("present")} present · ${count("weak")} weak · ${count("missing")} missing`;
}

/** Everything the grader should verify before trusting the score. */
export function ChecksCard({ evaluation }: { evaluation: PresentationEvaluation }) {
  const { physicsErrorLog, requiredElements, flags } = evaluation;
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Check before grading</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {flags.length > 0 ? (
          <SubSection title="Flags for the teaching team" count={flags.length}>
            <FlagList flags={flags} />
          </SubSection>
        ) : null}

        <SubSection title="Physics errors" count={physicsErrorLog.length}>
          {physicsErrorLog.length === 0 ? (
            <p className="text-sm text-gray-500">No physics errors found.</p>
          ) : (
            <ol className="space-y-3">
              {physicsErrorLog.map((entry, i) => (
                <ErrorEntry key={i} index={i} entry={entry} />
              ))}
            </ol>
          )}
        </SubSection>

        <SubSection title="Required elements">
          <p className="mb-2 text-caption text-gray-500">{elementSummary(requiredElements)}</p>
          <ElementList elements={requiredElements} />
        </SubSection>
      </CardContent>
    </Card>
  );
}
