"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { RosterLookup, RosterSummary } from "@/lib/presentation-roster";

const ROSTER_ENDPOINT = "/api/presentation-grading/roster";

/** The imported sign-up sheet (student ID → name/topic) and its re-import action. */
export function usePresentationRoster() {
  const [roster, setRoster] = useState<RosterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetch(ROSTER_ENDPOINT)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body) => setRoster(body.data))
      .catch((error) => {
        console.error("Failed to load the sign-up sheet summary:", error);
        toast.error("Failed to load the sign-up sheet");
      })
      .finally(() => setLoading(false));
  }, []);

  const importSheet = useCallback(async (sheetUrl: string): Promise<boolean> => {
    setImporting(true);
    try {
      const res = await fetch(ROSTER_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Failed to import the sign-up sheet");
        return false;
      }
      setRoster(body.data);
      toast.success(
        `Imported ${body.data.entryCount} students (${body.data.withTopicCount} with a topic)`
      );
      return true;
    } catch (error) {
      console.error("Sign-up sheet import failed:", error);
      toast.error("Failed to import the sign-up sheet");
      return false;
    } finally {
      setImporting(false);
    }
  }, []);

  return { roster, loading, importing, importSheet };
}

/** Looks a student up in the imported roster; null when absent or on error. */
export async function lookupRosterStudent(studentId: string): Promise<RosterLookup | null> {
  const trimmed = studentId.trim();
  if (!/^\d{5,15}$/.test(trimmed)) return null;
  try {
    const res = await fetch(`${ROSTER_ENDPOINT}/${encodeURIComponent(trimmed)}`);
    if (!res.ok) return null;
    const body = await res.json();
    return body.data;
  } catch (error) {
    console.error("Roster lookup failed:", error);
    return null;
  }
}
