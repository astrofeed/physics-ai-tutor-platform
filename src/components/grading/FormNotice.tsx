"use client";

import React from "react";
import { AlertCircle, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type NoticeTone = "error" | "warning";

const TONES: Record<NoticeTone, { icon: React.ElementType; role: "alert" | "status"; className: string }> = {
  error: {
    icon: AlertCircle,
    role: "alert",
    className:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  },
  warning: {
    icon: AlertTriangle,
    role: "status",
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
};

interface FormNoticeProps {
  tone: NoticeTone;
  title: string;
  messages: string[];
  onDismiss: () => void;
}

/**
 * A message that stays on screen until the user dismisses it. Use it instead of
 * a toast for anything the user has to read and act on.
 */
export function FormNotice({ tone, title, messages, onDismiss }: FormNoticeProps) {
  if (messages.length === 0) return null;
  const { icon: Icon, role, className } = TONES[tone];
  return (
    <div role={role} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-medium">{title}</p>
        <ul className={cn("space-y-0.5", messages.length > 1 && "list-disc pl-4")}>
          {messages.map((message, index) => (
            <li key={`${index}-${message}`} className="break-words">
              {message}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        aria-label={`Dismiss: ${title}`}
        onClick={onDismiss}
        className="-mr-1 rounded p-1 opacity-70 transition-opacity hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
