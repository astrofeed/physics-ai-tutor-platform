"use client";

import React, { useState } from "react";
import { FileVideo, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "@/lib/chat-attachments";
import { FilePicker } from "./FilePicker";
import { SubmissionImport, type ResolvedSubmission } from "./SubmissionImport";
import { lookupRosterStudent } from "@/hooks/usePresentationRoster";
import {
  PRESENTATION_SLIDES_MAX_BYTES,
  PRESENTATION_TRANSCRIPT_MAX_CHARS,
  PRESENTATION_VIDEO_MAX_BYTES,
} from "@/lib/presentation-grading";
import {
  useSubmitPresentationJob,
  type JobSubmitPhase,
  type NewJobInput,
} from "@/hooks/usePresentationGrading";

const PHASE_LABELS: Record<Exclude<JobSubmitPhase, null>, string> = {
  extracting: "Extracting audio from the video…",
  transcoding: "Converting the video with ffmpeg (first time downloads ~30 MB)…",
  uploading: "Uploading audio and slides…",
  creating: "Starting the grading job…",
};

export function NewJobForm({ onCreated }: { onCreated: () => void }) {
  const [topic, setTopic] = useState("");
  const [presenters, setPresenters] = useState("");
  const [studentIds, setStudentIds] = useState("");
  const [track, setTrack] = useState<"A" | "B" | "unknown">("unknown");
  const [reasoningEffort, setReasoningEffort] = useState<"high" | "xhigh">("high");
  const [source, setSource] = useState<"video" | "transcript">("video");
  const [video, setVideo] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [slides, setSlides] = useState<File | null>(null);
  const { submit, phase } = useSubmitPresentationJob(onCreated);

  const applySubmission = (submission: ResolvedSubmission) => {
    setSource("video");
    setStudentIds(submission.studentId ?? "");
    setPresenters(submission.presenters);
    setTopic(submission.topic);
    setVideo(submission.video);
    setSlides(submission.slides);
    const slidesNote = submission.slides ? "" : " No slides in this archive — grading from the video only.";
    if (submission.topicFromRoster) {
      toast.success(`Filled from the sign-up sheet: ${submission.label}.${slidesNote}`);
    } else {
      toast.info(
        `${submission.label} is not in the sign-up sheet — the topic was taken from the video filename. Please check it.${slidesNote}`
      );
    }
  };

  const fillFromRoster = async () => {
    const entry = await lookupRosterStudent(studentIds.split(/[,\s]+/)[0] ?? "");
    if (!entry) return;
    if (!presenters.trim() && entry.name) setPresenters(entry.name);
    if (!topic.trim() && entry.topic) setTopic(entry.topic);
  };

  const hasSource = source === "video" ? video !== null : transcript.trim().length > 0;
  const canSubmit =
    topic.trim().length > 0 && presenters.trim().length > 0 && hasSource && phase === null;

  const handleSubmit = async () => {
    const input: NewJobInput = {
      topic: topic.trim(),
      presenters: presenters.trim(),
      studentIds: studentIds.trim() || undefined,
      track: track === "unknown" ? undefined : track,
      video: source === "video" ? video : null,
      transcript: source === "transcript" ? transcript.trim() : null,
      slides,
      reasoningEffort,
    };
    if (await submit(input)) {
      setTopic("");
      setPresenters("");
      setStudentIds("");
      setVideo(null);
      setTranscript("");
      setSlides(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New grading job</CardTitle>
        <CardDescription>
          Drop the eeClass export below and check what was filled in, or enter a student by hand.
          The audio is extracted in your browser — the video itself is never uploaded; jobs run in
          the background.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SubmissionImport
          onSingle={applySubmission}
          submit={submit}
          phase={phase}
          track={track === "unknown" ? undefined : track}
          reasoningEffort={reasoningEffort}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="job-topic">
              Question Bank problem / topic <span className="text-red-500">*</span>
            </Label>
            <Input
              id="job-topic"
              placeholder="e.g. QB-12 — Induced emf in a rotating loop"
              maxLength={200}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-presenters">
              Presenter name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="job-presenters"
              placeholder="e.g. 王小明"
              maxLength={200}
              value={presenters}
              onChange={(e) => setPresenters(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="job-student-ids">Student IDs</Label>
          <Input
            id="job-student-ids"
            placeholder="e.g. 113012345 — used in CSV exports"
            maxLength={200}
            value={studentIds}
            onChange={(e) => setStudentIds(e.target.value)}
            onBlur={() => void fillFromRoster()}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Track</Label>
            <Select value={track} onValueChange={(v) => setTrack(v as typeof track)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Unknown</SelectItem>
                <SelectItem value="A">Track A — One Equation, One Model</SelectItem>
                <SelectItem value="B">Track B — Counterfactual Physics Lab</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reasoning effort</Label>
            <Select
              value={reasoningEffort}
              onValueChange={(v) => setReasoningEffort(v as typeof reasoningEffort)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High (default)</SelectItem>
                <SelectItem value="xhigh">Extra high (slower, more thorough)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>
                Presentation <span className="text-red-500">*</span>
              </Label>
              <div className="flex rounded-md border border-gray-200 dark:border-gray-800 p-0.5 text-xs">
                {([
                  ["video", "Upload video"],
                  ["transcript", "Paste transcript"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSource(value)}
                    className={`rounded px-2 py-1 transition-colors ${
                      source === value
                        ? "bg-gray-100 dark:bg-gray-800 font-medium"
                        : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {source === "video" ? (
              <FilePicker
                label=""
                hint={`MP4, MOV, WebM, WMV or AVI — max 3:30 and ${formatBytes(PRESENTATION_VIDEO_MAX_BYTES)}`}
                accept="video/*,.wmv,.avi,.mkv"
                file={video}
                onChange={setVideo}
                icon={FileVideo}
              />
            ) : (
              <div className="space-y-1">
                <Textarea
                  placeholder="Paste what was said in the presentation…"
                  maxLength={PRESENTATION_TRANSCRIPT_MAX_CHARS}
                  rows={4}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                />
                <p className="text-xs text-gray-500 text-right">
                  {transcript.length.toLocaleString()} / {PRESENTATION_TRANSCRIPT_MAX_CHARS.toLocaleString()}
                </p>
              </div>
            )}
          </div>
          <FilePicker
            label="Slides"
            hint={`PDF or PPTX, up to ${formatBytes(PRESENTATION_SLIDES_MAX_BYTES)}`}
            accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            file={slides}
            onChange={setSlides}
            icon={FileText}
          />
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          Using Google Slides? Export it as PDF first (File → Download → PDF).
        </p>

        <div className="flex items-center gap-3">
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {phase !== null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {phase !== null ? PHASE_LABELS[phase] : "Start grading"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
