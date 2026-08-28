"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Download, ListChecks, Loader2, RotateCcw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import type { ReportJobDetail, ReportJobSummary } from "@/lib/report-grading";
import { retryReportJob } from "@/hooks/useReportGrading";
import { useCsvExport, useRowSelection } from "@/hooks/useGradingCsvExport";
import { reportJobsToCsv } from "@/lib/grading-csv";
import {
  REPORT_STATUS_BADGE_VARIANTS,
  REPORT_STATUS_LABELS,
  formatDuration,
  formatTimestamp,
} from "./report-job-format";

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
          await retryReportJob(jobId);
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

export function ReportJobList({
  jobs,
  loading,
  page,
  totalPages,
  totalCount,
  search,
  onSearchChange,
  onPageChange,
  onRefresh,
}: {
  jobs: ReportJobSummary[];
  loading: boolean;
  page: number;
  totalPages: number;
  totalCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
}) {
  const { selected, toggle, selectAll, clear } = useRowSelection();
  const { exporting, exportIds } = useCsvExport<ReportJobDetail>(
    "/api/report-grading/jobs",
    "report-grading.csv",
    reportJobsToCsv
  );
  const allSelected = jobs.length > 0 && jobs.every((job) => selected.has(job.id));

  const searchBox = (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <Input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search title, author, or student ID…"
        className="pl-8 pr-8"
        aria-label="Search by report title, author name, or student ID"
      />
      {search ? (
        <button
          type="button"
          onClick={() => onSearchChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="space-y-4">
        {searchBox}
        <EmptyState
          icon={ListChecks}
          title={search ? "No matching results" : "No grading jobs yet"}
          description={
            search
              ? "Try a different title or author name."
              : "Submit a report above — results will appear here."
          }
        />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">
          Results <span className="text-sm font-normal text-gray-500">({totalCount})</span>
        </CardTitle>
        <div className="flex w-full flex-1 flex-wrap items-center justify-end gap-2 sm:w-auto">
          {searchBox}
          <Button
            variant="outline"
            size="sm"
            onClick={() => (allSelected ? clear() : selectAll(jobs.map((job) => job.id)))}
          >
            {allSelected ? "Clear selection" : "Select all"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selected.size === 0 || exporting}
            onClick={() => void exportIds(Array.from(selected))}
          >
            {exporting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-4 w-4" />
            )}
            Export CSV{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {jobs.map((job) => (
            <li key={job.id} className="flex items-center">
              <label className="flex shrink-0 cursor-pointer items-center self-stretch pl-4 pr-1">
                <input
                  type="checkbox"
                  aria-label={`Select ${job.title} for CSV export`}
                  className="h-4 w-4 accent-blue-600"
                  checked={selected.has(job.id)}
                  onChange={() => toggle(job.id)}
                />
              </label>
              <Link
                href={`/report-grading/${job.id}`}
                className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">
                    {job.title}
                    {job.authors ? (
                      <span className="font-normal text-gray-500"> — {job.authors}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-gray-500">
                    {[
                      job.studentId ? `ID ${job.studentId}` : "no student ID",
                      `effort ${job.reasoningEffort}`,
                      job.rubricVersion !== null ? `instructions v${job.rubricVersion}` : null,
                      formatTimestamp(job.createdAt),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {job.status === "FAILED" && job.error ? (
                    <p className="mt-0.5 truncate text-xs text-red-500">{job.error}</p>
                  ) : null}
                </div>
                {job.gradingDurationMs !== null ? (
                  <span className="text-xs text-gray-500 tabular-nums">
                    {formatDuration(job.gradingDurationMs)}
                  </span>
                ) : null}
                <Badge variant={REPORT_STATUS_BADGE_VARIANTS[job.status]}>
                  {REPORT_STATUS_LABELS[job.status]}
                  {job.status === "GRADING" ? (
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
