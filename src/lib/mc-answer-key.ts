/**
 * Students answer multiple choice questions with the option letter, so an MC
 * answer key only auto-grades correctly when it is stored as a letter. Authors
 * type option text or a 1-based number often enough that both are accepted here
 * and normalized to the letter.
 */

export const MIN_MC_OPTIONS = 2;
export const MAX_MC_OPTIONS = 8;

export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/**
 * Drops blank options an author left behind and moves the answer key to the
 * letter it lands on, so a gap in the middle of the list cannot silently
 * re-point the key at another option.
 */
export function compactMcOptions(
  options: string[],
  correctAnswer: string
): { options: string[]; correctAnswer: string } {
  const key = normalizeMcAnswerKey(correctAnswer, options);
  const kept = options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => option.trim().length > 0);

  const keyIndex = key ? key.charCodeAt(0) - 65 : -1;
  const newKeyIndex = kept.findIndex(({ index }) => index === keyIndex);

  return {
    options: kept.map(({ option }) => option),
    correctAnswer: newKeyIndex === -1 ? correctAnswer : optionLetter(newKeyIndex),
  };
}

/** Returns the option letter for `correctAnswer`, or null when it matches no option. */
export function normalizeMcAnswerKey(
  correctAnswer: string,
  options: string[]
): string | null {
  const value = correctAnswer.trim();
  if (!value || options.length === 0) return null;

  const letters = options.map((_, index) => optionLetter(index));

  const asLetter = letters.indexOf(value.toUpperCase());
  if (asLetter !== -1) return letters[asLetter];

  const asNumber = Number(value);
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= options.length) {
    return letters[asNumber - 1];
  }

  const asText = options.findIndex(
    (option) => option.trim().toLowerCase() === value.toLowerCase()
  );
  if (asText !== -1) return letters[asText];

  return null;
}
