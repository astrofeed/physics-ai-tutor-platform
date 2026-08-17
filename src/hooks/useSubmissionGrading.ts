"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useGradingDrafts } from "@/hooks/useGradingDrafts";
import { useFeedbackAttachments } from "@/hooks/useFeedbackAttachments";
import { useOverallGrade } from "@/hooks/useOverallGrade";
import { overallGradePayload, sumQuestionScores } from "@/lib/grade-release";
import type { AssignmentInfo, GradingMode, SubmissionForGrading } from "@/components/grading/types";

export type GradeMap = Record<string, { score: number; feedback: string }>;

interface UseSubmissionGradingOptions {
  assignmentInfo: AssignmentInfo | null;
  /** The submissions currently listed, used to walk the queue with "Save & next". */
  visibleSubmissions: SubmissionForGrading[];
  patchSubmission: (submissionId: string, patch: Partial<SubmissionForGrading>) => void;
  onQueueChanged: () => void;
}

/**
 * Owns one submission's grading session: hydration from server data and local
 * drafts, autosaving, releasing a grade, and taking a released grade back.
 */
export function useSubmissionGrading({
  assignmentInfo,
  visibleSubmissions,
  patchSubmission,
  onQueueChanged,
}: UseSubmissionGradingOptions) {
  const { saveDraft, loadDraft, clearDraft } = useGradingDrafts();

  const [submission, setSubmission] = useState<SubmissionForGrading | null>(null);
  const [grades, setGrades] = useState<GradeMap>({});
  const [suggestions, setSuggestions] = useState<GradeMap>({});
  const [confirmedAnswers, setConfirmedAnswers] = useState<Set<string>>(new Set());
  const [gradingMode, setGradingMode] = useState<GradingMode>("per-question");
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [showUnfinalizeConfirm, setShowUnfinalizeConfirm] = useState(false);
  const hydratedSubmissionIdRef = useRef<string | null>(null);
  /** Set by "Save & next" so the queue only advances after the save succeeds. */
  const advanceAfterSaveRef = useRef(false);

  const feedback = useFeedbackAttachments();
  const overall = useOverallGrade();
  const { overallGrade } = overall;
  const feedbackImages = feedback.images;
  const feedbackFile = feedback.file;

  const saveGradingDraft = useCallback(
    async (data: GradeMap) => {
      if (!submission) return;
      const gradeEntries = Object.entries(data);
      if (gradeEntries.length === 0) return;
      const res = await fetch("/api/grading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submission.id,
          isDraft: true,
          grades: gradeEntries.map(([answerId, g]) => ({
            answerId,
            score: g.score,
            feedback: g.feedback,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to save grading draft");
      }
    },
    [submission]
  );

  const {
    status: autoSaveStatus,
    lastSavedAt: autoSavedAt,
    saveNow: flushGradingSave,
    markSaved: markGradesSaved,
  } = useAutoSave({
    data: grades,
    saveFn: saveGradingDraft,
    delayMs: 5000,
    // A finalized submission is edited through Unfinalize, so drafts must not drift
    // its per-answer scores away from the released total.
    enabled: !!submission && !submission.gradedAt,
  });

  // Keep the grader's work locally, but only once hydration has run for this submission.
  useEffect(() => {
    if (!submission || hydratedSubmissionIdRef.current !== submission.id) return;
    saveDraft({
      submissionId: submission.id,
      grades,
      confirmedAnswers: Array.from(confirmedAnswers),
      overallGrade,
      feedbackImages,
      feedbackFileUrl: feedbackFile.url,
      gradingMode,
    });
  }, [
    submission,
    grades,
    confirmedAnswers,
    overallGrade,
    feedbackImages,
    feedbackFile.url,
    gradingMode,
    saveDraft,
  ]);

  const clearSelection = useCallback(() => {
    hydratedSubmissionIdRef.current = null;
    setSubmission(null);
  }, []);

  const select = (sub: SubmissionForGrading) => {
    if (submission && submission.id !== sub.id) flushGradingSave();
    hydratedSubmissionIdRef.current = sub.id;
    setSubmission(sub);

    const saved = loadDraft(sub);
    let restored = false;
    const initialGrades: GradeMap = {};
    sub.answers.forEach((a) => {
      const draft = saved?.grades?.[a.id];
      if (draft) {
        initialGrades[a.id] = draft;
        if (draft.score !== (a.score || 0) || draft.feedback !== (a.feedback || "")) {
          restored = true;
        }
      } else {
        initialGrades[a.id] = { score: a.score || 0, feedback: a.feedback || "" };
      }
    });
    setGrades(initialGrades);
    // Hydration is not an edit, so it must not trigger the autosave.
    markGradesSaved(initialGrades);
    setDraftRestored(restored);

    const storedSuggestions: GradeMap = {};
    sub.answers.forEach((a) => {
      if (a.aiSuggestedScore !== null) {
        storedSuggestions[a.id] = {
          score: a.aiSuggestedScore,
          feedback: a.aiSuggestedFeedback ?? "",
        };
      }
    });
    setSuggestions(storedSuggestions);

    setConfirmedAnswers(new Set(saved?.confirmedAnswers || []));
    overall.hydrate({
      score: saved?.overallGrade?.score ?? sub.totalScore ?? null,
      feedback: saved?.overallGrade?.feedback ?? sub.overallFeedback ?? "",
      confirmed: saved?.overallGrade?.confirmed ?? false,
    });

    const savedImages = saved?.feedbackImages;
    if (savedImages && Object.keys(savedImages).length > 0) {
      feedback.setImages(savedImages);
    } else {
      const fromServer: Record<string, string[]> = {};
      sub.answers.forEach((a) => {
        if (a.feedbackImageUrls?.length) fromServer[a.id] = a.feedbackImageUrls;
      });
      feedback.setImages(fromServer);
    }
    feedback.setFileUrl(saved?.feedbackFileUrl ?? sub.feedbackFileUrl ?? null);

    if (saved?.gradingMode) {
      setGradingMode(saved.gradingMode);
    } else if (sub.answers.length === 0 || assignmentInfo?.type === "FILE_UPLOAD") {
      setGradingMode("overall");
    } else {
      setGradingMode(sub.answers.every((a) => a.autoGraded) ? "overall" : "per-question");
    }
  };

  /**
   * Moves through the visible queue. Pending grade edits are flushed by `select`,
   * so nothing typed on the current submission is lost.
   */
  const selectAdjacent = (direction: 1 | -1) => {
    if (!submission) return;
    const index = visibleSubmissions.findIndex((s) => s.id === submission.id);
    const next = index === -1 ? undefined : visibleSubmissions[index + direction];
    if (!next) {
      toast.info(
        direction === 1 ? "Last submission in this list." : "First submission in this list."
      );
      return;
    }
    select(next);
  };

  const manualAnswers = submission?.answers.filter((a) => !a.autoGraded) ?? [];
  const perQuestionTotal = sumQuestionScores(Object.values(grades));

  const releaseGrade = async () => {
    if (!submission) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { submissionId: submission.id };
      if (feedbackFile.url) body.feedbackFileUrl = feedbackFile.url;
      // Only an explicitly confirmed override replaces the per-question total.
      Object.assign(body, overallGradePayload(overallGrade) ?? {});

      if (gradingMode === "per-question") {
        body.grades = Object.entries(grades).map(([answerId, g]) => ({
          answerId,
          score: g.score,
          feedback: g.feedback,
        }));
        if (Object.values(feedbackImages).some((imgs) => imgs.length > 0)) {
          body.feedbackImages = feedbackImages;
        }
      }

      const res = await fetch("/api/grading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        const savedId = submission.id;
        const graded = {
          totalScore: data.totalScore,
          gradedAt: new Date().toISOString(),
          gradedByName: "You",
        };
        clearDraft(savedId);
        setDraftRestored(false);
        patchSubmission(savedId, graded);
        // Only patch the panel while it still shows the submission that was saved.
        setSubmission((prev) => (prev && prev.id === savedId ? { ...prev, ...graded } : prev));
        // Advancing last keeps the next submission's hydrated state from being overwritten.
        if (advanceAfterSaveRef.current) selectAdjacent(1);
        onQueueChanged();
      } else {
        const errorBody = await res.json().catch(() => null);
        toast.error(errorBody?.error || "Failed to save grades");
      }
    } catch (err) {
      logger.error("Save grades request failed", {
        submissionId: submission.id,
        error: String(err),
      });
      toast.error("Failed to save grades");
    } finally {
      advanceAfterSaveRef.current = false;
      setSaving(false);
    }
  };

  const finalize = async (advanceAfterSave = false) => {
    if (!submission) return;
    advanceAfterSaveRef.current = advanceAfterSave;

    if (gradingMode === "overall" && !overallGradePayload(overallGrade)) {
      toast.error("Enter an overall score and confirm it before finalizing.");
      return;
    }
    if (gradingMode === "per-question" && confirmedAnswers.size < manualAnswers.length) {
      setShowFinalizeConfirm(true);
      return;
    }
    await releaseGrade();
  };

  const unfinalize = async () => {
    setShowUnfinalizeConfirm(false);
    if (!submission) return;
    const submissionId = submission.id;
    const ungraded = { totalScore: null, gradedAt: null, gradedByName: null };
    setSaving(true);
    try {
      const res = await fetch("/api/grading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, ungrade: true }),
      });
      if (res.ok) {
        patchSubmission(submissionId, ungraded);
        setSubmission((prev) => (prev ? { ...prev, ...ungraded } : prev));
        onQueueChanged();
      } else {
        const body = await res.json().catch(() => null);
        toast.error(body?.error || "Failed to unfinalize this submission");
      }
    } catch (err) {
      logger.error("Ungrade request failed", { submissionId, error: String(err) });
      toast.error("Failed to unfinalize this submission");
    } finally {
      setSaving(false);
    }
  };

  const requestAiSuggestion = async (answerId: string) => {
    setAiLoading(answerId);
    try {
      const res = await fetch("/api/grading", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions((prev) => ({
          ...prev,
          [answerId]: { score: data.suggestedScore, feedback: data.suggestedFeedback },
        }));
        toast.success("AI suggestion ready — review it, then apply to use it as the score");
      } else {
        const body = await res.json().catch(() => null);
        toast.error(body?.error || "AI suggestion failed. Your score and feedback are unchanged.");
      }
    } catch (err) {
      logger.error("AI grading suggestion request failed", { answerId, error: String(err) });
      toast.error("AI suggestion failed. Your score and feedback are unchanged.");
    } finally {
      setAiLoading(null);
    }
  };

  const answerCount = submission?.answers.length ?? 0;
  const allAutoGraded =
    answerCount > 0 && (submission?.answers.every((a) => a.autoGraded) ?? false);

  return {
    submission,
    select,
    selectAdjacent,
    clearSelection,
    /** Throws away the stored draft for a submission whose scores changed on the server. */
    discardDraft: clearDraft,
    /** Applies an out-of-band change (e.g. an appeal decision) to the open submission. */
    patchOpenSubmission: useCallback(
      (updater: (sub: SubmissionForGrading) => SubmissionForGrading) =>
        setSubmission((prev) => (prev ? updater(prev) : prev)),
      []
    ),

    grades,
    changeGrade: (answerId: string, field: "score" | "feedback", value: number | string) =>
      setGrades((prev) => ({ ...prev, [answerId]: { ...prev[answerId], [field]: value } })),
    suggestions,
    requestAiSuggestion,
    applySuggestion: (answerId: string) => {
      const suggestion = suggestions[answerId];
      if (suggestion) setGrades((prev) => ({ ...prev, [answerId]: { ...suggestion } }));
    },
    aiLoading,

    confirmedAnswers,
    toggleConfirmed: (answerId: string) =>
      setConfirmedAnswers((prev) => {
        const next = new Set(prev);
        if (next.has(answerId)) next.delete(answerId);
        else next.add(answerId);
        return next;
      }),

    overallGrade,
    setOverallScore: overall.setScore,
    setOverallFeedback: overall.setFeedback,
    toggleOverallConfirm: () => overall.toggleConfirm(perQuestionTotal, gradingMode),
    showOverrideConfirm: overall.showOverrideConfirm,
    setShowOverrideConfirm: overall.setShowOverrideConfirm,
    confirmOverride: overall.confirmOverride,

    gradingMode,
    setGradingMode,
    feedbackImages,
    setFeedbackImagesFor: feedback.setImagesFor,
    feedbackFile,
    uploadingFeedback: feedback.uploading,
    attachFeedbackFile: feedback.attach,
    clearFeedbackFile: feedback.clear,

    finalize,
    releaseGrade,
    unfinalize,
    saving,
    autoSaveStatus,
    autoSavedAt,

    draftRestored,
    dismissDraftBanner: () => setDraftRestored(false),
    showFinalizeConfirm,
    setShowFinalizeConfirm,
    showUnfinalizeConfirm,
    setShowUnfinalizeConfirm,

    manualAnswers,
    perQuestionTotal,
    allAutoGraded,
    answerCount,
  };
}
