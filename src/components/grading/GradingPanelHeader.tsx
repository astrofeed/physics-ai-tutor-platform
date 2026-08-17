"use client";

import { ArrowRight, CheckCircle2, Loader2, User, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SaveStatusIndicator } from "@/components/ui/save-status";
import { GradingShortcutsDialog } from "@/components/grading/GradingShortcutsDialog";
import type { SaveStatus } from "@/hooks/useAutoSave";
import { formatShortDate } from "@/lib/utils";
import type {
  AssignmentInfo,
  GradingMode,
  SubmissionForGrading,
} from "@/components/grading/types";

interface GradingPanelHeaderProps {
  submission: SubmissionForGrading;
  assignmentInfo: AssignmentInfo | null;
  allAutoGraded: boolean;
  confirmedCount: number;
  manualAnswerCount: number;
  gradingMode: GradingMode;
  onGradingModeChange: (mode: GradingMode) => void;
  autoSaveStatus: SaveStatus;
  autoSavedAt: Date | null;
  showShortcuts: boolean;
  onShowShortcutsChange: (open: boolean) => void;
  saving: boolean;
  finalizeDisabled: boolean;
  onFinalize: (advanceAfterSave?: boolean) => void;
  onUnfinalize: () => void;
}

export function GradingPanelHeader({
  submission,
  assignmentInfo,
  allAutoGraded,
  confirmedCount,
  manualAnswerCount,
  gradingMode,
  onGradingModeChange,
  autoSaveStatus,
  autoSavedAt,
  showShortcuts,
  onShowShortcutsChange,
  saving,
  finalizeDisabled,
  onFinalize,
  onUnfinalize,
}: GradingPanelHeaderProps) {
  const isLate =
    !!assignmentInfo?.dueDate &&
    new Date(submission.submittedAt) > new Date(assignmentInfo.dueDate);
  const showManualControls = submission.answers.length > 0 && !allAutoGraded;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
          <User className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
            {submission.userName}
          </h3>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Submitted {formatShortDate(submission.submittedAt)}
          </p>
          {submission.gradedByName && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              &middot; Graded by {submission.gradedByName}
            </p>
          )}
          {isLate && (
            <Badge className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 text-[10px]">
              Late
            </Badge>
          )}
          {allAutoGraded && submission.answers.length > 0 && (
            <Badge className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 text-[10px]">
              Auto-graded
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 ml-auto min-w-0">
        {showManualControls && (
          <>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:inline">
              Confirmed {confirmedCount}/{manualAnswerCount}
            </span>
            <Select
              value={gradingMode}
              onValueChange={(v) => onGradingModeChange(v as GradingMode)}
            >
              <SelectTrigger className="w-32 sm:w-40 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="per-question">By Question</SelectItem>
                <SelectItem value="overall">Overall Grade</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
        <SaveStatusIndicator status={autoSaveStatus} lastSavedAt={autoSavedAt} />
        <GradingShortcutsDialog open={showShortcuts} onOpenChange={onShowShortcutsChange} />
        {submission.gradedAt ? (
          <Button
            onClick={onUnfinalize}
            disabled={saving}
            variant="outline"
            size="sm"
            className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950 rounded-lg"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Unfinalize</span>
            <span className="sm:hidden">Undo</span>
          </Button>
        ) : (
          <>
            <Button
              onClick={() => onFinalize()}
              disabled={finalizeDisabled}
              size="sm"
              className="gap-1.5 bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 rounded-lg"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Finalize
            </Button>
            <Button
              onClick={() => onFinalize(true)}
              disabled={finalizeDisabled}
              variant="outline"
              size="sm"
              title="Finalize this submission and open the next one (Ctrl/⌘ + Enter)"
              className="gap-1.5 rounded-lg"
            >
              <ArrowRight className="h-4 w-4" />
              <span className="hidden sm:inline">Save &amp; next</span>
              <span className="sm:hidden">Next</span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
