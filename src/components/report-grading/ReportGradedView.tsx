"use client";

import React, { useState } from "react";
import { FeedbackEmailCard } from "@/components/grading/FeedbackEmailCard";
import { ReportDocumentPane } from "@/components/report-grading/ReportDocumentPane";
import { ReportGradingNavBar } from "@/components/report-grading/ReportGradingNavBar";
import { ReportJobResult } from "@/components/report-grading/ReportJobResult";
import { ReportMultiGraderPanel } from "@/components/report-grading/ReportMultiGraderPanel";
import { DEFAULT_VISIBLE_CATEGORIES } from "@/components/report-grading/report-comment-categories";
import { useHumanGrading } from "@/hooks/useHumanGrading";
import { weightedAverage } from "@/lib/human-grading";
import {
  parseReportEvaluation,
  REPORT_CRITERION_MAX_SCORE,
  type ReportCommentCategory,
  type ReportJobDetail,
} from "@/lib/report-grading";

interface Props {
  job: ReportJobDetail;
  onChanged: () => void;
}

/**
 * Split-pane grading workspace: student report (PDF or pasted text) on the left,
 * interactive AI notes, blind-by-default multi-grader scoring, and queue
 * navigation on the right.
 */
export function ReportGradedView({ job, onChanged }: Props) {
  const { saveScores, addExtraReview, deleteReview, revealAi, saving } = useHumanGrading(
    "report",
    job.id,
    job.human.aiRevealedAt,
    onChanged,
    { autoRevealOnMount: false }
  );
  const [activeCommentIndex, setActiveCommentIndex] = useState<number | null>(null);
  const [aiScoresVisible, setAiScoresVisible] = useState(false);
  const [visibleCategories, setVisibleCategories] = useState<Set<ReportCommentCategory>>(
    () => new Set(DEFAULT_VISIBLE_CATEGORIES)
  );

  const evaluation = parseReportEvaluation(job.resultJson);
  const criterionScores = evaluation?.criterionScores ?? null;
  const weightByCriterion = new Map(criterionScores?.map((c) => [c.criterion, c.weightPercent]));
  const weightOf = (criterion: string) => weightByCriterion.get(criterion);

  const toggleAiScores = () => {
    setAiScoresVisible((prev) => {
      const next = !prev;
      if (next) revealAi();
      return next;
    });
  };

  const toggleCategory = (category: ReportCommentCategory) => {
    setVisibleCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  return (
    <div className="grid grid-cols-1 gap-8 border-t border-gray-200 pt-5 dark:border-gray-800 lg:grid-cols-12 lg:items-start">
      <div className="lg:col-span-6 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] min-h-[420px]">
        <ReportDocumentPane
          job={job}
          comments={evaluation?.comments ?? []}
          activeCommentIndex={activeCommentIndex}
          onSelectComment={(idx) => setActiveCommentIndex(idx)}
          visibleCategories={visibleCategories}
          onToggleCategory={toggleCategory}
        />
      </div>

      <div className="lg:col-span-6 space-y-7 min-w-0 pb-8">
        <ReportJobResult
          job={job}
          activeCommentIndex={activeCommentIndex}
          onSelectComment={setActiveCommentIndex}
          aiScoresVisible={aiScoresVisible}
          onToggleAiScores={toggleAiScores}
          visibleCategories={visibleCategories}
          onToggleCategory={toggleCategory}
        />

        {criterionScores ? (
          <div className="border-t border-gray-200 pt-6 dark:border-gray-800">
            <ReportMultiGraderPanel
              items={criterionScores.map((entry) => ({
                name: entry.criterion,
                max: REPORT_CRITERION_MAX_SCORE,
                aiScore: entry.score,
              }))}
              total={{
                max: REPORT_CRITERION_MAX_SCORE,
                aiScore: weightedAverage(
                  criterionScores.map((c) => ({ name: c.criterion, score: c.score })),
                  weightOf
                ),
              }}
              totalFromItems={(scores) => weightedAverage(scores, weightOf)}
              myReview={job.human}
              allReviews={job.humanReviews ?? []}
              aiScoresVisible={aiScoresVisible}
              saving={saving}
              onSaveMine={saveScores}
              onAddExtra={addExtraReview}
              onDeleteReview={deleteReview}
            />
          </div>
        ) : null}

        <ReportGradingNavBar navigation={job.navigation} />

        {evaluation ? (
          <FeedbackEmailCard
            kind="report"
            jobId={job.id}
            status={job}
            onChanged={onChanged}
          />
        ) : null}
      </div>
    </div>
  );
}
