"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ReportJobDetail, ReportJobSummary } from "@/lib/report-grading";

export { useSubmitReportJob } from "@/hooks/useSubmitReportJob";
export type { NewReportJobInput, ReportSubmitProgress } from "@/hooks/useSubmitReportJob";

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
  const [group, setGroupState] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const pageRef = useRef(page);
  pageRef.current = page;
  const searchRef = useRef(debouncedSearch);
  searchRef.current = debouncedSearch;
  const groupRef = useRef(group);
  groupRef.current = group;

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
      if (groupRef.current !== null) params.set("group", String(groupRef.current));
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
  }, [refresh, page, debouncedSearch, group]);

  const setGroup = useCallback((value: number | null) => {
    setGroupState(value);
    setPage(1);
  }, []);

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
    group,
    setGroup,
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
