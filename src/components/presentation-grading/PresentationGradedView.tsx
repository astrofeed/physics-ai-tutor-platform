"use client";

import React from "react";
import { FeedbackEmailCard } from "@/components/grading/FeedbackEmailCard";
import { HumanScoreCard } from "@/components/grading/HumanScoreCard";
import { JobResult } from "@/components/presentation-grading/JobResult";
import { useHumanGrading } from "@/hooks/useHumanGrading";
import { sumScores } from "@/lib/human-grading";
import { presentationFeedbackDraft } from "@/lib/feedback-email";
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
  const evaluation = parseEvaluation(job.summaryJson);
  const scorecard = evaluation?.scorecard ?? null;

  return (
    <>
      <JobResult job={job} />
      {evaluation ? (
        <FeedbackEmailCard
          kind="presentation"
          jobId={job.id}
          status={job}
          draftFor={(senderName) =>
            presentationFeedbackDraft(job.topic, evaluation, {
              name: job.englishName ?? job.presenters,
              senderName,
            })
          }
          onChanged={onChanged}
        />
      ) : null}
      {scorecard ? (
        <HumanScoreCard
          items={scorecard.map((entry) => ({
            name: entry.category,
            max: entry.maxPoints,
            aiScore: entry.awardedPoints,
          }))}
          total={{
            max: scorecard.reduce((sum, entry) => sum + entry.maxPoints, 0),
            aiScore: evaluation?.totalScore ?? job.totalScore,
          }}
          totalFromItems={sumScores}
          human={job.human}
          saving={saving}
          onSave={saveScores}
        />
      ) : null}
    </>
  );
}
