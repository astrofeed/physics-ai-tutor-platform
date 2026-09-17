import { useCallback, useState } from "react";
import { calculateAccuracy, type Score } from "@/lib/simulation/scoring";
import {
  type ChargeConfig,
  CHARGE_SYMBOL,
  CHARGE_UNIT,
  METERS_PER_PX,
  SPHERE_RADIUS_PX,
  enclosedCharge,
  fluxFromCharge,
} from "@/lib/simulation/gauss-law";

const CONFIGS: ChargeConfig[] = ["point", "line", "sphere", "plane"];
const RADII_CM = [6, 10, 15, 20];

export interface GaussChallenge {
  cfg: ChargeConfig;
  q: number;
  radiusPx: number;
}

const cm = (px: number) => `${(px * METERS_PER_PX * 100).toFixed(0)} cm`;

/** Human-readable statement of the geometry the student must reason about. */
export function describeChallenge(c: GaussChallenge): string {
  const charge = `${CHARGE_SYMBOL[c.cfg]} = ${c.q} ${CHARGE_UNIT[c.cfg]}`;
  const sphere = `a Gaussian sphere of radius ${cm(c.radiusPx)}`;
  switch (c.cfg) {
    case "point":
      return `A point charge ${charge} sits at the centre of ${sphere}.`;
    case "sphere":
      return `A uniformly charged ball (R = ${cm(SPHERE_RADIUS_PX)}, ${charge}) is centred inside ${sphere}.`;
    case "line":
      return `An infinite line charge ${charge} passes through the centre of ${sphere}.`;
    case "plane":
      return `An infinite charged plane ${charge} cuts through the centre of ${sphere}.`;
  }
}

function randomChallenge(): GaussChallenge {
  const cfg = CONFIGS[Math.floor(Math.random() * CONFIGS.length)];
  let q = Math.round((Math.random() * 18 - 9) * 2) / 2;
  if (q === 0) q = 1;
  const radiusCm = RADII_CM[Math.floor(Math.random() * RADII_CM.length)];
  return { cfg, q, radiusPx: radiusCm / (METERS_PER_PX * 100) };
}

export function challengeFlux(c: GaussChallenge): number {
  return fluxFromCharge(enclosedCharge(c.cfg, c.q, 0, 0, c.radiusPx));
}

const formatFlux = (flux: number) => `${flux.toExponential(2)} N\u00B7m\u00B2/C`;

export function useGaussChallenge(onScored: (result: Score) => void) {
  const [challenge, setChallenge] = useState<GaussChallenge>(randomChallenge);
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const next = useCallback(() => {
    setChallenge(randomChallenge());
    setGuess("");
    setFeedback(null);
  }, []);

  const check = useCallback(() => {
    const guessValue = parseFloat(guess);
    if (Number.isNaN(guessValue)) {
      setFeedback("Please enter a valid number (in N\u00B7m\u00B2/C).");
      return;
    }

    const actual = challengeFlux(challenge);
    const result = calculateAccuracy(guessValue, actual, Math.abs(actual) * 0.5 || 100);
    onScored(result);

    if (result.points > 0) {
      setFeedback(`${result.label} Actual \u03A6 = ${formatFlux(actual)}`);
      setTimeout(next, 2000);
    } else {
      const qEnc = enclosedCharge(challenge.cfg, challenge.q, 0, 0, challenge.radiusPx);
      setFeedback(`Not quite. Hint: \u03A6 = Q_enc/\u03B5\u2080 and Q_enc = ${(qEnc * 1e9).toFixed(2)} nC.`);
    }
  }, [challenge, guess, next, onScored]);

  return { challenge, guess, setGuess, feedback, next, check };
}
