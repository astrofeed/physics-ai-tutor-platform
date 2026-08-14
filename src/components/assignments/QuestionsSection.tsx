"use client";

import { useState } from "react";
import { FileUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { QuestionFormData } from "@/types/assignment";
import { QuestionCard } from "./QuestionCard";
import { LatexImportDialog, type LatexImportMetadata } from "./LatexImportDialog";

interface QuestionsSectionProps {
  questions: QuestionFormData[];
  showDiagrams: boolean;
  onAdd: () => void;
  onUpdate: (index: number, field: keyof QuestionFormData, value: unknown) => void;
  onUpdateOption: (qIndex: number, oIndex: number, value: string) => void;
  onMove: (index: number, direction: "up" | "down") => void;
  onRemove: (index: number) => void;
  onImageUpload: (index: number, file: File) => void;
  onRemoveImage: (index: number) => void;
  onImport: (
    questions: QuestionFormData[],
    metadata: LatexImportMetadata,
    mode: "replace" | "append"
  ) => void;
}

export function QuestionsSection({
  questions,
  showDiagrams,
  onAdd,
  onUpdate,
  onUpdateOption,
  onMove,
  onRemove,
  onImageUpload,
  onRemoveImage,
  onImport,
}: QuestionsSectionProps) {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Questions</h2>
        <div className="flex gap-2">
          <Button
            onClick={() => setImportOpen(true)}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <FileUp className="h-4 w-4" />
            Import from LaTeX
          </Button>
          <Button onClick={onAdd} variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Question
          </Button>
        </div>
      </div>

      {questions.map((question, index) => (
        <QuestionCard
          key={index}
          question={question}
          index={index}
          totalQuestions={questions.length}
          showDiagrams={showDiagrams}
          onUpdate={(field, value) => onUpdate(index, field, value)}
          onUpdateOption={(oIndex, value) => onUpdateOption(index, oIndex, value)}
          onMove={(direction) => onMove(index, direction)}
          onRemove={() => onRemove(index)}
          onImageUpload={(file) => onImageUpload(index, file)}
          onRemoveImage={() => onRemoveImage(index)}
        />
      ))}

      {questions.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-neutral-400">
              No questions yet. Click &ldquo;Add Question&rdquo; to start building your quiz,
              or import a LaTeX file.
            </p>
          </CardContent>
        </Card>
      )}

      <LatexImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        existingQuestions={questions.length}
        onImport={onImport}
      />
    </div>
  );
}
