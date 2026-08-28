"use client";

import React, { useRef, useState } from "react";
import { FileVideo, FileText, Loader2, X } from "lucide-react";
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
  uploading: "Uploading audio and slides…",
  creating: "Starting the grading job…",
};

function FilePicker({
  label,
  hint,
  accept,
  file,
  onChange,
  icon: Icon,
  required,
}: {
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
  icon: React.ElementType;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      {label ? (
        <Label>
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </Label>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm">
          <Icon className="h-4 w-4 shrink-0 text-gray-500" />
          <span className="truncate flex-1">{file.name}</span>
          <span className="text-xs text-gray-500 shrink-0">{formatBytes(file.size)}</span>
          <button
            type="button"
            aria-label={label ? `Remove ${label.toLowerCase()}` : "Remove file"}
            onClick={() => {
              onChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-3 py-3 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <Icon className="h-4 w-4" />
          {hint}
        </button>
      )}
    </div>
  );
}

export function NewJobForm({ onCreated }: { onCreated: () => void }) {
  const [topic, setTopic] = useState("");
  const [presenters, setPresenters] = useState("");
  const [studentIds, setStudentIds] = useState("");
  const [track, setTrack] = useState<"A" | "B" | "unknown">("unknown");
  const [condition, setCondition] = useState<"AI-assisted" | "no-AI" | "unknown">("unknown");
  const [reasoningEffort, setReasoningEffort] = useState<"high" | "xhigh">("high");
  const [source, setSource] = useState<"video" | "transcript">("video");
  const [video, setVideo] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [slides, setSlides] = useState<File | null>(null);
  const { submit, phase } = useSubmitPresentationJob(onCreated);

  const hasSource = source === "video" ? video !== null : transcript.trim().length > 0;
  const canSubmit =
    topic.trim().length > 0 && presenters.trim().length > 0 && hasSource && phase === null;

  const handleSubmit = async () => {
    const input: NewJobInput = {
      topic: topic.trim(),
      presenters: presenters.trim(),
      studentIds: studentIds.trim() || undefined,
      track: track === "unknown" ? undefined : track,
      condition: condition === "unknown" ? undefined : condition,
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
          The audio is extracted in your browser — the video itself is never uploaded. You can
          submit several groups back to back; jobs run in the background.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="job-topic">
              Group / topic <span className="text-red-500">*</span>
            </Label>
            <Input
              id="job-topic"
              placeholder="e.g. Group 42 — Projectile motion with drag"
              maxLength={200}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-presenters">
              Presenter names <span className="text-red-500">*</span>
            </Label>
            <Input
              id="job-presenters"
              placeholder="e.g. 王小明, 陳大文"
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
            placeholder="e.g. 113012345, 113054321 — comma-separated, used in CSV exports"
            maxLength={200}
            value={studentIds}
            onChange={(e) => setStudentIds(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <Label>Condition</Label>
            <Select value={condition} onValueChange={(v) => setCondition(v as typeof condition)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Unknown</SelectItem>
                <SelectItem value="AI-assisted">AI-assisted</SelectItem>
                <SelectItem value="no-AI">No-AI</SelectItem>
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
                hint={`Video, max 3:30 and ${formatBytes(PRESENTATION_VIDEO_MAX_BYTES)}`}
                accept="video/*"
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
