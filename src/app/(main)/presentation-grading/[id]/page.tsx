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
import { JobActions } from "@/components/presentation-grading/JobActions";
import { PresentationGradedView } from "@/components/presentation-grading/PresentationGradedView";
import {
  STATUS_BADGE_VARIANTS,
  STATUS_LABELS,
  formatDuration,
  formatTimestamp,
} from "@/components/presentation-grading/job-format";
import { usePresentationJob } from "@/hooks/usePresentationGrading";
import { useTrackTime } from "@/lib/use-track-time";

function JobDetailContent({ id }: { id: string }) {
  const { job, loading, notFound, refresh } = usePresentationJob(id);
  useTrackTime("PRESENTATION_GRADING", "detail");

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

  const inProgress = job.status === "QUEUED" || job.status === "TRANSCRIBING" || job.status === "GRADING";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/presentation-grading">
              <ArrowLeft className="mr-1 h-4 w-4" />
              All jobs
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{job.topic}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {[
              job.presenters,
              job.studentIds,
              job.groupLabel,
              job.presentationDate ? `presents ${job.presentationDate}` : null,
              job.track ? `Track ${job.track}` : null,
              job.slidesFilename ? `slides: ${job.slidesFilename}` : "no slides submitted",
              job.model,
              `effort ${job.reasoningEffort}`,
              job.rubricVersion !== null ? `rubric v${job.rubricVersion}` : null,
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
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:mt-8 sm:flex-col sm:items-end">
          <Badge variant={STATUS_BADGE_VARIANTS[job.status]}>
            {STATUS_LABELS[job.status]}
            {inProgress ? <Loader2 className="ml-1 h-3 w-3 animate-spin" /> : null}
          </Badge>
          <JobActions
            jobId={job.id}
            topic={job.topic}
            presenters={job.presenters}
            studentIds={job.studentIds}
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
          {job.status === "GRADING"
            ? "The AI is grading against the rubric — this usually takes a few minutes at high reasoning effort."
            : "Preparing the transcript…"}
          <br />
          You can leave this page; processing continues in the background.
        </div>
      ) : null}

      {job.status === "DONE" && !job.slidesFilename ? (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-800 dark:text-amber-300">
          No slides were submitted — this evaluation is based on the spoken transcript alone.
          Treat slide- and figure-related scores as provisional and check the slides during the live session.
        </div>
      ) : null}

      {job.status === "DONE" ? (
        <PresentationGradedView job={job} onChanged={() => void refresh()} />
      ) : null}
    </div>
  );
}

export default function PresentationJobPage() {
  const params = useParams<{ id: string }>();
  return (
    <StaffOnly>
      <JobDetailContent id={params.id} />
    </StaffOnly>
  );
}
