"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
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
  REPORT_BATCH_MAX_FILES,
  REPORT_FILE_MAX_BYTES,
  REPORT_TEXT_MAX_CHARS,
} from "@/lib/report-grading";
import { useReportBatch } from "@/hooks/useReportBatch";
import {
  useSubmitReportJob,
  type NewReportJobInput,
  type ReportSubmitProgress,
} from "@/hooks/useReportGrading";
import { ReportBatchFileList } from "./ReportBatchFileList";
import { ReportDropZone } from "./ReportDropZone";

function progressLabel(progress: ReportSubmitProgress): string {
  const step = progress.total > 1 ? ` ${progress.current}/${progress.total}` : "";
  return progress.phase === "uploading"
    ? `Uploading report${step}…`
    : `Starting grading job${step}…`;
}

type Source = "pdf" | "text";

export function NewReportJobForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [source, setSource] = useState<Source>("pdf");
  const [reportText, setReportText] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState<"high" | "xhigh">("high");
  const batch = useReportBatch();
  const { submit, progress } = useSubmitReportJob(onCreated);

  const handleSubmit = async () => {
    const input: NewReportJobInput = {
      title: title.trim(),
      authors: authors.trim() || undefined,
      files: source === "pdf" ? batch.files : [],
      reportText: source === "text" ? reportText.trim() || null : null,
      reasoningEffort,
    };
    const created = await submit(input);
    if (created) {
      setTitle("");
      setAuthors("");
      setReportText("");
      batch.clear();
    }
  };

  const busy = progress !== null;
  const canSubmit =
    !busy &&
    (source === "pdf"
      ? batch.files.length > 0 && !batch.reading
      : title.trim().length > 0 && reportText.trim().length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grade written reports</CardTitle>
        <CardDescription>
          Drop the report PDFs or the eeClass export (.zip) — one or many. Each PDF becomes its own
          grading job: the AI reads it against the grading instructions, checks whether the
          assigned question was answered, and returns a summary, evidence-referenced comments and
          per-criterion scores.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Report source</Label>
          <div className="flex gap-2">
            {(
              [
                ["pdf", "Upload PDFs / zips"],
                ["text", "Paste text"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={source === value ? "default" : "outline"}
                size="sm"
                disabled={busy}
                onClick={() => setSource(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {source === "pdf" ? (
          <div className="space-y-3">
            <ReportDropZone
              reading={batch.reading}
              disabled={batch.reading || busy}
              hasFiles={batch.files.length > 0}
              onFiles={(files) => void batch.addFiles(files)}
            />
            <ReportBatchFileList
              files={batch.files}
              disabled={busy}
              onChange={batch.updateFile}
              onStudentIdBlur={(index) => void batch.refillFromRoster(index)}
              onRemove={batch.removeFile}
            />
            <p className="text-xs text-gray-500">
              PDF only, up to {formatBytes(REPORT_FILE_MAX_BYTES)} each and {REPORT_BATCH_MAX_FILES}{" "}
              per batch; files are deleted after grading. The student ID is read from the eeClass
              folder name or the filename (e.g. 王小明_113012345_期末報告.pdf) and can be corrected
              in each row — the name, title and assigned question refill from the sign-up sheet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
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
            {progress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {progress
              ? progressLabel(progress)
              : source === "pdf" && batch.files.length > 1
                ? `Start grading ${batch.files.length} reports`
                : "Start grading"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
