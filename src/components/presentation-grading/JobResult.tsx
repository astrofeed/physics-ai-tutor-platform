"use client";

import React, { useState } from "react";
import { Check, ClipboardCopy, MessagesSquare, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { cn } from "@/lib/utils";
import type { PresentationJobDetail } from "@/lib/presentation-grading";

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

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="mr-1.5 h-4 w-4" /> : <ClipboardCopy className="mr-1.5 h-4 w-4" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

type ResultTab = "analysis" | "student" | "transcript" | "slides";

export function JobResult({ job }: { job: PresentationJobDetail }) {
  const [tab, setTab] = useState<ResultTab>("analysis");

  const qaQuestions = job.partIIOutput
    ? extractSection(job.partIIOutput, /q\s*&\s*a|q&a/i)
    : null;
  const verifyInPerson = job.partIOutput
    ? extractSection(job.partIOutput, /verify in person/i)
    : null;

  const tabs: Array<[ResultTab, string, string | null]> = [
    ["analysis", "TA analysis", job.partIOutput],
    ["student", "Student feedback", job.partIIOutput],
    ["transcript", "Transcript", job.transcript],
    ["slides", "Slides text", job.slidesText],
  ];
  const available = tabs.filter(([, , content]) => content !== null);
  const activeContent = tabs.find(([value]) => value === tab)?.[2] ?? job.partIOutput;

  return (
    <div className="space-y-6">
      {qaQuestions ? (
        <Card className="border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessagesSquare className="h-5 w-5 text-purple-600" />
              Ask in the live Q&amp;A
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MarkdownContent content={qaQuestions} className="text-sm" />
          </CardContent>
        </Card>
      ) : null}

      {verifyInPerson ? (
        <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldQuestion className="h-5 w-5 text-amber-600" />
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
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 p-0.5">
            {available.map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  tab === value
                    ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {activeContent ? (
            <CopyButton
              text={activeContent}
              label={tab === "student" ? "Copy for students" : "Copy"}
            />
          ) : null}
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
