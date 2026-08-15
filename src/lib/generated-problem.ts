/**
 * Turns what the problem generator produced into something the rest of the
 * platform grades correctly. The model is asked for a specific shape but does
 * not always obey it, and the answer key it writes is never verified, so
 * everything here is about the gap between "generated" and "gradeable".
 */

import { optionLetter } from "@/lib/mc-answer-key";
import type { ToleranceUnit } from "@/lib/auto-grade";

/**
 * How far a student may be from a generated numeric answer and still be right.
 * Generated keys carry the model's own rounding (0.834 for a 0.83 answer), and
 * nothing in the generate → assign flow asks the author for a tolerance, so
 * without a default every generated numeric question is exact-match and marks
 * correctly-rounded work wrong. Percent, because generated answers span
 * everything from 1e-19 C to 3e8 m/s.
 */
export const GENERATED_NUMERIC_TOLERANCE_PERCENT = 1;

export interface GeneratedTolerance {
  tolerance: number | null;
  toleranceUnit: ToleranceUnit;
}

export function generatedTolerance(questionType: string): GeneratedTolerance {
  return questionType === "NUMERIC"
    ? { tolerance: GENERATED_NUMERIC_TOLERANCE_PERCENT, toleranceUnit: "PERCENT" }
    : { tolerance: null, toleranceUnit: "ABSOLUTE" };
}

/**
 * Drops the "A. " the model writes into the option text itself, which the UI
 * then renders behind its own letter as "A. A. 0.50 A". Only a label matching
 * the option's own position goes, so a genuine answer of "B." or a sentence
 * starting with a letter survives.
 */
export function stripOptionLabels(options: string[]): string[] {
  return options.map((option, index) => {
    const label = optionLetter(index);
    const match = option
      .trim()
      .match(new RegExp(`^\\(?${label}\\)?\\s*[.):\\-]\\s+(.*)$`, "s"));
    const stripped = match?.[1].trim();
    return stripped ? stripped : option;
  });
}

/** One-line plain-text preview of markdown + LaTeX question text. */
export function problemPreview(questionText: string, maxLength = 120): string {
  const plain = questionText
    .replace(/\$\$[\s\S]+?\$\$/g, " … ")
    .replace(/\$[^$\n]+\$/g, " … ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|\s)[*_]([^*_\n]+)[*_]/g, "$1$2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > maxLength ? `${plain.slice(0, maxLength).trimEnd()}…` : plain;
}
