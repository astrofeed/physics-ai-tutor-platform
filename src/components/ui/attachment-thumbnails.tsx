"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { isPdfUrl } from "@/lib/upload-constraints";

interface AttachmentThumbnailsProps {
  urls: string[];
  /** Describes the set for screen readers, e.g. "Answer attachment". */
  label: string;
  size?: "sm" | "md";
}

/** Opens photos and PDFs a student attached; PDFs get a tile instead of a preview. */
export function AttachmentThumbnails({
  urls,
  label,
  size = "md",
}: AttachmentThumbnailsProps) {
  // Attachments uploaded before the filename was part of the URL cannot be told
  // apart up front, so a failed image load falls back to the file tile.
  const [unpreviewable, setUnpreviewable] = useState<string[]>([]);

  if (urls.length === 0) return null;

  const box = size === "sm" ? "h-16 w-16" : "h-20 w-20";

  return (
    <div className="flex gap-2 flex-wrap">
      {urls.map((url, index) => (
        <a
          key={index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={`${label} ${index + 1}`}
          className="hover:opacity-80 transition-opacity"
        >
          {isPdfUrl(url) || unpreviewable.includes(url) ? (
            <span
              className={`${box} flex flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-600 dark:text-gray-300`}
            >
              <FileText className="h-5 w-5" />
              {isPdfUrl(url) ? "PDF" : "File"}
            </span>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={url}
              alt={`${label} ${index + 1}`}
              onError={() => setUnpreviewable((prev) => [...prev, url])}
              className={`${box} object-cover rounded-lg border border-gray-200 dark:border-gray-700`}
            />
          )}
        </a>
      ))}
    </div>
  );
}
