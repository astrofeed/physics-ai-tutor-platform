"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import type { Appeal } from "@/components/grading/types";

type AppealStatus = "RESOLVED" | "REJECTED" | "OPEN";

interface UseGradingAppealsOptions {
  /** Applies the appeal returned by the API to the submission lists. */
  onAppealUpdated: (appealId: string, appeal: Appeal) => void;
  /** Called after a decision that can change a released score. */
  onScoreChanged: () => void;
  /** Called after any decision so queue counters stay accurate. */
  onDecided: () => void;
}

/** Owns the appeal reply/decision forms of the grading page. */
export function useGradingAppeals({
  onAppealUpdated,
  onScoreChanged,
  onDecided,
}: UseGradingAppealsOptions) {
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [newScores, setNewScores] = useState<Record<string, string>>({});
  const [images, setImages] = useState<Record<string, string[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [resolving, setResolving] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    appealId: string;
    status: AppealStatus;
  } | null>(null);

  const clearForm = (appealId: string) => {
    setMessages((prev) => ({ ...prev, [appealId]: "" }));
    setImages((prev) => ({ ...prev, [appealId]: [] }));
  };

  const sendMessage = useCallback(
    async (appealId: string) => {
      const message = messages[appealId]?.trim();
      if (!message) return;
      try {
        const res = await fetch("/api/appeals", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appealId,
            message,
            imageUrls: images[appealId]?.length ? images[appealId] : undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          onAppealUpdated(appealId, data.appeal);
          clearForm(appealId);
        } else {
          const body = await res.json().catch(() => null);
          toast.error(body?.error || "Failed to send message");
        }
      } catch (err) {
        logger.error("Appeal message request failed", { appealId, error: String(err) });
        toast.error("Failed to send message");
      }
    },
    [messages, images, onAppealUpdated]
  );

  const executePendingAction = useCallback(async () => {
    if (!pendingAction) return;
    const { appealId, status } = pendingAction;
    setPendingAction(null);
    const newScoreStr = newScores[appealId];
    const newScore = status === "RESOLVED" && newScoreStr ? parseFloat(newScoreStr) : undefined;
    const message = messages[appealId];
    setResolving(appealId);
    try {
      const res = await fetch("/api/appeals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appealId,
          status,
          newScore,
          message: message?.trim() || undefined,
          imageUrls: images[appealId]?.length ? images[appealId] : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onAppealUpdated(appealId, data.appeal);
        clearForm(appealId);
        setNewScores((prev) => ({ ...prev, [appealId]: "" }));
        if (status === "RESOLVED" && newScore !== undefined) {
          onScoreChanged();
        }
        onDecided();
      } else {
        const body = await res.json().catch(() => null);
        toast.error(body?.error || "Failed to update appeal");
      }
    } catch (err) {
      logger.error("Appeal decision request failed", { appealId, status, error: String(err) });
      toast.error("Failed to update appeal");
    } finally {
      setResolving(null);
    }
  }, [pendingAction, newScores, messages, images, onAppealUpdated, onScoreChanged, onDecided]);

  return {
    messages,
    setMessage: (appealId: string, value: string) =>
      setMessages((prev) => ({ ...prev, [appealId]: value })),
    newScores,
    setNewScore: (appealId: string, value: string) =>
      setNewScores((prev) => ({ ...prev, [appealId]: value })),
    images,
    setImages: (appealId: string, urls: string[]) =>
      setImages((prev) => ({ ...prev, [appealId]: urls })),
    expanded,
    toggleExpanded: (appealId: string) =>
      setExpanded((prev) => ({ ...prev, [appealId]: !prev[appealId] })),
    resolving,
    pendingAction,
    requestDecision: (appealId: string, status: AppealStatus) =>
      setPendingAction({ appealId, status }),
    cancelDecision: () => setPendingAction(null),
    executePendingAction,
    sendMessage,
  };
}
