"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { QuestionFormData, QuestionPayload } from "@/types/assignment";
import { MAX_MC_OPTIONS, MIN_MC_OPTIONS, compactMcOptions } from "@/lib/mc-answer-key";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_OPTIONS = ["", "", "", ""];

const EMPTY_QUESTION: QuestionFormData = {
  questionText: "",
  questionType: "MC",
  options: DEFAULT_OPTIONS,
  correctAnswer: "",
  points: 10,
  tolerance: null,
  toleranceUnit: "ABSOLUTE",
};

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Failed to upload a question image");
  }
  return (await res.json()).url;
}

/** Owns the authored question list, including staged images and their upload on save. */
export function useQuestionList(initial: QuestionFormData[] = []) {
  const [questions, setQuestions] = useState<QuestionFormData[]>(initial);

  const addQuestion = useCallback(() => {
    setQuestions((prev) => [...prev, { ...EMPTY_QUESTION, options: [...DEFAULT_OPTIONS] }]);
  }, []);

  const moveQuestion = useCallback((index: number, direction: "up" | "down") => {
    setQuestions((prev) => {
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const updateQuestion = useCallback(
    (index: number, field: keyof QuestionFormData, value: unknown) => {
      setQuestions((prev) =>
        prev.map((q, i) => (i === index ? { ...q, [field]: value } : q))
      );
    },
    []
  );

  const updateOption = useCallback((qIndex: number, oIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const options = [...q.options];
        options[oIndex] = value;
        return { ...q, options };
      })
    );
  }, []);

  const addOption = useCallback((qIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex && q.options.length < MAX_MC_OPTIONS
          ? { ...q, options: [...q.options, ""] }
          : q
      )
    );
  }, []);

  /** Removing an option shifts the letters after it, so the answer key moves with them. */
  const removeOption = useCallback((qIndex: number, oIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex || q.options.length <= MIN_MC_OPTIONS) return q;
        const options = q.options.filter((_, index) => index !== oIndex);
        const dropped = q.options.map((option, index) => (index === oIndex ? "" : option));
        return { ...q, options, correctAnswer: compactMcOptions(dropped, q.correctAnswer).correctAnswer };
      })
    );
  }, []);

  const removeQuestion = useCallback((index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const setImage = useCallback((qIndex: number, file: File) => {
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image exceeds the 5 MB limit. Please use a smaller image.");
      return;
    }
    const preview = URL.createObjectURL(file);
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, imageFile: file, imagePreview: preview } : q))
    );
  }, []);

  const removeImage = useCallback((qIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex ? { ...q, imageFile: null, imagePreview: null, imageUrl: null } : q
      )
    );
  }, []);

  const importQuestions = useCallback(
    (imported: QuestionFormData[], mode: "replace" | "append") => {
      setQuestions((prev) => (mode === "append" ? [...prev, ...imported] : imported));
    },
    []
  );

  /** Uploads staged images, then returns the questions in the shape the API accepts. */
  const getQuestionsWithUrls = useCallback(
    (): Promise<QuestionPayload[]> =>
      Promise.all(
        questions.map(async (q) => {
          const imageUrl = q.imageFile ? await uploadImage(q.imageFile) : q.imageUrl || undefined;
          return {
            ...(q.id && { id: q.id }),
            questionText: q.questionText,
            questionType: q.questionType,
            options: q.options,
            correctAnswer: q.correctAnswer,
            points: q.points,
            ...(q.diagram && { diagram: q.diagram }),
            ...(imageUrl && { imageUrl }),
            tolerance: q.questionType === "NUMERIC" ? q.tolerance ?? null : null,
            toleranceUnit: q.toleranceUnit ?? "ABSOLUTE",
          };
        })
      ),
    [questions]
  );

  return {
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
  };
}
