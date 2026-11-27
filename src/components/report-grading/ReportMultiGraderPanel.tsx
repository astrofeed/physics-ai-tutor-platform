"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HumanScoreCard } from "@/components/grading/HumanScoreCard";
import { HumanScoreForm } from "@/components/grading/HumanScoreForm";
import { formatScore, type HumanScoreItem, type HumanTotalItem } from "@/components/grading/human-score-items";
import { formatTimestamp } from "@/components/presentation-grading/job-format";
import { GRADER_LABEL_MAX_CHARS, humanTotalOf } from "@/lib/human-grading";
import type {
  HumanGrading,
  HumanScoreEntry,
  HumanScoresInput,
  ReportHumanReviewDetail,
} from "@/types/human-grading";

interface Props {
  items: HumanScoreItem[];
  total: HumanTotalItem;
  totalFromItems: (scores: HumanScoreEntry[]) => number | null;
  myReview: HumanGrading;
  allReviews: ReportHumanReviewDetail[];
  aiScoresVisible: boolean;
  saving: boolean;
  onSaveMine: (input: HumanScoresInput) => Promise<boolean>;
  onAddExtra: (input: HumanScoresInput & { graderLabel?: string }) => Promise<boolean>;
  onDeleteReview: (reviewId: string) => Promise<boolean>;
}

const EMPTY_REVIEW: HumanGrading = {
  scores: [],
  total: null,
  comments: null,
  gradedAt: null,
  gradedByName: null,
  aiRevealedAt: null,
};

function graderDisplayName(review: ReportHumanReviewDetail, fallbackIndex: number): string {
  return review.graderLabel?.trim() || review.graderName || `Grader ${fallbackIndex + 1}`;
}

export function ReportMultiGraderPanel({
  items,
  total,
  totalFromItems,
  myReview,
  allReviews,
  aiScoresVisible,
  saving,
  onSaveMine,
  onAddExtra,
  onDeleteReview,
}: Props) {
  const [showOthers, setShowOthers] = useState(false);
  const [addingSlot, setAddingSlot] = useState(false);
  const [extraLabel, setExtraLabel] = useState("");

  const gradedReviews = allReviews.filter(
    (r) => r.gradedAt !== null || r.total !== null || r.scores.length > 0
  );
  const otherGradedReviews = gradedReviews.filter((r) => !r.isMine);

  const reviewTotals = gradedReviews
    .map((r) => humanTotalOf(r, totalFromItems))
    .filter((v): v is number => v !== null);
  const averageTotal =
    reviewTotals.length > 0
      ? reviewTotals.reduce((sum, v) => sum + v, 0) / reviewTotals.length
      : null;

  return (
    <div className="space-y-6">
      <HumanScoreCard
        items={items}
        total={total}
        totalFromItems={totalFromItems}
        human={myReview}
        saving={saving}
        onSave={onSaveMine}
        hideAiScores={!aiScoresVisible}
        borderless
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => setAddingSlot((open) => !open)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {addingSlot ? "Close extra grader slot" : "Add another grader score"}
          </Button>
          <span className="text-xs text-gray-500">
            Signed-in graders automatically get their own slot.
          </span>
        </div>

        {addingSlot ? (
          <div
            data-testid="extra-grader-card"
            className="border-l-2 border-gray-300 pl-4 space-y-4 dark:border-gray-700"
          >
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Additional Grader Score
            </p>
            <div className="max-w-xs space-y-1">
              <Label htmlFor="extra-grader-label" className="text-sm">
                Grader name / label (optional)
              </Label>
              <Input
                id="extra-grader-label"
                placeholder="e.g. TA 2 or Prof. Lin"
                maxLength={GRADER_LABEL_MAX_CHARS}
                value={extraLabel}
                onChange={(e) => setExtraLabel(e.target.value)}
                disabled={saving}
              />
            </div>
            <HumanScoreForm
              items={items}
              total={total}
              human={EMPTY_REVIEW}
              saving={saving}
              hideAiScores={!aiScoresVisible}
              focusOnOpen={false}
              onSave={async (input) => {
                const ok = await onAddExtra({
                  ...input,
                  graderLabel: extraLabel.trim() || undefined,
                });
                if (ok) {
                  setExtraLabel("");
                  setAddingSlot(false);
                }
                return ok;
              }}
              onCancel={() => {
                setExtraLabel("");
                setAddingSlot(false);
              }}
            />
          </div>
        ) : null}
      </div>

      <section className="space-y-3 border-t border-gray-200 pt-5 dark:border-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Other graders ({otherGradedReviews.length})
            </h3>
            {otherGradedReviews.length > 0 && !showOthers ? (
              <span className="text-xs text-gray-500">Hidden by default</span>
            ) : null}
          </div>
          {otherGradedReviews.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={showOthers}
              onClick={() => setShowOthers((prev) => !prev)}
            >
              {showOthers ? (
                <>
                  <ChevronDown className="mr-1 h-3.5 w-3.5" />
                  Hide other scores
                </>
              ) : (
                <>
                  <ChevronRight className="mr-1 h-3.5 w-3.5" />
                  Show other scores
                </>
              )}
            </Button>
          ) : null}
        </div>

        {otherGradedReviews.length > 0 && showOthers ? (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-gray-500">
                  <tr>
                    <th className="py-1.5 pr-3 font-medium">Grader</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Total / {total.max}</th>
                    <th className="py-1.5 pr-3 font-medium">Mode</th>
                    <th className="py-1.5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {gradedReviews.map((review, index) => {
                    const reviewTotal = humanTotalOf(review, totalFromItems);
                    return (
                      <tr
                        key={review.id}
                        className="border-t border-gray-200 dark:border-gray-800"
                      >
                        <td className="py-2 pr-3">
                          <span className="font-medium">
                            {graderDisplayName(review, index)}
                          </span>
                          {review.isMine ? (
                            <Badge variant="secondary" className="ml-1.5 text-[10px]">
                              You
                            </Badge>
                          ) : null}
                          {review.graderRole && !review.isExtraSlot ? (
                            <span className="ml-1.5 text-xs text-gray-500">
                              ({review.graderRole})
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                          {reviewTotal === null ? "—" : formatScore(reviewTotal)}
                        </td>
                        <td className="py-2 pr-3 text-xs text-gray-500">
                          {review.scores.length > 0 ? "Per item" : "Total only"}
                        </td>
                        <td className="py-2 text-right">
                          {review.isExtraSlot ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={saving}
                              aria-label={`Remove ${graderDisplayName(review, index)}`}
                              onClick={() => void onDeleteReview(review.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-gray-500 hover:text-red-600" />
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                  {averageTotal !== null && gradedReviews.length > 1 ? (
                    <tr className="border-t-2 border-gray-300 font-semibold dark:border-gray-700">
                      <td className="py-2 pr-3">Human average ({gradedReviews.length})</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatScore(averageTotal)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  ) : null}
                  {aiScoresVisible && total.aiScore !== null ? (
                    <tr className="border-t border-gray-200 text-gray-600 dark:border-gray-800 dark:text-gray-400">
                      <td className="py-2 pr-3">AI weighted total</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatScore(total.aiScore)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {otherGradedReviews.some((r) => r.comments || r.scores.length > 0) ? (
              <div className="divide-y divide-gray-200/80 dark:divide-gray-800">
                {otherGradedReviews.map((review, index) => (
                  <div key={review.id} className="py-2.5 text-xs space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {graderDisplayName(review, index)}
                      </span>
                      {review.gradedAt ? (
                        <span className="text-gray-500">
                          {formatTimestamp(review.gradedAt)}
                        </span>
                      ) : null}
                    </div>
                    {review.scores.length > 0 ? (
                      <div className="flex flex-wrap gap-2 text-gray-600 dark:text-gray-400">
                        {review.scores.map((s) => (
                          <span key={s.name} className="tabular-nums">
                            {s.name}: <strong>{formatScore(s.score)}</strong>
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {review.comments ? (
                      <p className="whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300">
                        {review.comments}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : otherGradedReviews.length === 0 ? (
          <p className="text-xs text-gray-500">
            No other TA or professor has scored this report yet.
          </p>
        ) : null}
      </section>
    </div>
  );
}
