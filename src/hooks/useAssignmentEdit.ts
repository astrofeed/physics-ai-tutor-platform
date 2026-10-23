"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { AssignmentDetail, AssignmentFormData } from "@/types/assignment";

function assignmentFormData(assignment: AssignmentDetail): AssignmentFormData {
  return {
    title: assignment.title,
    description: assignment.description || "",
    dueDate: assignment.dueDate ? new Date(assignment.dueDate).toISOString().slice(0, 16) : "",
    type: assignment.type,
    totalPoints: assignment.totalPoints,
    lockAfterSubmit: assignment.lockAfterSubmit || false,
    pdfUrl: assignment.pdfUrl || null,
    questions: assignment.questions.map((question) => ({
      id: question.id,
      questionText: question.questionText,
      questionType: question.questionType,
      options: question.options || ["", "", "", ""],
      correctAnswer: question.correctAnswer || "",
      alsoAcceptedAnswers: question.alsoAcceptedAnswers ?? [],
      points: question.points,
      diagram: question.diagram || null,
      imageUrl: question.imageUrl || null,
      tolerance: question.tolerance ?? null,
      toleranceUnit: question.toleranceUnit ?? "ABSOLUTE",
    })),
  };
}

export function useAssignmentEdit(assignmentId: string) {
  return useQuery({
    queryKey: ["assignment-edit", assignmentId],
    queryFn: async () => (await api.get<{ assignment: AssignmentDetail }>(`/api/assignments/${assignmentId}`)).assignment,
    select: assignmentFormData,
    // Keep one snapshot while editing; fetch fresh data on the next visit.
    staleTime: Infinity,
    gcTime: 0,
  });
}
