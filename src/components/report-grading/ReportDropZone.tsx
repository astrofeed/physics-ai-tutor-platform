"use client";

import React, { useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";

const ACCEPT = ".pdf,application/pdf,.zip,application/zip,application/x-zip-compressed";

interface ReportDropZoneProps {
  reading: boolean;
  disabled: boolean;
  /** True once the batch has rows, so the label reads as "add more". */
  hasFiles: boolean;
  onFiles: (files: File[]) => void;
}

/** The way in for written reports: drop any number of PDFs and/or eeClass exports (.zip). */
export function ReportDropZone({ reading, disabled, hasFiles, onFiles }: ReportDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length > 0) onFiles(files);
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
      className={`flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        hasFiles ? "py-3" : "py-6"
      } ${
        dragging
          ? "border-orange-400 bg-orange-50 dark:bg-orange-950/30"
          : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900"
      }`}
    >
      {reading ? (
        <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
      ) : (
        <FileText className="h-7 w-7 text-gray-400" />
      )}
      <span className="text-sm font-medium">
        {reading
          ? "Reading the files…"
          : hasFiles
            ? "Drop more PDFs or eeClass exports (.zip) here, or click to choose"
            : "Drop report PDFs or eeClass exports (.zip) here, or click to choose them"}
      </span>
      {hasFiles ? null : (
        <span className="text-xs text-gray-500">
          Zips are opened in your browser (never uploaded, any size) and every PDF inside becomes
          one row below. Student ID, name, topic and the assigned question are filled in from the
          sign-up sheet.
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        aria-label="Report PDFs or eeClass exports (.zip)"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />
    </button>
  );
}
