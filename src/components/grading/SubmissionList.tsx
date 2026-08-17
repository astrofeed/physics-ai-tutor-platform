"use client";

import React from "react";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  PencilLine,
  ShieldAlert,
} from "lucide-react";
import type { SubmissionForGrading, AssignmentInfo } from "./types";

interface SubmissionListProps {
  submissions: SubmissionForGrading[];
  selectedSubmission: SubmissionForGrading | null;
  onSelectSubmission: (sub: SubmissionForGrading) => void;
  assignmentInfo: AssignmentInfo | null;
  filterMode: string;
}

export function SubmissionList({
  submissions,
  selectedSubmission,
  onSelectSubmission,
  assignmentInfo,
  filterMode,
}: SubmissionListProps) {
  return (
    <div className="w-full md:w-80 shrink-0 flex flex-col bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm max-h-[40vh] md:max-h-none">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Submissions ({submissions.length})
        </h2>
        {assignmentInfo && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
            {assignmentInfo.title} &middot; {assignmentInfo.totalPoints} pts
          </p>
        )}
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-1.5" role="list" aria-label="Submissions">
        {submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ClipboardList className="h-6 w-6 text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {filterMode === "ungraded"
                ? "All submissions graded!"
                : "No submissions yet."}
            </p>
          </div>
        ) : (
          submissions.map((sub) => {
            const isSelected = selectedSubmission?.id === sub.id;
            const isGraded = sub.totalScore !== null;
            const hasDraft = !isGraded && sub.draftTotalScore !== null;

            return (
              <button
                key={sub.id}
                onClick={() => onSelectSubmission(sub)}
                className={`w-full text-left rounded-lg p-3 transition-colors border ${
                  isSelected
                    ? "bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 shadow-sm"
                    : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-700"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isSelected
                        ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                        : isGraded
                          ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {sub.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {sub.userName}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                      {sub.userEmail}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      Submitted{" "}
                      {new Intl.DateTimeFormat("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(new Date(sub.submittedAt))}
                      {assignmentInfo?.dueDate &&
                        new Date(sub.submittedAt) >
                          new Date(assignmentInfo.dueDate) && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-1.5 py-0.5 rounded-full">
                            Late
                          </span>
                        )}
                    </p>
                  </div>
                </div>
                <div className="mt-2 ml-10 space-y-1">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                      isGraded
                        ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800"
                        : hasDraft
                          ? "text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950 border-sky-200 dark:border-sky-800"
                          : "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    {isGraded ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : hasDraft ? (
                      <PencilLine className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {sub.totalScore ?? sub.draftTotalScore ?? 0}/
                    {assignmentInfo?.totalPoints}
                  </span>
                  {isGraded ? null : sub.openAppealCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-800">
                      <ShieldAlert className="h-3 w-3" />
                      Pending &middot; {sub.openAppealCount} appeal
                      {sub.openAppealCount !== 1 ? "s" : ""}
                    </span>
                  ) : hasDraft ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-800">
                      <PencilLine className="h-3 w-3" />
                      Draft &middot; not released
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                      <Clock className="h-3 w-3" />
                      Ungraded
                    </span>
                  )}
                  {isGraded && sub.openAppealCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-800">
                      <ShieldAlert className="h-3 w-3" />
                      {sub.openAppealCount} open appeal
                      {sub.openAppealCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {sub.gradedByName && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      Graded by {sub.gradedByName}
                    </p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
