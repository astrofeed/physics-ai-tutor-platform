"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { ExistingSubmission, GradeAppealData } from "@/types/submission";

export const MAX_APPEAL_REASON_LENGTH = 5000;
export const MAX_APPEAL_MESSAGE_LENGTH = 5000;

interface ConfirmDialogRequest {
  title: string;
  description: string;
  onConfirm: () => void;
}

interface UseAssignmentAppealsOptions {
  assignmentId: string;
  requestConfirm: (request: ConfirmDialogRequest) => void;
  onSubmissionRefetched: (submission: ExistingSubmission) => void;
}

async function errorMessage(res: Response, fallback: string) {
  const data = await res.json().catch(() => null);
  return (data && typeof data.error === "string" && data.error) || fallback;
}

export function useAssignmentAppeals({
  assignmentId,
  requestConfirm,
  onSubmissionRefetched,
}: UseAssignmentAppealsOptions) {
  const [appeals, setAppeals] = useState<GradeAppealData[]>([]);
  const [appealReasons, setAppealReasons] = useState<Record<string, string>>({});
  const [appealMessages, setAppealMessages] = useState<Record<string, string>>({});
  const [appealNewScores, setAppealNewScores] = useState<Record<string, string>>({});
  const [appealImages, setAppealImages] = useState<Record<string, string[]>>({});
  const [submittingAppeal, setSubmittingAppeal] = useState<string | null>(null);
  const [expandedAppeals, setExpandedAppeals] = useState<Record<string, boolean>>({});
  const [resolvingAppeal, setResolvingAppeal] = useState<string | null>(null);
  const [appealFilter, setAppealFilter] = useState<"ALL" | "OPEN">("OPEN");

  const handleSubmitAppeal = async (answerId: string) => {
    const reason = appealReasons[answerId]?.trim();
    if (!reason) {
      toast.error("Explain why you are appealing before submitting");
      return;
    }
    if (reason.length > MAX_APPEAL_REASON_LENGTH) {
      toast.error(`Keep your reason under ${MAX_APPEAL_REASON_LENGTH.toLocaleString()} characters`);
      return;
    }
    setSubmittingAppeal(answerId);
    try {
      const res = await fetch("/api/appeals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionAnswerId: answerId,
          reason,
          imageUrls: appealImages[answerId]?.length ? appealImages[answerId] : undefined,
        }),
      });
      if (!res.ok) {
        toast.error(await errorMessage(res, "Failed to submit appeal"));
        return;
      }
      const data = await res.json();
      setAppeals((prev) => [data.appeal, ...prev]);
      setAppealReasons((prev) => ({ ...prev, [answerId]: "" }));
      setAppealImages((prev) => ({ ...prev, [answerId]: [] }));
      setExpandedAppeals((prev) => ({ ...prev, [data.appeal.id]: true }));
    } catch {
      toast.error("Failed to submit appeal");
    } finally {
      setSubmittingAppeal(null);
    }
  };

  const handleAppealMessage = async (appealId: string) => {
    const message = appealMessages[appealId]?.trim();
    if (!message) return;
    if (message.length > MAX_APPEAL_MESSAGE_LENGTH) {
      toast.error(`Keep your message under ${MAX_APPEAL_MESSAGE_LENGTH.toLocaleString()} characters`);
      return;
    }
    try {
      const res = await fetch("/api/appeals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appealId,
          message,
          imageUrls: appealImages[appealId]?.length ? appealImages[appealId] : undefined,
        }),
      });
      if (!res.ok) {
        toast.error(await errorMessage(res, "Failed to send message"));
        return;
      }
      const data = await res.json();
      setAppeals((prev) => prev.map((a) => (a.id === appealId ? data.appeal : a)));
      setAppealMessages((prev) => ({ ...prev, [appealId]: "" }));
      setAppealImages((prev) => ({ ...prev, [appealId]: [] }));
    } catch {
      toast.error("Failed to send message");
    }
  };

  const refreshSubmission = useCallback(async () => {
    try {
      const res = await fetch(`/api/submissions?assignmentId=${assignmentId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.submission) onSubmissionRefetched(data.submission);
    } catch (err) {
      console.error("[appeals] Failed to refresh submission:", err);
    }
  }, [assignmentId, onSubmissionRefetched]);

  const handleResolveAppeal = (
    appealId: string,
    status: "RESOLVED" | "REJECTED" | "OPEN"
  ) => {
    const appeal = appeals.find((a) => a.id === appealId);
    const maxPoints = appeal?.submissionAnswer?.question?.points;
    const rawScore = appealNewScores[appealId]?.trim();
    const parsedScore = rawScore ? Number(rawScore) : undefined;

    if (status === "RESOLVED" && rawScore) {
      if (parsedScore === undefined || !Number.isFinite(parsedScore) || parsedScore < 0) {
        toast.error("Enter a score of 0 or more");
        return;
      }
      if (maxPoints !== undefined && parsedScore > maxPoints) {
        toast.error(`Score cannot exceed the question's ${maxPoints} points`);
        return;
      }
    }

    // A score typed into the box is only applied when resolving, so warn
    // instead of silently discarding it on reject/reopen.
    const scoreIgnored = status !== "RESOLVED" && Boolean(rawScore);
    const action =
      status === "RESOLVED" ? "resolve" : status === "REJECTED" ? "reject" : "reopen";

    requestConfirm({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Appeal`,
      description: scoreIgnored
        ? `The score you entered will NOT be applied when you ${action} this appeal. Continue?`
        : status === "RESOLVED" && rawScore
          ? `The student's score for this question will be changed to ${parsedScore}. Continue?`
          : `Are you sure you want to ${action} this appeal?`,
      onConfirm: async () => {
        setResolvingAppeal(appealId);
        try {
          const res = await fetch("/api/appeals", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              appealId,
              status,
              newScore: status === "RESOLVED" ? parsedScore : undefined,
              resolutionNote: appealMessages[appealId]?.trim() || undefined,
            }),
          });
          if (!res.ok) {
            toast.error(await errorMessage(res, "Failed to update appeal"));
            return;
          }
          const data = await res.json();
          setAppeals((prev) => prev.map((a) => (a.id === appealId ? data.appeal : a)));
          setAppealMessages((prev) => ({ ...prev, [appealId]: "" }));
          setAppealNewScores((prev) => ({ ...prev, [appealId]: "" }));
          if (status === "RESOLVED" && parsedScore !== undefined) {
            await refreshSubmission();
          }
        } catch {
          toast.error("Failed to update appeal");
        } finally {
          setResolvingAppeal(null);
        }
      },
    });
  };

  const getAppealForAnswer = (answerId: string) =>
    appeals.find((a) => a.submissionAnswerId === answerId);

  return {
    appeals,
    setAppeals,
    appealReasons,
    setAppealReasons,
    appealMessages,
    setAppealMessages,
    appealNewScores,
    setAppealNewScores,
    appealImages,
    setAppealImages,
    submittingAppeal,
    expandedAppeals,
    setExpandedAppeals,
    resolvingAppeal,
    appealFilter,
    setAppealFilter,
    handleSubmitAppeal,
    handleAppealMessage,
    handleResolveAppeal,
    getAppealForAnswer,
  };
}
