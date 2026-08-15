"use client";

import { CheckCircle2, Clock, Download, Filter, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RegradeButton } from "@/components/grading/RegradeButton";
import type { AssignmentInfo, FilterMode } from "@/components/grading/types";

interface SubmissionToolbarProps {
  assignmentId: string;
  assignmentInfo: AssignmentInfo | null;
  submissionCount: number;
  gradedCount: number;
  ungradedCount: number;
  appealsCount: number;
  filterMode: FilterMode;
  onFilterModeChange: (mode: FilterMode) => void;
  onRegraded: () => void;
}

/** Queue-level controls: filtering, CSV export, regrade, and progress counters. */
export function SubmissionToolbar({
  assignmentId,
  assignmentInfo,
  submissionCount,
  gradedCount,
  ungradedCount,
  appealsCount,
  filterMode,
  onFilterModeChange,
  onRegraded,
}: SubmissionToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={filterMode} onValueChange={(v) => onFilterModeChange(v as FilterMode)}>
        <SelectTrigger className="w-32 sm:w-44">
          <Filter className="h-3.5 w-3.5 mr-1.5" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All ({submissionCount})</SelectItem>
          <SelectItem value="ungraded">Ungraded ({ungradedCount})</SelectItem>
          <SelectItem value="graded">Graded ({gradedCount})</SelectItem>
          {appealsCount > 0 && (
            <SelectItem value="appeals">Has Appeals ({appealsCount})</SelectItem>
          )}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() =>
          window.open(`/api/grading/export?assignmentId=${assignmentId}`, "_blank")
        }
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Export CSV</span>
        <span className="sm:hidden">Export</span>
      </Button>

      {assignmentInfo?.type === "QUIZ" && (
        <RegradeButton
          assignmentId={assignmentId}
          submissionCount={submissionCount}
          onRegraded={onRegraded}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="h-3 w-3" />
          {gradedCount} Graded
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-950 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">
          <Clock className="h-3 w-3" />
          {ungradedCount} Ungraded
        </span>
        {appealsCount > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-orange-600 bg-orange-50 dark:bg-orange-950 px-2.5 py-1 rounded-full border border-orange-200 dark:border-orange-800">
            <ShieldAlert className="h-3 w-3" />
            {appealsCount} Appeals
          </span>
        )}
      </div>
    </div>
  );
}
