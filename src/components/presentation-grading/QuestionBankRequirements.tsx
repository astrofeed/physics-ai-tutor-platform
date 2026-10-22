"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { QUESTION_BANK_SOURCE_URL, QUESTION_BANK_VERSION } from "@/data/presentation-question-bank";
import { useQuestionBankSelection } from "@/hooks/useQuestionBankSelection";
import { resolveQuestionBankMatch } from "@/lib/question-bank";
import { QUESTION_BANK_TEXT as text } from "@/lib/question-bank-strings";
import { QuestionBankPicker } from "./QuestionBankPicker";

export function QuestionBankRequirements({ jobId, topic, questionBankId }: {
  jobId: string;
  topic: string;
  questionBankId: string | null;
}) {
  const headingId = useId();
  const { question, status } = resolveQuestionBankMatch(topic, questionBankId);
  const { confirm, saving } = useQuestionBankSelection(jobId);
  return (
    <section aria-labelledby={headingId} className="mt-4 space-y-3 rounded-md border border-border bg-card p-4">
      <h2 id={headingId} className="eyebrow">{text.heading}</h2>
      {question ? (
        <>
          <p className="text-body leading-relaxed">{question.whatToDo}</p>
          <p className="text-caption text-muted-foreground">
            {question.title} · Topic {question.chapter} · Track {question.track}
          </p>
          <p className="text-caption font-medium">{status === "confirmed" ? text.confirmed : text.exact}</p>
        </>
      ) : <p className="text-body text-muted-foreground">{status === "unavailable" ? text.unavailable : text.unmatched}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {status === "exact" && question ? (
          <Button type="button" size="sm" disabled={saving} onClick={() => void confirm(question.id)}>
            {saving ? text.saving : text.confirm}
          </Button>
        ) : null}
        <QuestionBankPicker topic={topic} selectedId={questionBankId} disabled={saving}
          onConfirm={(selected) => confirm(selected.id)} />
        <a href={QUESTION_BANK_SOURCE_URL} target="_blank" rel="noopener noreferrer"
          className="text-caption text-primary underline underline-offset-4">{text.source}</a>
      </div>
      <p className="text-caption text-muted-foreground">{QUESTION_BANK_VERSION}. {text.displayOnly}</p>
    </section>
  );
}
