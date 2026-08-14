"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useEffectiveSession } from "@/lib/effective-session-context";
import { useTrackTime } from "@/lib/use-track-time";
import { api } from "@/lib/api-client";
import { FileText, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { isStaff } from "@/lib/constants";
import { toast } from "sonner";
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
import type { AssignmentListItem } from "@/types";
import { AssignmentCard } from "./components/AssignmentCard";

type AssignmentFilter = "ALL" | "PUBLISHED" | "DRAFTS" | "SCHEDULED" | "DELETED";

const FILTER_LABELS: Record<AssignmentFilter, string> = {
  ALL: "All",
  PUBLISHED: "Published",
  SCHEDULED: "Scheduled",
  DRAFTS: "Drafts",
  DELETED: "Deleted",
};

const FILTER_PARAMS: Partial<Record<AssignmentFilter, string>> = {
  PUBLISHED: "published",
  DRAFTS: "drafts",
  SCHEDULED: "scheduled",
  DELETED: "deleted",
};

export default function AssignmentsPage() {
  useTrackTime("ASSIGNMENT_VIEW");
  const effectiveSession = useEffectiveSession();
  const [assignments, setAssignments] = useState<AssignmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AssignmentFilter>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userRole = effectiveSession.role;

  const fetchAssignments = useCallback((f?: string, p?: number, ps?: number, q?: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(p ?? 1));
    params.set("pageSize", String(ps ?? 10));
    const filterParam = FILTER_PARAMS[(f ?? "ALL") as AssignmentFilter];
    if (filterParam) params.set("filter", filterParam);
    if (q) params.set("search", q);
    api.get<{ assignments: AssignmentListItem[]; totalCount: number }>(`/api/assignments?${params}`)
      .then((data) => {
        setAssignments(data.assignments || []);
        setTotalCount(data.totalCount ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAssignments(filter, page, pageSize, activeSearch);
  }, [fetchAssignments, filter, page, pageSize, activeSearch]);

  const handleFilterChange = (f: AssignmentFilter) => {
    setFilter(f);
    setPage(1);
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setPage(1);
  };

  const canManage = isStaff(userRole);
  const showingDeleted = filter === "DELETED";

  const handleDeleteDraft = (e: React.MouseEvent, assignmentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setPendingDeleteId(assignmentId);
  };

  const confirmDeleteDraft = async () => {
    if (!pendingDeleteId) return;
    const assignmentId = pendingDeleteId;
    setPendingDeleteId(null);
    setBusyId(assignmentId);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, { method: "DELETE" });
      if (res.ok) {
        setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
        setTotalCount((c) => c - 1);
      } else {
        toast.error("Failed to delete assignment");
      }
    } catch {
      toast.error("Failed to delete assignment");
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (e: React.MouseEvent, assignmentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setBusyId(assignmentId);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/restore`, { method: "POST" });
      if (res.ok) {
        setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
        setTotalCount((c) => Math.max(0, c - 1));
        toast.success("Assignment restored with its submissions and grades");
      } else {
        const data = await res.json().catch(() => ({ error: "Failed to restore assignment" }));
        toast.error(data.error || "Failed to restore assignment");
      }
    } catch {
      toast.error("Failed to restore assignment");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Assignments
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {userRole === "STUDENT"
              ? "View and submit your assignments"
              : "Manage assignments and view submissions"}
          </p>
        </div>
        {isStaff(userRole) && (
          <Link href="/assignments/create" className="shrink-0">
            <Button className="gap-2 bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 rounded-lg shadow-sm w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Create Assignment
            </Button>
          </Link>
        )}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search assignments..."
            value={searchInput}
            onChange={(e) => {
              const val = e.target.value;
              setSearchInput(val);
              if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
              searchTimerRef.current = setTimeout(() => {
                setActiveSearch(val);
                setPage(1);
              }, 300);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                setActiveSearch(searchInput);
                setPage(1);
              }
            }}
            className="pl-9 h-9"
          />
        </div>
      {canManage && (
        <div className="flex items-center gap-2">
          {(["ALL", "PUBLISHED", "SCHEDULED", "DRAFTS", "DELETED"] as const).map((type) => (
            <button
              key={type}
              onClick={() => handleFilterChange(type)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                filter === type
                  ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-sm"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700"
              }`}
            >
              {FILTER_LABELS[type]}
            </button>
          ))}
        </div>
      )}
      </div>

      {canManage && showingDeleted && (
        <div className="flex items-start gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4 text-sm text-gray-600 dark:text-gray-400">
          <Trash2 className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Deleted assignments are hidden from students and excluded from grading queues and
            exports. Submissions, grades, and appeals are kept — restoring brings them all back.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <LoadingSpinner message="Loading assignments..." />
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={showingDeleted ? "Recycle bin is empty" : "No assignments found"}
          description={
            showingDeleted
              ? "Deleted assignments appear here so you can restore them."
              : filter !== "ALL"
                ? "No assignments match this filter. Try selecting a different type."
                : userRole === "STUDENT"
                  ? "Check back later for new assignments."
                  : "Create your first assignment to get started."
          }
        />
      ) : (
        <>
          {/* Assignment Cards */}
          <div className="grid gap-3" role="list" aria-label="Assignments">
            {assignments.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                userRole={userRole}
                canManage={canManage}
                busyId={busyId}
                onDelete={handleDeleteDraft}
                onRestore={handleRestore}
                deleted={showingDeleted}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalCount > 0 && (
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                <span>Rows per page:</span>
                <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-20 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="30">30</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              This draft moves to the Deleted tab, where you can restore it. Submissions, grades,
              and appeals are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDraft} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
