"use client";

import React from "react";
import { HowToCard, type HowToFaq, type HowToStep } from "@/components/grading/HowToCard";

const COLLAPSED_STORAGE_KEY = "presentation-grading-help-collapsed";

const STEPS: HowToStep[] = [
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

const FAQ: HowToFaq[] = [
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

/** Step-by-step instructions and FAQ for TAs grading presentations. */
export function HowToGradeCard() {
  return (
    <HowToCard
      title="How to grade a presentation"
      storageKey={COLLAPSED_STORAGE_KEY}
      steps={STEPS}
      faq={FAQ}
    />
  );
}
