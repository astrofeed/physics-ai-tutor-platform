"use client";

import { AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { normalizeMcAnswerKey, optionLetter } from "@/lib/mc-answer-key";

interface McAnswerKeyProps {
  options: string[];
  correctAnswer: string;
  alsoAcceptedAnswers: string[];
  onChange: (correctAnswer: string, alsoAcceptedAnswers: string[]) => void;
}

/**
 * MC answers are authored as a set of accepted letters; the first one is kept as
 * `correctAnswer` so exports and "the answer" displays stay unchanged.
 */
export function McAnswerKey({
  options,
  correctAnswer,
  alsoAcceptedAnswers,
  onChange,
}: McAnswerKeyProps) {
  const keys = [correctAnswer, ...alsoAcceptedAnswers].filter(
    (key) => key.trim().length > 0
  );

  const acceptedLetters = keys
    .map((key) => normalizeMcAnswerKey(key, options))
    .filter((letter): letter is string => letter !== null)
    .filter((letter) => (options[letter.charCodeAt(0) - 65] ?? "").trim().length > 0);

  /**
   * A key still marked correct after its option was emptied would be rejected on
   * save, so it is called out here instead of at the end of a long form.
   */
  const orphanedKeys = keys.filter((key) => {
    const letter = normalizeMcAnswerKey(key, options);
    return letter === null || !(options[letter.charCodeAt(0) - 65] ?? "").trim();
  });

  const setAccepted = (letters: string[]) => {
    const sorted = [...letters].sort();
    onChange(sorted[0] ?? "", sorted.slice(1));
  };

  const toggle = (letter: string) =>
    setAccepted(
      acceptedLetters.includes(letter)
        ? acceptedLetters.filter((l) => l !== letter)
        : [...acceptedLetters, letter]
    );

  return (
    <div className="space-y-2">
      <Label>Correct Answer(s)</Label>
      <div className="space-y-1.5">
        {options.map((option, index) =>
          option.trim() ? (
            <label key={index} className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={acceptedLetters.includes(optionLetter(index))}
                onChange={() => toggle(optionLetter(index))}
              />
              <span>
                <span className="font-medium">{optionLetter(index)}</span> — {option}
              </span>
            </label>
          ) : null
        )}
        {orphanedKeys.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="space-y-1">
              <p>
                {orphanedKeys.join(", ")} {orphanedKeys.length > 1 ? "are" : "is"} marked
                correct but no longer matches an option. Fill the option back in, or drop
                the answer so the question can be saved.
              </p>
              <button
                type="button"
                onClick={() => setAccepted(acceptedLetters)}
                className="font-medium underline"
              >
                Drop {orphanedKeys.length > 1 ? "them" : "it"}
              </button>
            </div>
          </div>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Tick every option that scores full marks. Students still pick one.
        </p>
      </div>
    </div>
  );
}
