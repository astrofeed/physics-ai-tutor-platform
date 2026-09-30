"use client";

import { useCallback, useState } from "react";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { extractAudioFromVideo, AudioExtractionError } from "@/lib/extract-audio";
import { formatBytes } from "@/lib/chat-attachments";
import {
  PRESENTATION_SLIDES_MAX_BYTES,
  PRESENTATION_TRANSCRIPT_MAX_CHARS,
  PRESENTATION_VIDEO_MAX_BYTES,
  PRESENTATION_VIDEO_MAX_SECONDS,
} from "@/lib/presentation-grading";
import type { NewJobInput, JobSubmitPhase } from "@/types/presentation-grading";

const UPLOAD_ENDPOINT = "/api/presentation-grading/upload";

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

/** Extracts audio, uploads media, creates the job, and starts processing. */
export function useSubmitPresentationJob(onCreated: () => void) {
  const [phase, setPhase] = useState<JobSubmitPhase>(null);

  const submit = useCallback(
    async (input: NewJobInput): Promise<boolean> => {
      if (!input.video && !input.transcript) {
        toast.error("Choose a video or paste the transcript first.");
        return false;
      }
      if (input.video && input.video.size > PRESENTATION_VIDEO_MAX_BYTES) {
        toast.error(
          `The video is ${formatBytes(input.video.size)}; the maximum is ${formatBytes(PRESENTATION_VIDEO_MAX_BYTES)}.`
        );
        return false;
      }
      if (input.transcript && input.transcript.length > PRESENTATION_TRANSCRIPT_MAX_CHARS) {
        toast.error(
          `The transcript is ${input.transcript.length.toLocaleString()} characters; the maximum is ${PRESENTATION_TRANSCRIPT_MAX_CHARS.toLocaleString()}.`
        );
        return false;
      }
      if (input.slides && input.slides.size > PRESENTATION_SLIDES_MAX_BYTES) {
        toast.error(
          `The slides file is ${formatBytes(input.slides.size)}; the maximum is ${formatBytes(PRESENTATION_SLIDES_MAX_BYTES)}.`
        );
        return false;
      }
      try {
        let audioBlobUrl: string | undefined;
        if (input.video) {
          const { wav, durationSeconds } = await extractAudioFromVideo(input.video, setPhase);
          if (durationSeconds > PRESENTATION_VIDEO_MAX_SECONDS) {
            toast.error(
              `The video is ${Math.floor(durationSeconds / 60)}:${String(Math.round(durationSeconds % 60)).padStart(2, "0")} long; presentations must be at most 3:30.`
            );
            return false;
          }
          setPhase("uploading");
          audioBlobUrl = await uploadToBlob("audio", "presentation-audio.wav", wav, "audio/wav");
        } else {
          setPhase("uploading");
        }
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
            questionBankId: input.questionBankId,
            presenters: input.presenters,
            studentIds: input.studentIds,
            track: input.track,
            audioBlobUrl,
            transcript: input.transcript ?? undefined,
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
        }).then((response) => {
          if (!response.ok) throw new Error(`Processing returned ${response.status}`);
        }).catch((error) => {
          // The job list will show it as QUEUED; retry restarts it.
          console.error("[presentation-grading:process]", { jobId: body.data.id, error });
          toast.error("Could not start processing. Check the job status before retrying.");
        });

        toast.success(`Grading job for "${input.topic}" started`);
        onCreated();
        return true;
      } catch (error) {
        console.error("[presentation-grading:submit]", { error });
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
