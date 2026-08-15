"use client";

import { useState } from "react";
import { toast } from "sonner";
import { overrideConfirmAction } from "@/lib/grade-release";
import type { GradingMode, OverallGradeState } from "@/components/grading/types";

const EMPTY: OverallGradeState = { score: null, feedback: "", confirmed: false };

/**
 * The overall score override. Confirming a score that differs from the
 * per-question total needs an explicit confirmation, so the dialog state lives
 * here with the rule that opens it.
 */
export function useOverallGrade() {
  const [overallGrade, setOverallGrade] = useState<OverallGradeState>(EMPTY);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);

  return {
    overallGrade,
    hydrate: setOverallGrade,
    setScore: (score: number | null) =>
      setOverallGrade((prev) => ({
        ...prev,
        score,
        confirmed: score === null ? false : prev.confirmed,
      })),
    setFeedback: (feedback: string) => setOverallGrade((prev) => ({ ...prev, feedback })),
    toggleConfirm: (perQuestionTotal: number, gradingMode: GradingMode) => {
      switch (overrideConfirmAction(overallGrade, perQuestionTotal, gradingMode)) {
        case "clear":
          setOverallGrade((prev) => ({ ...prev, confirmed: false }));
          return;
        case "reject-blank":
          toast.error(
            "Enter an overall score first, or leave it blank to release the per-question total."
          );
          return;
        case "warn-differs":
          setShowOverrideConfirm(true);
          return;
        case "confirm":
          setOverallGrade((prev) => ({ ...prev, confirmed: true }));
      }
    },
    showOverrideConfirm,
    setShowOverrideConfirm,
    confirmOverride: () => {
      setShowOverrideConfirm(false);
      setOverallGrade((prev) => ({ ...prev, confirmed: true }));
    },
  };
}
