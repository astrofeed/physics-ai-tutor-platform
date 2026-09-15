/** Rubric item shown in the human score card, with the AI's score for comparison. */
export interface HumanScoreItem {
  name: string;
  max: number;
  aiScore: number;
}

/** The overall scale (report 0-10, presentation 0-100) and the AI's total on it. */
export interface HumanTotalItem {
  max: number;
  aiScore: number | null;
}

export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
