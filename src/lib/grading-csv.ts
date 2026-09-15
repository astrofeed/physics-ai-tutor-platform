/**
 * CSV export for the grading tools. Builds spreadsheet-friendly CSVs from
 * graded jobs: report jobs export per-criterion scores/reasons, presentation
 * jobs export per-category reference scores only (no questions). Every row
 * pairs the AI score with the staff score (when entered) and records whether
 * the staff graded before opening the AI result.
 */

import {
  parseReportEvaluation,
  type ReportJobDetail,
} from "@/lib/report-grading";
import {
  parseEvaluation,
  type PresentationJobDetail,
} from "@/lib/presentation-grading";
import {
  gradedBlind,
  humanTotalOf,
  sumScores,
  weightedAverage,
  type HumanGrading,
} from "@/lib/human-grading";

type CsvValue = string | number | null | undefined;

function csvEscape(value: CsvValue): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** BOM prefix so Excel opens UTF-8 (Chinese names / IDs) correctly. */
function toCsv(rows: CsvValue[][]): string {
  return "\uFEFF" + rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

const HUMAN_AUDIT_HEADER: CsvValue[] = [
  "Human scoring",
  "Human graded at",
  "Human grader",
  "AI revealed at",
  "Human graded blind",
];

function humanAuditCells(human: HumanGrading): CsvValue[] {
  const blind = gradedBlind(human);
  return [
    human.total !== null ? "total only" : human.scores.length > 0 ? "per item" : "",
    human.gradedAt ?? "",
    human.gradedByName ?? "",
    human.aiRevealedAt ?? "",
    blind === null ? "" : blind ? "yes" : "no",
  ];
}

function humanScoresByName(human: HumanGrading): Map<string, number> {
  return new Map(human.scores.map((entry) => [entry.name, entry.score]));
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * One row per report job: student ID, title, per-criterion AI score, human
 * score + AI reason (columns follow the first graded job's rubric order),
 * weighted totals, and the AI summary. Ungraded/legacy jobs get blank cells.
 */
export function reportJobsToCsv(jobs: ReportJobDetail[]): string {
  const evaluations = jobs.map((job) => parseReportEvaluation(job.resultJson));

  const criteria: { criterion: string; weightPercent: number }[] = [];
  const seen = new Set<string>();
  for (const evaluation of evaluations) {
    for (const score of evaluation?.criterionScores ?? []) {
      if (!seen.has(score.criterion)) {
        seen.add(score.criterion);
        criteria.push({ criterion: score.criterion, weightPercent: score.weightPercent });
      }
    }
  }

  const header: CsvValue[] = [
    "Student ID",
    "Title",
    "Authors",
    "English name",
    "Group",
    "Presentation date",
    "Report question",
    "Status",
    ...criteria.flatMap(({ criterion, weightPercent }) => [
      `${criterion} (${weightPercent}%) AI score`,
      `${criterion} (${weightPercent}%) human score`,
      `${criterion} AI reason`,
    ]),
    "AI weighted total (0-10)",
    "Human total (0-10)",
    ...HUMAN_AUDIT_HEADER,
    "Summary",
  ];

  const rows = jobs.map((job, i) => {
    const scores = evaluations[i]?.criterionScores ?? null;
    const byCriterion = new Map(scores?.map((s) => [s.criterion, s]) ?? []);
    const humanByCriterion = humanScoresByName(job.human);
    const weightOf = (criterion: string) => byCriterion.get(criterion)?.weightPercent;
    const aiTotal = scores
      ? weightedAverage(
          scores.map((s) => ({ name: s.criterion, score: s.score })),
          weightOf
        )
      : null;
    const humanTotal = humanTotalOf(job.human, (scores) => weightedAverage(scores, weightOf));
    return [
      job.studentId,
      job.title,
      job.authors,
      job.englishName,
      job.groupLabel,
      job.presentationDate,
      job.assignedQuestion,
      job.status,
      ...criteria.flatMap(({ criterion }) => {
        const score = byCriterion.get(criterion);
        return [score?.score ?? "", humanByCriterion.get(criterion) ?? "", score?.reason ?? ""];
      }),
      aiTotal === null ? "" : aiTotal.toFixed(2),
      humanTotal === null ? "" : humanTotal.toFixed(2),
      ...humanAuditCells(job.human),
      evaluations[i]?.summary ?? "",
    ];
  });

  return toCsv([header, ...rows]);
}

/**
 * One row per presentation job: identifying fields plus the AI and human
 * score of every scorecard category and the totals — no questions or
 * comments. Category columns follow the first graded job's scorecard order.
 */
export function presentationJobsToCsv(jobs: PresentationJobDetail[]): string {
  const evaluations = jobs.map((job) => parseEvaluation(job.summaryJson));

  const categories: { category: string; maxPoints: number }[] = [];
  const seen = new Set<string>();
  for (const evaluation of evaluations) {
    for (const entry of evaluation?.scorecard ?? []) {
      if (!seen.has(entry.category)) {
        seen.add(entry.category);
        categories.push({ category: entry.category, maxPoints: entry.maxPoints });
      }
    }
  }

  const header: CsvValue[] = [
    "Topic",
    "Presenters",
    "Student IDs",
    "English name",
    "Group",
    "Presentation date",
    "Track",
    "Status",
    ...categories.flatMap(({ category, maxPoints }) => [
      `${category} (/${maxPoints}) AI`,
      `${category} (/${maxPoints}) human`,
    ]),
    "AI total (/100)",
    "Human total (/100)",
    ...HUMAN_AUDIT_HEADER,
  ];

  const rows = jobs.map((job, i) => {
    const byCategory = new Map(
      evaluations[i]?.scorecard.map((entry) => [entry.category, entry]) ?? []
    );
    const humanByCategory = humanScoresByName(job.human);
    const humanTotal = humanTotalOf(job.human, sumScores);
    return [
      job.topic,
      job.presenters,
      job.studentIds,
      job.englishName,
      job.groupLabel,
      job.presentationDate,
      job.track,
      job.status,
      ...categories.flatMap(({ category }) => [
        byCategory.get(category)?.awardedPoints ?? "",
        humanByCategory.get(category) ?? "",
      ]),
      job.totalScore ?? "",
      humanTotal ?? "",
      ...humanAuditCells(job.human),
    ];
  });

  return toCsv([header, ...rows]);
}
