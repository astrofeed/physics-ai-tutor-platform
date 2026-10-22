"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { humanTotalOf } from "@/lib/human-grading";
import { HUMAN_GRADING_TEXT } from "@/lib/human-grading-strings";
import type { HumanGrading, HumanScoreEntry, HumanScoresInput } from "@/types/human-grading";
import { formatTimestamp } from "@/components/presentation-grading/job-format";
import { HumanScoreForm } from "./HumanScoreForm";
import { formatScore, type HumanScoreItem, type HumanTotalItem } from "./human-score-items";

interface Props {
  items: HumanScoreItem[];
  total: HumanTotalItem;
  /** How per-item scores roll up to a total on `total.max`'s scale. */
  totalFromItems: (scores: HumanScoreEntry[]) => number | null;
  human: HumanGrading;
  saving: boolean;
  onSave: (input: HumanScoresInput) => Promise<boolean>;
}

interface Row {
  label: string;
  max: number;
  mine: number | null;
  ai: number | null;
  emphasis: boolean;
}

function ScoreCell({ value }: { value: number | null }) {
  return <>{value === null ? "—" : formatScore(value)}</>;
}

function ComparisonTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-gray-500">
          <tr>
            <th className="py-1 pr-3 font-medium">{HUMAN_GRADING_TEXT.item}</th>
            <th className="py-1 pr-3 text-right font-medium">{HUMAN_GRADING_TEXT.you}</th>
            <th className="py-1 pr-3 text-right font-medium">{HUMAN_GRADING_TEXT.ai}</th>
            <th className="py-1 text-right font-medium">{HUMAN_GRADING_TEXT.difference}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className={
                row.emphasis
                  ? "border-t-2 border-gray-300 font-semibold dark:border-gray-700"
                  : "border-t border-gray-200 dark:border-gray-800"
              }
            >
              <td className="py-1.5 pr-3">
                {row.label} <span className="font-normal text-gray-500">/ {row.max}</span>
              </td>
              <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">
                <ScoreCell value={row.mine} />
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums">
                <ScoreCell value={row.ai} />
              </td>
              <td className="py-1.5 text-right tabular-nums text-gray-500">
                <ScoreCell value={row.mine !== null && row.ai !== null ? row.mine - row.ai : null} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Optional staff score — one overall total or one score per rubric item —
 * shown beside the AI's once saved so the two can be compared.
 */
export function HumanScoreCard({ items, total, totalFromItems, human, saving, onSave }: Props) {
  const graded = human.scores.length > 0 || human.total !== null;
  const [editing, setEditing] = useState(!graded);
  const [openedByGrader, setOpenedByGrader] = useState(false);

  const savedByName = new Map(human.scores.map((entry) => [entry.name, entry.score]));
  const rows: Row[] = [
    ...(human.scores.length > 0
      ? items.map((item) => ({
          label: item.name,
          max: item.max,
          mine: savedByName.get(item.name) ?? null,
          ai: item.aiScore,
          emphasis: false,
        }))
      : []),
    {
      label: HUMAN_GRADING_TEXT.total,
      max: total.max,
      mine: humanTotalOf(human, totalFromItems),
      ai: total.aiScore,
      emphasis: true,
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{HUMAN_GRADING_TEXT.title}</CardTitle>
        <span className="text-xs text-gray-500">{HUMAN_GRADING_TEXT.optional}</span>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <HumanScoreForm
            items={items}
            total={total}
            human={human}
            saving={saving}
            onSave={async (input) => {
              const ok = await onSave(input);
              if (ok) setEditing(false);
              return ok;
            }}
            onCancel={graded ? () => setEditing(false) : null}
            focusOnOpen={openedByGrader}
          />
        ) : (
          <>
            <ComparisonTable rows={rows} />
            {human.comments ? (
              <section aria-label={HUMAN_GRADING_TEXT.savedComments} className="space-y-2 border-t border-border pt-4">
                <h3 className="text-sm font-medium">{HUMAN_GRADING_TEXT.savedComments}</h3>
                <p className="whitespace-pre-wrap break-words text-sm">{human.comments}</p>
              </section>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
              <span>
                {human.gradedAt ? HUMAN_GRADING_TEXT.savedAt(formatTimestamp(human.gradedAt)) : null}
                {human.gradedByName ? HUMAN_GRADING_TEXT.savedBy(human.gradedByName) : null}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setOpenedByGrader(true);
                  setEditing(true);
                }}
              >
                {HUMAN_GRADING_TEXT.edit}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
