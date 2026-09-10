"use client";

import React from "react";
import { AiResultGate } from "@/components/grading/AiResultGate";
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

/** Human score entry above the (initially folded) AI review of a finished job. */
export function ReportGradedView({ job, onChanged }: Props) {
  const { saveScores, saving, revealAi, revealing } = useHumanGrading("report", job.id, onChanged);
  const criterionScores = parseReportEvaluation(job.resultJson)?.criterionScores ?? null;

  return (
    <>
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
      <AiResultGate
        revealed={job.human.aiRevealedAt !== null || !criterionScores}
        revealing={revealing}
        onReveal={() => void revealAi()}
      >
        <ReportJobResult job={job} />
      </AiResultGate>
    </>
  );
}
