"use client";

import React from "react";
import { HumanScoreCard } from "@/components/grading/HumanScoreCard";
import { ReportJobResult } from "@/components/report-grading/ReportJobResult";
import { useHumanGrading } from "@/hooks/useHumanGrading";
import {
  parseReportEvaluation,
  REPORT_CRITERION_MAX_SCORE,
  type ReportJobDetail,
} from "@/lib/report-grading";

interface Props {
  job: ReportJobDetail;
  onChanged: () => void;
}

/** AI review of a finished job with an optional human scorecard underneath. */
export function ReportGradedView({ job, onChanged }: Props) {
  const { saveScores, saving } = useHumanGrading(
    "report",
    job.id,
    job.human.aiRevealedAt,
    onChanged
  );
  const criterionScores = parseReportEvaluation(job.resultJson)?.criterionScores ?? null;

  return (
    <>
      <ReportJobResult job={job} />
      {criterionScores ? (
        <HumanScoreCard
          items={criterionScores.map((entry) => ({
            name: entry.criterion,
            max: REPORT_CRITERION_MAX_SCORE,
            aiScore: entry.score,
          }))}
          human={job.human}
          saving={saving}
          onSave={saveScores}
        />
      ) : null}
    </>
  );
}
