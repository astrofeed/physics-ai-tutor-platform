"use client";

import React, { useState } from "react";
import { MessagesSquare, ShieldQuestion } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { cn } from "@/lib/utils";
import type { PresentationJobDetail } from "@/lib/presentation-grading";
import { CopyButton } from "./CopyButton";
import { NumberedItem } from "./FeedbackCards";

/**
 * Returns the body of the first markdown section whose heading matches,
 * up to the next heading of the same or higher level.
 */
function extractSection(markdown: string, headingPattern: RegExp): string | null {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => /^#{1,4}\s/.test(line) && headingPattern.test(line));
  if (start === -1) return null;
  const level = lines[start].match(/^#+/)?.[0].length ?? 1;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,4})\s/);
    if (match && match[1].length <= level) {
      end = i;
      break;
    }
  }
  const body = lines.slice(start + 1, end).join("\n").trim();
  return body.length > 0 ? body : null;
}

/**
 * Splits a Q&A section into individual numbered questions so each can be
 * shown on its own. Falls back to null when there is no numbered list.
 */
function splitNumberedItems(markdown: string): string[] | null {
  const lines = markdown.split("\n");
  const items: string[] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (/^\s*\d+[.)]\s/.test(line)) {
      if (current) items.push(current.join("\n").trim());
      current = [line.replace(/^\s*\d+[.)]\s/, "")];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) items.push(current.join("\n").trim());
  return items.length >= 2 ? items : null;
}

type LegacyTab = "analysis" | "notes" | "transcript" | "slides";

function TabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: Array<[LegacyTab, string]>;
  active: LegacyTab;
  onSelect: (tab: LegacyTab) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 p-0.5">
      {tabs.map(([value, label]) => (
        <button
          key={value}
          onClick={() => onSelect(value)}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium transition-colors",
            active === value
              ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Markdown-based rendering for jobs graded before structured output. */
export function LegacyResult({ job }: { job: PresentationJobDetail }) {
  const [tab, setTab] = useState<LegacyTab>("analysis");

  const qaQuestions = job.partIIOutput
    ? extractSection(job.partIIOutput, /q\s*&\s*a|q&a/i)
    : null;
  const qaItems = qaQuestions ? splitNumberedItems(qaQuestions) : null;
  const verifyInPerson = job.partIOutput
    ? extractSection(job.partIOutput, /verify in person/i)
    : null;

  const tabs: Array<[LegacyTab, string, string | null]> = [
    ["analysis", "TA analysis", job.partIOutput],
    ["notes", "Feedback notes", job.partIIOutput],
    ["transcript", "Transcript", job.transcript],
    ["slides", "Slides text", job.slidesText],
  ];
  const available: Array<[LegacyTab, string]> = tabs
    .filter(([, , content]) => content !== null)
    .map(([value, label]) => [value, label]);
  const activeContent = tabs.find(([value]) => value === tab)?.[2] ?? job.partIOutput;

  return (
    <div className="space-y-6">
      {qaQuestions ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessagesSquare className="h-4 w-4 text-gray-500" />
              Ask in the live Q&amp;A
            </CardTitle>
          </CardHeader>
          <CardContent>
            {qaItems ? (
              <ol className="space-y-3">
                {qaItems.map((item, index) => (
                  <NumberedItem key={index} index={index}>
                    <MarkdownContent content={item} className="text-sm" />
                  </NumberedItem>
                ))}
              </ol>
            ) : (
              <MarkdownContent content={qaQuestions} className="text-sm" />
            )}
          </CardContent>
        </Card>
      ) : null}

      {verifyInPerson ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldQuestion className="h-4 w-4 text-gray-500" />
              Verify in person
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MarkdownContent content={verifyInPerson} className="text-sm" />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <TabBar tabs={available} active={tab} onSelect={setTab} />
          {activeContent ? <CopyButton text={activeContent} label="Copy" /> : null}
        </CardHeader>
        <CardContent>
          {tab === "transcript" || tab === "slides" ? (
            <pre className="whitespace-pre-wrap break-words rounded-lg bg-gray-50 dark:bg-gray-900 p-4 text-sm leading-relaxed">
              {activeContent}
            </pre>
          ) : (
            <MarkdownContent content={activeContent ?? ""} className="text-sm" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
