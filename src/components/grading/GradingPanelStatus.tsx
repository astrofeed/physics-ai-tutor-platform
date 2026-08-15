"use client";

import { CheckCircle2, Download } from "lucide-react";
import type { AssignmentInfo, SubmissionForGrading } from "@/components/grading/types";

interface GradingPanelStatusProps {
  submission: SubmissionForGrading;
  assignmentInfo: AssignmentInfo | null;
  allAutoGraded: boolean;
  showProgress: boolean;
  confirmedCount: number;
  manualAnswerCount: number;
  draftRestored: boolean;
  onDismissDraftBanner: () => void;
}

/** Progress, restored-draft notice, the student's file, and the auto-graded notice. */
export function GradingPanelStatus({
  submission,
  assignmentInfo,
  allAutoGraded,
  showProgress,
  confirmedCount,
  manualAnswerCount,
  draftRestored,
  onDismissDraftBanner,
}: GradingPanelStatusProps) {
  const allConfirmed = confirmedCount >= manualAnswerCount;
  const progressPercent =
    manualAnswerCount > 0 ? (confirmedCount / manualAnswerCount) * 100 : 0;

  return (
    <>
      {showProgress && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">
            Graded {confirmedCount}/{manualAnswerCount}
          </span>
          <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                allConfirmed ? "bg-emerald-500" : "bg-blue-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {confirmedCount > 0 && allConfirmed ? (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
              All confirmed
            </span>
          ) : confirmedCount > 0 ? (
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">
              Ready to finalize
            </span>
          ) : null}
        </div>
      )}

      {draftRestored && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Grading progress restored from a previous session.
          </p>
          <button
            onClick={onDismissDraftBanner}
            className="ml-auto text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
          >
            &times;
          </button>
        </div>
      )}

      {submission.fileUrl && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Student Submission File
          </p>
          <a
            href={submission.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <Download className="h-4 w-4" />
            View / Download Submission
          </a>
        </div>
      )}

      {allAutoGraded && submission.answers.length > 0 && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4">
          <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
            This submission was automatically graded.
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
            Score: {submission.totalScore}/{assignmentInfo?.totalPoints} &mdash; No manual
            grading needed.
          </p>
        </div>
      )}
    </>
  );
}
