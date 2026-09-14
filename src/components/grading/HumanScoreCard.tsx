"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HumanGrading, HumanScoreEntry } from "@/lib/human-grading";
import { formatTimestamp } from "@/components/presentation-grading/job-format";

export interface HumanScoreItem {
  name: string;
  max: number;
  aiScore: number;
}

interface Props {
  items: HumanScoreItem[];
  human: HumanGrading;
  saving: boolean;
  onSave: (scores: HumanScoreEntry[]) => Promise<boolean>;
}

type Draft = Record<string, string>;

function draftFrom(items: HumanScoreItem[], saved: HumanScoreEntry[]): Draft {
  const byName = new Map(saved.map((entry) => [entry.name, entry.score]));
  return Object.fromEntries(
    items.map((item) => [item.name, byName.has(item.name) ? String(byName.get(item.name)) : ""])
  );
}

function parseDraft(items: HumanScoreItem[], draft: Draft): HumanScoreEntry[] | string {
  const scores: HumanScoreEntry[] = [];
  for (const item of items) {
    const raw = draft[item.name]?.trim() ?? "";
    if (raw === "") return `Enter a score for "${item.name}"`;
    const score = Number(raw);
    if (!Number.isFinite(score) || score < 0 || score > item.max) {
      return `"${item.name}" must be between 0 and ${item.max}`;
    }
    scores.push({ name: item.name, score });
  }
  return scores;
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * Optional staff score per rubric item, shown beside the AI's once saved so
 * the two can be compared.
 */
export function HumanScoreCard({ items, human, saving, onSave }: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(items, human.scores));
  const [editing, setEditing] = useState(human.scores.length === 0);
  const [error, setError] = useState<string | null>(null);

  const savedByName = new Map(human.scores.map((entry) => [entry.name, entry.score]));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseDraft(items, draft);
    if (typeof parsed === "string") {
      setError(parsed);
      return;
    }
    setError(null);
    if (await onSave(parsed)) setEditing(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Your scores</CardTitle>
        <span className="text-xs text-gray-500">Optional</span>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <form onSubmit={submit} className="space-y-3">
            <p className="text-sm text-gray-500">
              Enter your own score per item to compare it with the AI&apos;s. Scores can be
              changed later.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => {
                const id = `human-score-${item.name}`;
                return (
                  <div key={item.name} className="space-y-1">
                    <Label htmlFor={id} className="flex justify-between gap-2 text-sm">
                      <span>
                        {item.name} <span className="text-gray-500">/ {item.max}</span>
                      </span>
                      <span className="text-gray-500">AI {formatScore(item.aiScore)}</span>
                    </Label>
                    <Input
                      id={id}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={item.max}
                      step="any"
                      value={draft[item.name] ?? ""}
                      onChange={(e) => setDraft({ ...draft, [item.name]: e.target.value })}
                      disabled={saving}
                    />
                  </div>
                );
              })}
            </div>
            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Save scores
              </Button>
              {human.scores.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => {
                    setDraft(draftFrom(items, human.scores));
                    setError(null);
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-gray-500">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Item</th>
                    <th className="py-1 pr-3 text-right font-medium">You</th>
                    <th className="py-1 pr-3 text-right font-medium">AI</th>
                    <th className="py-1 text-right font-medium">Δ (you − AI)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const mine = savedByName.get(item.name);
                    return (
                      <tr key={item.name} className="border-t border-gray-200 dark:border-gray-800">
                        <td className="py-1.5 pr-3">
                          {item.name} <span className="text-gray-500">/ {item.max}</span>
                        </td>
                        <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">
                          {mine === undefined ? "—" : formatScore(mine)}
                        </td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">
                          {formatScore(item.aiScore)}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-gray-500">
                          {mine === undefined ? "—" : formatScore(mine - item.aiScore)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
              <span>
                {human.gradedAt ? `Saved ${formatTimestamp(human.gradedAt)}` : null}
                {human.gradedByName ? ` by ${human.gradedByName}` : null}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDraft(draftFrom(items, human.scores));
                  setEditing(true);
                }}
              >
                Edit scores
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
