"use client";

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

type AppealStatus = "RESOLVED" | "REJECTED" | "OPEN";

const APPEAL_VERB: Record<AppealStatus, { title: string; action: string }> = {
  RESOLVED: { title: "Resolve", action: "resolve" },
  REJECTED: { title: "Reject", action: "reject" },
  OPEN: { title: "Reopen", action: "reopen" },
};

interface GradingDialogsProps {
  finalizeOpen: boolean;
  onFinalizeOpenChange: (open: boolean) => void;
  confirmedCount: number;
  manualAnswerCount: number;
  onConfirmFinalize: () => void;

  overrideOpen: boolean;
  onOverrideOpenChange: (open: boolean) => void;
  perQuestionTotal: number;
  overrideScore: number | null;
  totalPoints: number;
  onConfirmOverride: () => void;

  appealStatus: AppealStatus | null;
  onAppealOpenChange: (open: boolean) => void;
  onConfirmAppeal: () => void;

  unfinalizeOpen: boolean;
  onUnfinalizeOpenChange: (open: boolean) => void;
  onConfirmUnfinalize: () => void;
}

/** The grading page's confirmation dialogs, all of which guard a released grade. */
export function GradingDialogs({
  finalizeOpen,
  onFinalizeOpenChange,
  confirmedCount,
  manualAnswerCount,
  onConfirmFinalize,
  overrideOpen,
  onOverrideOpenChange,
  perQuestionTotal,
  overrideScore,
  totalPoints,
  onConfirmOverride,
  appealStatus,
  onAppealOpenChange,
  onConfirmAppeal,
  unfinalizeOpen,
  onUnfinalizeOpenChange,
  onConfirmUnfinalize,
}: GradingDialogsProps) {
  const appealVerb = appealStatus ? APPEAL_VERB[appealStatus] : null;

  return (
    <>
      <AlertDialog open={finalizeOpen} onOpenChange={onFinalizeOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalize with Unconfirmed Scores</AlertDialogTitle>
            <AlertDialogDescription>
              You have only confirmed {confirmedCount} out of {manualAnswerCount} scores.
              Finalize anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmFinalize}>Finalize</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={overrideOpen} onOpenChange={onOverrideOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Override the Per-Question Total?</AlertDialogTitle>
            <AlertDialogDescription>
              The per-question scores add up to {perQuestionTotal}/{totalPoints}.
              Confirming this override releases {overrideScore}/{totalPoints} to the
              student instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmOverride}>Use override</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!appealStatus} onOpenChange={onAppealOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{appealVerb?.title} Appeal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {appealVerb?.action} this appeal?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmAppeal}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unfinalizeOpen} onOpenChange={onUnfinalizeOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unfinalize Submission</AlertDialogTitle>
            <AlertDialogDescription>
              This clears the released score and gradedAt, so the student stops seeing a
              grade for this submission until you finalize it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmUnfinalize}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Unfinalize
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
