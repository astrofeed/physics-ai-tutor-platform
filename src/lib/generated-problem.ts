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

function comparableAnswer(text: string): string {
  return text
    .toLowerCase()
    .replace(/\$|\\mathrm|\\text|\\,|\\;|\\ |[{}\\]/g, "")
    .replace(/[\s]/g, "")
    .replace(/×10\^?/g, "e")
    .trim();
}

/**
 * Resolves an MC key from the answer's *value* rather than the letter the model
 * claims. The letter is the least reliable field it writes: a solution that
 * derives 2.00 A (option B) has repeatedly ended with "corresponds to Option C",
 * and a wrong key still grades cleanly, marking correct students down. Returns
 * null when the value matches no option, so the caller keeps the stated letter.
 */
export function mcKeyFromValue(value: string, options: string[]): string | null {
  const wanted = comparableAnswer(value);
  if (!wanted || options.length === 0) return null;

  const comparable = options.map(comparableAnswer);
  const exact = comparable.indexOf(wanted);
  if (exact !== -1) return optionLetter(exact);

  const contained = comparable.filter((option) => option.includes(wanted));
  if (contained.length === 1) return optionLetter(comparable.indexOf(contained[0]));

  return null;
}

function numbersIn(text: string): number[] {
  const matches = text.match(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g) ?? [];
  return matches.map(Number).filter(Number.isFinite);
}

function keyValueText(problem: GeneratedProblemLike): string | null {
  if (problem.questionType === "NUMERIC") return problem.correctAnswer;
  if (problem.questionType !== "MC") return null;

  const options = problem.options ?? [];
  const index = problem.correctAnswer.trim().toUpperCase().charCodeAt(0) - 65;
  return options[index] ?? null;
}

export interface GeneratedProblemLike {
  questionType: string;
  options?: string[] | null;
  correctAnswer: string;
  solution: string;
}

/**
 * Flags a generated problem whose answer key never appears in its own solution.
 * The model's answer *value* is wrong often enough that mapping it to the right
 * option is not enough: a solution deriving 11.0 V has been paired with a key on
 * the 10.9 V distractor. A key the solution never mentions is the cheap, honest
 * signal for that; it cannot judge whether the physics is right, so a clean
 * result means "nothing obviously contradictory", not "verified".
 *
 * The match has to be tight (0.5%), because the distractors are deliberately
 * close: 10.9 V sits within 1% of the 11.0 V the solution derived. It is loose
 * enough for the rounding between a solution's 2.6667 and an option's 2.67.
 */
export function keyContradictsSolution(problem: GeneratedProblemLike): boolean {
  const keyText = keyValueText(problem);
  if (!keyText || !problem.solution.trim()) return false;

  const [keyValue] = numbersIn(keyText);
  if (keyValue === undefined) return false;

  const scale = Math.max(Math.abs(keyValue), 1e-12);
  return !numbersIn(problem.solution).some(
    (value) => Math.abs(value - keyValue) / scale <= 0.005
  );
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
