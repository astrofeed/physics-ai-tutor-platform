"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Download, ListChecks, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Pagination } from "@/components/ui/pagination";
import type { PresentationJobSummary } from "@/lib/presentation-grading";
import { retryPresentationJob } from "@/hooks/usePresentationGrading";
import { STATUS_BADGE_VARIANTS, STATUS_LABELS, formatDuration, formatTimestamp } from "./job-format";

function exportCsv(jobs: PresentationJobSummary[]) {
  const header = "Topic,Track,Condition,Status,Total score,Effort,Duration,Rubric version,Completed at";
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = jobs.map((job) =>
    [
      escape(job.topic),
      job.track ?? "",
      job.condition ?? "",
      STATUS_LABELS[job.status],
      job.totalScore ?? "",
      job.reasoningEffort,
      formatDuration(job.gradingDurationMs),
      job.rubricVersion ?? "",
      job.completedAt ?? "",
    ].join(",")
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "presentation-grading.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function RetryButton({ jobId, onDone }: { jobId: string; onDone: () => void }) {
  const [retrying, setRetrying] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={retrying}
      onClick={async (e) => {
        e.preventDefault();
        setRetrying(true);
        try {
          await retryPresentationJob(jobId);
          onDone();
        } catch (error) {
          toast.error((error as Error).message);
        } finally {
          setRetrying(false);
        }
      }}
    >
      {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
      <span className="ml-1">Retry</span>
    </Button>
  );
}

export function JobList({
  jobs,
  loading,
  page,
  totalPages,
  totalCount,
  onPageChange,
  onRefresh,
}: {
  jobs: PresentationJobSummary[];
  loading: boolean;
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No grading jobs yet"
        description="Submit a presentation above — results will appear here."
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">
          Results <span className="text-sm font-normal text-gray-500">({totalCount})</span>
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => exportCsv(jobs)}>
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/presentation-grading/${job.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{job.topic}</p>
                  <p className="text-xs text-gray-500">
                    {[
                      job.track ? `Track ${job.track}` : null,
                      job.condition,
                      `effort ${job.reasoningEffort}`,
                      job.rubricVersion !== null ? `rubric v${job.rubricVersion}` : null,
                      formatTimestamp(job.createdAt),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {job.status === "FAILED" && job.error ? (
                    <p className="mt-0.5 truncate text-xs text-red-500">{job.error}</p>
                  ) : null}
                </div>
                {job.totalScore !== null ? (
                  <span className="text-sm font-semibold tabular-nums">
                    {job.totalScore.toFixed(0)}/100
                  </span>
                ) : null}
                {job.gradingDurationMs !== null ? (
                  <span className="text-xs text-gray-500 tabular-nums">
                    {formatDuration(job.gradingDurationMs)}
                  </span>
                ) : null}
                <Badge variant={STATUS_BADGE_VARIANTS[job.status]}>
                  {STATUS_LABELS[job.status]}
                  {job.status === "TRANSCRIBING" || job.status === "GRADING" ? (
                    <Loader2 className="ml-1 h-3 w-3 animate-spin" />
                  ) : null}
                </Badge>
                {job.status === "FAILED" ? <RetryButton jobId={job.id} onDone={onRefresh} /> : null}
              </Link>
            </li>
          ))}
        </ul>
        {totalPages > 1 ? (
          <div className="border-t border-gray-100 dark:border-gray-800 p-3">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
