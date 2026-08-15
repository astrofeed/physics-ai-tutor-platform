import { prisma } from "@/lib/prisma";
import { autoGradeAnswer, type GradableQuestion, type ToleranceUnit } from "@/lib/auto-grade";
import { recordGradeAudit } from "@/lib/services/grading-service";

export interface RegradeResult {
  submissionsChecked: number;
  submissionsChanged: number;
  answersChanged: number;
  scoresRaised: number;
  scoresLowered: number;
}

export interface AnswerToRegrade {
  id: string;
  questionId: string;
  answer: string | null;
  score: number | null;
  autoGraded: boolean;
}

export interface Rescore {
  id: string;
  from: number | null;
  to: number;
}

export class RegradeError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

/**
 * Answers whose machine score no longer matches the answer key. Answers a
 * grader touched (`autoGraded` false) are left out, which is what keeps a
 * re-grade from overwriting human judgement.
 */
export function plannedRescores(
  answers: AnswerToRegrade[],
  questions: Map<string, GradableQuestion>
): Rescore[] {
  return answers.flatMap((answer) => {
    if (!answer.autoGraded) return [];
    const graded = autoGradeAnswer(answer.answer ?? "", questions.get(answer.questionId));
    if (graded.score === null || graded.score === answer.score) return [];
    return [{ id: answer.id, from: answer.score, to: graded.score }];
  });
}

/** Total after applying `rescores`, keeping every score the re-grade did not touch. */
export function totalAfterRescores(answers: AnswerToRegrade[], rescores: Rescore[]): number {
  const rescored = new Map(rescores.map((rescore) => [rescore.id, rescore.to]));
  return answers.reduce(
    (sum, answer) => sum + (rescored.get(answer.id) ?? answer.score ?? 0),
    0
  );
}

/**
 * Re-runs auto-grading for one assignment against its current answer keys, for
 * when a key was wrong or a second option was opened up after students
 * submitted.
 *
 * Deliberate limits:
 * - only answers still flagged `autoGraded` are touched, so a grader's score is
 *   never overwritten by the machine;
 * - a submission that was not released stays unreleased (its running total goes
 *   to `draftTotalScore`), so re-grading never publishes grades by itself.
 */
export async function regradeAssignment(
  graderId: string,
  assignmentId: string
): Promise<RegradeResult> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { questions: true },
  });
  if (!assignment || assignment.isDeleted) {
    throw new RegradeError("Assignment not found", 404);
  }
  if (assignment.type !== "QUIZ") {
    throw new RegradeError("Only quiz assignments are auto-graded", 400);
  }

  const gradable = new Map<string, GradableQuestion>(
    assignment.questions.map((q) => [
      q.id,
      {
        questionType: q.questionType,
        correctAnswer: q.correctAnswer,
        alsoAcceptedAnswers: q.alsoAcceptedAnswers,
        points: q.points,
        tolerance: q.tolerance === null ? null : Number(q.tolerance),
        toleranceUnit: q.toleranceUnit as ToleranceUnit,
      },
    ])
  );

  const submissions = await prisma.submission.findMany({
    where: { assignmentId, isDraft: false, isDeleted: false },
    select: {
      id: true,
      userId: true,
      gradedAt: true,
      totalScore: true,
      draftTotalScore: true,
      answers: {
        select: { id: true, questionId: true, answer: true, score: true, autoGraded: true },
      },
    },
  });

  const result: RegradeResult = {
    submissionsChecked: submissions.length,
    submissionsChanged: 0,
    answersChanged: 0,
    scoresRaised: 0,
    scoresLowered: 0,
  };

  for (const submission of submissions) {
    const updates = plannedRescores(submission.answers, gradable);
    if (updates.length === 0) continue;

    const total = totalAfterRescores(submission.answers, updates);
    const released = submission.gradedAt !== null;

    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.submissionAnswer.update({
          where: { id: update.id },
          data: { score: update.to, autoGraded: true },
        });
      }
      await tx.submission.update({
        where: { id: submission.id },
        data: released ? { totalScore: total } : { draftTotalScore: total },
      });
    });

    result.submissionsChanged += 1;
    result.answersChanged += updates.length;
    for (const update of updates) {
      if (update.to > (update.from ?? 0)) result.scoresRaised += 1;
      else result.scoresLowered += 1;
    }

    await recordGradeAudit(graderId, "assignment_regraded", {
      submissionId: submission.id,
      assignmentId,
      studentId: submission.userId,
      previousTotalScore: released ? submission.totalScore : submission.draftTotalScore,
      totalScore: total,
      released,
      answersChanged: updates.length,
    });
  }

  return result;
}
