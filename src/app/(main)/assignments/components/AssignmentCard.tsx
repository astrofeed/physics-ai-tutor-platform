"use client";

import React from "react";
import Link from "next/link";
import {
  Clock,
  Users,
  Loader2,
  CheckCircle2,
  BookOpen,
  Upload,
  ShieldAlert,
  Trash2,
  Lock,
  Unlock,
  CalendarClock,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatShortDate } from "@/lib/utils";
import { isStaff } from "@/lib/constants";
import type { AssignmentListItem } from "@/types";
import type { UserRole } from "@/types/user";

function isDueSoon(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const diff = new Date(dueDate).getTime() - Date.now();
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
}

interface AssignmentCardProps {
  assignment: AssignmentListItem;
  userRole: UserRole;
  canManage: boolean;
  /** Id currently being deleted or restored, so its control shows a spinner. */
  busyId: string | null;
  onDelete: (e: React.MouseEvent, assignmentId: string) => void;
  onRestore: (e: React.MouseEvent, assignmentId: string) => void;
  /** Renders the recycle-bin variant: restore instead of open/delete. */
  deleted?: boolean;
}

export function AssignmentCard({
  assignment,
  userRole,
  canManage,
  busyId,
  onDelete,
  onRestore,
  deleted = false,
}: AssignmentCardProps) {
  const body = (
    <div
      className={`group bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm transition-all ${
        deleted ? "opacity-75" : "hover:shadow-md cursor-pointer"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mb-1.5">
            <div className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 shrink-0 hidden sm:block">
              {assignment.type === "QUIZ" ? (
                <BookOpen className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              ) : (
                <Upload className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              )}
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors break-words min-w-0">
              {assignment.title}
            </h3>
            {deleted && (
              <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 text-xs gap-1">
                <Trash2 className="h-3 w-3" />
                Deleted
                {assignment.deletedAt ? ` ${formatShortDate(assignment.deletedAt)}` : ""}
              </Badge>
            )}
            {!deleted && !assignment.published && !assignment.scheduledPublishAt && (
              <Badge className="bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-xs">
                Draft
              </Badge>
            )}
            {!deleted && !assignment.published && assignment.scheduledPublishAt && (
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800 text-xs gap-1">
                <CalendarClock className="h-3 w-3" />
                Scheduled: {new Date(assignment.scheduledPublishAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </Badge>
            )}
            {!deleted && isDueSoon(assignment.dueDate) && (
              <Badge className="bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 text-xs">
                Due Soon
              </Badge>
            )}
          </div>
          {assignment.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mb-3 sm:ml-9">
              {assignment.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-gray-400 dark:text-gray-500 ml-0 sm:ml-9">
            <Badge variant="secondary" className="font-medium bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700">
              {assignment.type === "QUIZ" ? "Quiz" : "File Upload"}
            </Badge>
            {assignment.lockAfterSubmit ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                <Lock className="h-3 w-3" />
                Locked after submit
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <Unlock className="h-3 w-3" />
                Resubmit allowed
              </span>
            )}
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {assignment._count.questions} questions
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {assignment._count.submissions} submissions
              {deleted ? " kept" : ""}
            </span>
            {isStaff(userRole) && assignment.ungradedCount !== undefined && assignment.ungradedCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                <Clock className="h-3 w-3" />
                {assignment.ungradedCount} ungraded
              </span>
            )}
            {assignment.openAppealCount !== undefined && assignment.openAppealCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-800">
                <ShieldAlert className="h-3 w-3" />
                {assignment.openAppealCount} open appeal{assignment.openAppealCount !== 1 ? "s" : ""}
              </span>
            )}
            {assignment.dueDate && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Due {formatShortDate(assignment.dueDate)}
              </span>
            )}
            {userRole === "STUDENT" && assignment.mySubmitted && (() => {
              const canResubmit = !assignment.lockAfterSubmit && !assignment.myGraded;
              return canResubmit ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                  Can resubmit
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
                  {assignment.lockAfterSubmit ? "Locked" : "Graded"}
                </span>
              );
            })()}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          {deleted && canManage && (
            <button
              onClick={(e) => onRestore(e, assignment.id)}
              disabled={busyId === assignment.id}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {busyId === assignment.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Restore
            </button>
          )}
          {!deleted && canManage && !assignment.published && !assignment.scheduledPublishAt && (
            <button
              onClick={(e) => onDelete(e, assignment.id)}
              disabled={busyId === assignment.id}
              className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/50 transition-colors disabled:opacity-50"
              title="Delete draft"
            >
              {busyId === assignment.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          )}
          <div className="text-right">
            {canManage && !assignment.mySubmitted ? (
              <>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {assignment._count.submissions}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                  submission{assignment._count.submissions !== 1 ? "s" : ""}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  <span className={assignment.myScore !== null ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-gray-500"}>
                    {assignment.myScore !== null ? assignment.myScore : "_"}
                  </span>
                  <span className="text-gray-300 dark:text-gray-600">/</span>
                  {assignment.totalPoints}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                  {assignment.myScore !== null
                    ? "graded"
                    : assignment.mySubmitted
                      ? "submitted"
                      : "points"}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (deleted) return body;

  return <Link href={`/assignments/${assignment.id}`}>{body}</Link>;
}
