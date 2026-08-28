"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { cn } from "@/lib/utils";
import type { PresentationEvaluation } from "@/lib/presentation-grading";

const ELEMENT_STATUS_STYLES: Record<
  PresentationEvaluation["requiredElements"][number]["status"],
  string
> = {
  present: "text-green-700 dark:text-green-400",
  weak: "text-amber-700 dark:text-amber-400",
  missing: "text-red-700 dark:text-red-400",
};

const ELEMENT_STATUS_MARKS = { present: "✓", weak: "△", missing: "✗" } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {children}
    </section>
  );
}

export function AnalysisView({ evaluation }: { evaluation: PresentationEvaluation }) {
  return (
    <div className="space-y-6">
      <Section title="Summary">
        <MarkdownContent content={evaluation.summary} className="text-sm" />
      </Section>

      <Section title="Scorecard">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-left text-xs text-gray-500">
                <th className="py-1.5 pr-3 font-medium">Category</th>
                <th className="py-1.5 pr-3 font-medium">Score</th>
                <th className="py-1.5 font-medium">Justification</th>
              </tr>
            </thead>
            <tbody>
              {evaluation.scorecard.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-900 align-top">
                  <td className="py-2 pr-3">{row.category}</td>
                  <td className="py-2 pr-3 whitespace-nowrap font-medium">
                    {row.awardedPoints}/{row.maxPoints}
                    {row.provisional ? (
                      <span className="ml-1 text-xs font-normal text-amber-600 dark:text-amber-400">
                        provisional
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 text-gray-600 dark:text-gray-400">{row.justification}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2 pr-3 font-semibold">Total</td>
                <td className="py-2 pr-3 font-semibold">{evaluation.totalScore}/100</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Physics error log">
        {evaluation.physicsErrorLog.length === 0 ? (
          <p className="text-sm text-gray-500">No physics errors found.</p>
        ) : (
          <ol className="space-y-3">
            {evaluation.physicsErrorLog.map((entry, i) => (
              <li
                key={i}
                className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 text-sm space-y-1.5"
              >
                <p className="text-xs text-gray-500">{entry.reference}</p>
                <MarkdownContent content={entry.error} className="text-sm" />
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Check: </span>
                  {entry.check}
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Correct: </span>
                  {entry.correction}
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Ask: </span>
                  {entry.guidingQuestion}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Required elements">
        <ul className="space-y-1 text-sm">
          {evaluation.requiredElements.map((el, i) => (
            <li key={i} className="flex gap-2">
              <span className={cn("w-4 shrink-0 text-center", ELEMENT_STATUS_STYLES[el.status])}>
                {ELEMENT_STATUS_MARKS[el.status]}
              </span>
              <span>
                {el.element}
                {el.reference ? (
                  <span className="text-gray-500"> — {el.reference}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {evaluation.flags.length > 0 ? (
        <Section title="Flags for the teaching team">
          <ul className="space-y-2 text-sm">
            {evaluation.flags.map((flag, i) => (
              <li key={i} className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
                <p>
                  {flag.concern}
                  <span className="ml-2 text-xs uppercase text-gray-500">
                    {flag.confidence} confidence
                  </span>
                </p>
                <p className="text-gray-600 dark:text-gray-400">{flag.evidence}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

export function NotesView({ evaluation }: { evaluation: PresentationEvaluation }) {
  return (
    <div className="space-y-6">
      <Section title="What they did well">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {evaluation.strengths.map((strength, i) => (
            <li key={i}>{strength}</li>
          ))}
        </ul>
      </Section>

      <Section title="Questions to think about">
        <div className="space-y-3">
          {evaluation.guidingQuestions.map((group, i) => (
            <div key={i} className="text-sm">
              <p className="text-xs text-gray-500">{group.reference}</p>
              <ul className="list-disc space-y-1 pl-5">
                {group.questions.map((question, j) => (
                  <li key={j}>{question}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Advice for the individual reports">
        <p className="text-sm">{evaluation.reportAdvice}</p>
      </Section>

      {evaluation.topicSuggestions ? (
        <TopicSuggestionsSection suggestions={evaluation.topicSuggestions} />
      ) : null}
    </div>
  );
}

function TopicSuggestionsSection({
  suggestions,
}: {
  suggestions: NonNullable<PresentationEvaluation["topicSuggestions"]>;
}) {
  return (
    <Section title="Report topic suggestions">
      <p
        className={cn(
          "text-sm",
          suggestions.verdict === "revise"
            ? "text-amber-700 dark:text-amber-400"
            : "text-green-700 dark:text-green-400"
        )}
      >
        {suggestions.verdict === "revise"
          ? "Revise the report first — "
          : "The report is on solid ground — "}
        {suggestions.assessment}
      </p>
      <ol className="space-y-3">
        {suggestions.options.map((option, i) => (
          <li
            key={i}
            className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 text-sm space-y-1"
          >
            <p className="font-medium">
              {i + 1}. {option.title}
            </p>
            <MarkdownContent content={option.direction} className="text-sm" />
            <p className="text-gray-500">Why: {option.rationale}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function QaCard({
  qaQuestions,
  icon,
}: {
  qaQuestions: PresentationEvaluation["qaQuestions"];
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          Ask in the live Q&amp;A
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {qaQuestions.map((item, index) => (
            <li
              key={index}
              className="rounded-lg border border-gray-200 dark:border-gray-800 p-3"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {index + 1}
                </span>
                <div className="text-sm space-y-1">
                  <MarkdownContent content={item.question} className="text-sm" />
                  <p className="text-gray-500">Why: {item.reason}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
