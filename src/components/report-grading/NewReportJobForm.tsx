"use client";

import React, { useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
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
import {
  REPORT_BATCH_MAX_FILES,
  REPORT_FILE_MAX_BYTES,
  REPORT_TEXT_MAX_CHARS,
  studentIdFromFilename,
} from "@/lib/report-grading";
import {
  useSubmitReportJob,
  type NewReportJobInput,
  type ReportBatchFile,
  type ReportSubmitProgress,
} from "@/hooks/useReportGrading";
import { ReportBatchFileList } from "./ReportBatchFileList";

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
  const [files, setFiles] = useState<ReportBatchFile[]>([]);
  const [reportText, setReportText] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState<"high" | "xhigh">("high");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { submit, progress } = useSubmitReportJob(onCreated);

  const addFiles = (picked: FileList | null) => {
    if (!picked) return;
    const next = [...files];
    for (const file of Array.from(picked)) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        toast.error(`"${file.name}" is not a PDF and was skipped.`);
        continue;
      }
      next.push({ file, studentId: studentIdFromFilename(file.name) });
    }
    if (next.length > REPORT_BATCH_MAX_FILES) {
      toast.error(`At most ${REPORT_BATCH_MAX_FILES} reports per batch.`);
      next.length = REPORT_BATCH_MAX_FILES;
    }
    setFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    const input: NewReportJobInput = {
      title: title.trim(),
      authors: authors.trim() || undefined,
      files: source === "pdf" ? files : [],
      reportText: source === "text" ? reportText.trim() || null : null,
      reasoningEffort,
    };
    const created = await submit(input);
    if (created) {
      setTitle("");
      setAuthors("");
      setReportText("");
      setFiles([]);
    }
  };

  const canSubmit =
    progress === null &&
    (source === "pdf"
      ? files.length > 0
      : title.trim().length > 0 && reportText.trim().length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grade written reports</CardTitle>
        <CardDescription>
          Upload one or more report PDFs (or paste one report&apos;s text). Each PDF becomes its
          own grading job: the AI reads it against the shared grading instructions and returns a
          summary, comments, and per-criterion scores with reasons.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="report-title">
              Report title {source === "text" ? <span className="text-red-500">*</span> : null}
            </Label>
            <Input
              id="report-title"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                source === "pdf"
                  ? "Optional for a single PDF — filenames are used otherwise"
                  : "e.g. Deriving Coulomb's Law from Maxwell's Equations"
              }
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
                ["pdf", "Upload PDFs"],
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
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <ReportBatchFileList
              files={files}
              onChangeStudentId={(index, studentId) =>
                setFiles((prev) =>
                  prev.map((entry, i) => (i === index ? { ...entry, studentId } : entry))
                )
              }
              onRemove={(index) => setFiles((prev) => prev.filter((_, i) => i !== index))}
            />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <FileText className="mr-1.5 h-4 w-4" />
              {files.length > 0 ? "Add more PDFs" : "Choose report PDFs"}
            </Button>
            <p className="text-xs text-gray-500">
              PDF only, up to {formatBytes(REPORT_FILE_MAX_BYTES)} each and{" "}
              {REPORT_BATCH_MAX_FILES} per batch. Files are deleted after grading. Ask students to
              put their student ID in the filename (e.g. 王小明_113012345_期末報告.pdf) — it is
              picked up automatically and can be corrected above.
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
            {progress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {progress
              ? progressLabel(progress)
              : files.length > 1
                ? `Start grading ${files.length} reports`
                : "Start grading"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
