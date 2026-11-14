"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useQueryErrorToast } from "@/hooks/useQueryErrorToast";
import { api } from "@/lib/api-client";
import type { ReportJobDetail, ReportJobSummary } from "@/lib/report-grading";
import type { RubricState } from "@/types/presentation-grading";

export { useSubmitReportJob } from "@/hooks/useSubmitReportJob";
export type { NewReportJobInput, ReportSubmitProgress } from "@/hooks/useSubmitReportJob";

const JOBS_PAGE_SIZE = 20;
const ACTIVE_POLL_MS = 5_000;
const ACTIVE_STATUSES = new Set(["QUEUED", "GRADING"]);
const SEARCH_DEBOUNCE_MS = 300;
const RUBRIC_KEY = ["report-grading", "rubric"];
const RUBRIC_HISTORY_KEY = [...RUBRIC_KEY, "history"];

/** The server's own explanation when it answered with one, else the generic message. */
function serverMessage(error: unknown, fallback: string): string {
  return error instanceof Error && "status" in error ? error.message : fallback;
}

export function useReportRubric() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: RUBRIC_KEY,
    queryFn: async () => (await api.get<{ data: RubricState }>("/api/report-grading/rubric")).data,
  });
  useQueryErrorToast(query.error, "Failed to load the grading instructions");
  const mutation = useMutation({
    mutationFn: (content: string) => api.put<{ data: RubricState }>("/api/report-grading/rubric", { content }),
    onSuccess: async ({ data }) => {
      await client.cancelQueries({ queryKey: RUBRIC_KEY });
      client.setQueryData(RUBRIC_KEY, data);
      await client.invalidateQueries({ queryKey: RUBRIC_HISTORY_KEY });
      toast.success(`Grading instructions saved as version ${data.version}`);
    },
  });
  const save = async (content: string) => {
    try {
      await mutation.mutateAsync(content);
      return true;
    } catch (error) {
      console.error("[report-grading:save-rubric]", { error });
      toast.error(serverMessage(error, "Failed to save the grading instructions"));
      return false;
    }
  };
  return { rubric: query.data ?? null, loading: query.isPending, saving: mutation.isPending, save };
}

/** Loaded the first time `enabled` turns true; a rubric save refreshes it. */
export function useReportRubricHistory(enabled: boolean) {
  const query = useQuery({
    queryKey: RUBRIC_HISTORY_KEY,
    queryFn: async () => (await api.get<{ data: RubricState[] }>("/api/report-grading/rubric/history")).data,
    enabled,
  });
  useQueryErrorToast(query.error, "Failed to load version history");
  return { versions: query.data ?? null, loading: query.isFetching };
}

export function useReportJobs() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [group, setGroupState] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const query = useQuery({
    queryKey: ["report-grading", "jobs", page, debouncedSearch, group],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(JOBS_PAGE_SIZE) });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (group !== null) params.set("group", String(group));
      return (await api.get<{ data: { jobs: ReportJobSummary[]; totalCount: number } }>(
        `/api/report-grading/jobs?${params}`
      )).data;
    },
    refetchInterval: (current) =>
      current.state.data?.jobs.some((job) => ACTIVE_STATUSES.has(job.status)) ? ACTIVE_POLL_MS : false,
  });
  useQueryErrorToast(query.error, "Failed to load grading jobs");

  const setGroup = useCallback((value: number | null) => {
    setGroupState(value);
    setPage(1);
  }, []);

  const totalCount = query.data?.totalCount ?? 0;
  return {
    jobs: query.data?.jobs ?? [],
    page,
    setPage,
    search,
    setSearch,
    group,
    setGroup,
    totalPages: Math.max(1, Math.ceil(totalCount / JOBS_PAGE_SIZE)),
    totalCount,
    loading: query.isPending,
    refresh: (silent = false) => query.refetch({ cancelRefetch: !silent }),
  };
}

export function useReportJob(id: string) {
  const query = useQuery({
    queryKey: ["report-grading", "job", id],
    queryFn: async () => (await api.get<{ data: ReportJobDetail }>(`/api/report-grading/jobs/${id}`)).data,
    refetchInterval: (current) =>
      current.state.data && ACTIVE_STATUSES.has(current.state.data.status) ? ACTIVE_POLL_MS : false,
  });
  const notFound = query.error !== null && "status" in query.error && query.error.status === 404;
  useQueryErrorToast(notFound ? null : query.error, "Failed to load the job");
  return { job: query.data ?? null, loading: query.isPending, notFound, refresh: query.refetch };
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
    const body = await res.json().catch((error) => {
      console.error("[report-grading:retry-response]", { id, error });
      return null;
    });
    throw new Error(body?.error ?? "Retry failed");
  }
}

export async function updateReportJob(
  id: string,
  input: { title?: string; authors?: string | null; studentId?: string | null }
): Promise<void> {
  await api.patch(`/api/report-grading/jobs/${id}`, input);
}

export async function deleteReportJob(id: string): Promise<void> {
  await api.delete(`/api/report-grading/jobs/${id}`);
}
