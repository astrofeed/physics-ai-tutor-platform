"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ReportSplit } from "./ReportSplit";
import { ReportLeaveGuard } from "./ReportLeaveGuard";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { FeedbackEmailCard } from "@/components/grading/FeedbackEmailCard";
import { ReportDocumentPane } from "@/components/report-grading/ReportDocumentPane";
import { ReportGradingNavBar } from "@/components/report-grading/ReportGradingNavBar";
import { ReportJobResult } from "@/components/report-grading/ReportJobResult";
import { ReportNoteEvidenceProvider } from "./ReportNoteEvidence";
import { ReportMultiGraderPanel } from "@/components/report-grading/ReportMultiGraderPanel";
import { DEFAULT_VISIBLE_CATEGORIES } from "@/components/report-grading/report-comment-categories";
import { useHumanGrading } from "@/hooks/useHumanGrading";
import { reportWeightedTotal, REPORT_TOTAL_MAX_SCORE } from "@/lib/report-score-scale";
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
  const router = useRouter();
  const [read, setRead] = useState(false);
  const onRead = useCallback(() => setRead(true), []);
  const [rubricMode, setRubricMode] = useState(false);
  const nextUngraded = job.navigation?.nextUngradedId;
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

  const evaluation = useMemo(() => parseReportEvaluation(job.resultJson, job.rubricContent), [job.resultJson, job.rubricContent]);
  const criterionScores = evaluation?.criterionScores ?? null;
  const weightByCriterion = new Map(criterionScores?.map((c) => [c.criterion, c.weightPercent]));
  const weightOf = (criterion: string) => weightByCriterion.get(criterion);

  const toggleAiScores = () => {
    if (!aiScoresVisible) revealAi();
    setAiScoresVisible(!aiScoresVisible);
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
    <div className="space-y-6 border-t pt-4">
      <ReportLeaveGuard />
      <div role="group" aria-label="Review mode"
        className="sticky top-0 z-20 flex gap-1 border-b bg-background py-1 lg:justify-end">
        <Button variant={rubricMode ? "ghost" : "secondary"} size="sm" aria-pressed={!rubricMode}
          onClick={() => setRubricMode(false)}>Page notes</Button>
        <Button variant={rubricMode ? "secondary" : "ghost"} size="sm" aria-pressed={rubricMode}
          onClick={() => setRubricMode(true)}>Rubric &amp; scoring</Button>
      </div>
      <ReportNoteEvidenceProvider><ReportSplit>
        <ReportDocumentPane
          onRead={onRead} showNotes={!rubricMode && !!evaluation}
          sidebar={evaluation ? <ReportJobResult key={rubricMode ? "rubric" : "notes"} job={job} evaluation={evaluation} rubricMode={rubricMode}
            aiScoresVisible={aiScoresVisible} onToggleAiScores={toggleAiScores}
            visibleCategories={visibleCategories} /> : <p>The AI review could not be read.</p>}
          job={job}
          comments={evaluation?.comments ?? []}
          activeCommentIndex={activeCommentIndex}
          onSelectComment={(idx) => setActiveCommentIndex(idx)}
          visibleCategories={visibleCategories}
          onToggleCategory={toggleCategory}
        />
      </ReportSplit></ReportNoteEvidenceProvider>

      <div className="mx-auto max-w-4xl space-y-6">
        {evaluation && <details><summary className="cursor-pointer text-sm font-medium">Feedback email</summary>
          <FeedbackEmailCard kind="report" jobId={job.id} status={job} onChanged={onChanged} />
        </details>}
        {criterionScores && !read && <p role="status">Read to the end of the report to enter scores.</p>}
        {criterionScores && read ? (
          <div className="border-t border-gray-200 pt-6 dark:border-gray-800">
            {rubricMode && job.rubricContent && <details className="mb-4">
              <summary className="cursor-pointer text-sm font-medium">Consult rubric while scoring</summary>
              <div className="max-h-64 overflow-auto py-2" tabIndex={0}>
                <MarkdownContent content={job.rubricContent} className="text-sm" />
              </div>
            </details>}
            <ReportMultiGraderPanel
              jobId={job.id}
              onNext={nextUngraded ? () => router.push(`/report-grading/${nextUngraded}`) : undefined}
              items={criterionScores.map((entry) => ({
                name: entry.criterion,
                max: REPORT_CRITERION_MAX_SCORE,
                aiScore: entry.score,
              }))}
              total={{
                max: REPORT_TOTAL_MAX_SCORE,
                step: 0.1,
                aiScore: reportWeightedTotal(
                  criterionScores.map((c) => ({ name: c.criterion, score: c.score })),
                  weightOf
                ),
              }}
              totalFromItems={(scores) => reportWeightedTotal(scores, weightOf)}
              myReview={job.human}
              allReviews={job.humanReviews ?? []}
              aiScoresVisible={rubricMode && aiScoresVisible}
              saving={saving}
              onSaveMine={saveScores}
              onAddExtra={addExtraReview}
              onDeleteReview={deleteReview}
            />
          </div>
        ) : null}

        <ReportGradingNavBar navigation={job.navigation} />

      </div>
    </div>
  );
}
