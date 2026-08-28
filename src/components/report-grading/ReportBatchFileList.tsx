"use client";

import React from "react";
import { AlertTriangle, FileText, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/lib/chat-attachments";
import { REPORT_STUDENT_ID_MAX_CHARS } from "@/lib/report-grading";
import type { ReportBatchFile } from "@/hooks/useReportGrading";

/**
 * The selected report PDFs, one row per file, with the student ID parsed
 * from the filename shown as an editable field (blank = missing ID).
 */
export function ReportBatchFileList({
  files,
  onChangeStudentId,
  onRemove,
}: {
  files: ReportBatchFile[];
  onChangeStudentId: (index: number, studentId: string) => void;
  onRemove: (index: number) => void;
}) {
  if (files.length === 0) return null;
  return (
    <ul className="space-y-2">
      {files.map(({ file, studentId }, index) => (
        <li
          key={`${file.name}-${index}`}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm"
        >
          <FileText className="h-4 w-4 shrink-0 text-gray-500" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <span className="shrink-0 text-xs text-gray-500">{formatBytes(file.size)}</span>
          <div className="flex items-center gap-1.5">
            {!studentId?.trim() ? (
              <AlertTriangle
                className="h-4 w-4 text-amber-500"
                aria-label="No student ID found in the filename"
              />
            ) : null}
            <Input
              aria-label={`Student ID for ${file.name}`}
              placeholder="Student ID"
              maxLength={REPORT_STUDENT_ID_MAX_CHARS}
              value={studentId ?? ""}
              onChange={(e) => onChangeStudentId(index, e.target.value)}
              className="h-8 w-32 text-xs"
            />
          </div>
          <button
            type="button"
            aria-label={`Remove ${file.name}`}
            onClick={() => onRemove(index)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
