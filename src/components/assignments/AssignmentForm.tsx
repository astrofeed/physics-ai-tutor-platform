"use client";

import React, { useState, useEffect } from "react";
import { Loader2, ArrowLeft, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { toast } from "sonner";
import type {
  AssignmentFormData,
  QuestionFormData,
  QuestionPayload,
} from "@/types/assignment";
import { useQuestionList } from "@/hooks/use-question-list";
import { QuestionsSection } from "./QuestionsSection";
import type { LatexImportMetadata } from "./LatexImportDialog";

interface AssignmentFormProps {
  /** "create" or "edit" */
  mode: "create" | "edit";
  /** Initial form data (for edit mode, pre-populated from API) */
  initialData?: Partial<AssignmentFormData>;
  /** Whether the form is in a loading/submitting state */
  submitting?: boolean;
  /** Show diagram rendering in question cards (edit mode has existing diagrams) */
  showDiagrams?: boolean;
  /** Back link URL */
  backHref: string;
  /** Page title */
  title: string;
  /** Page subtitle */
  subtitle: string;
  /** Extra content rendered after the questions section and before the actions */
  extraContent?: React.ReactNode;
  /** Render action buttons. Receives form data + helpers. */
  renderActions: (props: {
    formData: AssignmentFormData;
    getQuestionsWithUrls: () => Promise<QuestionPayload[]>;
    titleValid: boolean;
  }) => React.ReactNode;
}

export function AssignmentForm({
  mode: _mode,
  initialData,
  showDiagrams = false,
  backHref,
  title: pageTitle,
  subtitle,
  extraContent,
  renderActions,
}: AssignmentFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [dueDate, setDueDate] = useState(initialData?.dueDate ?? "");
  const [type, setType] = useState<"QUIZ" | "FILE_UPLOAD">(initialData?.type ?? "QUIZ");
  const [totalPoints, setTotalPoints] = useState(initialData?.totalPoints ?? 100);
  const {
    questions,
    setQuestions,
    addQuestion,
    moveQuestion,
    updateQuestion,
    updateOption,
    addOption,
    removeOption,
    removeQuestion,
    setImage,
    removeImage,
    importQuestions,
    getQuestionsWithUrls,
  } = useQuestionList(initialData?.questions ?? []);
  const [lockAfterSubmit, setLockAfterSubmit] = useState(initialData?.lockAfterSubmit ?? false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(initialData?.pdfUrl ?? null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Sync initialData into state when it changes (for edit mode async fetch)
  useEffect(() => {
    if (initialData) {
      if (initialData.title !== undefined) setTitle(initialData.title);
      if (initialData.description !== undefined) setDescription(initialData.description);
      if (initialData.dueDate !== undefined) setDueDate(initialData.dueDate);
      if (initialData.type !== undefined) setType(initialData.type);
      if (initialData.totalPoints !== undefined) setTotalPoints(initialData.totalPoints);
      if (initialData.questions !== undefined) setQuestions(initialData.questions);
      if (initialData.lockAfterSubmit !== undefined) setLockAfterSubmit(initialData.lockAfterSubmit);
      if (initialData.pdfUrl !== undefined) setPdfUrl(initialData.pdfUrl);
    }
  // Only re-sync when mode is edit and initialData reference changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  const handleImport = (
    imported: QuestionFormData[],
    metadata: LatexImportMetadata,
    mode: "replace" | "append"
  ) => {
    importQuestions(imported, mode);
    if (metadata.title && !title.trim()) setTitle(metadata.title);
    if (metadata.description && !description.trim()) setDescription(metadata.description);
    setTotalPoints(
      (mode === "append" ? questions : []).reduce((sum, q) => sum + q.points, 0) +
        imported.reduce((sum, q) => sum + q.points, 0)
    );
    toast.success(
      `Imported ${imported.length} question${imported.length === 1 ? "" : "s"}. Review them, then save the assignment.`
    );
  };

  const handlePdfUpload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("PDF exceeds the 20 MB limit. Please use a smaller file.");
      return;
    }
    setPdfFile(file);
    setUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setPdfUrl(data.url);
      }
    } catch (err) {
      console.error("PDF upload failed:", err);
    } finally {
      setUploadingPdf(false);
    }
  };

  const removePdf = () => {
    setPdfFile(null);
    setPdfUrl(null);
  };

  const formData: AssignmentFormData = {
    title,
    description,
    dueDate,
    type,
    totalPoints,
    lockAfterSubmit,
    pdfUrl,
    questions,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={backHref}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
          <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assignment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Homework 3: Newton's Laws"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Assignment instructions..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "QUIZ" | "FILE_UPLOAD")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="QUIZ">Quiz (Answer in browser)</SelectItem>
                  <SelectItem value="FILE_UPLOAD">File Upload</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                lang="en-US"
              />
            </div>

            <div className="space-y-2">
              <Label>Total Points</Label>
              <Input
                type="number"
                value={totalPoints}
                onChange={(e) => setTotalPoints(Number(e.target.value))}
              />
            </div>
          </div>

          <label className="flex items-center gap-3 pt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={lockAfterSubmit}
              onChange={(e) => setLockAfterSubmit(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800"
            />
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Lock after submission</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">Students cannot delete or resubmit once they submit. Useful for timed quizzes.</p>
            </div>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {type === "QUIZ" ? "Quiz PDF (Optional)" : "Assignment PDF (Optional)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-500 mb-3">
            {type === "QUIZ"
              ? "Upload a PDF with quiz content. Students will see it inline above the questions."
              : "Upload a PDF with assignment instructions. Students will see it when viewing the assignment."}
          </p>
            {pdfUrl ? (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <FileText className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="text-sm text-emerald-700 truncate flex-1">
                  {pdfFile?.name || "PDF uploaded"}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={removePdf}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-neutral-50 transition-colors">
                {uploadingPdf ? (
                  <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
                ) : (
                  <FileText className="h-8 w-8 text-neutral-300" />
                )}
                <span className="text-sm text-neutral-500">
                  {uploadingPdf ? "Uploading..." : "Click to upload a PDF"}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePdfUpload(file);
                  }}
                />
              </label>
            )}
          </CardContent>
        </Card>

      {type === "QUIZ" && (
        <QuestionsSection
          questions={questions}
          showDiagrams={showDiagrams}
          onAdd={addQuestion}
          onUpdate={updateQuestion}
          onUpdateOption={updateOption}
          onAddOption={addOption}
          onRemoveOption={removeOption}
          onMove={moveQuestion}
          onRemove={removeQuestion}
          onImageUpload={setImage}
          onRemoveImage={removeImage}
          onImport={handleImport}
        />
      )}

      {extraContent}

      {renderActions({
        formData,
        getQuestionsWithUrls,
        titleValid: !!title.trim(),
      })}
    </div>
  );
}
