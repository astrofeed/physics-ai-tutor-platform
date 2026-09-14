"use client";

import React from "react";
import { MessagesSquare, ShieldQuestion } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { cn } from "@/lib/utils";
import type { PresentationEvaluation } from "@/lib/presentation-grading";
import { ReferenceChip } from "./ChecksCard";
import { CopyButton } from "./CopyButton";
import { notesToText } from "./job-format";

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="eyebrow mb-2">{title}</p>
      {children}
    </section>
  );
}

export function NumberedItem({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white dark:bg-gray-100 dark:text-gray-900">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
    </li>
  );
}

/** Questions for the live session plus claims that need checking face to face. */
export function LiveQaCard({ evaluation }: { evaluation: PresentationEvaluation }) {
  const { qaQuestions, verifyInPerson } = evaluation;
  if (qaQuestions.length === 0 && verifyInPerson.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessagesSquare className="h-4 w-4 text-gray-500" />
          Live Q&amp;A
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {qaQuestions.length > 0 ? (
          <SubSection title="Ask the student">
            <ol className="space-y-3">
              {qaQuestions.map((item, i) => (
                <NumberedItem key={i} index={i}>
                  <MarkdownContent content={item.question} className="text-sm font-medium" />
                  <p className="mt-0.5 text-gray-500">Why: {item.reason}</p>
                </NumberedItem>
              ))}
            </ol>
          </SubSection>
        ) : null}

        {verifyInPerson.length > 0 ? (
          <SubSection title="Verify in person">
            <ul className="space-y-1.5 text-sm">
              {verifyInPerson.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </SubSection>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TopicSuggestions({
  suggestions,
}: {
  suggestions: NonNullable<PresentationEvaluation["topicSuggestions"]>;
}) {
  const revise = suggestions.verdict === "revise";
  return (
    <SubSection title="Report topic suggestions">
      <p
        className={cn(
          "mb-3 text-sm",
          revise ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
        )}
      >
        {revise ? "Revise the report first — " : "The report is on solid ground — "}
        {suggestions.assessment}
      </p>
      <ol className="space-y-3">
        {suggestions.options.map((option, i) => (
          <NumberedItem key={i} index={i}>
            <p className="font-medium">{option.title}</p>
            <MarkdownContent content={option.direction} className="text-sm" />
            <p className="mt-0.5 text-gray-500">Why: {option.rationale}</p>
          </NumberedItem>
        ))}
      </ol>
    </SubSection>
  );
}

/** Text the grader can hand to the student: strengths, Socratic questions, report advice. */
export function StudentFeedbackCard({ evaluation }: { evaluation: PresentationEvaluation }) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-4">
        <CardTitle className="text-base">Feedback for the student</CardTitle>
        <CopyButton text={notesToText(evaluation)} label="Copy feedback" />
      </CardHeader>
      <CardContent className="space-y-6">
        <SubSection title="What they did well">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {evaluation.strengths.map((strength, i) => (
              <li key={i}>{strength}</li>
            ))}
          </ul>
        </SubSection>

        {evaluation.guidingQuestions.length > 0 ? (
          <SubSection title="Questions to think about">
            <div className="space-y-3">
              {evaluation.guidingQuestions.map((group, i) => (
                <div key={i} className="text-sm">
                  <ReferenceChip reference={group.reference} />
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {group.questions.map((question, j) => (
                      <li key={j}>{question}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </SubSection>
        ) : null}

        <SubSection title="Advice for the report">
          <p className="text-sm leading-relaxed">{evaluation.reportAdvice}</p>
        </SubSection>

        {evaluation.topicSuggestions ? (
          <TopicSuggestions suggestions={evaluation.topicSuggestions} />
        ) : null}
      </CardContent>
    </Card>
  );
}
