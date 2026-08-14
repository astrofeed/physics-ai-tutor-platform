"use client";

import { useState } from "react";
import { AlertTriangle, Download, FileUp, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { readLatexImport, type LatexImport } from "@/lib/latex-import-archive";
import {
  LATEX_IMPORT_EXAMPLE,
  LATEX_IMPORT_EXAMPLE_FILENAME,
} from "@/lib/latex-import-example";
import { LatexImportError } from "@/lib/latex-import";
import type { QuestionFormData } from "@/types/assignment";

export interface LatexImportMetadata {
  title: string | null;
  description: string;
}

interface LatexImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Number of questions already in the form, which decides replace vs. append. */
  existingQuestions: number;
  onImport: (
    questions: QuestionFormData[],
    metadata: LatexImportMetadata,
    mode: "replace" | "append"
  ) => void;
}

const TYPE_LABELS: Record<QuestionFormData["questionType"], string> = {
  MC: "Multiple choice",
  NUMERIC: "Numeric",
  FREE_RESPONSE: "Free response",
};

function downloadExample() {
  const url = URL.createObjectURL(
    new Blob([LATEX_IMPORT_EXAMPLE], { type: "text/x-tex" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = LATEX_IMPORT_EXAMPLE_FILENAME;
  link.click();
  URL.revokeObjectURL(url);
}

function Instructions() {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
      <p className="flex items-center gap-1.5 font-medium">
        <Info className="h-3.5 w-3.5" />
        How to prepare the file
      </p>
      <ul className="mt-2 space-y-1 list-disc pl-4">
        <li>
          Start each question with <code>\textbf{"{Question 1}"} (10 points)</code> or{" "}
          <code>\question[10]</code>. Without a point value the question gets 10 points.
        </li>
        <li>
          List multiple-choice options in an <code>enumerate</code>, <code>itemize</code>{" "}
          or <code>choices</code> environment — that is what makes a question multiple choice.
        </li>
        <li>
          Write the reference answer as <code>\textbf{"{Answer:}"} B</code>. For
          multiple choice you may write the option letter, its number, or the option text;
          all three are converted to the letter. A numeric answer becomes a numeric
          question, anything else becomes free response.
        </li>
        <li>
          <code>\title</code> fills in the assignment title, and a second title line,{" "}
          <code>\subtitle</code> or the text before the first question fills in the
          description. <code>\section*{"{Part A}"}</code> stays a heading, never a question.
        </li>
        <li>
          Images cannot travel inside a <code>.tex</code> file. Upload the{" "}
          <code>.zip</code> from “Export LaTeX” to bring figures along, or attach them to
          the questions after importing.
        </li>
      </ul>
      <button
        type="button"
        onClick={downloadExample}
        className="mt-2 inline-flex items-center gap-1.5 font-medium underline"
      >
        <Download className="h-3.5 w-3.5" />
        Download an example .tex
      </button>
    </div>
  );
}

function Preview({ result }: { result: LatexImport }) {
  const errors = result.issues.filter((issue) => issue.severity === "error");

  return (
    <div className="space-y-3">
      <div className="rounded-lg border p-3 text-sm dark:border-neutral-700">
        <p className="font-medium">
          {result.formQuestions.length} question
          {result.formQuestions.length === 1 ? "" : "s"} ready to import
          {errors.length > 0 && `, ${errors.length} skipped`}
        </p>
        {result.title && (
          <p className="mt-1 text-xs text-neutral-500">Title: {result.title}</p>
        )}
        <ol className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
          {result.formQuestions.map((question, index) => (
            <li key={index} className="truncate">
              {index + 1}. [{TYPE_LABELS[question.questionType]} ·{" "}
              {question.points} pt
              {question.correctAnswer ? ` · answer ${question.correctAnswer}` : " · no answer"}
              ] {question.questionText.replace(/[#*]/g, "")}
            </li>
          ))}
        </ol>
      </div>

      {result.issues.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            {result.issues.length} thing
            {result.issues.length === 1 ? "" : "s"} to check after importing
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-900 dark:text-amber-200">
            {result.issues.map((issue, index) => (
              <li key={index}>
                <span className="font-medium">
                  Question {issue.questionNumber}
                  {issue.severity === "error" ? " (skipped)" : ""}:
                </span>{" "}
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function LatexImportDialog({
  open,
  onOpenChange,
  existingQuestions,
  onImport,
}: LatexImportDialogProps) {
  const [tex, setTex] = useState("");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LatexImport | null>(null);

  const reset = () => {
    setTex("");
    setError(null);
    setResult(null);
  };

  const parse = async (source: File | string) => {
    setParsing(true);
    setError(null);
    try {
      setResult(await readLatexImport(source));
    } catch (err) {
      setResult(null);
      setError(
        err instanceof LatexImportError
          ? err.message
          : "The file could not be read. Upload a .tex file, the .zip from “Export LaTeX”, or paste the LaTeX source."
      );
    } finally {
      setParsing(false);
    }
  };

  const importQuestions = (mode: "replace" | "append") => {
    if (!result) return;
    onImport(
      result.formQuestions,
      { title: result.title, description: result.description },
      mode
    );
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import questions from LaTeX</DialogTitle>
          <DialogDescription>
            Upload a .tex file or the .zip from “Export LaTeX”, or paste the source
            below. Nothing is saved until you save the assignment, so you can edit
            every imported question first.
          </DialogDescription>
        </DialogHeader>

        <Instructions />

        <div className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900">
            {parsing ? (
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            ) : (
              <FileUp className="h-6 w-6 text-neutral-300" />
            )}
            <span className="text-sm text-neutral-500">
              {parsing ? "Reading…" : "Click to choose a .tex or .zip file"}
            </span>
            <input
              type="file"
              className="hidden"
              accept=".tex,.zip"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) parse(file);
              }}
            />
          </label>

          <Textarea
            value={tex}
            onChange={(event) => setTex(event.target.value)}
            placeholder="…or paste the LaTeX source here"
            rows={5}
            className="font-mono text-xs"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!tex.trim() || parsing}
            onClick={() => parse(tex)}
          >
            Parse pasted LaTeX
          </Button>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {result && <Preview result={result} />}

        {result && result.formQuestions.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {existingQuestions > 0 && (
              <Button variant="outline" onClick={() => importQuestions("append")}>
                Add after the {existingQuestions} existing question
                {existingQuestions === 1 ? "" : "s"}
              </Button>
            )}
            <Button onClick={() => importQuestions("replace")}>
              {existingQuestions > 0
                ? `Replace all ${existingQuestions} question${existingQuestions === 1 ? "" : "s"}`
                : `Import ${result.formQuestions.length} question${result.formQuestions.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
