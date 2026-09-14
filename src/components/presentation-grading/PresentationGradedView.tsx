"use client";

import React from "react";
import { HumanScoreCard } from "@/components/grading/HumanScoreCard";
import { JobResult } from "@/components/presentation-grading/JobResult";
import { useHumanGrading } from "@/hooks/useHumanGrading";
import { parseEvaluation, type PresentationJobDetail } from "@/lib/presentation-grading";

interface Props {
  job: PresentationJobDetail;
  onChanged: () => void;
}

/** AI result of a finished job with an optional human scorecard underneath. */
export function PresentationGradedView({ job, onChanged }: Props) {
  const { saveScores, saving } = useHumanGrading(
    "presentation",
    job.id,
    job.human.aiRevealedAt,
    onChanged
  );
  const scorecard = parseEvaluation(job.summaryJson)?.scorecard ?? null;

  return (
    <>
      <JobResult job={job} />
      {scorecard ? (
        <HumanScoreCard
          items={scorecard.map((entry) => ({
            name: entry.category,
            max: entry.maxPoints,
            aiScore: entry.awardedPoints,
          }))}
          human={job.human}
          saving={saving}
          onSave={saveScores}
        />
      ) : null}
    </>
  );
}
