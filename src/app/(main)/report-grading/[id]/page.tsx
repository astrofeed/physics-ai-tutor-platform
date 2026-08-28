"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileQuestion, Loader2 } from "lucide-react";
import { StaffOnly } from "@/components/auth/StaffOnly";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ReportJobActions } from "@/components/report-grading/ReportJobActions";
import { ReportJobResult } from "@/components/report-grading/ReportJobResult";
import {
  REPORT_STATUS_BADGE_VARIANTS,
  REPORT_STATUS_LABELS,
  formatDuration,
  formatTimestamp,
} from "@/components/report-grading/report-job-format";
import { useReportJob } from "@/hooks/useReportGrading";
import { useTrackTime } from "@/lib/use-track-time";

function ReportJobDetailContent({ id }: { id: string }) {
  const { job, loading, notFound, refresh } = useReportJob(id);
  useTrackTime("PRESENTATION_GRADING", "report-detail");

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }
  if (notFound || !job) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Job not found"
        description="This grading job does not exist or was removed."
      />
    );
  }

  const inProgress = job.status === "QUEUED" || job.status === "GRADING";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/report-grading">
              <ArrowLeft className="mr-1 h-4 w-4" />
              All jobs
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {[
              job.authors,
              job.reportFilename,
              job.model,
              `effort ${job.reasoningEffort}`,
              job.rubricVersion !== null ? `instructions v${job.rubricVersion}` : null,
              job.createdByName ? `by ${job.createdByName}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="text-sm text-gray-500">
            Submitted {formatTimestamp(job.createdAt)}
            {job.completedAt
              ? ` · completed ${formatTimestamp(job.completedAt)} in ${formatDuration(job.gradingDurationMs)}`
              : ""}
          </p>
        </div>
        <div className="mt-8 flex shrink-0 flex-col items-end gap-2">
          <Badge variant={REPORT_STATUS_BADGE_VARIANTS[job.status]}>
            {REPORT_STATUS_LABELS[job.status]}
            {inProgress ? <Loader2 className="ml-1 h-3 w-3 animate-spin" /> : null}
          </Badge>
          <ReportJobActions
            jobId={job.id}
            title={job.title}
            authors={job.authors}
            onUpdated={() => void refresh()}
          />
        </div>
      </div>

      {job.status === "FAILED" ? (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-300">
          {job.error ?? "The job failed."} You can retry it from the job list.
        </div>
      ) : null}

      {inProgress ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-6 text-center text-sm text-gray-500">
          The AI is reviewing the report against the grading instructions — this usually takes a
          few minutes at high reasoning effort.
          <br />
          You can leave this page; processing continues in the background.
        </div>
      ) : null}

      {job.status === "DONE" ? <ReportJobResult job={job} /> : null}
    </div>
  );
}

export default function ReportJobPage() {
  const params = useParams<{ id: string }>();
  return (
    <StaffOnly>
      <ReportJobDetailContent id={params.id} />
    </StaffOnly>
  );
}
