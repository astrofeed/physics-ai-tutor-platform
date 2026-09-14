"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLLAPSED_STORAGE_KEY = "presentation-grading-help-collapsed";

const STEPS: { title: string; detail: string }[] = [
  {
    title: "Drop the eeClass export (.zip) into the box at the top.",
    detail:
      "Download the student's submission from eeClass as a zip and drop it in as-is — no need to unzip or rename anything. You can drop several zips at once; the zip itself is never uploaded, so size is not a problem.",
  },
  {
    title: "Check what was filled in.",
    detail:
      "Student ID, name, topic, video and slides (if any) are filled in from the folder name and the sign-up sheet. If the topic is wrong or missing, type it in. Track and reasoning effort can stay on their defaults.",
  },
  {
    title: "Press Start grading, then move on.",
    detail:
      "The browser extracts the audio (a few seconds; WMV/AVI take longer the first time while ffmpeg downloads), uploads it and starts the job. Grading runs in the background for a few minutes — you can submit the next student or leave the page.",
  },
  {
    title: "Open the job to read the AI result; add your own scores if you like.",
    detail:
      "The AI scorecard, mistakes and suggested questions show right away. The “Your scores” card underneath is optional — fill it in to compare your grade with the AI’s; scores can be edited later.",
  },
  {
    title: "Export a CSV when you are done.",
    detail:
      "Tick the jobs in the list and press Export CSV — it includes student ID, group, date, every category's AI and human score and the totals.",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "The student did not submit slides.",
    a: "That is fine. The job is graded from the video alone, the result page says so, and slide-related scores are marked provisional — check the slides during the live session.",
  },
  {
    q: "The student ID was not found in the sign-up sheet.",
    a: "Type the topic (and name) by hand; everything else works the same. If the student signed up after the last import, press Refresh on the sign-up sheet card and drop the zip again.",
  },
  {
    q: "The video is WMV / AVI.",
    a: "Accepted. The first conversion downloads about 30 MB of ffmpeg into the browser, so it takes a minute; later ones are quick.",
  },
  {
    q: "The video is longer than 3:30 or has no audio.",
    a: "It is rejected with a clear message before anything is uploaded — ask the student for a compliant recording, or paste a transcript instead of the video.",
  },
  {
    q: "I need to find a student for the live session.",
    a: "Search the job list by student ID, name, topic, group (e.g. Group 1) or date (e.g. 9/15).",
  },
];

/** Step-by-step instructions and FAQ for TAs; stays open until dismissed. */
export function HowToGradeCard() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1") setCollapsed(true);
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="h-4 w-4 text-gray-500" />
            How to grade a presentation
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={toggle} aria-expanded={!collapsed}>
            {collapsed ? "Show" : "Hide"}
            {collapsed ? <ChevronDown className="ml-1 h-4 w-4" /> : <ChevronUp className="ml-1 h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {collapsed ? null : (
        <CardContent className="grid grid-cols-1 gap-6 text-sm md:grid-cols-2">
          <ol className="space-y-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white dark:bg-gray-100 dark:text-gray-900">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="text-gray-500">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <dl className="space-y-3">
            {FAQ.map((item) => (
              <div key={item.q}>
                <dt className="font-medium">{item.q}</dt>
                <dd className="text-gray-500">{item.a}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      )}
    </Card>
  );
}
