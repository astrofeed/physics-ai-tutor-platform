"use client";

import React, { useState } from "react";
import { Archive, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lookupRosterStudent } from "@/hooks/usePresentationRoster";
import type { JobSubmitPhase, NewJobInput } from "@/hooks/usePresentationGrading";
import type { PresentationReasoningEffort } from "@/lib/presentation-grading";
import { parseSubmissionZip, type SubmissionPackage } from "@/lib/submission-zip";
import { FilePicker } from "./FilePicker";

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

/**
 * Accepts an eeClass export (.zip). One student fills the form; a bulk export
 * with several student folders becomes a queue submitted one after another.
 */
export function SubmissionImport({ onSingle, submit, phase, track, reasoningEffort }: SubmissionImportProps) {
  const [archive, setArchive] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [runningBatch, setRunningBatch] = useState(false);

  const handleArchive = async (file: File | null) => {
    setArchive(file);
    if (!file) return;
    setReading(true);
    try {
      const packages = await parseSubmissionZip(file);
      if (packages.length === 0) {
        toast.error("No video or slides found in that archive.");
        setArchive(null);
        return;
      }
      const resolved = await Promise.all(packages.map(resolveSubmission));
      if (resolved.length === 1) {
        onSingle(resolved[0]);
        setArchive(null);
        return;
      }
      setRows(resolved.map((pkg) => ({ ...pkg, status: pkg.video ? "pending" : "no-video" })));
    } catch (error) {
      console.error("Failed to read the submission archive:", error);
      toast.error("Could not read that .zip file.");
      setArchive(null);
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
    setArchive(null);
  };

  const readyCount = rows.filter(isReady).length;
  const incompleteCount = rows.filter((row) => row.status === "pending" && !isReady(row)).length;

  if (rows.length === 0) {
    return (
      <FilePicker
        label=""
        hint={reading ? "Reading archive…" : "Or import an eeClass export (.zip) — fills ID, name, topic, video and slides"}
        accept=".zip,application/zip,application/x-zip-compressed"
        file={reading ? archive : null}
        onChange={(file) => void handleArchive(file)}
        icon={reading ? Loader2 : Archive}
        disabled={reading || phase !== null}
      />
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {rows.length} students in {archive?.name ?? "the archive"}
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
          <li key={row.label} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_2fr_auto] gap-2 py-2 items-center">
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
