import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useEffectiveSession } from "@/lib/effective-session-context";
import { useTrackTime } from "@/lib/use-track-time";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { buildAssignmentNotifyContent } from "@/lib/utils";
import { useAssignmentAppeals } from "@/hooks/useAssignmentAppeals";
import { unconfirmedKeysMessage, unconfirmedQuestionNumbers } from "@/lib/key-review";
import type { AssignmentDetail, AssignmentQuestion } from "@/types/assignment";
import type { ExistingSubmission } from "@/types/submission";

/** What an in-progress quiz autosaves: typed answers plus attachment URLs. */
interface QuizDraft {
  answers: Record<string, string>;
  images: Record<string, string[]>;
}

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

  // --- Image upload ---
  const { upload: handleUploadImage, uploading: uploadingImage } = useUploadFile();

  // --- Draft state ---
  const [draftRestored, setDraftRestored] = useState(false);
  const draftRestoredRef = useRef(false);
  /** Whether a draft exists on the server, so an emptied quiz still has to be saved. */
  const savedDraftRef = useRef(false);

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

  const requestConfirm = useCallback(
    (request: { title: string; description: string; onConfirm: () => void }) =>
      setConfirmDialog({ open: true, ...request }),
    []
  );

  const appealState = useAssignmentAppeals({
    assignmentId,
    requestConfirm,
    onSubmissionRefetched: setExistingSubmission,
  });
  const { setAppeals, setExpandedAppeals } = appealState;

  // --- Auto-save ---
  const isQuizInProgress = assignment?.type === "QUIZ" && (!existingSubmission || existingSubmission.isDraft === true) && !submitted && userRole === "STUDENT";

  // Attachments are part of the watched data, so attaching a photo with no typed
  // answer still saves a draft.
  const draft: QuizDraft = useMemo(() => ({ answers, images: answerImages }), [answers, answerImages]);

  const saveDraft = useCallback(async (data: QuizDraft) => {
    if (!assignment) return;
    const questionIds = new Set([
      ...Object.keys(data.answers).filter((qId) => data.answers[qId].trim() !== ""),
      ...Object.keys(data.images).filter((qId) => (data.images[qId]?.length ?? 0) > 0),
    ]);
    // Sending an empty quiz is only worth it once a draft exists — clearing the
    // last answer otherwise leaves the stale server copy to come back on reload.
    if (questionIds.size === 0 && !savedDraftRef.current) return;
    const answers = Array.from(questionIds, (questionId) => ({
      questionId,
      answer: data.answers[questionId] ?? "",
      answerImageUrls: data.images[questionId]?.length ? data.images[questionId] : undefined,
    }));
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignmentId: assignment.id,
        isDraft: true,
        answers,
      }),
    });
    // Throwing keeps the indicator on "error" instead of claiming "Saved".
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Failed to save draft");
    }
    savedDraftRef.current = true;
  }, [assignment]);

  const { status: autoSaveStatus, lastSavedAt, saveNow: flushAutoSave, markSaved } = useAutoSave({
    data: draft,
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
          if (data.submission.isDraft) savedDraftRef.current = true;
          if (data.submission.isDraft && data.submission.answers?.length > 0 && !draftRestoredRef.current) {
            const restored: Record<string, string> = {};
            const restoredImages: Record<string, string[]> = {};
            for (const a of data.submission.answers) {
              if (a.answer) restored[a.questionId] = a.answer;
              if (a.answerImageUrls?.length) restoredImages[a.questionId] = a.answerImageUrls;
            }
            setAnswers(restored);
            setAnswerImages(restoredImages);
            markSaved({ answers: restored, images: restoredImages });
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

  const doSubmit: (options?: { acknowledgeLate?: boolean }) => Promise<void> = useCallback(async (options: { acknowledgeLate?: boolean } = {}) => {
    if (!assignment) return;
    setSubmitting(true);
    try {
      let fileUrl: string | undefined;
      const fileToUpload = assignment.type === "FILE_UPLOAD" ? file : attachmentFile;
      if (fileToUpload) {
        const formData = new FormData();
        formData.append("file", fileToUpload);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        // Submitting after a failed upload is what made empty submissions look
        // successful, so the upload failure aborts the whole submission.
        if (!uploadRes.ok) {
          const body = await uploadRes.json().catch(() => null);
          toast.error(body?.error || "Upload failed — your work was not submitted");
          return;
        }
        fileUrl = (await uploadRes.json()).url;
      } else if (assignment.type === "FILE_UPLOAD" && !existingSubmission?.fileUrl) {
        toast.error("Attach a file before submitting this assignment");
        return;
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
          acknowledgeLate: options.acknowledgeLate,
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
        return;
      }

      const data = await res.json().catch(() => null);
      if (res.status === 409 && data?.pastDue) {
        setConfirmDialog({
          open: true,
          title: "Submit late?",
          description: `This assignment was due ${data.dueDate ? new Date(data.dueDate).toLocaleString() : "earlier"}. Your submission will be marked as late. Submit anyway?`,
          onConfirm: () => doSubmit({ acknowledgeLate: true }),
        });
        return;
      }
      toast.error(data?.error || "Submission failed");
    } catch (err) {
      console.error(err);
      toast.error("Submission failed");
    } finally {
      setSubmitting(false);
    }
  }, [assignment, file, attachmentFile, answers, answerImages, existingSubmission, isQuizInProgress, flushAutoSave]);

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
    const hasFile = Boolean(existingSubmission.fileUrl);
    requestConfirm({
      title: "Edit Submission",
      description: hasFile
        ? "This reopens your submission for editing. Your submitted file stays attached unless you upload a replacement, and you must resubmit when done. Continue?"
        : "This will reopen your submission for editing. You'll need to resubmit when done. Continue?",
      onConfirm: async () => {
        setDeletingSubmission(true);
        try {
          const res = await fetch(`/api/submissions/${existingSubmission.id}`, { method: "PATCH" });
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            toast.error(body?.error || "Failed to reopen submission");
            return;
          }
          const restored: Record<string, string> = {};
          const restoredImages: Record<string, string[]> = {};
          for (const a of existingSubmission.answers) {
            if (a.answer) restored[a.questionId] = a.answer;
            if (a.answerImageUrls?.length) restoredImages[a.questionId] = a.answerImageUrls;
          }
          setAnswers(restored);
          setAnswerImages(restoredImages);
          setExistingSubmission({ ...existingSubmission, isDraft: true });
        } catch (err) {
          console.error(err);
          toast.error("Failed to reopen submission");
        } finally {
          setDeletingSubmission(false);
        }
      },
    });
  };

  /** Keeps the panel's confirmation state in step with the server's answer. */
  const handleQuestionChange = (question: AssignmentQuestion) => {
    setAssignment((prev) =>
      prev
        ? {
            ...prev,
            questions: prev.questions.map((q) => (q.id === question.id ? question : q)),
          }
        : prev
    );
  };

  const blockedByKeyReview = () => {
    if (!assignment?.requiresKeyReview) return false;
    const unconfirmed = unconfirmedQuestionNumbers(
      assignment.questions.map((q) => ({
        order: q.order,
        keyConfirmedAt: q.keyConfirmedAt ?? null,
      }))
    );
    if (unconfirmed.length === 0) return false;
    toast.error(unconfirmedKeysMessage(unconfirmed));
    return true;
  };

  const handlePublish = () => {
    if (!assignment) return;
    if (assignment.published) {
      setUnpublishDialogOpen(true);
    } else {
      if (blockedByKeyReview()) return;
      const { subject, message } = buildAssignmentNotifyContent(assignment);
      setNotifySubject(subject);
      setNotifyMessage(message);
      setNotifyDialogOpen(true);
    }
  };

  const handleSchedule = () => {
    if (!assignment) return;
    if (blockedByKeyReview()) return;
    const { subject, message } = buildAssignmentNotifyContent(assignment);
    setNotifySubject(subject);
    setNotifyMessage(message);
    setScheduleDialogOpen(true);
  };

  const handleToggleLock = async () => {
    if (!assignment) return;
    try {
      const res = await fetch(`/api/assignments/${assignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockAfterSubmit: !assignment.lockAfterSubmit }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error || "Failed to toggle lock setting");
        return;
      }
      setAssignment({ ...assignment, lockAfterSubmit: !assignment.lockAfterSubmit });
    } catch {
      toast.error("Failed to toggle lock setting");
    }
  };

  const handleDelete = () => {
    if (!assignment) return;
    requestConfirm({
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
    autoSaveStatus, lastSavedAt, draftRestored, setDraftRestored, isQuizInProgress,
    // Appeals
    ...appealState,
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
    handlePublish, handleSchedule, handleToggleLock, handleDelete, handleExportLatex,
    handleQuestionChange,
  };
}
