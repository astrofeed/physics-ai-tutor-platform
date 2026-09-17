"use client";

import type { ChallengeState } from "@/lib/simulation/scoring";
import { describeChallenge, type GaussChallenge } from "./useGaussChallenge";

interface GaussChallengePanelProps {
  challenge: GaussChallenge;
  guess: string;
  feedback: string | null;
  state: ChallengeState;
  onGuessChange: (value: string) => void;
  onCheck: () => void;
  onSkip: () => void;
}

const feedbackClass = (feedback: string) =>
  feedback.startsWith("Not")
    ? "text-red-600 dark:text-red-400"
    : feedback.startsWith("Please")
      ? "text-gray-500"
      : "text-green-600 dark:text-green-400";

export function GaussChallengePanel({
  challenge,
  guess,
  feedback,
  state,
  onGuessChange,
  onCheck,
  onSkip,
}: GaussChallengePanelProps) {
  return (
    <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4">
      <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">Predict the Flux Challenge</h3>
      <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
        {describeChallenge(challenge)} What is the electric flux {"\u03A6"} through the sphere?
      </p>
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={guess}
            onChange={(e) => onGuessChange(e.target.value)}
            placeholder="Enter flux (e.g., 565 or 5.65e2)"
            className="w-full h-10 px-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
            onKeyDown={(e) => e.key === "Enter" && onCheck()}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            N{"\u00B7"}m{"\u00B2"}/C
          </span>
        </div>
        <button
          onClick={onCheck}
          className="px-6 h-10 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors"
        >
          Check
        </button>
        <button
          onClick={onSkip}
          className="px-4 h-10 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
        >
          Skip
        </button>
      </div>
      {feedback && <p className={`text-xs mt-2 font-medium ${feedbackClass(feedback)}`}>{feedback}</p>}
      <div className="mt-2 flex gap-4 text-xs font-mono text-amber-700 dark:text-amber-400">
        <span>Score: {state.score}</span>
        <span>Attempts: {state.attempts}</span>
        <span>Streak: {state.streak}</span>
      </div>
    </div>
  );
}
