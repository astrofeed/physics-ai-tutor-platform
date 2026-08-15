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
 * Drops blank options an author left behind and moves every answer key to the
 * letter it lands on, so a gap in the middle of the list cannot silently
 * re-point a key at another option. A key that pointed at a dropped option
 * comes back empty rather than at its neighbour, so the caller rejects it
 * instead of scoring the class against an option nobody chose.
 */
export function compactMcOptions(
  options: string[],
  correctAnswer: string,
  alsoAcceptedAnswers: string[] = []
): { options: string[]; correctAnswer: string; alsoAcceptedAnswers: string[] } {
  const kept = options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => option.trim().length > 0);

  const remap = (key: string): string | null => {
    const letter = normalizeMcAnswerKey(key, options);
    if (!letter) return null;
    const newIndex = kept.findIndex(({ index }) => index === letter.charCodeAt(0) - 65);
    return newIndex === -1 ? null : optionLetter(newIndex);
  };

  const primary = remap(correctAnswer);
  const extras = alsoAcceptedAnswers
    .map(remap)
    .filter((letter): letter is string => letter !== null && letter !== primary);

  return {
    options: kept.map(({ option }) => option),
    correctAnswer: primary ?? "",
    alsoAcceptedAnswers: Array.from(new Set(extras)),
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
