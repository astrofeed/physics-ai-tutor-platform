"use client";

import React from "react";
import { AlertTriangle, FileText, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/lib/chat-attachments";
import { REPORT_ASSIGNED_QUESTION_MAX_CHARS, REPORT_STUDENT_ID_MAX_CHARS } from "@/lib/report-grading";
import type { ReportBatchFile } from "@/hooks/useReportBatch";

interface ReportBatchFileListProps {
  files: ReportBatchFile[];
  disabled: boolean;
  onChange: (index: number, patch: Partial<ReportBatchFile>) => void;
  /** Fired when the grader finishes editing a student ID, to refill the row from the sheet. */
  onStudentIdBlur: (index: number) => void;
  onRemove: (index: number) => void;
}

function rosterNote(row: ReportBatchFile): string {
  if (!row.studentId?.trim()) return "No student ID — type it in to fill the row from the sign-up sheet";
  if (!row.rosterMatched) return "Not in the sign-up sheet — check the title and question by hand";
  return [row.groupLabel, row.presentationDate].filter(Boolean).join(" · ") || "In the sign-up sheet";
}

/**
 * The report PDFs waiting to be submitted, one row per file. Everything the
 * AI is told about a report (student ID, name, presentation topic, report question) is
 * shown and editable; group and date come from the sign-up sheet.
 */
export function ReportBatchFileList({
  files,
  disabled,
  onChange,
  onStudentIdBlur,
  onRemove,
}: ReportBatchFileListProps) {
  if (files.length === 0) return null;
  return (
    <ul className="space-y-2">
      {files.map((row, index) => {
        const missingId = !row.studentId?.trim();
        return (
          <li
            key={`${row.folder ?? ""}/${row.file.name}-${index}`}
            className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-gray-500" />
              <span className="min-w-0 flex-1 truncate" title={row.file.name}>
                {row.folder ? <span className="text-gray-500">{row.folder} / </span> : null}
                {row.file.name}
              </span>
              <span className="shrink-0 text-xs text-gray-500">{formatBytes(row.file.size)}</span>
              <button
                type="button"
                aria-label={`Remove ${row.file.name}`}
                disabled={disabled}
                onClick={() => onRemove(index)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[8rem_1fr_2fr]">
              <div className="flex items-center gap-1.5">
                {missingId || !row.rosterMatched ? (
                  <AlertTriangle
                    className="h-4 w-4 shrink-0 text-amber-500"
                    aria-label={missingId ? "No student ID found" : "Student not in the sign-up sheet"}
                  />
                ) : null}
                <Input
                  aria-label={`Student ID for ${row.file.name}`}
                  placeholder="Student ID"
                  maxLength={REPORT_STUDENT_ID_MAX_CHARS}
                  value={row.studentId ?? ""}
                  disabled={disabled}
                  onChange={(e) => onChange(index, { studentId: e.target.value })}
                  onBlur={() => onStudentIdBlur(index)}
                  className="h-8 text-xs"
                />
              </div>
              <Input
                aria-label={`Student name for ${row.file.name}`}
                placeholder="Student name"
                maxLength={200}
                value={row.studentName}
                disabled={disabled}
                onChange={(e) => onChange(index, { studentName: e.target.value })}
                className="h-8 text-xs"
              />
              <Input
                aria-label={`Presentation topic for ${row.file.name}`}
                placeholder="Presentation topic (sheet: Topics)"
                maxLength={200}
                value={row.title}
                disabled={disabled}
                onChange={(e) => onChange(index, { title: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <Input
              aria-label={`Report question for ${row.file.name}`}
              placeholder="Report question to answer (sheet: Report Topic) — blank if none"
              maxLength={REPORT_ASSIGNED_QUESTION_MAX_CHARS}
              value={row.assignedQuestion}
              disabled={disabled}
              onChange={(e) => onChange(index, { assignedQuestion: e.target.value })}
              className="h-8 text-xs"
            />
            <p className="text-xs text-gray-500">{rosterNote(row)}</p>
          </li>
        );
      })}
    </ul>
  );
}
