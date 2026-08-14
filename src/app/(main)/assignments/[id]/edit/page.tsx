"use client";

import { StaffOnly } from "@/components/auth/StaffOnly";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AssignmentForm } from "@/components/assignments/AssignmentForm";
import type { AssignmentFormData, QuestionFormData } from "@/types/assignment";
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
import { toast } from "sonner";
import type { QuestionPayload } from "@/types/assignment";

interface DestructiveSave {
  questions: Array<{ id: string; questionText: string; answerCount: number }>;
  confirm: () => Promise<void>;
}

function EditAssignmentPageContent({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [initialData, setInitialData] = useState<Partial<AssignmentFormData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingLatex, setExportingLatex] = useState(false);
  const [pendingDestructive, setPendingDestructive] = useState<DestructiveSave | null>(null);

  useEffect(() => {
    fetch(`/api/assignments/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        const a = data.assignment;
        if (!a) {
          toast.error(data?.error || "Failed to load assignment");
          return;
        }
        setInitialData({
          title: a.title,
          description: a.description || "",
          dueDate: a.dueDate ? new Date(a.dueDate).toISOString().slice(0, 16) : "",
          type: a.type,
          totalPoints: a.totalPoints,
          lockAfterSubmit: a.lockAfterSubmit || false,
          pdfUrl: a.pdfUrl || null,
          questions: (a.questions || []).map(
            (q: {
              id: string;
              questionText: string;
              questionType: "MC" | "NUMERIC" | "FREE_RESPONSE";
              options: string[] | null;
              correctAnswer: string | null;
              points: number;
              diagram?: { type: "svg" | "mermaid"; content: string } | null;
              imageUrl?: string | null;
              tolerance?: number | null;
              toleranceUnit?: "ABSOLUTE" | "PERCENT" | null;
            }) => ({
              id: q.id,
              questionText: q.questionText,
              questionType: q.questionType,
              options: q.options || ["", "", "", ""],
              correctAnswer: q.correctAnswer || "",
              points: q.points,
              diagram: q.diagram || null,
              imageUrl: q.imageUrl || null,
              tolerance: q.tolerance ?? null,
              toleranceUnit: q.toleranceUnit ?? "ABSOLUTE",
            })
          ) as QuestionFormData[],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error("[assignment-edit] Failed to load assignment:", err);
        toast.error("Failed to load assignment");
        setLoading(false);
      });
  }, [params.id]);

  const handleSave = async (
    formData: AssignmentFormData,
    getQuestionsWithUrls: () => Promise<QuestionPayload[]>,
    publish: boolean
  ) => {
    if (!formData.title.trim()) return;
    setSaving(true);

    try {
      const questionsWithUrls = await getQuestionsWithUrls();

      const save = (confirmDestructive: boolean) =>
        fetch(`/api/assignments/${params.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            dueDate: formData.dueDate || null,
            totalPoints: formData.totalPoints,
            pdfUrl: formData.pdfUrl || null,
            lockAfterSubmit: formData.lockAfterSubmit,
            published: publish ? true : undefined,
            questions: formData.type === "QUIZ" ? questionsWithUrls : undefined,
            ...(confirmDestructive && { confirmDestructive: true }),
          }),
        });

      const res = await save(false);
      const body = await res.json().catch(() => null);

      if (!res.ok && body?.requiresConfirmation) {
        setPendingDestructive({
          questions: body.questionsWithAnswers ?? [],
          confirm: async () => {
            setPendingDestructive(null);
            setSaving(true);
            const retry = await save(true);
            if (!retry.ok) {
              const retryBody = await retry.json().catch(() => null);
              toast.error(retryBody?.error || "Failed to save assignment");
              setSaving(false);
              return;
            }
            router.push(`/assignments/${params.id}`);
          },
        });
        return;
      }

      if (!res.ok) {
        toast.error(body?.error || "Failed to save assignment");
        return;
      }

      router.push(`/assignments/${params.id}`);
    } catch (err) {
      console.error("[assignment-edit] Save failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save assignment");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <>
    <AssignmentForm
      mode="edit"
      initialData={initialData ?? undefined}
      title="Edit Assignment"
      subtitle="Modify assignment details, questions, and scoring"
      backHref={`/assignments/${params.id}`}
      submitting={saving || exportingLatex}
      showDiagrams
      renderActions={({ formData, getQuestionsWithUrls, titleValid }) => (
        <div className="flex flex-wrap justify-end gap-3 pb-8">
          <Button
            variant="outline"
            onClick={() => handleSave(formData, getQuestionsWithUrls, false)}
            disabled={saving || exportingLatex || !titleValid}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save
          </Button>
          {formData.type === "QUIZ" && (
            <Button
              variant="outline"
              onClick={async () => {
                setExportingLatex(true);
                try {
                  const res = await fetch(
                    `/api/assignments/${params.id}/export-latex`
                  );
                  if (!res.ok) throw new Error("Export failed");
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${formData.title
                    .replace(/[^a-zA-Z0-9_\- ]/g, "")
                    .replace(/\s+/g, "_")
                    .slice(0, 60)}_latex.zip`;
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
              }}
              disabled={saving || exportingLatex}
            >
              {exportingLatex ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download LaTeX
            </Button>
          )}
          <Button
            onClick={() => handleSave(formData, getQuestionsWithUrls, true)}
            disabled={saving || exportingLatex || !titleValid}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save &amp; Publish
          </Button>
        </div>
      )}
    />

    <AlertDialog
      open={pendingDestructive !== null}
      onOpenChange={(open) => { if (!open) setPendingDestructive(null); }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete answered questions?</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingDestructive?.questions.length} question(s) you removed already
            have student answers
            {pendingDestructive
              ? ` (${pendingDestructive.questions.reduce((n, q) => n + q.answerCount, 0)} answers)`
              : ""}
            . Saving deletes those answers, their grades, and any appeals on them.
            This cannot be undone. Cancel and re-add the questions if you only
            meant to reword them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => pendingDestructive?.confirm()}>
            Delete answers and save
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

export default function EditAssignmentPage(props: React.ComponentProps<typeof EditAssignmentPageContent>) {
  return (
    <StaffOnly>
      <EditAssignmentPageContent {...props} />
    </StaffOnly>
  );
}
