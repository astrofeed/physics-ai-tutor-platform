"use client";

import React, { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RegradeResult {
  submissionsChecked: number;
  submissionsChanged: number;
  answersChanged: number;
  scoresRaised: number;
  scoresLowered: number;
}

/**
 * Re-runs auto-grading for an assignment after its answer key changed. Scores a
 * grader edited by hand are left alone, and unreleased grades stay unreleased.
 */
export function RegradeButton({
  assignmentId,
  submissionCount,
  onRegraded,
}: {
  assignmentId: string;
  submissionCount: number;
  onRegraded: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);

  const regrade = async () => {
    setRunning(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/regrade`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Re-grading failed");

      const result = body.data as RegradeResult;
      toast.success(
        result.submissionsChanged === 0
          ? "No scores changed — every auto-graded answer already matches the answer key."
          : `${result.submissionsChanged} submission(s) updated: ${result.scoresRaised} score(s) raised, ${result.scoresLowered} lowered.`
      );
      onRegraded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Re-grading failed");
    } finally {
      setRunning(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setConfirming(true)}
        disabled={submissionCount === 0}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Re-run auto-grading</span>
        <span className="sm:hidden">Re-grade</span>
      </Button>

      <AlertDialog open={confirming} onOpenChange={(open) => !running && setConfirming(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-run auto-grading on {submissionCount} submission(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Auto-graded answers are re-scored with the current answer keys. Scores you
              edited by hand are kept, and submissions whose grades are not released yet
              stay hidden from students.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={running}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void regrade();
              }}
              disabled={running}
            >
              {running && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Re-run auto-grading
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
