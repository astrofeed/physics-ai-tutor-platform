"use client";

import React, { useRef, useState } from "react";
import { FileVideo, FileText, Loader2, Sparkles, X } from "lucide-react";
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
import { formatBytes } from "@/lib/chat-attachments";
import { PRESENTATION_SLIDES_MAX_BYTES } from "@/lib/presentation-grading";
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
      <Label>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </Label>
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
            aria-label={`Remove ${label.toLowerCase()}`}
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
  const [track, setTrack] = useState<"A" | "B" | "unknown">("unknown");
  const [condition, setCondition] = useState<"AI-assisted" | "no-AI" | "unknown">("unknown");
  const [reasoningEffort, setReasoningEffort] = useState<"high" | "xhigh">("high");
  const [video, setVideo] = useState<File | null>(null);
  const [slides, setSlides] = useState<File | null>(null);
  const { submit, phase } = useSubmitPresentationJob(onCreated);

  const canSubmit = topic.trim().length > 0 && video !== null && phase === null;

  const handleSubmit = async () => {
    if (!video) return;
    const input: NewJobInput = {
      topic: topic.trim(),
      track: track === "unknown" ? undefined : track,
      condition: condition === "unknown" ? undefined : condition,
      video,
      slides,
      reasoningEffort,
    };
    if (await submit(input)) {
      setTopic("");
      setVideo(null);
      setSlides(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          New grading job
        </CardTitle>
        <CardDescription>
          The audio is extracted in your browser — the video itself is never uploaded. You can
          submit several groups back to back; jobs run in the background.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <FilePicker
            label="Presentation video"
            hint="Choose a video (max 3:30)"
            accept="video/*"
            file={video}
            onChange={setVideo}
            icon={FileVideo}
            required
          />
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
