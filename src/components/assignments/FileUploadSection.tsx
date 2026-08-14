"use client";

import React from "react";
import { Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  UPLOAD_ACCEPT_ATTRIBUTE,
  UPLOAD_LIMITS_HINT,
} from "@/lib/upload-constraints";

interface FileUploadSectionProps {
  /** "main" for FILE_UPLOAD type assignments, "attachment" for QUIZ optional attachment */
  variant: "main" | "attachment";
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** URL of the file already submitted, if any — a new upload replaces it. */
  currentFileUrl?: string | null;
}

export function FileUploadSection({
  variant,
  file,
  onFileChange,
  currentFileUrl,
}: FileUploadSectionProps) {
  const isMain = variant === "main";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {isMain ? "Upload Your Submission" : "Attach Your Work (Optional)"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-xl ${isMain ? "p-8" : "p-6"} text-center`}
        >
          <Upload
            className={`${isMain ? "h-10 w-10" : "h-8 w-8"} text-neutral-300 mx-auto ${isMain ? "mb-3" : "mb-2"}`}
          />
          <p className="text-sm text-neutral-500 mb-1">
            {isMain
              ? "Upload your submission"
              : "Upload your handwritten or additional work"}
          </p>
          <p className="text-xs text-neutral-500 mb-3">{UPLOAD_LIMITS_HINT}</p>
          {currentFileUrl && !file && (
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-3">
              A file is already submitted.{" "}
              <a href={currentFileUrl} target="_blank" rel="noopener noreferrer" className="underline">
                View it
              </a>
              . Uploading a new file replaces it.
            </p>
          )}
          <input
            type="file"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              if (f && f.size > MAX_UPLOAD_BYTES) {
                toast.error("File exceeds the 20 MB limit. Please use a smaller file.");
                e.target.value = "";
                return;
              }
              const ext = f?.name.split(".").pop()?.toLowerCase();
              if (f && (!ext || !ALLOWED_UPLOAD_EXTENSIONS.includes(ext))) {
                toast.error(`This file type is not accepted. ${UPLOAD_LIMITS_HINT}`);
                e.target.value = "";
                return;
              }
              onFileChange(f);
            }}
            className="text-sm"
            accept={UPLOAD_ACCEPT_ATTRIBUTE}
          />
          {file && (
            <p className="text-sm text-emerald-600 mt-2">
              Selected: {file.name}
              {currentFileUrl ? " — this replaces your submitted file" : ""}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
