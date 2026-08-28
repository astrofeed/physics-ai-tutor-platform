"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { formatBytes } from "@/lib/chat-attachments";
import {
  REPORT_FILE_MAX_BYTES,
  REPORT_TEXT_MAX_CHARS,
  type ReportJobDetail,
  type ReportJobSummary,
  type ReportReasoningEffort,
} from "@/lib/report-grading";

const UPLOAD_ENDPOINT = "/api/report-grading/upload";
const JOBS_PAGE_SIZE = 20;
const ACTIVE_POLL_MS = 5_000;

export interface ReportRubricState {
  version: number;
  content: string;
  updatedByName: string | null;
  updatedAt: string | null;
}

export function useReportRubric() {
  const [rubric, setRubric] = useState<ReportRubricState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/report-grading/rubric")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body) => setRubric(body.data))
      .catch(() => toast.error("Failed to load the grading instructions"))
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(async (content: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/report-grading/rubric", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Failed to save the grading instructions");
        return false;
      }
      setRubric(body.data);
      toast.success(`Grading instructions saved as version ${body.data.version}`);
      return true;
    } catch {
      toast.error("Failed to save the grading instructions");
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { rubric, loading, saving, save };
}

export function useReportRubricHistory() {
  const [versions, setVersions] = useState<ReportRubricState[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/report-grading/rubric/history");
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      setVersions(body.data);
    } catch (error) {
      console.error("[report-grading] failed to load rubric history:", error);
      toast.error("Failed to load version history");
    } finally {
      setLoading(false);
    }
  }, []);

  return { versions, loading, load };
}

const ACTIVE_STATUSES = new Set(["QUEUED", "GRADING"]);

const SEARCH_DEBOUNCE_MS = 300;

export function useReportJobs() {
  const [jobs, setJobs] = useState<ReportJobSummary[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const pageRef = useRef(page);
  pageRef.current = page;
  const searchRef = useRef(debouncedSearch);
  searchRef.current = debouncedSearch;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pageRef.current),
        pageSize: String(JOBS_PAGE_SIZE),
      });
      if (searchRef.current) params.set("q", searchRef.current);
      const res = await fetch(`/api/report-grading/jobs?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      setJobs(body.data.jobs);
      setTotalCount(body.data.totalCount);
    } catch {
      if (!silent) toast.error("Failed to load grading jobs");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, page, debouncedSearch]);

  const hasActiveJobs = jobs.some((job) => ACTIVE_STATUSES.has(job.status));
  useEffect(() => {
    if (!hasActiveJobs) return;
    const interval = setInterval(() => void refresh(true), ACTIVE_POLL_MS);
    return () => clearInterval(interval);
  }, [hasActiveJobs, refresh]);

  return {
    jobs,
    page,
    setPage,
    search,
    setSearch,
    totalPages: Math.max(1, Math.ceil(totalCount / JOBS_PAGE_SIZE)),
    totalCount,
    loading,
    refresh,
  };
}

export function useReportJob(id: string) {
  const [job, setJob] = useState<ReportJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/report-grading/jobs/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      setJob(body.data);
    } catch {
      toast.error("Failed to load the job");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const isActive = job !== null && ACTIVE_STATUSES.has(job.status);
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => void load(), ACTIVE_POLL_MS);
    return () => clearInterval(interval);
  }, [isActive, load]);

  return { job, loading, notFound, refresh: load };
}

export interface ReportBatchFile {
  file: File;
  /** Parsed from the filename; the grader can correct it before submitting. */
  studentId: string | null;
}

export interface NewReportJobInput {
  title: string;
  authors?: string;
  /** Exactly one of files / reportText is provided. */
  files: ReportBatchFile[];
  reportText: string | null;
  reasoningEffort: ReportReasoningEffort;
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

/** Strips the extension: "113012345_final.pdf" → "113012345_final". */
function filenameStem(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

/**
 * Uploads each report, creates one job per file (or one job for pasted
 * text), and starts processing. Files are handled sequentially so a large
 * batch doesn't fire dozens of parallel uploads.
 */
export function useSubmitReportJob(onCreated: () => void) {
  const [progress, setProgress] = useState<ReportSubmitProgress | null>(null);

  const submit = useCallback(
    async (input: NewReportJobInput): Promise<boolean> => {
      if (input.files.length === 0 && !input.reportText) {
        toast.error("Choose report PDFs or paste the report text first.");
        return false;
      }
      const oversized = input.files.find((f) => f.file.size > REPORT_FILE_MAX_BYTES);
      if (oversized) {
        toast.error(
          `"${oversized.file.name}" is ${formatBytes(oversized.file.size)}; the maximum is ${formatBytes(REPORT_FILE_MAX_BYTES)}.`
        );
        return false;
      }
      if (input.reportText && input.reportText.length > REPORT_TEXT_MAX_CHARS) {
        toast.error(
          `The report text is ${input.reportText.length.toLocaleString()} characters; the maximum is ${REPORT_TEXT_MAX_CHARS.toLocaleString()}.`
        );
        return false;
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
          return true;
        } catch (error) {
          toast.error(
            (error as Error).message || "Something went wrong while submitting the job"
          );
          return false;
        } finally {
          setProgress(null);
        }
      }

      const total = input.files.length;
      let started = 0;
      try {
        for (let index = 0; index < input.files.length; index += 1) {
          const { file, studentId } = input.files[index];
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
            title: total === 1 && input.title ? input.title : filenameStem(file.name),
            authors: input.authors,
            studentId: studentId ?? undefined,
            reportBlobUrl: blob.url,
            reportFilename: file.name,
            reasoningEffort: input.reasoningEffort,
          });
          started += 1;
        }
        toast.success(
          total === 1
            ? "Grading job started"
            : `Started grading jobs for ${total} reports`
        );
        onCreated();
        return true;
      } catch (error) {
        toast.error(
          `${(error as Error).message || "Something went wrong while submitting"}${
            started > 0 ? ` — ${started} of ${total} reports were already submitted` : ""
          }`
        );
        if (started > 0) onCreated();
        return false;
      } finally {
        setProgress(null);
      }
    },
    [onCreated]
  );

  return { submit, progress };
}

/**
 * Restarts a failed job. Processing takes minutes, so this only waits briefly
 * for an immediate rejection (e.g. the file was already deleted) — if none
 * arrives, the pipeline is running and the job list polling picks up progress.
 */
export async function retryReportJob(id: string): Promise<void> {
  const request = fetch(`/api/report-grading/jobs/${id}/process`, {
    method: "POST",
    keepalive: true,
  });
  request.catch((error) => {
    console.error(`[report-grading] retry request for job ${id} failed:`, error);
  });
  const res = await Promise.race([
    request,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_000)),
  ]);
  if (res && !res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Retry failed");
  }
}

export async function updateReportJob(
  id: string,
  input: { title?: string; authors?: string | null; studentId?: string | null }
): Promise<void> {
  const res = await fetch(`/api/report-grading/jobs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to save changes");
  }
}

export async function deleteReportJob(id: string): Promise<void> {
  const res = await fetch(`/api/report-grading/jobs/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to delete the record");
  }
}
