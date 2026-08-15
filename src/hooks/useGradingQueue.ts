"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import type {
  AssignmentInfo,
  AssignmentOption,
  SubmissionForGrading,
} from "@/components/grading/types";

const ASSIGNMENT_PAGE_SIZE = 10;

interface ApiAssignment {
  id: string;
  title: string;
  type: string;
  totalPoints: number;
  ungradedCount?: number;
  gradedCount?: number;
  openAppealCount?: number;
  _count?: { submissions: number };
}

function toAssignmentOption(a: ApiAssignment): AssignmentOption {
  return {
    id: a.id,
    title: a.title,
    type: a.type,
    totalPoints: a.totalPoints,
    submissionCount: a._count?.submissions || 0,
    ungradedCount: a.ungradedCount || 0,
    gradedCount: a.gradedCount || 0,
    openAppealCount: a.openAppealCount || 0,
  };
}

/**
 * Loads the grading queue: the published assignments a grader can pick from and
 * the submissions of the selected one.
 */
export function useGradingQueue(initialAssignmentId: string | null) {
  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(initialAssignmentId || "");
  const [assignmentInfo, setAssignmentInfo] = useState<AssignmentInfo | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionForGrading[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / ASSIGNMENT_PAGE_SIZE));

  const fetchAssignments = useCallback(
    (targetPage: number, silent?: boolean) => {
      if (!silent) setLoading(true);
      const params = new URLSearchParams({
        filter: "published",
        page: String(targetPage),
        pageSize: String(ASSIGNMENT_PAGE_SIZE),
      });
      fetch(`/api/assignments?${params}`)
        .then((res) => res.json())
        .then((data) => {
          setAssignments((data.assignments || []).map(toAssignmentOption));
          setTotalCount(data.totalCount ?? 0);
          if (!silent) setLoading(false);
        })
        .catch((err) => {
          logger.error("Failed to load grading assignment list", { error: String(err) });
          if (!silent) setLoading(false);
        });
    },
    []
  );

  /** Refreshes the queue counters without flashing a loading state. */
  const refreshCounters = useCallback(
    () => fetchAssignments(page, true),
    [fetchAssignments, page]
  );

  const fetchSubmissions = useCallback((assignmentId: string) => {
    if (!assignmentId) return;
    setLoadingSubmissions(true);
    setUnavailableReason(null);
    fetch(`/api/assignments/${assignmentId}/submissions`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setAssignmentInfo(null);
          setSubmissions([]);
          const message =
            res.status === 404
              ? "This assignment was deleted. Its submissions, grades and appeals are kept — restore it from Assignments → Deleted to grade it."
              : data.error || "Failed to load submissions";
          setUnavailableReason(message);
          toast.error(message);
          return;
        }
        setAssignmentInfo(data.assignment || null);
        setSubmissions(data.submissions || []);
      })
      .catch((err) => {
        logger.error("Failed to load submissions for grading", {
          assignmentId,
          error: String(err),
        });
        toast.error("Failed to load submissions");
      })
      .finally(() => setLoadingSubmissions(false));
  }, []);

  useEffect(() => {
    fetchAssignments(page);
  }, [fetchAssignments, page]);

  useEffect(() => {
    if (selectedAssignmentId) fetchSubmissions(selectedAssignmentId);
  }, [selectedAssignmentId, fetchSubmissions]);

  return {
    assignments,
    page,
    setPage,
    totalPages,
    selectedAssignmentId,
    setSelectedAssignmentId,
    assignmentInfo,
    submissions,
    setSubmissions,
    loading,
    loadingSubmissions,
    unavailableReason,
    refreshCounters,
    reloadSubmissions: () => fetchSubmissions(selectedAssignmentId),
  };
}
