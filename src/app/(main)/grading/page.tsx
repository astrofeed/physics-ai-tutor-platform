"use client";

import { StaffOnly } from "@/components/auth/StaffOnly";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useSearchParams } from "next/navigation";
import { useTrackTime } from "@/lib/use-track-time";
import {
  Loader2,
  ClipboardList,
  CheckCircle2,
  Clock,
  User,
  Download,
  ShieldAlert,
  XCircle,
  Search,
  ChevronDown,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { formatShortDate } from "@/lib/utils";
import { useAutoSave } from "@/hooks/useAutoSave";
import { SaveStatusIndicator } from "@/components/ui/save-status";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
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

// Extracted subcomponents
import { SubmissionList } from "@/components/grading/SubmissionList";
import { GradingPanel } from "@/components/grading/GradingPanel";
import { OverallGradeForm } from "@/components/grading/OverallGradeForm";
import type {
  AssignmentInfo,
  SubmissionForGrading,
  Appeal,
  GradingMode,
  FilterMode,
} from "@/components/grading/types";

interface AssignmentOption {
  id: string;
  title: string;
  type: string;
  totalPoints: number;
  submissionCount: number;
  ungradedCount: number;
  gradedCount: number;
  openAppealCount: number;
}

// --- Consolidated state types ---

interface OverallGradeState {
  score: number;
  feedback: string;
  confirmed: boolean;
}

interface AssignmentPickerState {
  filter: "all" | "ungraded" | "pending";
  search: string;
  open: boolean;
}

interface FeedbackFileState {
  file: File | null;
  url: string | null;
}

// --- localStorage schema versioning ---

const GRADING_STATE_VERSION = 1;

interface GradingDraftData {
  _version: number;
  grades: Record<string, { score: number; feedback: string }>;
  confirmedAnswers: string[];
  overallGrade: { score: number; feedback: string; confirmed: boolean };
  feedbackImages: Record<string, string[]>;
  feedbackFileUrl: string | null;
  gradingMode: GradingMode;
}

function isValidGradingDraft(data: unknown): data is GradingDraftData {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  if (d._version !== GRADING_STATE_VERSION) return false;
  if (typeof d.grades !== "object" || d.grades === null) return false;
  if (!Array.isArray(d.confirmedAnswers)) return false;
  if (typeof d.overallGrade !== "object" || d.overallGrade === null) return false;
  const og = d.overallGrade as Record<string, unknown>;
  if (typeof og.score !== "number" || typeof og.feedback !== "string" || typeof og.confirmed !== "boolean") return false;
  if (typeof d.feedbackImages !== "object" || d.feedbackImages === null) return false;
  if (typeof d.gradingMode !== "string") return false;
  return true;
}

function GradingPageContent() {
  useTrackTime("GRADING");
  const searchParams = useSearchParams();
  const initialAssignmentId = searchParams.get("assignmentId");

  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [assignmentPageSize] = useState(10);
  const [assignmentTotalCount, setAssignmentTotalCount] = useState(0);
  const assignmentTotalPages = Math.max(1, Math.ceil(assignmentTotalCount / assignmentPageSize));
  // Consolidated: assignment picker state (filter, search, open)
  const [assignmentPicker, setAssignmentPicker] = useState<AssignmentPickerState>({
    filter: "all",
    search: "",
    open: false,
  });
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(initialAssignmentId || "");
  const [assignmentInfo, setAssignmentInfo] = useState<AssignmentInfo | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionForGrading[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionForGrading | null>(null);
  const [grades, setGrades] = useState<Record<string, { score: number; feedback: string }>>({});
  // Consolidated: overall grade state (score, feedback, confirmed)
  const [overallGrade, setOverallGrade] = useState<OverallGradeState>({
    score: 0,
    feedback: "",
    confirmed: false,
  });
  const [gradingMode, setGradingMode] = useState<GradingMode>("per-question");
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, { score: number; feedback: string }>>({});
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  // Consolidated: feedback file state (file object, url)
  const [feedbackFileState, setFeedbackFileState] = useState<FeedbackFileState>({
    file: null,
    url: null,
  });
  const { upload: uploadFeedbackFile, uploading: uploadingFeedback } = useUploadFile({
    maxSizeBytes: 20 * 1024 * 1024,
    onSizeError: () => toast.error("File exceeds the 20 MB limit. Please use a smaller file."),
  });
  const [feedbackImages, setFeedbackImages] = useState<Record<string, string[]>>({});
  const [appealMessages, setAppealMessages] = useState<Record<string, string>>({});
  const [appealNewScores, setAppealNewScores] = useState<Record<string, string>>({});
  const [resolvingAppeal, setResolvingAppeal] = useState<string | null>(null);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [pendingAppealAction, setPendingAppealAction] = useState<{ appealId: string; status: "RESOLVED" | "REJECTED" | "OPEN" } | null>(null);
  const [showUnfinalizeConfirm, setShowUnfinalizeConfirm] = useState(false);
  const [expandedAppeals, setExpandedAppeals] = useState<Record<string, boolean>>({});
  const [appealImages, setAppealImages] = useState<Record<string, string[]>>({});
  const { upload: handleUploadImage, uploading: uploadingImage } = useUploadFile();
  const [confirmedAnswers, setConfirmedAnswers] = useState<Set<string>>(new Set());
  const [gradingDraftRestored, setGradingDraftRestored] = useState(false);
  const prevSubmissionIdRef = useRef<string | null>(null);

  // localStorage helpers for grading drafts with schema versioning
  const getLocalStorageKey = (submissionId: string) => `grading-state-${submissionId}`;

  const saveAllToLocalStorage = useCallback(() => {
    if (!selectedSubmission) return;
    try {
      const draft: GradingDraftData = {
        _version: GRADING_STATE_VERSION,
        grades,
        confirmedAnswers: Array.from(confirmedAnswers),
        overallGrade,
        feedbackImages,
        feedbackFileUrl: feedbackFileState.url,
        gradingMode,
      };
      localStorage.setItem(getLocalStorageKey(selectedSubmission.id), JSON.stringify(draft));
    } catch { /* quota exceeded or similar */ }
  }, [selectedSubmission, grades, confirmedAnswers, overallGrade, feedbackImages, feedbackFileState.url, gradingMode]);

  const loadAllFromLocalStorage = useCallback((submissionId: string): GradingDraftData | null => {
    try {
      const raw = localStorage.getItem(getLocalStorageKey(submissionId));
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      // Validate schema version and shape; discard stale data
      if (!isValidGradingDraft(parsed)) {
        localStorage.removeItem(getLocalStorageKey(submissionId));
        return null;
      }
      return parsed;
    } catch {
      // Parse error — remove corrupt data
      try { localStorage.removeItem(getLocalStorageKey(submissionId)); } catch { /* ignore */ }
      return null;
    }
  }, []);

  const clearLocalStorage = useCallback((submissionId: string) => {
    try {
      localStorage.removeItem(getLocalStorageKey(submissionId));
    } catch { /* ignore */ }
  }, []);

  // Save all grading state to localStorage on every change
  useEffect(() => {
    if (!selectedSubmission) return;
    saveAllToLocalStorage();
  }, [selectedSubmission, saveAllToLocalStorage]);

  // Server auto-save for grading drafts (5-second debounce)
  const saveGradingDraft = useCallback(async (data: Record<string, { score: number; feedback: string }>) => {
    if (!selectedSubmission) return;
    const gradeEntries = Object.entries(data);
    if (gradeEntries.length === 0) return;
    const res = await fetch("/api/grading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionId: selectedSubmission.id,
        isDraft: true,
        grades: gradeEntries.map(([answerId, g]) => ({
          answerId,
          score: g.score,
          feedback: g.feedback,
        })),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Failed to save grading draft");
    }
  }, [selectedSubmission]);

  const { status: gradingAutoSaveStatus, lastSavedAt: gradingAutoSavedAt, saveNow: flushGradingSave } = useAutoSave({
    data: grades,
    saveFn: saveGradingDraft,
    delayMs: 5000,
    enabled: !!selectedSubmission,
  });

  // Fetch assignment list with pagination and search
  const fetchAssignmentList = useCallback((p?: number, ps?: number, q?: string, silent?: boolean) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams({ filter: "published", page: String(p ?? 1), pageSize: String(ps ?? 10) });
    if (q) params.set("search", q);
    fetch(`/api/assignments?${params}`)
      .then((res) => res.json())
      .then((data) => {
        const list = (data.assignments || []).map((a: { id: string; title: string; type: string; totalPoints: number; ungradedCount?: number; gradedCount?: number; openAppealCount?: number; _count?: { submissions: number } }) => ({
          id: a.id,
          title: a.title,
          type: a.type,
          totalPoints: a.totalPoints,
          submissionCount: a._count?.submissions || 0,
          ungradedCount: a.ungradedCount || 0,
          gradedCount: a.gradedCount || 0,
          openAppealCount: a.openAppealCount || 0,
        }));
        setAssignments(list);
        setAssignmentTotalCount(data.totalCount ?? 0);
        if (!silent) setLoading(false);
      })
      .catch((err) => {
        logger.error("Failed to load grading assignment list", { error: String(err) });
        if (!silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchAssignmentList(assignmentPage, assignmentPageSize);
  }, [fetchAssignmentList, assignmentPage, assignmentPageSize]);

  const fetchSubmissions = useCallback((assignmentId: string) => {
    if (!assignmentId) return;
    setLoadingSubmissions(true);
    setSelectedSubmission(null);
    fetch(`/api/assignments/${assignmentId}/submissions`)
      .then((res) => res.json())
      .then((data) => {
        setAssignmentInfo(data.assignment || null);
        setSubmissions(data.submissions || []);
        setLoadingSubmissions(false);
      })
      .catch((err) => {
        logger.error("Failed to load submissions for grading", { assignmentId, error: String(err) });
        setLoadingSubmissions(false);
      });
  }, []);

  useEffect(() => {
    if (selectedAssignmentId) {
      fetchSubmissions(selectedAssignmentId);
    }
  }, [selectedAssignmentId, fetchSubmissions]);

  const selectSubmission = (sub: SubmissionForGrading) => {
    // Flush pending auto-save for the previous submission
    if (selectedSubmission && selectedSubmission.id !== sub.id) {
      flushGradingSave();
    }
    prevSubmissionIdRef.current = sub.id;

    setSelectedSubmission(sub);
    setFeedbackFileState({ file: null, url: null });
    setGradingDraftRestored(false);

    // Try to restore all state from localStorage (validated)
    const saved = loadAllFromLocalStorage(sub.id);
    let restored = false;

    // Grades
    const initialGrades: Record<string, { score: number; feedback: string }> = {};
    sub.answers.forEach((a) => {
      if (saved?.grades?.[a.id]) {
        initialGrades[a.id] = saved.grades[a.id];
        if (saved.grades[a.id].score !== (a.score || 0) || saved.grades[a.id].feedback !== (a.feedback || "")) {
          restored = true;
        }
      } else {
        initialGrades[a.id] = {
          score: a.score || 0,
          feedback: a.feedback || "",
        };
      }
    });
    setGrades(initialGrades);
    if (restored) setGradingDraftRestored(true);

    const storedSuggestions: Record<string, { score: number; feedback: string }> = {};
    sub.answers.forEach((a) => {
      if (a.aiSuggestedScore !== null) {
        storedSuggestions[a.id] = {
          score: a.aiSuggestedScore,
          feedback: a.aiSuggestedFeedback ?? "",
        };
      }
    });
    setSuggestions(storedSuggestions);

    // Confirmed answers & overall grade (consolidated)
    setConfirmedAnswers(new Set(saved?.confirmedAnswers || []));
    setOverallGrade({
      score: saved?.overallGrade?.score ?? sub.totalScore ?? 0,
      feedback: saved?.overallGrade?.feedback ?? sub.overallFeedback ?? "",
      confirmed: saved?.overallGrade?.confirmed ?? false,
    });

    // Feedback images: prefer localStorage, fall back to server data
    if (saved?.feedbackImages && Object.keys(saved.feedbackImages).length > 0) {
      setFeedbackImages(saved.feedbackImages);
    } else {
      const loadedFeedbackImages: Record<string, string[]> = {};
      sub.answers.forEach((a) => {
        if (a.feedbackImageUrls && a.feedbackImageUrls.length > 0) {
          loadedFeedbackImages[a.id] = a.feedbackImageUrls;
        }
      });
      setFeedbackImages(loadedFeedbackImages);
    }

    // Feedback file URL
    setFeedbackFileState((prev) => ({ ...prev, url: saved?.feedbackFileUrl ?? null }));

    // Grading mode: prefer saved, fall back to auto-detect
    if (saved?.gradingMode) {
      setGradingMode(saved.gradingMode);
    } else if (sub.answers.length === 0 || assignmentInfo?.type === "FILE_UPLOAD") {
      setGradingMode("overall");
    } else {
      const allAutoGraded = sub.answers.every((a) => a.autoGraded);
      setGradingMode(allAutoGraded ? "overall" : "per-question");
    }
  };

  const handleAIGrade = async (answerId: string) => {
    setAiLoading(answerId);
    try {
      const res = await fetch("/api/grading", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions((prev) => ({
          ...prev,
          [answerId]: { score: data.suggestedScore, feedback: data.suggestedFeedback },
        }));
        toast.success("AI suggestion ready — review it, then apply to use it as the score");
      } else {
        const body = await res.json().catch(() => null);
        toast.error(body?.error || "AI suggestion failed. Your score and feedback are unchanged.");
      }
    } catch (err) {
      logger.error("AI grading suggestion request failed", { answerId, error: String(err) });
      toast.error("AI suggestion failed. Your score and feedback are unchanged.");
    } finally {
      setAiLoading(null);
    }
  };

  /** Copies a stored AI recommendation into the editable grade; saving is still the grader's call. */
  const handleApplySuggestion = (answerId: string) => {
    const suggestion = suggestions[answerId];
    if (!suggestion) return;
    setGrades((prev) => ({
      ...prev,
      [answerId]: { score: suggestion.score, feedback: suggestion.feedback },
    }));
  };

  const handleUploadFeedbackFile = async (file: File) => {
    setFeedbackFileState((prev) => ({ ...prev, file }));
    const url = await uploadFeedbackFile(file);
    if (url) setFeedbackFileState((prev) => ({ ...prev, url }));
  };

  const handleGradeChange = (answerId: string, field: "score" | "feedback", value: number | string) => {
    setGrades((prev) => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        [field]: value,
      },
    }));
  };

  const handleToggleConfirm = (answerId: string) => {
    setConfirmedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(answerId)) next.delete(answerId);
      else next.add(answerId);
      return next;
    });
  };

  const handleSaveGrades = async () => {
    if (!selectedSubmission) return;

    // In per-question mode, warn if not all answers are confirmed
    if (gradingMode === "per-question") {
      const manualAnswers = selectedSubmission.answers.filter(a => !a.autoGraded);
      if (confirmedAnswers.size < manualAnswers.length) {
        setShowFinalizeConfirm(true);
        return;
      }
    }
    await executeSaveGrades();
  };

  const executeSaveGrades = async () => {
    if (!selectedSubmission) return;

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        submissionId: selectedSubmission.id,
      };

      if (feedbackFileState.url) {
        body.feedbackFileUrl = feedbackFileState.url;
      }

      // Include overall score and feedback when confirmed
      if (overallGrade.confirmed) {
        body.overallScore = overallGrade.score;
        body.overallFeedback = overallGrade.feedback;
      }

      if (gradingMode === "per-question") {
        body.grades = Object.entries(grades).map(([answerId, g]) => ({
          answerId,
          score: g.score,
          feedback: g.feedback,
        }));
        // Include feedback images keyed by answerId
        const hasAnyImages = Object.values(feedbackImages).some((imgs) => imgs.length > 0);
        if (hasAnyImages) {
          body.feedbackImages = feedbackImages;
        }
      }

      const res = await fetch("/api/grading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        // Clear localStorage on successful final save
        clearLocalStorage(selectedSubmission.id);
        setGradingDraftRestored(false);
        setSubmissions((prev) =>
          prev.map((s) => {
            if (s.id !== selectedSubmission.id) return s;
            return {
              ...s,
              totalScore: data.totalScore,
              gradedAt: new Date().toISOString(),
              gradedByName: "You",
            };
          })
        );
        setSelectedSubmission((prev) =>
          prev ? { ...prev, totalScore: data.totalScore, gradedAt: new Date().toISOString(), gradedByName: "You" } : prev
        );
        fetchAssignmentList(assignmentPage, assignmentPageSize, undefined, true);
      } else {
        const body = await res.json().catch(() => null);
        toast.error(body?.error || "Failed to save grades");
      }
    } catch (err) {
      logger.error("Save grades request failed", {
        submissionId: selectedSubmission.id,
        error: String(err),
      });
      toast.error("Failed to save grades");
    } finally {
      setSaving(false);
    }
  };

  const handleAppealMessage = async (appealId: string) => {
    const message = appealMessages[appealId]?.trim();
    if (!message) return;
    try {
      const res = await fetch("/api/appeals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appealId,
          message,
          imageUrls: appealImages[appealId]?.length ? appealImages[appealId] : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        updateAppealInSubmissions(appealId, data.appeal);
        setAppealMessages((prev) => ({ ...prev, [appealId]: "" }));
        setAppealImages((prev) => ({ ...prev, [appealId]: [] }));
      } else {
        const body = await res.json().catch(() => null);
        toast.error(body?.error || "Failed to send message");
      }
    } catch (err) {
      logger.error("Appeal message request failed", { appealId, error: String(err) });
      toast.error("Failed to send message");
    }
  };

  const handleResolveAppeal = (appealId: string, status: "RESOLVED" | "REJECTED" | "OPEN") => {
    setPendingAppealAction({ appealId, status });
  };

  const executeResolveAppeal = async () => {
    if (!pendingAppealAction) return;
    const { appealId, status } = pendingAppealAction;
    setPendingAppealAction(null);
    const newScoreStr = appealNewScores[appealId];
    const newScore = status === "RESOLVED" && newScoreStr ? parseFloat(newScoreStr) : undefined;
    const message = appealMessages[appealId];
    setResolvingAppeal(appealId);
    try {
      const res = await fetch("/api/appeals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appealId,
          status,
          newScore,
          message: message?.trim() || undefined,
          imageUrls: appealImages[appealId]?.length ? appealImages[appealId] : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        updateAppealInSubmissions(appealId, data.appeal);
        setAppealMessages((prev) => ({ ...prev, [appealId]: "" }));
        setAppealImages((prev) => ({ ...prev, [appealId]: [] }));
        setAppealNewScores((prev) => ({ ...prev, [appealId]: "" }));
        // Refresh submissions to get updated scores
        if (status === "RESOLVED" && newScore !== undefined) {
          fetchSubmissions(selectedAssignmentId);
        }
        fetchAssignmentList(assignmentPage, assignmentPageSize, undefined, true);
      } else {
        const body = await res.json().catch(() => null);
        toast.error(body?.error || "Failed to update appeal");
      }
    } catch (err) {
      logger.error("Appeal decision request failed", { appealId, status, error: String(err) });
      toast.error("Failed to update appeal");
    } finally {
      setResolvingAppeal(null);
    }
  };

  const updateAppealInSubmissions = (appealId: string, updatedAppeal: Appeal) => {
    setSubmissions((prev) =>
      prev.map((sub) => ({
        ...sub,
        openAppealCount: sub.answers.reduce(
          (count, a) => count + a.appeals.filter((ap) => ap.id === appealId ? updatedAppeal.status === "OPEN" : ap.status === "OPEN").length,
          0
        ),
        answers: sub.answers.map((a) => ({
          ...a,
          appeals: a.appeals.map((ap) => ap.id === appealId ? updatedAppeal : ap),
        })),
      }))
    );
    setSelectedSubmission((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        answers: prev.answers.map((a) => ({
          ...a,
          appeals: a.appeals.map((ap) => ap.id === appealId ? updatedAppeal : ap),
        })),
      };
    });
  };

  const filteredSubmissions = submissions.filter((s) => {
    if (filterMode === "ungraded") return s.totalScore === null;
    if (filterMode === "graded") return s.totalScore !== null;
    if (filterMode === "appeals") return s.openAppealCount > 0;
    return true;
  });

  const gradedCount = submissions.filter((s) => s.totalScore !== null).length;
  const ungradedCount = submissions.length - gradedCount;
  const appealsCount = submissions.filter((s) => s.openAppealCount > 0).length;
  const allAutoGraded = (selectedSubmission?.answers.length ?? 0) > 0 && (selectedSubmission?.answers.every((a) => a.autoGraded) ?? false);

  if (loading) {
    return <LoadingSpinner message="Loading..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Grading</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Review and grade student submissions</p>
        </div>
      </div>

      {/* Assignment Picker & Submission Controls */}
      <div className="space-y-3">
        {/* Assignment Picker */}
        <Popover open={assignmentPicker.open} onOpenChange={(open) => setAssignmentPicker((prev) => ({ ...prev, open }))}>
          <PopoverTrigger asChild>
            <button
              className="flex h-10 w-full sm:w-96 items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
            >
              <span className={selectedAssignmentId ? "text-gray-900 dark:text-gray-100 font-medium truncate" : "text-gray-400 dark:text-gray-500"}>
                {assignments.find((a) => a.id === selectedAssignmentId)?.title || "Select an assignment to grade"}
              </span>
              <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="sm:w-96 p-0">
            {/* Search */}
            <div className="p-2 border-b border-neutral-100 dark:border-neutral-800">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Search assignments..."
                  value={assignmentPicker.search}
                  onChange={(e) => setAssignmentPicker((prev) => ({ ...prev, search: e.target.value }))}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
            {/* Filter tabs */}
            <div className="flex items-center gap-1 p-2 border-b border-neutral-100 dark:border-neutral-800">
              {([
                { key: "all", label: "All" },
                { key: "ungraded", label: "Ungraded" },
                { key: "pending", label: "Appeals" },
              ] as const).map((f) => (
                <button
                  key={f.key}
                  onClick={() => { setAssignmentPicker((prev) => ({ ...prev, filter: f.key })); setAssignmentPage(1); }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    assignmentPicker.filter === f.key
                      ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {/* Assignment list */}
            <div className="max-h-64 overflow-y-auto p-1">
              {(() => {
                const filtered = assignments.filter((a) => {
                  if (assignmentPicker.search && !a.title.toLowerCase().includes(assignmentPicker.search.toLowerCase())) return false;
                  if (assignmentPicker.filter === "ungraded" && a.ungradedCount <= 0) return false;
                  if (assignmentPicker.filter === "pending" && a.openAppealCount <= 0) return false;
                  return true;
                });
                if (filtered.length === 0) {
                  return <div className="px-3 py-6 text-sm text-gray-400 text-center">No matching assignments</div>;
                }
                return filtered.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { setSelectedAssignmentId(a.id); setAssignmentPicker((prev) => ({ ...prev, open: false, search: "" })); }}
                    className={`w-full text-left rounded-md px-3 py-2.5 transition-colors ${
                      a.id === selectedAssignmentId
                        ? "bg-gray-100 dark:bg-gray-800"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{a.title}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                      <span>{a.submissionCount} submissions</span>
                      {a.ungradedCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded font-semibold text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                          {a.ungradedCount} ungraded
                        </span>
                      )}
                      {a.openAppealCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded font-semibold text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400">
                          {a.openAppealCount} appeal{a.openAppealCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </button>
                ));
              })()}
            </div>
            {/* Pagination */}
            {assignmentTotalPages > 1 && (
              <div className="flex items-center justify-center px-3 py-2 border-t border-neutral-100 dark:border-neutral-800">
                <Pagination currentPage={assignmentPage} totalPages={assignmentTotalPages} onPageChange={setAssignmentPage} />
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Submission controls -- only visible after selecting an assignment */}
        {selectedAssignmentId && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
              <SelectTrigger className="w-32 sm:w-44">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ({submissions.length})</SelectItem>
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
              onClick={() => {
                const url = `/api/grading/export?assignmentId=${selectedAssignmentId}`;
                window.open(url, "_blank");
              }}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </Button>

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
        )}
      </div>

      {!selectedAssignmentId ? (
        <EmptyState
          icon={ClipboardList}
          title="Select an assignment to grade"
          description="Choose an assignment from the dropdown above."
        />
      ) : loadingSubmissions ? (
        <LoadingSpinner />
      ) : (
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:h-[calc(100vh-16rem)]">
          {/* Submission List */}
          <SubmissionList
            submissions={filteredSubmissions}
            selectedSubmission={selectedSubmission}
            onSelectSubmission={selectSubmission}
            assignmentInfo={assignmentInfo}
            filterMode={filterMode}
          />

          {/* Grading Panel */}
          <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
            {selectedSubmission ? (
              <>
                {/* Panel Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{selectedSubmission.userName}</h3>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Submitted {formatShortDate(selectedSubmission.submittedAt)}
                      </p>
                      {selectedSubmission.gradedByName && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          &middot; Graded by {selectedSubmission.gradedByName}
                        </p>
                      )}
                      {assignmentInfo?.dueDate && new Date(selectedSubmission.submittedAt) > new Date(assignmentInfo.dueDate) && (
                        <Badge className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 text-[10px]">
                          Late
                        </Badge>
                      )}
                      {allAutoGraded && selectedSubmission.answers.length > 0 && (
                        <Badge className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 text-[10px]">
                          Auto-graded
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    {/* Grading progress */}
                    {selectedSubmission.answers.length > 0 && !allAutoGraded && (
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:inline">
                        Confirmed {confirmedAnswers.size}/{selectedSubmission.answers.filter(a => !a.autoGraded).length}
                      </span>
                    )}
                    {/* Grading mode toggle - only for QUIZ with questions */}
                    {selectedSubmission.answers.length > 0 && !allAutoGraded && (
                      <Select value={gradingMode} onValueChange={(v) => setGradingMode(v as GradingMode)}>
                        <SelectTrigger className="w-32 sm:w-40 h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per-question">By Question</SelectItem>
                          <SelectItem value="overall">Overall Grade</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <SaveStatusIndicator status={gradingAutoSaveStatus} lastSavedAt={gradingAutoSavedAt} />
                    {selectedSubmission.gradedAt ? (
                      <Button
                        onClick={() => setShowUnfinalizeConfirm(true)}
                        disabled={saving}
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950 rounded-lg"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                        <span className="hidden sm:inline">Unfinalize</span>
                        <span className="sm:hidden">Undo</span>
                      </Button>
                    ) : (
                      <Button
                        onClick={handleSaveGrades}
                        disabled={saving || allAutoGraded || (selectedSubmission.answers.filter(a => !a.autoGraded).length === 0 && !overallGrade.confirmed)}
                        size="sm"
                        className="gap-1.5 bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 rounded-lg"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Finalize
                      </Button>
                    )}
                  </div>
                </div>

                {/* Panel Body */}
                <div className="flex-1 overflow-auto p-6 space-y-5">
                  {/* Grading progress bar */}
                  {selectedSubmission.answers.length > 0 && !allAutoGraded && gradingMode === "per-question" && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">
                        Graded {confirmedAnswers.size}/{selectedSubmission.answers.filter(a => !a.autoGraded).length}
                      </span>
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            confirmedAnswers.size >= selectedSubmission.answers.filter(a => !a.autoGraded).length ? "bg-emerald-500" : "bg-blue-500"
                          }`}
                          style={{ width: `${selectedSubmission.answers.filter(a => !a.autoGraded).length > 0 ? (confirmedAnswers.size / selectedSubmission.answers.filter(a => !a.autoGraded).length) * 100 : 0}%` }}
                        />
                      </div>
                      {confirmedAnswers.size > 0 && confirmedAnswers.size >= selectedSubmission.answers.filter(a => !a.autoGraded).length ? (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">All confirmed</span>
                      ) : confirmedAnswers.size > 0 ? (
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">Ready to finalize</span>
                      ) : null}
                    </div>
                  )}
                  {/* Draft restored banner */}
                  {gradingDraftRestored && (
                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <p className="text-sm text-blue-700 dark:text-blue-300">Grading progress restored from a previous session.</p>
                      <button onClick={() => setGradingDraftRestored(false)} className="ml-auto text-blue-400 hover:text-blue-600 dark:hover:text-blue-300">
                        &times;
                      </button>
                    </div>
                  )}

                  {/* Uploaded file (student submission) */}
                  {selectedSubmission.fileUrl && (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student Submission File</p>
                      <a
                        href={selectedSubmission.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <Download className="h-4 w-4" />
                        View / Download Submission
                      </a>
                    </div>
                  )}

                  {/* Auto-graded notice */}
                  {allAutoGraded && selectedSubmission.answers.length > 0 && (
                    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4">
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                        This submission was automatically graded.
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                        Score: {selectedSubmission.totalScore}/{assignmentInfo?.totalPoints} &mdash; No manual grading needed.
                      </p>
                    </div>
                  )}

                  {/* Per-question grading */}
                  {gradingMode === "per-question" && (
                    <GradingPanel
                      answers={selectedSubmission.answers}
                      grades={grades}
                      onGradeChange={handleGradeChange}
                      confirmedAnswers={confirmedAnswers}
                      onToggleConfirm={handleToggleConfirm}
                      aiLoading={aiLoading}
                      onAIGrade={handleAIGrade}
                      suggestions={suggestions}
                      onApplySuggestion={handleApplySuggestion}
                      feedbackImages={feedbackImages}
                      onFeedbackImagesChange={(answerId, imgs) => setFeedbackImages((prev) => ({ ...prev, [answerId]: imgs }))}
                      onUploadImage={handleUploadImage}
                      uploadingImage={uploadingImage}
                      appealMessages={appealMessages}
                      onAppealMessageChange={(id, v) => setAppealMessages((prev) => ({ ...prev, [id]: v }))}
                      appealImages={appealImages}
                      onAppealImagesChange={(id, imgs) => setAppealImages((prev) => ({ ...prev, [id]: imgs }))}
                      appealNewScores={appealNewScores}
                      onAppealNewScoreChange={(id, v) => setAppealNewScores((prev) => ({ ...prev, [id]: v }))}
                      expandedAppeals={expandedAppeals}
                      onToggleAppealExpand={(id) => setExpandedAppeals((prev) => ({ ...prev, [id]: !prev[id] }))}
                      resolvingAppeal={resolvingAppeal}
                      onResolveAppeal={handleResolveAppeal}
                      onSendAppealMessage={handleAppealMessage}
                    />
                  )}

                  {/* Overall score & feedback + feedback file */}
                  {!allAutoGraded && (
                    <OverallGradeForm
                      totalPoints={assignmentInfo?.totalPoints || 100}
                      overallScore={overallGrade.score}
                      onOverallScoreChange={(score) => setOverallGrade((prev) => ({ ...prev, score }))}
                      overallFeedback={overallGrade.feedback}
                      onOverallFeedbackChange={(feedback) => setOverallGrade((prev) => ({ ...prev, feedback }))}
                      overallGradeConfirmed={overallGrade.confirmed}
                      onToggleOverallConfirm={() => setOverallGrade((prev) => ({ ...prev, confirmed: !prev.confirmed }))}
                      feedbackFileUrl={feedbackFileState.url}
                      feedbackFileName={feedbackFileState.file?.name || null}
                      uploadingFeedback={uploadingFeedback}
                      onUploadFeedbackFile={handleUploadFeedbackFile}
                      onClearFeedbackFile={() => setFeedbackFileState({ file: null, url: null })}
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-3">
                  <ClipboardList className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                  Select a submission to start grading
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                  Choose a student from the left panel
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      <AlertDialog open={showFinalizeConfirm} onOpenChange={setShowFinalizeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalize with Unconfirmed Scores</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedSubmission && (() => {
                const manualAnswers = selectedSubmission.answers.filter(a => !a.autoGraded);
                return `You have only confirmed ${confirmedAnswers.size} out of ${manualAnswers.length} scores. Finalize anyway?`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowFinalizeConfirm(false); executeSaveGrades(); }}>
              Finalize
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingAppealAction} onOpenChange={(open) => { if (!open) setPendingAppealAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAppealAction?.status === "RESOLVED" ? "Resolve" : pendingAppealAction?.status === "REJECTED" ? "Reject" : "Reopen"} Appeal
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {pendingAppealAction?.status === "RESOLVED" ? "resolve" : pendingAppealAction?.status === "REJECTED" ? "reject" : "reopen"} this appeal?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeResolveAppeal}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showUnfinalizeConfirm} onOpenChange={setShowUnfinalizeConfirm}>
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
            <AlertDialogAction onClick={async () => {
              setShowUnfinalizeConfirm(false);
              if (!selectedSubmission) return;
              setSaving(true);
              try {
                const res = await fetch("/api/grading", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ submissionId: selectedSubmission.id, ungrade: true }),
                });
                if (res.ok) {
                  setSubmissions((prev) => prev.map((s) => s.id !== selectedSubmission.id ? s : { ...s, totalScore: null, gradedAt: null, gradedByName: null }));
                  setSelectedSubmission((prev) => prev ? { ...prev, totalScore: null, gradedAt: null, gradedByName: null } : prev);
                  fetchAssignmentList(assignmentPage, assignmentPageSize, undefined, true);
                } else {
                  const body = await res.json().catch(() => null);
                  toast.error(body?.error || "Failed to unfinalize this submission");
                }
              } catch (err) {
                logger.error("Ungrade request failed", {
                  submissionId: selectedSubmission.id,
                  error: String(err),
                });
                toast.error("Failed to unfinalize this submission");
              } finally { setSaving(false); }
            }} className="bg-amber-600 hover:bg-amber-700 text-white">
              Unfinalize
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function GradingPage() {
  return (
    <StaffOnly>
      <GradingPageContent />
    </StaffOnly>
  );
}
