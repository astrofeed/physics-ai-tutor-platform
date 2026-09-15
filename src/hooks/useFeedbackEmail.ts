"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { FeedbackDraftResponse, FeedbackEmailInput } from "@/lib/feedback-email";
import type { HumanGradingKind } from "@/hooks/useHumanGrading";

const API_BASE: Record<HumanGradingKind, string> = {
  report: "/api/report-grading/jobs",
  presentation: "/api/presentation-grading/jobs",
};

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error ?? fallback;
}

/**
 * Loads the letter-style draft of a job's AI feedback and emails the staff-edited
 * version to the student; `onSent` should reload the job.
 */
export function useFeedbackEmail(kind: HumanGradingKind, jobId: string, onSent: () => void) {
  const [sending, setSending] = useState(false);

  const loadDraft = useCallback(async (): Promise<FeedbackDraftResponse | null> => {
    try {
      const res = await fetch(`${API_BASE[kind]}/${jobId}/feedback-email`);
      if (!res.ok) {
        toast.error(await errorMessage(res, "Failed to prepare the draft"));
        return null;
      }
      const body: { data: FeedbackDraftResponse } = await res.json();
      return body.data;
    } catch (error) {
      console.error(`[feedback-email] drafting for ${kind} job ${jobId} failed:`, error);
      toast.error("Failed to prepare the draft");
      return null;
    }
  }, [kind, jobId]);

  const send = useCallback(
    async (input: FeedbackEmailInput): Promise<boolean> => {
      setSending(true);
      try {
        const res = await fetch(`${API_BASE[kind]}/${jobId}/feedback-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          toast.error(await errorMessage(res, "Failed to send the email"));
          return false;
        }
        toast.success(`Feedback sent to ${input.to}`);
        onSent();
        return true;
      } catch (error) {
        console.error(`[feedback-email] sending for ${kind} job ${jobId} failed:`, error);
        toast.error("Failed to send the email");
        return false;
      } finally {
        setSending(false);
      }
    },
    [kind, jobId, onSent]
  );

  return { loadDraft, send, sending };
}
