"use client";

import React from "react";
import { HowToCard, type HowToFaq, type HowToStep } from "@/components/grading/HowToCard";

const COLLAPSED_STORAGE_KEY = "report-grading-help-collapsed";

const STEPS: HowToStep[] = [
  {
    title: "Drop the report PDFs or the eeClass export (.zip) into the box.",
    detail:
      "Any number of PDFs and zips at once. Zips are opened in your browser and never uploaded, so size is not a problem; every PDF inside becomes one row, other files (index.html, content.html) are ignored.",
  },
  {
    title: "Check each row.",
    detail:
      "Student ID, name, presentation topic (sheet column Topics) and report question (sheet column Report Topic) come from the folder name and the sign-up sheet. Rows with a warning triangle need a student ID or were not found in the sheet — fix the ID and the row refills itself.",
  },
  {
    title: "Press Start grading, then move on.",
    detail:
      "Reports are uploaded and started one after another; grading runs in the background for a few minutes per report. You can leave the page — results appear in the list below.",
  },
  {
    title: "Open a job to read the AI result; add your own scores if you like.",
    detail:
      "The summary, evidence-referenced comments and per-criterion scores show right away. The “Your scores” card underneath is optional and can be edited later.",
  },
  {
    title: "Export a CSV when you are done.",
    detail:
      "Tick the jobs and press Export CSV — it includes student ID, group, date, presentation topic, report question, every criterion's AI and human score and the totals.",
  },
];

const FAQ: HowToFaq[] = [
  {
    q: "What is the report question?",
    a: "The sign-up sheet's “Report Topic” column: an extra question this student's report must answer on top of the presentation topic (column Topics). The AI's first criterion grades whether both were covered; when Report Topic is blank the report is graded against the presentation topic alone and is not penalised.",
  },
  {
    q: "The student ID was not found in the sign-up sheet.",
    a: "Type the presentation topic (and report question, if any) by hand; grading works the same. If the student signed up after the last import, press Refresh on the sign-up sheet card and drop the file again.",
  },
  {
    q: "A student's folder has several PDFs.",
    a: "Each becomes a row. Remove the ones that are not the report (appendices, the presentation slides) with the × before starting.",
  },
  {
    q: "The report is not a PDF.",
    a: "Ask the student for a PDF, or open the file yourself and use “Paste text” for a single report.",
  },
  {
    q: "I need to find a group's reports.",
    a: "Search the job list by student ID, name, topic, group (e.g. Group 1) or date (e.g. 9/15).",
  },
];

/** Step-by-step instructions and FAQ for TAs grading written reports. */
export function ReportHowToCard() {
  return (
    <HowToCard
      title="How to grade written reports"
      storageKey={COLLAPSED_STORAGE_KEY}
      steps={STEPS}
      faq={FAQ}
    />
  );
}
