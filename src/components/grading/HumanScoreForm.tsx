"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { HUMAN_COMMENTS_MAX_CHARS } from "@/lib/human-grading";
import { HUMAN_GRADING_TEXT } from "@/lib/human-grading-strings";
import type { HumanGrading, HumanScoreEntry, HumanScoresInput } from "@/types/human-grading";
import { formatScore, type HumanScoreItem, type HumanTotalItem } from "./human-score-items";

export type ScoreMode = "total" | "items";

interface Props {
  items: HumanScoreItem[];
  total: HumanTotalItem;
  human: HumanGrading;
  saving: boolean;
  onSave: (input: HumanScoresInput) => Promise<boolean>;
  onCancel: (() => void) | null;
  /** Focus the total field on open; only when the grader opened the form, so page load never scrolls here. */
  focusOnOpen: boolean;
}

type Draft = Record<string, string>;

function itemDraftFrom(items: HumanScoreItem[], saved: HumanScoreEntry[]): Draft {
  const byName = new Map(saved.map((entry) => [entry.name, entry.score]));
  return Object.fromEntries(
    items.map((item) => [item.name, byName.has(item.name) ? String(byName.get(item.name)) : ""])
  );
}

/** A finite number within [0, max]; null for anything else (blank, NaN, out of range). */
function parseBounded(raw: string, max: number): number | null {
  if (raw.trim() === "") return null;
  const score = Number(raw);
  return Number.isFinite(score) && score >= 0 && score <= max ? score : null;
}

function parseItems(items: HumanScoreItem[], draft: Draft): HumanScoresInput | string {
  const scores: HumanScoreEntry[] = [];
  for (const item of items) {
    const score = parseBounded(draft[item.name] ?? "", item.max);
    if (score === null) return HUMAN_GRADING_TEXT.scoreOutOfRange(`"${item.name}"`, item.max);
    scores.push({ name: item.name, score });
  }
  return { scores };
}

function parseTotal(raw: string, max: number): HumanScoresInput | string {
  const total = parseBounded(raw, max);
  return total === null ? HUMAN_GRADING_TEXT.scoreOutOfRange(HUMAN_GRADING_TEXT.total, max) : { total };
}

function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: ScoreMode;
  onChange: (mode: ScoreMode) => void;
  disabled: boolean;
}) {
  const options: { value: ScoreMode; label: string }[] = [
    { value: "total", label: HUMAN_GRADING_TEXT.totalOnly },
    { value: "items", label: HUMAN_GRADING_TEXT.perItem },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={HUMAN_GRADING_TEXT.scoringMode}
      className="inline-flex rounded-md border border-gray-200 p-0.5 text-xs dark:border-gray-800"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={mode === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded px-2.5 py-1 font-medium transition-colors",
            mode === option.value
              ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
              : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Staff score entry: one overall total (the quick option between back-to-back
 * talks) or a score per rubric item, each shown beside the AI's.
 */
export function HumanScoreForm({
  items,
  total,
  human,
  saving,
  onSave,
  onCancel,
  focusOnOpen,
}: Props) {
  const [mode, setMode] = useState<ScoreMode>(human.scores.length > 0 ? "items" : "total");
  const [itemDraft, setItemDraft] = useState<Draft>(() => itemDraftFrom(items, human.scores));
  const [totalDraft, setTotalDraft] = useState(human.total === null ? "" : String(human.total));
  const [comments, setComments] = useState(human.comments ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = mode === "total" ? parseTotal(totalDraft, total.max) : parseItems(items, itemDraft);
    if (typeof parsed === "string") {
      setError(parsed);
      return;
    }
    setError(null);
    await onSave({ ...parsed, comments });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          {mode === "total" ? HUMAN_GRADING_TEXT.totalHint : HUMAN_GRADING_TEXT.itemsHint}
        </p>
        <ModeToggle mode={mode} onChange={setMode} disabled={saving} />
      </div>

      {mode === "total" ? (
        <div className="max-w-xs space-y-1">
          <Label htmlFor="human-total" className="flex justify-between gap-2 text-sm">
            <span>
              {HUMAN_GRADING_TEXT.total} <span className="text-gray-500">/ {total.max}</span>
            </span>
            {total.aiScore !== null ? (
              <span className="text-gray-500">{HUMAN_GRADING_TEXT.ai} {formatScore(total.aiScore)}</span>
            ) : null}
          </Label>
          <Input
            id="human-total"
            type="number"
            inputMode="decimal"
            min={0}
            max={total.max}
            step="any"
            autoFocus={focusOnOpen}
            value={totalDraft}
            onChange={(e) => setTotalDraft(e.target.value)}
            disabled={saving}
            className="text-lg"
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => {
            const id = `human-score-${item.name}`;
            return (
              <div key={item.name} className="space-y-1">
                <Label htmlFor={id} className="flex justify-between gap-2 text-sm">
                  <span>
                    {item.name} <span className="text-gray-500">/ {item.max}</span>
                  </span>
                  <span className="text-gray-500">{HUMAN_GRADING_TEXT.ai} {formatScore(item.aiScore)}</span>
                </Label>
                <Input
                  id={id}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={item.max}
                  step="any"
                  value={itemDraft[item.name] ?? ""}
                  onChange={(e) => setItemDraft({ ...itemDraft, [item.name]: e.target.value })}
                  disabled={saving}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="human-comments">{HUMAN_GRADING_TEXT.comments}</Label>
        <Textarea
          id="human-comments"
          value={comments}
          onChange={(event) => setComments(event.target.value)}
          rows={5}
          maxLength={HUMAN_COMMENTS_MAX_CHARS}
          disabled={saving}
          aria-describedby="human-comments-hint human-comments-count"
          placeholder={HUMAN_GRADING_TEXT.commentsPlaceholder}
          className="resize-y rounded-md shadow-none"
        />
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <p id="human-comments-hint" className="max-w-prose">{HUMAN_GRADING_TEXT.commentsHint}</p>
          <span id="human-comments-count" className="tabular-nums">{comments.length} / {HUMAN_COMMENTS_MAX_CHARS}</span>
        </div>
      </div>
      {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          {HUMAN_GRADING_TEXT.save}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={onCancel}>
            {HUMAN_GRADING_TEXT.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
