"use client";

import React, { useRef, useState } from "react";
import { Archive, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lookupRosterStudent } from "@/hooks/usePresentationRoster";
import type { JobSubmitPhase, NewJobInput } from "@/hooks/usePresentationGrading";
import type { PresentationReasoningEffort } from "@/lib/presentation-grading";
import { parseSubmissionZip, type SubmissionPackage } from "@/lib/submission-zip";

const ZIP_ACCEPT = ".zip,application/zip,application/x-zip-compressed";

function isZip(file: File): boolean {
  return /\.zip$/i.test(file.name) || file.type.includes("zip");
}

interface ArchiveDropZoneProps {
  reading: boolean;
  disabled: boolean;
  onFiles: (files: File[]) => void;
}

/** The primary way in: a large drop target for one or more eeClass exports. */
function ArchiveDropZone({ reading, disabled, onFiles }: ArchiveDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    const zips = files.filter(isZip);
    if (zips.length < files.length) {
      toast.error("Only .zip exports go here. Single videos and slides go in the pickers below.");
    }
    if (zips.length > 0) onFiles(zips);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) pick(e.dataTransfer.files);
      }}
      className={`flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        dragging
          ? "border-orange-400 bg-orange-50 dark:bg-orange-950/30"
          : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900"
      }`}
    >
      {reading ? (
        <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
      ) : (
        <Archive className="h-7 w-7 text-gray-400" />
      )}
      <span className="text-sm font-medium">
        {reading ? "Reading the archives…" : "Drop eeClass exports (.zip) here, or click to choose them"}
      </span>
      <span className="text-xs text-gray-500">
        Student ID, name, topic, video and slides are filled in for you. One student fills the
        form below; several students (or several zips) become a queue graded one after another.
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={ZIP_ACCEPT}
        multiple
        className="hidden"
        aria-label="eeClass exports (.zip)"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />
    </button>
  );
}

/** A submission package with name and topic resolved against the roster. */
export interface ResolvedSubmission extends SubmissionPackage {
  presenters: string;
  topic: string;
  /** True when the topic came from the sign-up sheet rather than the video filename. */
  topicFromRoster: boolean;
}

async function resolveSubmission(pkg: SubmissionPackage): Promise<ResolvedSubmission> {
  const roster = pkg.studentId ? await lookupRosterStudent(pkg.studentId) : null;
  return {
    ...pkg,
    presenters: pkg.studentName ?? roster?.name ?? "",
    topic: roster?.topic ?? pkg.topicHint ?? "",
    topicFromRoster: Boolean(roster?.topic),
  };
}

type RowStatus = "pending" | "running" | "done" | "failed" | "no-video";

interface BatchRow extends ResolvedSubmission {
  status: RowStatus;
}

const STATUS_LABELS: Record<RowStatus, string> = {
  pending: "Ready",
  running: "Submitting…",
  done: "Started",
  failed: "Failed",
  "no-video": "No video in folder",
};

interface SubmissionImportProps {
  /** Called with a resolved package when the archive holds exactly one student. */
  onSingle: (submission: ResolvedSubmission) => void;
  submit: (input: NewJobInput) => Promise<boolean>;
  phase: JobSubmitPhase;
  track: "A" | "B" | undefined;
  reasoningEffort: PresentationReasoningEffort;
}

/** Packages from every readable archive; unreadable or empty ones are reported and skipped. */
async function parseArchives(files: File[]): Promise<SubmissionPackage[]> {
  const packages: SubmissionPackage[] = [];
  for (const file of files) {
    try {
      const found = await parseSubmissionZip(file);
      if (found.length === 0) toast.error(`No video or slides found in ${file.name}.`);
      packages.push(...found);
    } catch (error) {
      console.error(`Failed to read the submission archive ${file.name}:`, error);
      toast.error(`Could not read ${file.name} as a .zip file.`);
    }
  }
  return packages;
}

/**
 * Accepts eeClass exports (.zip). One student fills the form; several students
 * (from one bulk export or several zips) become a queue submitted one after another.
 */
export function SubmissionImport({ onSingle, submit, phase, track, reasoningEffort }: SubmissionImportProps) {
  const [archiveNames, setArchiveNames] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [runningBatch, setRunningBatch] = useState(false);

  const handleArchives = async (files: File[]) => {
    setReading(true);
    try {
      const resolved = await Promise.all((await parseArchives(files)).map(resolveSubmission));
      if (resolved.length === 0) return;
      if (resolved.length === 1) {
        onSingle(resolved[0]);
        return;
      }
      setArchiveNames(files.map((file) => file.name));
      setRows(resolved.map((pkg) => ({ ...pkg, status: pkg.video ? "pending" : "no-video" })));
    } finally {
      setReading(false);
    }
  };

  const updateRow = (index: number, patch: Partial<BatchRow>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const isReady = (row: BatchRow) =>
    row.status === "pending" && row.video !== null && row.topic.trim() !== "" && row.presenters.trim() !== "";

  const runBatch = async () => {
    setRunningBatch(true);
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      if (!isReady(row) || !row.video) continue;
      updateRow(index, { status: "running" });
      const ok = await submit({
        topic: row.topic.trim(),
        presenters: row.presenters.trim() || undefined,
        studentIds: row.studentId ?? undefined,
        track,
        video: row.video,
        transcript: null,
        slides: row.slides,
        reasoningEffort,
      });
      updateRow(index, { status: ok ? "done" : "failed" });
    }
    setRunningBatch(false);
  };

  const clearBatch = () => {
    setRows([]);
    setArchiveNames([]);
  };

  const readyCount = rows.filter(isReady).length;
  const incompleteCount = rows.filter((row) => row.status === "pending" && !isReady(row)).length;

  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        <ArchiveDropZone
          reading={reading}
          disabled={reading || phase !== null}
          onFiles={(files) => void handleArchives(files)}
        />
        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-gray-400">
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
          or fill in by hand
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {rows.length} students in{" "}
          {archiveNames.length === 1 ? archiveNames[0] : `${archiveNames.length} archives`}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={clearBatch} disabled={runningBatch}>
            Clear
          </Button>
          <Button size="sm" onClick={() => void runBatch()} disabled={runningBatch || readyCount === 0}>
            {runningBatch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {runningBatch ? "Grading…" : `Grade all (${readyCount})`}
          </Button>
        </div>
      </div>
      {incompleteCount > 0 ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {incompleteCount} {incompleteCount === 1 ? "row needs" : "rows need"} a topic and a name
          before it can be graded — fill them in below or import the sign-up sheet first.
        </p>
      ) : null}
      <ul className="divide-y divide-gray-200 dark:divide-gray-800 text-sm">
        {rows.map((row, index) => (
          <li key={`${index}-${row.label}`} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_2fr_auto] gap-2 py-2 items-center">
            <div className="min-w-0">
              <p className="truncate font-medium">{row.studentId ?? "No student ID"}</p>
              <p className="truncate text-xs text-gray-500">
                {row.label}
                {row.slides ? ` · ${row.slides.name}` : " · no slides"}
              </p>
            </div>
            <Input
              aria-label={`Presenter name for ${row.label}`}
              placeholder="Presenter name"
              maxLength={200}
              value={row.presenters}
              disabled={runningBatch || row.status !== "pending"}
              onChange={(e) => updateRow(index, { presenters: e.target.value })}
            />
            <Input
              aria-label={`Topic for ${row.label}`}
              placeholder="Question Bank problem / topic"
              maxLength={200}
              value={row.topic}
              disabled={runningBatch || row.status !== "pending"}
              onChange={(e) => updateRow(index, { topic: e.target.value })}
            />
            <span className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
              {row.status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {row.status === "done" ? <Check className="h-3.5 w-3.5 text-green-600" /> : null}
              {row.status === "failed" || row.status === "no-video" ? (
                <X className="h-3.5 w-3.5 text-red-500" />
              ) : null}
              {STATUS_LABELS[row.status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
