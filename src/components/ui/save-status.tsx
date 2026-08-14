"use client";

import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import type { SaveStatus } from "@/hooks/useAutoSave";

export function SaveStatusIndicator({
  status,
  lastSavedAt,
}: {
  status: SaveStatus;
  lastSavedAt?: Date | null;
}) {
  if (status === "idle") {
    if (!lastSavedAt) return null;
    return (
      <span className="text-xs text-gray-500 dark:text-gray-400" role="status">
        Saved at {lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium" role="status" aria-live="polite">
      {status === "saving" && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400 dark:text-gray-500" />
          <span className="text-gray-500 dark:text-gray-400">Saving...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
          <span className="text-emerald-600 dark:text-emerald-400">
            Saved{lastSavedAt ? ` at ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
          </span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
          <span className="text-red-600 dark:text-red-400">
            Save failed — your latest edits are not stored
          </span>
        </>
      )}
    </span>
  );
}
