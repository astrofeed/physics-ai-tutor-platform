"use client";

import React from "react";
import { Paperclip } from "lucide-react";

/** Full-container overlay shown while files are dragged over the chat. */
export function FileDropOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-blue-400 dark:border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 px-10 py-8">
        <Paperclip className="h-8 w-8 text-blue-500" />
        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
          Drop files to attach
        </p>
        <p className="text-xs text-blue-500 dark:text-blue-400">
          Images, PDF, .md, or .txt
        </p>
      </div>
    </div>
  );
}
