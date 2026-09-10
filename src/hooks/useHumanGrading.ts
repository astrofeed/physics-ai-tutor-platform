"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { HumanScoreEntry } from "@/lib/human-grading";

export type HumanGradingKind = "report" | "presentation";

const API_BASE: Record<HumanGradingKind, string> = {
  report: "/api/report-grading/jobs",
  presentation: "/api/presentation-grading/jobs",
};

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error ?? fallback;
}

async function postReveal(kind: HumanGradingKind, jobId: string): Promise<Response> {
  return fetch(`${API_BASE[kind]}/${jobId}/reveal-ai`, { method: "POST" });
}

/**
 * Saves staff scores for a job and records when the AI result is revealed.
 * Saving scores also reveals the AI result, since the comparison is shown
 * right after. `onChanged` should reload the job so the page reflects the
 * new state.
 */
export function useHumanGrading(
  kind: HumanGradingKind,
  jobId: string,
  onChanged: () => void
) {
  const [saving, setSaving] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const saveScores = useCallback(
    async (scores: HumanScoreEntry[]): Promise<boolean> => {
      setSaving(true);
      try {
        const res = await fetch(`${API_BASE[kind]}/${jobId}/human-scores`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scores }),
        });
        if (!res.ok) {
          toast.error(await errorMessage(res, "Failed to save your scores"));
          return false;
        }
        const reveal = await postReveal(kind, jobId);
        if (!reveal.ok) {
          console.error(`[human-grading] reveal after save failed for ${kind} job ${jobId}:`, reveal.status);
        }
        toast.success("Your scores were saved");
        onChanged();
        return true;
      } catch (error) {
        console.error(`[human-grading] saving scores for ${kind} job ${jobId} failed:`, error);
        toast.error("Failed to save your scores");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [kind, jobId, onChanged]
  );

  const revealAi = useCallback(async (): Promise<boolean> => {
    setRevealing(true);
    try {
      const res = await postReveal(kind, jobId);
      if (!res.ok) {
        toast.error(await errorMessage(res, "Failed to open the AI result"));
        return false;
      }
      onChanged();
      return true;
    } catch (error) {
      console.error(`[human-grading] revealing AI for ${kind} job ${jobId} failed:`, error);
      toast.error("Failed to open the AI result");
      return false;
    } finally {
      setRevealing(false);
    }
  }, [kind, jobId, onChanged]);

  return { saveScores, saving, revealAi, revealing };
}
