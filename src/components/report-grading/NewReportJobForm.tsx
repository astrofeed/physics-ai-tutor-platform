"use client";

import React, { useRef, useState } from "react";
import { FileText, Loader2, X } from "lucide-react";
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
import { REPORT_FILE_MAX_BYTES, REPORT_TEXT_MAX_CHARS } from "@/lib/report-grading";
import {
  useSubmitReportJob,
  type NewReportJobInput,
  type ReportSubmitPhase,
} from "@/hooks/useReportGrading";

const PHASE_LABELS: Record<Exclude<ReportSubmitPhase, null>, string> = {
  uploading: "Uploading the report…",
  creating: "Starting the grading job…",
};

type Source = "pdf" | "text";

export function NewReportJobForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [source, setSource] = useState<Source>("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [reportText, setReportText] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState<"high" | "xhigh">("high");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { submit, phase } = useSubmitReportJob(onCreated);

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    const input: NewReportJobInput = {
      title: title.trim(),
      authors: authors.trim() || undefined,
      file: source === "pdf" ? file : null,
      reportText: source === "text" ? reportText.trim() || null : null,
      reasoningEffort,
    };
    const created = await submit(input);
    if (created) {
      setTitle("");
      setAuthors("");
      setReportText("");
      clearFile();
    }
  };

  const canSubmit =
    title.trim().length > 0 &&
    phase === null &&
    (source === "pdf" ? file !== null : reportText.trim().length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grade a written report</CardTitle>
        <CardDescription>
          Upload the report PDF (or paste its text). The AI reads it against the shared grading
          instructions and returns a summary, comments, and per-criterion scores with reasons.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="report-title">
              Report title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="report-title"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Deriving Coulomb's Law from Maxwell's Equations"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-authors">Author names</Label>
            <Input
              id="report-authors"
              maxLength={200}
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Report source</Label>
          <div className="flex gap-2">
            {(
              [
                ["pdf", "Upload PDF"],
                ["text", "Paste text"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={source === value ? "default" : "outline"}
                size="sm"
                onClick={() => setSource(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {source === "pdf" ? (
          <div className="space-y-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-gray-500" />
                <span className="truncate flex-1">{file.name}</span>
                <span className="text-xs text-gray-500 shrink-0">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  aria-label="Remove report file"
                  onClick={clearFile}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <FileText className="mr-1.5 h-4 w-4" />
                Choose report PDF
              </Button>
            )}
            <p className="text-xs text-gray-500">
              PDF only, up to {formatBytes(REPORT_FILE_MAX_BYTES)}. The file is deleted after
              grading.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="report-text">Report text</Label>
            <Textarea
              id="report-text"
              rows={10}
              maxLength={REPORT_TEXT_MAX_CHARS}
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              placeholder="Paste the report or lecture notes here…"
              className="font-mono text-xs leading-relaxed"
            />
            <p className="text-xs text-gray-500">
              {reportText.length.toLocaleString()} / {REPORT_TEXT_MAX_CHARS.toLocaleString()}{" "}
              characters
            </p>
          </div>
        )}

        <div className="space-y-1.5 sm:max-w-xs">
          <Label>Reasoning effort</Label>
          <Select
            value={reasoningEffort}
            onValueChange={(value) => setReasoningEffort(value === "xhigh" ? "xhigh" : "high")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High (recommended)</SelectItem>
              <SelectItem value="xhigh">Extra high (slower)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {phase ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {phase ? PHASE_LABELS[phase] : "Start grading"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
