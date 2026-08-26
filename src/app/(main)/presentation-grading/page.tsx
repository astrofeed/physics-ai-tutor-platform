"use client";

import React, { useState } from "react";
import { MonitorPlay } from "lucide-react";
import { StaffOnly } from "@/components/auth/StaffOnly";
import { cn } from "@/lib/utils";
import { JobList } from "@/components/presentation-grading/JobList";
import { NewJobForm } from "@/components/presentation-grading/NewJobForm";
import { RubricEditor } from "@/components/presentation-grading/RubricEditor";
import { usePresentationJobs } from "@/hooks/usePresentationGrading";

type Tab = "grade" | "rubric";

function PresentationGradingContent() {
  const [tab, setTab] = useState<Tab>("grade");
  const jobsState = usePresentationJobs();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <MonitorPlay className="h-6 w-6 text-purple-500" />
          Presentation AI pre-grading
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          AI drafts a scorecard, physics error log, and live Q&amp;A questions before the in-person
          presentation. The final grade is always yours — verify flagged items live.
        </p>
      </div>

      <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 p-0.5">
        {(
          [
            ["grade", "Grade presentations"],
            ["rubric", "Rubric"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === value
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "grade" ? (
        <div className="space-y-6">
          <NewJobForm onCreated={() => void jobsState.refresh(true)} />
          <JobList
            jobs={jobsState.jobs}
            loading={jobsState.loading}
            page={jobsState.page}
            totalPages={jobsState.totalPages}
            totalCount={jobsState.totalCount}
            onPageChange={jobsState.setPage}
            onRefresh={() => void jobsState.refresh(true)}
          />
        </div>
      ) : (
        <RubricEditor />
      )}
    </div>
  );
}

export default function PresentationGradingPage() {
  return (
    <StaffOnly>
      <PresentationGradingContent />
    </StaffOnly>
  );
}
