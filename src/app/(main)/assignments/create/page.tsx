"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Download, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotifyUsersDialog } from "@/components/ui/notify-users-dialog";
import { AssignmentForm, type AssignmentFormData } from "@/components/assignments/AssignmentForm";
import { toast } from "sonner";
import { buildAssignmentNotifyContent } from "@/lib/utils";

export default function CreateAssignmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [exportingLatex, setExportingLatex] = useState(false);
  const createdIdRef = useRef<string | null>(null);
  const [isScheduleMode, setIsScheduleMode] = useState(false);

  // Reminder dialog state
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderSubject, setReminderSubject] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");

  // Stores pending publish data — assignment is created only when the user confirms in the dialog
  const pendingPublishRef = useRef<{
    formData: AssignmentFormData;
    questions: Array<{
      questionText: string;
      questionType: string;
      options: string[];
      correctAnswer: string;
      points: number;
      diagram?: unknown;
      imageUrl?: string;
    }>;
    schedule: boolean;
  } | null>(null);

  /** Build the POST body for creating an assignment — single source of truth */
  const buildCreateBody = (
    formData: AssignmentFormData,
    questions: Array<{ questionText: string; questionType: string; options: string[]; correctAnswer: string; points: number; diagram?: unknown; imageUrl?: string }>,
    extra?: Record<string, unknown>,
  ) => ({
    title: formData.title,
    description: formData.description,
    dueDate: formData.dueDate || null,
    type: formData.type,
    totalPoints: formData.totalPoints,
    pdfUrl: formData.pdfUrl || null,
    lockAfterSubmit: formData.lockAfterSubmit,
    questions: formData.type === "QUIZ" ? questions : [],
    ...extra,
  });

  /** POST to /api/assignments and return the new id */
  const postAssignment = async (body: Record<string, unknown>): Promise<string> => {
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || "Failed to create assignment");
    }
    const data = await res.json();
    return data.assignment.id as string;
  };

  const createAssignment = async (scheduledPublishAt?: string, notifyOnPublish?: boolean) => {
    const pending = pendingPublishRef.current;
    if (!pending) return null;
    const extra: Record<string, unknown> = {};
    if (scheduledPublishAt) extra.scheduledPublishAt = scheduledPublishAt;
    if (notifyOnPublish) extra.notifyOnPublish = true;
    const body = buildCreateBody(pending.formData, pending.questions, Object.keys(extra).length > 0 ? extra : undefined);
    const id = await postAssignment(body);
    pendingPublishRef.current = null;
    return id;
  };

  const handleSubmit = async (
    formData: AssignmentFormData,
    getQuestionsWithUrls: () => Promise<Array<{
      questionText: string;
      questionType: string;
      options: string[];
      correctAnswer: string;
      points: number;
      diagram?: unknown;
      imageUrl?: string;
    }>>,
    publish: boolean,
    schedule?: boolean,
  ) => {
    if (!formData.title.trim()) {
      toast.error("Please enter a title for the assignment");
      return;
    }

    setLoading(true);

    try {
      const questionsWithUrls = await getQuestionsWithUrls();

      if (publish || schedule) {
        // Store pending data — assignment will be created when user confirms in the dialog
        pendingPublishRef.current = { formData, questions: questionsWithUrls, schedule: !!schedule };

        const { subject, message } = buildAssignmentNotifyContent({
          title: formData.title,
          description: formData.description,
          dueDate: formData.dueDate || null,
          totalPoints: formData.totalPoints,
        });
        setReminderSubject(subject);
        setReminderMessage(message);

        if (schedule) {
          setIsScheduleMode(true);
        } else {
          setIsScheduleMode(false);
        }

        setReminderOpen(true);
      } else {
        // Save as Draft: create immediately and redirect
        const body = buildCreateBody(formData, questionsWithUrls);
        const id = await postAssignment(body);
        router.push(`/assignments/${id}`);
        router.refresh();
      }
    } catch (err) {
      console.error("Create assignment error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to create assignment");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndExportLatex = async (
    formData: AssignmentFormData,
    getQuestionsWithUrls: () => Promise<Array<{
      questionText: string;
      questionType: string;
      options: string[];
      correctAnswer: string;
      points: number;
      diagram?: unknown;
      imageUrl?: string;
    }>>,
  ) => {
    if (!formData.title.trim()) {
      toast.error("Please enter a title for the assignment");
      return;
    }
    setExportingLatex(true);

    try {
      const questionsWithUrls = await getQuestionsWithUrls();

      // Create assignment as draft
      const body = buildCreateBody(formData, questionsWithUrls);
      const newId = await postAssignment(body);

      // Fetch LaTeX export
      const exportRes = await fetch(`/api/assignments/${newId}/export-latex`);
      if (!exportRes.ok) throw new Error("Export failed");

      const blob = await exportRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${formData.title.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_").slice(0, 60)}_latex.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Redirect to the new assignment
      router.push(`/assignments/${newId}`);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save and export LaTeX");
    } finally {
      setExportingLatex(false);
    }
  };

  return (
    <>
      <AssignmentForm
        mode="create"
        title="Create Assignment"
        subtitle="Set up a new assignment or quiz for students"
        backHref="/assignments"
        submitting={loading || exportingLatex}
        renderActions={({ formData, getQuestionsWithUrls, titleValid }) => (
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-end gap-3 pb-8">
            <Button
              variant="outline"
              onClick={() => handleSubmit(formData, getQuestionsWithUrls, false)}
              disabled={loading || exportingLatex || !titleValid}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save as Draft
            </Button>
            {formData.type === "QUIZ" && (
              <Button
                variant="outline"
                onClick={() => handleSaveAndExportLatex(formData, getQuestionsWithUrls)}
                disabled={loading || exportingLatex || !titleValid}
              >
                {exportingLatex ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Save & Download LaTeX
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => handleSubmit(formData, getQuestionsWithUrls, false, true)}
              disabled={loading || exportingLatex || !titleValid}
              className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950"
            >
              <CalendarClock className="h-4 w-4" />
              Schedule Publish
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSubmit(formData, getQuestionsWithUrls, true)}
              disabled={loading || exportingLatex || !titleValid}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Publish
            </Button>
          </div>
        )}
      />

      {/* Publish & Notify Dialog (immediate publish) */}
      {!isScheduleMode && (
        <NotifyUsersDialog
          open={reminderOpen}
          onOpenChange={setReminderOpen}
          defaultSubject={reminderSubject}
          defaultMessage={reminderMessage}
          dialogTitle="Publish & Notify"
          dialogDescription="Select who to notify about this assignment. Optionally also send an email."
          sendButtonLabel="Notify & Publish"
          skipButtonLabel="Skip Notification & Publish"
          onSkip={async () => {
            try {
              const id = await createAssignment();
              if (!id) return;
              await fetch(`/api/assignments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ published: true }),
              });
              router.push(`/assignments/${id}`);
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed to create assignment");
            }
          }}
          onBeforeSend={async (subj, msg, { audienceRoles }) => {
            const id = await createAssignment();
            if (!id) return;
            createdIdRef.current = id;
            await fetch(`/api/assignments/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ published: true }),
            });
            await fetch("/api/notifications", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: subj, message: msg, audienceRoles }),
            });
          }}
          onSent={() => {
            const target = createdIdRef.current ? `/assignments/${createdIdRef.current}` : "/assignments";
            router.push(target);
            router.refresh();
          }}
        />
      )}

      {/* Schedule Publish Dialog — same flow as publish but with datetime picker */}
      {isScheduleMode && (
        <NotifyUsersDialog
          open={reminderOpen}
          onOpenChange={setReminderOpen}
          defaultSubject={reminderSubject}
          defaultMessage={reminderMessage}
          schedulePublishMode
          dialogTitle="Schedule Publish"
          dialogDescription="Set a publish time and select who to notify when it goes live."
          sendButtonLabel="Notify & Schedule"
          skipButtonLabel="Skip Notification & Schedule"
          onBeforeSend={async (_subj, _msg, { scheduledAt }) => {
            const id = await createAssignment(scheduledAt, true);
            if (!id) return;
            createdIdRef.current = id;
            return id;
          }}
          onSkip={async (scheduledAt) => {
            try {
              const id = await createAssignment(scheduledAt, true);
              if (!id) return;
              toast.success(`Assignment scheduled for ${new Date(scheduledAt!).toLocaleString()}`);
              router.push(`/assignments/${id}`);
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed to create assignment");
            }
          }}
          onSent={() => {
            const target = createdIdRef.current ? `/assignments/${createdIdRef.current}` : "/assignments";
            router.push(target);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
