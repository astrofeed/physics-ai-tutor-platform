"use client";

import { useCallback, useState } from "react";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { formatBytes } from "@/lib/chat-attachments";
import type { ReportBatchFile } from "@/hooks/useReportBatch";
import {
  REPORT_FILE_MAX_BYTES,
  REPORT_TEXT_MAX_CHARS,
  filenameStem,
  type ReportReasoningEffort,
} from "@/lib/report-grading";

const UPLOAD_ENDPOINT = "/api/report-grading/upload";

export interface NewReportJobInput {
  /** Used for pasted text; each PDF row carries its own title. */
  title: string;
  authors?: string;
  /** Exactly one of files / reportText is provided. */
  files: ReportBatchFile[];
  reportText: string | null;
  reasoningEffort: ReportReasoningEffort;
}

/**
 * `submitted` holds the reports whose jobs were created before the failure, so
 * the form can take them off the batch and a retry does not grade them twice.
 */
export type ReportSubmitResult =
  | { ok: true }
  | { ok: false; problem: string; submitted: File[] };

function failure(problem: string, submitted: File[] = []): ReportSubmitResult {
  return { ok: false, problem, submitted };
}

export interface ReportSubmitProgress {
  phase: "uploading" | "creating";
  /** 1-based index of the file being processed; 0 for pasted text. */
  current: number;
  total: number;
}

async function createJobAndProcess(payload: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/report-grading/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error ?? "Failed to create the grading job");
  }
  // Fire-and-forget: the serverless function keeps processing even if
  // the grader navigates away or closes the tab.
  void fetch(`/api/report-grading/jobs/${body.data.id}/process`, {
    method: "POST",
    keepalive: true,
  }).catch((error) => {
    console.error(
      `[report-grading] processing kickoff for job ${body.data.id} failed:`,
      error
    );
    // The job list shows it as QUEUED; retry restarts it.
  });
}

/**
 * Uploads each report, creates one job per file (or one job for pasted
 * text), and starts processing. Files are handled sequentially so a large
 * batch doesn't fire dozens of parallel uploads.
 */
export function useSubmitReportJob(onCreated: () => void) {
  const [progress, setProgress] = useState<ReportSubmitProgress | null>(null);

  const submit = useCallback(
    async (input: NewReportJobInput): Promise<ReportSubmitResult> => {
      if (input.files.length === 0 && !input.reportText) {
        return failure("Choose report PDFs or paste the report text first.");
      }
      const oversized = input.files.find((f) => f.file.size > REPORT_FILE_MAX_BYTES);
      if (oversized) {
        return failure(
          `"${oversized.file.name}" is ${formatBytes(oversized.file.size)}; the maximum is ${formatBytes(REPORT_FILE_MAX_BYTES)}.`
        );
      }
      if (input.reportText && input.reportText.length > REPORT_TEXT_MAX_CHARS) {
        return failure(
          `The report text is ${input.reportText.length.toLocaleString()} characters; the maximum is ${REPORT_TEXT_MAX_CHARS.toLocaleString()}.`
        );
      }

      if (input.reportText) {
        setProgress({ phase: "creating", current: 0, total: 1 });
        try {
          await createJobAndProcess({
            title: input.title,
            authors: input.authors,
            reportText: input.reportText,
            reasoningEffort: input.reasoningEffort,
          });
          toast.success(`Grading job for "${input.title}" started`);
          onCreated();
          return { ok: true };
        } catch (error) {
          return failure((error as Error).message || "Something went wrong while submitting the job");
        } finally {
          setProgress(null);
        }
      }

      const total = input.files.length;
      const submitted: File[] = [];
      try {
        for (let index = 0; index < input.files.length; index += 1) {
          const row = input.files[index];
          const { file } = row;
          setProgress({ phase: "uploading", current: index + 1, total });
          const blob = await upload(file.name, file, {
            access: "public",
            handleUploadUrl: UPLOAD_ENDPOINT,
            contentType: "application/pdf",
            clientPayload: JSON.stringify({
              contentType: "application/pdf",
              sizeBytes: file.size,
            }),
          });
          setProgress({ phase: "creating", current: index + 1, total });
          await createJobAndProcess({
            title: row.title.trim() || filenameStem(file.name),
            authors: row.studentName.trim() || undefined,
            studentId: row.studentId?.trim() || undefined,
            assignedQuestion: row.assignedQuestion.trim() || undefined,
            reportBlobUrl: blob.url,
            reportFilename: file.name,
            reasoningEffort: input.reasoningEffort,
          });
          submitted.push(file);
        }
        toast.success(
          total === 1
            ? "Grading job started"
            : `Started grading jobs for ${total} reports`
        );
        onCreated();
        return { ok: true };
      } catch (error) {
        if (submitted.length > 0) onCreated();
        return failure(
          `${(error as Error).message || "Something went wrong while submitting"}${
            submitted.length > 0
              ? ` — ${submitted.length} of ${total} reports were already submitted and taken off the list. Start grading again to submit the rest.`
              : ""
          }`,
          submitted
        );
      } finally {
        setProgress(null);
      }
    },
    [onCreated]
  );

  return { submit, progress };
}
