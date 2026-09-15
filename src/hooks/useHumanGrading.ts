"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { HumanScoresInput } from "@/lib/human-grading";

export type HumanGradingKind = "report" | "presentation";

const API_BASE: Record<HumanGradingKind, string> = {
  report: "/api/report-grading/jobs",
  presentation: "/api/presentation-grading/jobs",
};

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error ?? fallback;
}

/**
 * Saves staff scores (per item or one total) for a job and records the first time staff saw the AI
 * result. The result is shown as soon as the page opens, so the view is
 * recorded on mount; the timestamps still tell blind grades from AI-informed
 * ones for the end-of-term comparison. `onChanged` should reload the job.
 */
export function useHumanGrading(
  kind: HumanGradingKind,
  jobId: string,
  aiRevealedAt: string | null,
  onChanged: () => void
) {
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (aiRevealedAt !== null) return;
    fetch(`${API_BASE[kind]}/${jobId}/reveal-ai`, { method: "POST" })
      .then((res) => {
        if (!res.ok) {
          console.error(`[human-grading] recording AI view for ${kind} job ${jobId} failed:`, res.status);
        }
      })
      .catch((error) => {
        console.error(`[human-grading] recording AI view for ${kind} job ${jobId} failed:`, error);
      });
  }, [kind, jobId, aiRevealedAt]);

  const saveScores = useCallback(
    async (input: HumanScoresInput): Promise<boolean> => {
      setSaving(true);
      try {
        const res = await fetch(`${API_BASE[kind]}/${jobId}/human-scores`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          toast.error(await errorMessage(res, "Failed to save your scores"));
          return false;
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

  return { saveScores, saving };
}
