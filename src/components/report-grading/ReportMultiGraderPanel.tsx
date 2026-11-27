"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="space-y-4">
      <HumanScoreCard
        items={items}
        total={total}
        totalFromItems={totalFromItems}
        human={myReview}
        saving={saving}
        onSave={onSaveMine}
        hideAiScores={!aiScoresVisible}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
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
          Each TA/professor logging in gets their own score slot automatically; use this to record
          an extra grader slot on the same screen.
        </span>
      </div>

      {addingSlot ? (
        <Card data-testid="extra-grader-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Additional Grader Score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 py-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-500" />
            <CardTitle className="text-sm font-semibold">
              Other graders ({otherGradedReviews.length})
            </CardTitle>
            {otherGradedReviews.length === 0 ? (
              <Badge variant="outline" className="text-[11px] font-normal text-gray-500">
                None yet
              </Badge>
            ) : !showOthers ? (
              <Badge variant="secondary" className="text-[11px] font-normal">
                Hidden by default
              </Badge>
            ) : null}
          </div>
          {otherGradedReviews.length > 0 ? (
            <Button
              type="button"
              variant="outline"
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
        </CardHeader>

        {otherGradedReviews.length > 0 && showOthers ? (
          <CardContent className="space-y-4 pt-0">
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
              <div className="space-y-2.5 border-t border-gray-200 pt-3 dark:border-gray-800">
                {otherGradedReviews.map((review, index) => (
                  <div
                    key={review.id}
                    className="rounded-lg border border-gray-200 p-3 text-xs space-y-1.5 dark:border-gray-800"
                  >
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
                      <div className="flex flex-wrap gap-1.5">
                        {review.scores.map((s) => (
                          <span
                            key={s.name}
                            className="rounded bg-gray-100 px-1.5 py-0.5 tabular-nums dark:bg-gray-800"
                          >
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
          </CardContent>
        ) : otherGradedReviews.length === 0 ? (
          <CardContent className="pt-0">
            <p className="text-xs text-gray-500">
              No other TA or professor has scored this report yet.
            </p>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
