"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type {
  PresentationJobDetail,
  PresentationJobSummary,
  RubricState,
  UpdatePresentationJobInput,
} from "@/types/presentation-grading";

export { useSubmitPresentationJob } from "@/hooks/useSubmitPresentationJob";
export type { NewJobInput, JobSubmitPhase, RubricState } from "@/types/presentation-grading";

const JOBS_PAGE_SIZE = 20;
const ACTIVE_POLL_MS = 5_000;
const ACTIVE_STATUSES = new Set(["QUEUED", "TRANSCRIBING", "GRADING"]);
const SEARCH_DEBOUNCE_MS = 300;
const RUBRIC_KEY = ["presentation-grading", "rubric"];

export const presentationJobKey = (id: string) => ["presentation-grading", "job", id];

function useQueryError(error: Error | null, message: string) {
  useEffect(() => {
    if (!error) return;
    console.error("[presentation-grading:query]", { message, error });
    toast.error(message);
  }, [error, message]);
}

export function usePresentationRubric() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: RUBRIC_KEY,
    queryFn: async () => (await api.get<{ data: RubricState }>("/api/presentation-grading/rubric")).data,
  });
  useQueryError(query.error, "Failed to load the rubric");
  const mutation = useMutation({
    mutationFn: (content: string) => api.put<{ data: RubricState }>("/api/presentation-grading/rubric", { content }),
    onSuccess: async ({ data }) => {
      await client.cancelQueries({ queryKey: RUBRIC_KEY });
      client.setQueryData(RUBRIC_KEY, data);
      await client.invalidateQueries({ queryKey: [...RUBRIC_KEY, "history"] });
      toast.success(`Rubric saved as version ${data.version}`);
    },
  });
  const save = async (content: string) => {
    try {
      await mutation.mutateAsync(content);
      return true;
    } catch (error) {
      console.error("[presentation-grading:save-rubric]", { error });
      toast.error("Failed to save the rubric");
      return false;
    }
  };
  return { rubric: query.data ?? null, loading: query.isPending, saving: mutation.isPending, save };
}

export function useRubricHistory(enabled: boolean) {
  const query = useQuery({
    queryKey: [...RUBRIC_KEY, "history"],
    queryFn: async () => (await api.get<{ data: RubricState[] }>("/api/presentation-grading/rubric/history")).data,
    enabled,
  });
  useQueryError(query.error, "Failed to load rubric history");
  return { versions: query.data ?? null, loading: query.isFetching };
}

export function usePresentationJobs() {
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
    queryKey: ["presentation-grading", "jobs", page, debouncedSearch, group],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(JOBS_PAGE_SIZE) });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (group !== null) params.set("group", String(group));
      return (await api.get<{ data: { jobs: PresentationJobSummary[]; totalCount: number } }>(
        `/api/presentation-grading/jobs?${params}`
      )).data;
    },
    refetchInterval: (current) => current.state.data?.jobs.some((job) => ACTIVE_STATUSES.has(job.status))
      ? ACTIVE_POLL_MS : false,
  });
  useQueryError(query.error, "Failed to load grading jobs");
  const setGroup = useCallback((value: number | null) => {
    setGroupState(value);
    setPage(1);
  }, []);
  const totalCount = query.data?.totalCount ?? 0;
  return {
    jobs: query.data?.jobs ?? [], page, setPage, search, setSearch, group, setGroup,
    totalPages: Math.max(1, Math.ceil(totalCount / JOBS_PAGE_SIZE)),
    totalCount, loading: query.isPending,
    refresh: (silent = false) => query.refetch({ cancelRefetch: !silent }),
  };
}

export function usePresentationJob(id: string) {
  const query = useQuery({
    queryKey: presentationJobKey(id),
    queryFn: async () => (await api.get<{ data: PresentationJobDetail }>(`/api/presentation-grading/jobs/${id}`)).data,
    refetchInterval: (current) => current.state.data && ACTIVE_STATUSES.has(current.state.data.status)
      ? ACTIVE_POLL_MS : false,
  });
  const notFound = query.error !== null && "status" in query.error && query.error.status === 404;
  useQueryError(notFound ? null : query.error, "Failed to load the job");
  return { job: query.data ?? null, loading: query.isPending, notFound, refresh: query.refetch };
}

/**
 * Restarts a failed job. Processing takes minutes, so this only waits briefly
 * for an immediate rejection (e.g. media already deleted) — if none arrives,
 * the pipeline is running and the job list polling picks up the new status.
 */
export async function retryPresentationJob(id: string): Promise<void> {
  const request = fetch(`/api/presentation-grading/jobs/${id}/process`, {
    method: "POST",
    keepalive: true,
  });
  request.catch((error) => {
    console.error(`[presentation-grading] retry request for job ${id} failed:`, error);
  });
  const res = await Promise.race([
    request,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_000)),
  ]);
  if (res && !res.ok) {
    const body = await res.json().catch((error) => {
      console.error("[presentation-grading:retry-response]", { id, error });
      return null;
    });
    throw new Error(body?.error ?? "Retry failed");
  }
}

export async function updatePresentationJob(id: string, input: UpdatePresentationJobInput): Promise<void> {
  await api.patch(`/api/presentation-grading/jobs/${id}`, input);
}

export async function deletePresentationJob(id: string): Promise<void> {
  await api.delete(`/api/presentation-grading/jobs/${id}`);
}
