import { useEffect, useState, useCallback, useRef } from "react";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useEffectiveSession } from "@/lib/effective-session-context";
import { useTrackTime } from "@/lib/use-track-time";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { buildAssignmentNotifyContent } from "@/lib/utils";
import type { AssignmentDetail } from "@/types/assignment";
import type { ExistingSubmission, GradeAppealData } from "@/types/submission";

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
}

export function useAssignmentDetail(assignmentId: string) {
  useTrackTime("ASSIGNMENT_VIEW");
  const router = useRouter();
  const effectiveSession = useEffectiveSession();

  // --- Core state ---
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingSubmission, setDeletingSubmission] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [exportingLatex, setExportingLatex] = useState(false);

  // --- Student answer state ---
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answerImages, setAnswerImages] = useState<Record<string, string[]>>({});
  const [file, setFile] = useState<File | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  // --- Submission state ---
  const [existingSubmission, setExistingSubmission] = useState<ExistingSubmission | null>(null);

  // --- Appeal state ---
  const [appeals, setAppeals] = useState<GradeAppealData[]>([]);
  const [appealReasons, setAppealReasons] = useState<Record<string, string>>({});
  const [appealMessages, setAppealMessages] = useState<Record<string, string>>({});
  const [appealNewScores, setAppealNewScores] = useState<Record<string, string>>({});
  const [appealImages, setAppealImages] = useState<Record<string, string[]>>({});
  const [submittingAppeal, setSubmittingAppeal] = useState<string | null>(null);
  const [expandedAppeals, setExpandedAppeals] = useState<Record<string, boolean>>({});
  const [resolvingAppeal, setResolvingAppeal] = useState<string | null>(null);
  const [appealFilter, setAppealFilter] = useState<"ALL" | "OPEN">("OPEN");

  // --- Image upload ---
  const { upload: handleUploadImage, uploading: uploadingImage } = useUploadFile();

  // --- Draft state ---
  const [draftRestored, setDraftRestored] = useState(false);
  const draftRestoredRef = useRef(false);

  // --- Dialog state ---
  const [unpublishDialogOpen, setUnpublishDialogOpen] = useState(false);
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [notifySubject, setNotifySubject] = useState("");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [cancelScheduleDialogOpen, setCancelScheduleDialogOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false, title: "", description: "", onConfirm: () => {},
  });

  const userRole = effectiveSession.role;

  // --- Auto-save ---
  const isQuizInProgress = assignment?.type === "QUIZ" && (!existingSubmission || existingSubmission.isDraft === true) && !submitted && userRole === "STUDENT";

  const saveDraft = useCallback(async (data: Record<string, string>) => {
    if (!assignment) return;
    const answerEntries = Object.entries(data).filter(([qId, v]) => v.trim() !== "" || (answerImages[qId]?.length ?? 0) > 0);
    if (answerEntries.length === 0) return;
    await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignmentId: assignment.id,
        isDraft: true,
        answers: answerEntries.map(([questionId, answer]) => ({
          questionId,
          answer,
          answerImageUrls: answerImages[questionId]?.length ? answerImages[questionId] : undefined,
        })),
      }),
    });
  }, [assignment, answerImages]);

  const { status: autoSaveStatus, saveNow: flushAutoSave, markSaved } = useAutoSave({
    data: answers,
    saveFn: saveDraft,
    delayMs: 2000,
    enabled: isQuizInProgress,
  });

  // beforeunload warning when save is in progress
  useEffect(() => {
    if (autoSaveStatus !== "saving") return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [autoSaveStatus]);

  // --- Fetch assignment data ---
  useEffect(() => {
    fetch(`/api/assignments/${assignmentId}`)
      .then((res) => res.json())
      .then((data) => {
        setAssignment(data.assignment);

        if (data.submission) {
          setExistingSubmission(data.submission);
          if (data.submission.isDraft && data.submission.answers?.length > 0 && !draftRestoredRef.current) {
            const restored: Record<string, string> = {};
            const restoredImages: Record<string, string[]> = {};
            for (const a of data.submission.answers) {
              if (a.answer) restored[a.questionId] = a.answer;
              if (a.answerImageUrls?.length) restoredImages[a.questionId] = a.answerImageUrls;
            }
            setAnswers(restored);
            setAnswerImages(restoredImages);
            markSaved(restored);
            setDraftRestored(true);
            draftRestoredRef.current = true;
          }
        }

        const fetched = data.appeals || [];
        setAppeals(fetched);
        const expanded: Record<string, boolean> = {};
        for (const a of fetched) {
          if (a.status === "OPEN") expanded[a.id] = true;
        }
        setExpandedAppeals((prev) => ({ ...prev, ...expanded }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [assignmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Handlers ---
  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleAnswerImagesChange = (questionId: string, images: string[]) => {
    setAnswerImages((prev) => ({ ...prev, [questionId]: images }));
  };

  const doSubmit = useCallback(async () => {
    if (!assignment) return;
    setSubmitting(true);
    try {
      let fileUrl: string | undefined;
      const fileToUpload = assignment.type === "FILE_UPLOAD" ? file : attachmentFile;
      if (fileToUpload) {
        const formData = new FormData();
        formData.append("file", fileToUpload);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          fileUrl = data.url;
        }
      }
      if (isQuizInProgress) flushAutoSave();

      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: assignment.id,
          isDraft: false,
          answers: (() => {
            const allQuestionIds = new Set([
              ...Object.keys(answers),
              ...Object.keys(answerImages).filter(qId => answerImages[qId]?.length > 0),
            ]);
            return Array.from(allQuestionIds).map(questionId => ({
              questionId,
              answer: answers[questionId] || "",
              answerImageUrls: answerImages[questionId]?.length ? answerImages[questionId] : undefined,
            }));
          })(),
          fileUrl,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setExistingSubmission({
          id: data.submission.id,
          fileUrl: data.submission.fileUrl,
          submittedAt: data.submission.submittedAt,
          totalScore: data.submission.totalScore,
          answers: data.submission.answers || [],
        });
        setSubmitted(true);
      } else {
        const data = await res.json();
        toast.error(data.error || "Submission failed");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }, [assignment, file, attachmentFile, answers, answerImages, isQuizInProgress, flushAutoSave]);

  const handleSubmit = () => {
    if (!assignment) return;
    if (assignment.type === "QUIZ" && assignment.questions.length > 0) {
      const answered = assignment.questions.filter(q =>
        (answers[q.id]?.trim()) || (answerImages[q.id]?.length > 0)
      ).length;
      const total = assignment.questions.length;
      if (answered < total) {
        const hasAttachment = !!attachmentFile || !!file;
        const desc = hasAttachment
          ? `You answered ${answered} out of ${total} questions online. Are all remaining answers in the attached document? Confirm to submit.`
          : `You have only answered ${answered} out of ${total} questions. Are you sure you want to submit?`;
        setConfirmDialog({ open: true, title: "Submit with unanswered questions?", description: desc, onConfirm: () => {
          if (assignment.lockAfterSubmit) {
            setConfirmDialog({ open: true, title: "Locked Submission", description: "Once you submit, you will NOT be able to change or resubmit your answers. Are you sure you want to submit?", onConfirm: doSubmit });
          } else {
            doSubmit();
          }
        }});
        return;
      }
    }
    if (assignment.lockAfterSubmit) {
      setConfirmDialog({ open: true, title: "Locked Submission", description: "Once you submit, you will NOT be able to change or resubmit your answers. Are you sure you want to submit?", onConfirm: doSubmit });
      return;
    }
    doSubmit();
  };

  const handleEditSubmission = async () => {
    if (!existingSubmission) return;
    setConfirmDialog({
      open: true,
      title: "Edit Submission",
      description: "This will reopen your submission for editing. You'll need to resubmit when done. Continue?",
      onConfirm: async () => {
        setDeletingSubmission(true);
        try {
          const res = await fetch(`/api/submissions/${existingSubmission.id}`, { method: "PATCH" });
          if (res.ok) {
            const restored: Record<string, string> = {};
            const restoredImages: Record<string, string[]> = {};
            for (const a of existingSubmission.answers) {
              if (a.answer) restored[a.questionId] = a.answer;
              if (a.answerImageUrls?.length) restoredImages[a.questionId] = a.answerImageUrls;
            }
            setAnswers(restored);
            setAnswerImages(restoredImages);
            setExistingSubmission({ ...existingSubmission, isDraft: true });
          }
        } catch (err) {
          console.error(err);
        } finally {
          setDeletingSubmission(false);
        }
      },
    });
  };

  const handleSubmitAppeal = async (answerId: string) => {
    const reason = appealReasons[answerId];
    if (!reason?.trim()) return;
    setSubmittingAppeal(answerId);
    try {
      const res = await fetch("/api/appeals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionAnswerId: answerId,
          reason: reason.trim(),
          imageUrls: appealImages[answerId]?.length ? appealImages[answerId] : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAppeals((prev) => [data.appeal, ...prev]);
        setAppealReasons((prev) => ({ ...prev, [answerId]: "" }));
        setAppealImages((prev) => ({ ...prev, [answerId]: [] }));
        setExpandedAppeals((prev) => ({ ...prev, [data.appeal.id]: true }));
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to submit appeal");
      }
    } catch {
      toast.error("Failed to submit appeal");
    } finally {
      setSubmittingAppeal(null);
    }
  };

  const handleAppealMessage = async (appealId: string) => {
    const message = appealMessages[appealId];
    if (!message?.trim()) return;
    try {
      const res = await fetch("/api/appeals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appealId,
          message: message.trim(),
          imageUrls: appealImages[appealId]?.length ? appealImages[appealId] : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAppeals((prev) => prev.map((a) => (a.id === appealId ? data.appeal : a)));
        setAppealMessages((prev) => ({ ...prev, [appealId]: "" }));
        setAppealImages((prev) => ({ ...prev, [appealId]: [] }));
      }
    } catch {
      toast.error("Failed to send message");
    }
  };

  const handleResolveAppeal = (appealId: string, status: "RESOLVED" | "REJECTED" | "OPEN") => {
    const action = status === "RESOLVED" ? "resolve" : status === "REJECTED" ? "reject" : "reopen";
    setConfirmDialog({
      open: true,
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Appeal`,
      description: `Are you sure you want to ${action} this appeal?`,
      onConfirm: async () => {
        const newScoreStr = appealNewScores[appealId];
        const newScore = status === "RESOLVED" && newScoreStr ? parseFloat(newScoreStr) : undefined;
        const message = appealMessages[appealId];
        setResolvingAppeal(appealId);
        try {
          const res = await fetch("/api/appeals", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appealId, status, newScore, message: message?.trim() || undefined }),
          });
          if (res.ok) {
            const data = await res.json();
            setAppeals((prev) => prev.map((a) => (a.id === appealId ? data.appeal : a)));
            setAppealMessages((prev) => ({ ...prev, [appealId]: "" }));
            setAppealNewScores((prev) => ({ ...prev, [appealId]: "" }));
            if (status === "RESOLVED" && newScore !== undefined) {
              fetch(`/api/submissions?assignmentId=${assignmentId}`)
                .then((r) => r.json())
                .then((d) => { if (d.submission) setExistingSubmission(d.submission); })
                .catch((err) => console.error("[submission] Failed to refresh submission:", err));
            }
          }
        } catch {
          toast.error("Failed to update appeal");
        } finally {
          setResolvingAppeal(null);
        }
      },
    });
  };

  const getAppealForAnswer = (answerId: string) =>
    appeals.find((a) => a.submissionAnswerId === answerId);

  const handlePublish = () => {
    if (!assignment) return;
    if (assignment.published) {
      setUnpublishDialogOpen(true);
    } else {
      const { subject, message } = buildAssignmentNotifyContent(assignment);
      setNotifySubject(subject);
      setNotifyMessage(message);
      setNotifyDialogOpen(true);
    }
  };

  const handleSchedule = () => {
    if (!assignment) return;
    const { subject, message } = buildAssignmentNotifyContent(assignment);
    setNotifySubject(subject);
    setNotifyMessage(message);
    setScheduleDialogOpen(true);
  };

  const handleToggleLock = async () => {
    if (!assignment) return;
    try {
      await fetch(`/api/assignments/${assignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockAfterSubmit: !assignment.lockAfterSubmit }),
      });
      setAssignment({ ...assignment, lockAfterSubmit: !assignment.lockAfterSubmit });
    } catch {
      toast.error("Failed to toggle lock setting");
    }
  };

  const handleDelete = () => {
    if (!assignment) return;
    setConfirmDialog({
      open: true,
      title: "Delete Assignment",
      description:
        "This hides the assignment from students and removes it from grading queues and exports. Submissions, grades, and appeals are kept — you can restore it from Assignments → Deleted.",
      onConfirm: async () => {
        setDeleting(true);
        try {
          const res = await fetch(`/api/assignments/${assignment.id}`, { method: "DELETE" });
          if (res.ok) {
            router.push("/assignments");
          } else {
            toast.error("Failed to delete assignment");
          }
        } catch {
          toast.error("Failed to delete assignment");
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  const handleExportLatex = async () => {
    if (!assignment) return;
    setExportingLatex(true);
    try {
      const res = await fetch(`/api/assignments/${assignment.id}/export-latex`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${assignment.title.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_").slice(0, 60)}_latex.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error("Failed to export LaTeX");
    } finally {
      setExportingLatex(false);
    }
  };

  return {
    // Core
    assignment, setAssignment, loading, submitted, userRole,
    // Submission
    submitting, deleting, deletingSubmission, existingSubmission,
    answers, answerImages, file, setFile, attachmentFile, setAttachmentFile,
    // Auto-save
    autoSaveStatus, draftRestored, setDraftRestored, isQuizInProgress,
    // Appeals
    appeals, appealReasons, setAppealReasons, appealMessages, setAppealMessages,
    appealNewScores, setAppealNewScores, appealImages, setAppealImages,
    submittingAppeal, expandedAppeals, setExpandedAppeals, resolvingAppeal,
    appealFilter, setAppealFilter,
    // Image upload
    handleUploadImage, uploadingImage,
    // Dialogs
    unpublishDialogOpen, setUnpublishDialogOpen,
    notifyDialogOpen, setNotifyDialogOpen,
    notifySubject, notifyMessage,
    scheduleDialogOpen, setScheduleDialogOpen,
    cancelScheduleDialogOpen, setCancelScheduleDialogOpen,
    confirmDialog, setConfirmDialog,
    exportingLatex,
    // Handlers
    handleAnswerChange, handleAnswerImagesChange,
    handleSubmit, handleEditSubmission,
    handleSubmitAppeal, handleAppealMessage, handleResolveAppeal,
    getAppealForAnswer,
    handlePublish, handleSchedule, handleToggleLock, handleDelete, handleExportLatex,
  };
}
