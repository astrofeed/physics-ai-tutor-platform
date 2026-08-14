"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutoSaveOptions<T> {
  data: T;
  saveFn: (data: T) => Promise<void>;
  delayMs?: number;
  enabled?: boolean;
}

export function useAutoSave<T>({
  data,
  saveFn,
  delayMs = 2000,
  enabled = true,
}: UseAutoSaveOptions<T>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const lastSavedRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  const doSave = useCallback(async (dataToSave: T) => {
    const serialized = JSON.stringify(dataToSave);
    if (serialized === lastSavedRef.current) return;

    setStatus("saving");
    try {
      await saveFnRef.current(dataToSave);
      lastSavedRef.current = serialized;
      setLastSavedAt(new Date());
      setStatus("saved");
      // Reset to idle after 3 seconds
      if (savedResetRef.current) clearTimeout(savedResetRef.current);
      savedResetRef.current = setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      logger.error("Auto-save failed", { error: String(err) });
      setStatus("error");
    }
  }, []);

  // Debounced auto-save on data change
  useEffect(() => {
    if (!enabled) return;
    const serialized = JSON.stringify(data);
    if (serialized === lastSavedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      doSave(data);
    }, delayMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, delayMs, enabled, doSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (savedResetRef.current) clearTimeout(savedResetRef.current);
    };
  }, []);

  const saveNow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    doSave(data);
  }, [data, doSave]);

  // Mark current data as already saved (for restoring drafts)
  const markSaved = useCallback((savedData: T) => {
    lastSavedRef.current = JSON.stringify(savedData);
  }, []);

  return { status, lastSavedAt, saveNow, markSaved };
}
