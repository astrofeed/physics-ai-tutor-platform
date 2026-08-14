"use client";

import { useEffect, useState } from "react";

/** Whether the platform-wide exam mode is currently on. */
export function useExamMode() {
  const [examModeActive, setExamModeActive] = useState(false);

  useEffect(() => {
    fetch("/api/exam-mode")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setExamModeActive(data.isActive); })
      .catch((err) => console.error("[exam-mode] Failed to check exam mode:", err));
  }, []);

  return examModeActive;
}
