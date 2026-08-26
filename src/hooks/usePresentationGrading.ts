"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { extractAudioFromVideo, AudioExtractionError } from "@/lib/extract-audio";
import {
  PRESENTATION_VIDEO_MAX_SECONDS,
  type PresentationJobDetail,
  type PresentationJobSummary,
  type PresentationReasoningEffort,
} from "@/lib/presentation-grading";

const UPLOAD_ENDPOINT = "/api/presentation-grading/upload";
const JOBS_PAGE_SIZE = 20;
const ACTIVE_POLL_MS = 5_000;

export interface RubricState {
  version: number;
  content: string;
  updatedByName: string | null;
  updatedAt: string | null;
}

export function usePresentationRubric() {
  const [rubric, setRubric] = useState<RubricState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/presentation-grading/rubric")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body) => setRubric(body.data))
      .catch(() => toast.error("Failed to load the rubric"))
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(async (content: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/presentation-grading/rubric", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Failed to save the rubric");
        return false;
      }
      setRubric(body.data);
      toast.success(`Rubric saved as version ${body.data.version}`);
      return true;
    } catch {
      toast.error("Failed to save the rubric");
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { rubric, loading, saving, save };
}

const ACTIVE_STATUSES = new Set(["QUEUED", "TRANSCRIBING", "GRADING"]);

export function usePresentationJobs() {
  const [jobs, setJobs] = useState<PresentationJobSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const pageRef = useRef(page);
  pageRef.current = page;

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(
        `/api/presentation-grading/jobs?page=${pageRef.current}&pageSize=${JOBS_PAGE_SIZE}`
      );
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
  }, [refresh, page]);

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
    totalPages: Math.max(1, Math.ceil(totalCount / JOBS_PAGE_SIZE)),
    totalCount,
    loading,
    refresh,
  };
}

export function usePresentationJob(id: string) {
  const [job, setJob] = useState<PresentationJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/presentation-grading/jobs/${id}`);
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

async function uploadToBlob(
  kind: "audio" | "slides",
  filename: string,
  data: Blob | File,
  contentType: string
): Promise<string> {
  const blob = await upload(filename, data, {
    access: "public",
    handleUploadUrl: UPLOAD_ENDPOINT,
    contentType,
    clientPayload: JSON.stringify({ kind, contentType, sizeBytes: data.size }),
  });
  return blob.url;
}

export interface NewJobInput {
  topic: string;
  track?: "A" | "B";
  condition?: "AI-assisted" | "no-AI";
  video: File;
  slides: File | null;
  reasoningEffort: PresentationReasoningEffort;
}

export type JobSubmitPhase = "extracting" | "uploading" | "creating" | null;

/** Extracts audio, uploads media, creates the job, and starts processing. */
export function useSubmitPresentationJob(onCreated: () => void) {
  const [phase, setPhase] = useState<JobSubmitPhase>(null);

  const submit = useCallback(
    async (input: NewJobInput): Promise<boolean> => {
      try {
        setPhase("extracting");
        const { wav, durationSeconds } = await extractAudioFromVideo(input.video);
        if (durationSeconds > PRESENTATION_VIDEO_MAX_SECONDS) {
          toast.error(
            `The video is ${Math.floor(durationSeconds / 60)}:${String(Math.round(durationSeconds % 60)).padStart(2, "0")} long; presentations must be at most 3:30.`
          );
          return false;
        }

        setPhase("uploading");
        const audioBlobUrl = await uploadToBlob("audio", "presentation-audio.wav", wav, "audio/wav");
        let slidesBlobUrl: string | undefined;
        if (input.slides) {
          const isPdf = input.slides.name.toLowerCase().endsWith(".pdf");
          slidesBlobUrl = await uploadToBlob(
            "slides",
            input.slides.name,
            input.slides,
            isPdf
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.presentationml.presentation"
          );
        }

        setPhase("creating");
        const res = await fetch("/api/presentation-grading/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: input.topic,
            track: input.track,
            condition: input.condition,
            audioBlobUrl,
            slidesBlobUrl,
            slidesFilename: input.slides?.name,
            reasoningEffort: input.reasoningEffort,
          }),
        });
        const body = await res.json();
        if (!res.ok) {
          toast.error(body.error ?? "Failed to create the grading job");
          return false;
        }

        // Fire-and-forget: the serverless function keeps processing even if
        // the TA navigates away or closes the tab.
        void fetch(`/api/presentation-grading/jobs/${body.data.id}/process`, {
          method: "POST",
          keepalive: true,
        }).catch(() => {
          // The job list will show it as QUEUED; retry restarts it.
        });

        toast.success(`Grading job for "${input.topic}" started`);
        onCreated();
        return true;
      } catch (error) {
        toast.error(
          error instanceof AudioExtractionError
            ? error.message
            : "Something went wrong while submitting the job"
        );
        return false;
      } finally {
        setPhase(null);
      }
    },
    [onCreated]
  );

  return { submit, phase };
}

export async function retryPresentationJob(id: string): Promise<void> {
  const res = await fetch(`/api/presentation-grading/jobs/${id}/process`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Retry failed");
  }
}
