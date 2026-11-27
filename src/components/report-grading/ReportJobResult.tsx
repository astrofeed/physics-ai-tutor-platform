"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { weightedAverage } from "@/lib/human-grading";
import type { ReportEvaluation, ReportJobDetail, ReportCommentCategory } from "@/lib/report-grading";
import { reportEvaluationToText } from "./report-job-format";
import { ReportSuggestionChecks } from "./ReportSuggestionChecks";

interface Props {
  job: ReportJobDetail;
  evaluation: ReportEvaluation;
  rubricMode: boolean;
  aiScoresVisible: boolean;
  onToggleAiScores: () => void;
  visibleCategories: Set<ReportCommentCategory>;
}

export function ReportJobResult({ job, evaluation, rubricMode, aiScoresVisible,
  onToggleAiScores, visibleCategories }: Props) {
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const scores = evaluation.criterionScores;
  const aiTotal = scores && weightedAverage(scores.map((c) => ({ name: c.criterion, score: c.score })),
    (name) => scores.find((c) => c.criterion === name)?.weightPercent);
  async function copy() {
    const text = reportEvaluationToText(evaluation, {
      categories: rubricMode ? new Set() : visibleCategories,
      includeScores: rubricMode && aiScoresVisible,
      includeDirections: !rubricMode && directionsOpen,
      includeSummary: !rubricMode,
    });
    try {
      await navigator.clipboard.writeText(rubricMode ? [job.rubricContent, text].filter(Boolean).join("\n\n") : text);
      toast.success("Visible review copied");
    } catch { toast.error("Could not copy to the clipboard"); }
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{rubricMode
          ? `Grading rubric${job.rubricVersion ? ` · v${job.rubricVersion}` : ""}` : "AI Notes & Review"}</h2>
        <Button variant="ghost" size="sm" onClick={copy}>Copy visible</Button>
      </div>
      {rubricMode ? <>
        {job.rubricContent && (
          <div tabIndex={0} aria-label="Grading instructions" className="max-h-72 overflow-y-auto py-2">
            <MarkdownContent content={job.rubricContent} className="text-sm" />
          </div>
        )}
        {scores && <>
          <Button variant="outline" size="sm" onClick={onToggleAiScores} aria-expanded={aiScoresVisible}>
            {aiScoresVisible ? "Hide AI scores" : "Show AI scores"}
          </Button>
          {aiScoresVisible ? <>
            {aiTotal !== null && <p className="text-sm font-medium">Weighted total: {aiTotal.toFixed(2)} / 10</p>}
            <ol className="divide-y">{scores.map((s) => (
              <li key={s.criterion} className="space-y-1 py-2 text-sm">
                <strong>{s.criterion} ({s.weightPercent}%) · {s.score}/10</strong>
                <MarkdownContent content={s.reason} />
              </li>
            ))}</ol>
          </> : <p className="text-xs text-muted-foreground">Hidden by default so AI scores do not anchor your grading.</p>}
        </>}
        <p className="text-sm text-muted-foreground">{scores ? "Enter your own score below the last page." :
          "No verified AI scores are available for this rubric version."}</p>
      </> : <>
        <MarkdownContent content={evaluation.summary} className="text-sm" />
        {!!evaluation.suggestionChecks?.length && <ReportSuggestionChecks checks={evaluation.suggestionChecks}
          presentationJobId={job.presentationJobId} onToggle={setDirectionsOpen} />}
      </>}
    </div>
  );
}
