"use client";

import { useCallback } from "react";
import type { GradingMode, SubmissionForGrading } from "@/components/grading/types";

/** Bumped whenever the stored shape changes, so old drafts are discarded. */
const GRADING_STATE_VERSION = 3;

export interface GradingDraftData {
  _version: number;
  submissionId: string;
  savedAt: number;
  grades: Record<string, { score: number; feedback: string }>;
  confirmedAnswers: string[];
  overallGrade: { score: number | null; feedback: string; confirmed: boolean };
  feedbackImages: Record<string, string[]>;
  feedbackFileUrl: string | null;
  gradingMode: GradingMode;
}

export type GradingDraftInput = Omit<GradingDraftData, "_version" | "savedAt">;

function isValidGradingDraft(data: unknown): data is GradingDraftData {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  if (d._version !== GRADING_STATE_VERSION) return false;
  if (typeof d.submissionId !== "string" || typeof d.savedAt !== "number") return false;
  if (typeof d.grades !== "object" || d.grades === null) return false;
  if (!Array.isArray(d.confirmedAnswers)) return false;
  if (typeof d.overallGrade !== "object" || d.overallGrade === null) return false;
  const og = d.overallGrade as Record<string, unknown>;
  if (og.score !== null && typeof og.score !== "number") return false;
  if (typeof og.feedback !== "string" || typeof og.confirmed !== "boolean") return false;
  if (typeof d.feedbackImages !== "object" || d.feedbackImages === null) return false;
  if (typeof d.gradingMode !== "string") return false;
  return true;
}

const storageKey = (submissionId: string) => `grading-state-${submissionId}`;

/** Keeps a grader's in-progress work in localStorage so a reload does not lose it. */
export function useGradingDrafts() {
  const saveDraft = useCallback((draft: GradingDraftInput) => {
    try {
      localStorage.setItem(
        storageKey(draft.submissionId),
        JSON.stringify({
          ...draft,
          _version: GRADING_STATE_VERSION,
          savedAt: Date.now(),
        } satisfies GradingDraftData)
      );
    } catch {
      /* quota exceeded or similar */
    }
  }, []);

  /** Persisted grades win over a draft that predates them, so a finalized submission is never shown as zeros. */
  const loadDraft = useCallback(
    (submission: SubmissionForGrading): GradingDraftData | null => {
      const key = storageKey(submission.id);
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!isValidGradingDraft(parsed) || parsed.submissionId !== submission.id) {
          localStorage.removeItem(key);
          return null;
        }
        const gradedAt = submission.gradedAt ? Date.parse(submission.gradedAt) : null;
        if (gradedAt !== null && Number.isFinite(gradedAt) && parsed.savedAt <= gradedAt) {
          localStorage.removeItem(key);
          return null;
        }
        return parsed;
      } catch {
        try {
          localStorage.removeItem(key);
        } catch {
          /* ignore */
        }
        return null;
      }
    },
    []
  );

  const clearDraft = useCallback((submissionId: string) => {
    try {
      localStorage.removeItem(storageKey(submissionId));
    } catch {
      /* ignore */
    }
  }, []);

  return { saveDraft, loadDraft, clearDraft };
}
