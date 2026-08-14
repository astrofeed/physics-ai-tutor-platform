/**
 * Students answer multiple choice questions with the option letter, so an MC
 * answer key only auto-grades correctly when it is stored as a letter. Authors
 * type option text or a 1-based number often enough that both are accepted here
 * and normalized to the letter.
 */

export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
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
