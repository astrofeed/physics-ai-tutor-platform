import { prisma } from "@/lib/prisma";
import { autoGradeAnswer, type GradableQuestion, type ToleranceUnit } from "@/lib/auto-grade";
import { recordGradeAudit } from "@/lib/services/grading-service";
import type { UserRole } from "@/types/user";

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
  hasResolvedAppeal: boolean;
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
 * grader touched (`autoGraded` false) and answers whose score came out of a
 * resolved appeal are left out, which is what keeps a re-grade from overwriting
 * human judgement.
 */
export function plannedRescores(
  answers: AnswerToRegrade[],
  questions: Map<string, GradableQuestion>
): Rescore[] {
  return answers.flatMap((answer) => {
    if (!answer.autoGraded || answer.hasResolvedAppeal) return [];
    const graded = autoGradeAnswer(answer.answer ?? "", questions.get(answer.questionId));
    if (graded.score === null || graded.score === answer.score) return [];
    return [{ id: answer.id, from: answer.score, to: graded.score }];
  });
}

/**
 * Moves the stored total by what the re-grade changed instead of recomputing it
 * from the answers, because a grader can enter an overall grade that deliberately
 * differs from the sum of the per-question scores. With no stored total the sum
 * of the answers is the starting point.
 */
export function totalAfterRescores(
  answers: AnswerToRegrade[],
  rescores: Rescore[],
  storedTotal: number | null
): number {
  const answerSum = answers.reduce((sum, answer) => sum + (answer.score ?? 0), 0);
  const delta = rescores.reduce((sum, rescore) => sum + rescore.to - (rescore.from ?? 0), 0);
  return (storedTotal ?? answerSum) + delta;
}

/**
 * Re-runs auto-grading for one assignment against its current answer keys, for
 * when a key was wrong or a second option was opened up after students
 * submitted.
 *
 * Deliberate limits:
 * - only answers still flagged `autoGraded` and free of a resolved appeal are
 *   touched, so a grader's score is never overwritten by the machine;
 * - the stored total moves by the change the re-grade made, so an overall grade
 *   a grader entered by hand survives;
 * - a submission that was not released stays unreleased (its running total goes
 *   to `draftTotalScore`), so re-grading never publishes grades by itself.
 */
export async function regradeAssignment(
  actor: { id: string; role: UserRole },
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
  if (actor.role === "TA" && assignment.createdById !== actor.id) {
    throw new RegradeError(
      "Forbidden: you can only re-grade your own assignments",
      403
    );
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
        select: {
          id: true,
          questionId: true,
          answer: true,
          score: true,
          autoGraded: true,
          appeals: { where: { status: "RESOLVED" }, select: { id: true }, take: 1 },
        },
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
    const answers: AnswerToRegrade[] = submission.answers.map((answer) => ({
      id: answer.id,
      questionId: answer.questionId,
      answer: answer.answer,
      score: answer.score,
      autoGraded: answer.autoGraded,
      hasResolvedAppeal: answer.appeals.length > 0,
    }));
    const updates = plannedRescores(answers, gradable);
    if (updates.length === 0) continue;

    const released = submission.gradedAt !== null;
    const total = totalAfterRescores(
      answers,
      updates,
      released ? submission.totalScore : submission.draftTotalScore
    );

    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.submissionAnswer.update({
          where: { id: update.id },
          data: { score: update.to, autoGraded: true },
        });
      }
      await tx.submission.update({
        where: { id: submission.id },
        // Moving `gradedAt` records when the grade last changed, and makes any
        // grading draft a browser still holds older than the server's scores,
        // so it is discarded instead of being finalized back over them.
        data: released
          ? { totalScore: total, gradedAt: new Date() }
          : { draftTotalScore: total },
      });
    });

    result.submissionsChanged += 1;
    result.answersChanged += updates.length;
    for (const update of updates) {
      if (update.to > (update.from ?? 0)) result.scoresRaised += 1;
      else result.scoresLowered += 1;
    }

    await recordGradeAudit(actor.id, "assignment_regraded", {
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
