"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { presentationJobKey, updatePresentationJob } from "@/hooks/usePresentationGrading";
import { QUESTION_BANK_TEXT } from "@/lib/question-bank-strings";
import type { PresentationJobDetail } from "@/types/presentation-grading";

export function useQuestionBankSelection(jobId: string) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (questionBankId: string) => updatePresentationJob(jobId, { questionBankId }),
    onSuccess: async (_, questionBankId) => {
      await client.cancelQueries({ queryKey: presentationJobKey(jobId) });
      client.setQueryData<PresentationJobDetail>(presentationJobKey(jobId), (job) => job ? { ...job, questionBankId } : job);
      toast.success(QUESTION_BANK_TEXT.saved);
    },
  });

  const confirm = async (questionBankId: string) => {
    try {
      await mutation.mutateAsync(questionBankId);
      return true;
    } catch (error) {
      console.error("[presentation-grading:question-bank]", { jobId, questionBankId, error });
      toast.error(QUESTION_BANK_TEXT.saveError);
      return false;
    }
  };
  return { confirm, saving: mutation.isPending };
}
