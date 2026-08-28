/**
 * CSV export for the grading tools. Builds spreadsheet-friendly CSVs from
 * graded jobs: report jobs export per-criterion scores/reasons, presentation
 * jobs export per-category reference scores only (no questions).
 */

import {
  parseReportEvaluation,
  type ReportJobDetail,
} from "@/lib/report-grading";
import {
  parseEvaluation,
  type PresentationJobDetail,
} from "@/lib/presentation-grading";

type CsvValue = string | number | null | undefined;

function csvEscape(value: CsvValue): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** BOM prefix so Excel opens UTF-8 (Chinese names / IDs) correctly. */
function toCsv(rows: CsvValue[][]): string {
  return "\uFEFF" + rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
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
 * One row per report job: student ID, title, per-criterion score + reason
 * (columns follow the first graded job's rubric order), weighted total,
 * and the AI summary. Ungraded/legacy jobs get blank score cells.
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
    "Status",
    ...criteria.flatMap(({ criterion, weightPercent }) => [
      `${criterion} (${weightPercent}%) score`,
      `${criterion} reason`,
    ]),
    "Weighted total (0-10)",
    "Summary",
  ];

  const rows = jobs.map((job, i) => {
    const scores = evaluations[i]?.criterionScores ?? null;
    const byCriterion = new Map(scores?.map((s) => [s.criterion, s]) ?? []);
    const weightSum = scores?.reduce((sum, s) => sum + s.weightPercent, 0) ?? 0;
    const weightedTotal =
      scores && weightSum > 0
        ? scores.reduce((sum, s) => sum + s.score * s.weightPercent, 0) / weightSum
        : null;
    return [
      job.studentId,
      job.title,
      job.authors,
      job.status,
      ...criteria.flatMap(({ criterion }) => {
        const score = byCriterion.get(criterion);
        return [score?.score ?? "", score?.reason ?? ""];
      }),
      weightedTotal === null ? "" : weightedTotal.toFixed(2),
      evaluations[i]?.summary ?? "",
    ];
  });

  return toCsv([header, ...rows]);
}

/**
 * One row per presentation job: identifying fields plus the reference score
 * of every scorecard category and the total — no questions or comments.
 * Category columns follow the first graded job's scorecard order.
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
    "Track",
    "Condition",
    "Status",
    ...categories.map(({ category, maxPoints }) => `${category} (/${maxPoints})`),
    "Total score (/100)",
  ];

  const rows = jobs.map((job, i) => {
    const byCategory = new Map(
      evaluations[i]?.scorecard.map((entry) => [entry.category, entry]) ?? []
    );
    return [
      job.topic,
      job.presenters,
      job.studentIds,
      job.track,
      job.condition,
      job.status,
      ...categories.map(({ category }) => byCategory.get(category)?.awardedPoints ?? ""),
      job.totalScore ?? "",
    ];
  });

  return toCsv([header, ...rows]);
}
