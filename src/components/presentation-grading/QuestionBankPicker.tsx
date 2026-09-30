"use client";

import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { PRESENTATION_QUESTION_BANK } from "@/data/presentation-question-bank";
import { findQuestionBankCandidates, questionBankEntry } from "@/lib/question-bank";
import { QUESTION_BANK_TEXT as text } from "@/lib/question-bank-strings";
import type { QuestionBankEntry } from "@/types/question-bank";

interface PickerProps {
  topic: string;
  selectedId: string | null;
  disabled?: boolean;
  onConfirm: (question: QuestionBankEntry) => Promise<boolean> | boolean;
}

function QuestionBankSelection({ topic, selectedId, onConfirm, disabled, onClose }: PickerProps & { onClose: () => void }) {
  const [query, setQuery] = useState(topic);
  const [draftId, setDraftId] = useState(selectedId);
  const searchId = useId();
  const candidates = useMemo(() => query.trim()
    ? findQuestionBankCandidates(query).map(({ question }) => question)
    : PRESENTATION_QUESTION_BANK, [query]);
  const draft = draftId ? questionBankEntry(draftId) : null;

  const confirm = async () => {
    if (draft && await onConfirm(draft)) onClose();
  };

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={searchId}>{text.search}</Label>
        <Input id={searchId} value={query} maxLength={200} disabled={disabled}
          placeholder={text.searchPlaceholder} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <p className="text-caption text-muted-foreground" aria-live="polite">
        {query.trim() ? text.suggested : text.browse}
      </p>
      <div className="max-h-60 overflow-y-auto rounded-md border border-border">
        {candidates.length ? (
          <ul className="divide-y divide-border">
            {candidates.map((question) => (
              <li key={question.id}>
                <button type="button" aria-pressed={draftId === question.id} disabled={disabled}
                  className={`w-full px-4 py-3 text-left text-body transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${draftId === question.id ? "bg-muted" : ""}`}
                  onClick={() => setDraftId(question.id)}>
                  <span className="block font-medium">{question.title}</span>
                  <span className="text-caption text-muted-foreground">Topic {question.chapter} · Track {question.track} · {question.id}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="p-4 text-body text-muted-foreground">{text.empty}</p>}
      </div>
      {draft ? (
        <div className="space-y-2 rounded-md border border-border p-4">
          <p className="eyebrow">{text.preview}</p>
          <p className="font-medium">{draft.title}</p>
          <p className="text-body leading-relaxed"><span className="font-medium">{text.heading}: </span>{draft.whatToDo}</p>
        </div>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={disabled} onClick={onClose}>{text.cancel}</Button>
        <Button type="button" disabled={!draft || disabled} onClick={() => void confirm()}>
          {disabled ? text.saving : text.confirm}
        </Button>
      </DialogFooter>
    </>
  );
}

export function QuestionBankPicker(props: PickerProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!props.disabled) setOpen(value); }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={props.disabled}>
          {props.selectedId ? text.change : text.choose}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{text.choose}</DialogTitle>
          <DialogDescription>{text.description}</DialogDescription>
        </DialogHeader>
        {open ? <QuestionBankSelection {...props} onClose={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
