"use client";

import React, { useRef } from "react";
import { X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { formatBytes } from "@/lib/chat-attachments";

export function FilePicker({
  label,
  hint,
  accept,
  file,
  onChange,
  icon: Icon,
  required,
  disabled,
}: {
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
  icon: React.ElementType;
  required?: boolean;
  disabled?: boolean;
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
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-3 py-3 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon className="h-4 w-4" />
          {hint}
        </button>
      )}
    </div>
  );
}
