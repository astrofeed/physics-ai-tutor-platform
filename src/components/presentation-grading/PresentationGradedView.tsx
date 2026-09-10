"use client";

import React from "react";
import { AiResultGate } from "@/components/grading/AiResultGate";
import { HumanScoreCard } from "@/components/grading/HumanScoreCard";
import { JobResult } from "@/components/presentation-grading/JobResult";
import { useHumanGrading } from "@/hooks/useHumanGrading";
import { parseEvaluation, type PresentationJobDetail } from "@/lib/presentation-grading";

interface Props {
  job: PresentationJobDetail;
  onChanged: () => void;
}

/** Human scorecard entry above the (initially folded) AI result of a finished job. */
export function PresentationGradedView({ job, onChanged }: Props) {
  const { saveScores, saving, revealAi, revealing } = useHumanGrading(
    "presentation",
    job.id,
    onChanged
  );
  const scorecard = parseEvaluation(job.summaryJson)?.scorecard ?? null;

  return (
    <>
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
      <AiResultGate
        revealed={job.human.aiRevealedAt !== null || !scorecard}
        revealing={revealing}
        onReveal={() => void revealAi()}
      >
        <JobResult job={job} />
      </AiResultGate>
    </>
  );
}
