"use client";

import { useEffect } from "react";

interface GradingShortcutHandlers {
  onSaveAndNext: () => void;
  onNextSubmission: () => void;
  onPrevSubmission: () => void;
  onToggleHelp: () => void;
  enabled: boolean;
}

/** Shortcuts documented in `GradingShortcutsDialog`. */
export const GRADING_SHORTCUTS: { keys: string; description: string }[] = [
  { keys: "Enter (in a score box)", description: "Confirm the score and jump to the next question" },
  { keys: "Alt + F (in a score box)", description: "Give full marks for that question" },
  { keys: "Ctrl / ⌘ + Enter", description: "Finalize and open the next submission" },
  { keys: "J / N", description: "Next submission" },
  { keys: "K / P", description: "Previous submission" },
  { keys: "?", description: "Show this list" },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

/** Keyboard-driven grading; text fields keep their normal behaviour. */
export function useGradingShortcuts({
  onSaveAndNext,
  onNextSubmission,
  onPrevSubmission,
  onToggleHelp,
  enabled,
}: GradingShortcutHandlers) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        onSaveAndNext();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      switch (event.key.toLowerCase()) {
        case "j":
        case "n":
          event.preventDefault();
          onNextSubmission();
          break;
        case "k":
        case "p":
          event.preventDefault();
          onPrevSubmission();
          break;
        case "?":
          event.preventDefault();
          onToggleHelp();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onSaveAndNext, onNextSubmission, onPrevSubmission, onToggleHelp]);
}
