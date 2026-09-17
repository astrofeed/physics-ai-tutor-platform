"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { ParticleSystem } from "@/lib/simulation/particles";
import { playSFX, playScore } from "@/lib/simulation/sound";
import {
  renderScorePopup,
  renderScoreboard,
  createChallengeState,
  updateChallengeState,
  type Score,
  type ScorePopup,
  type ChallengeState,
} from "@/lib/simulation/scoring";
import { createDragHandler } from "@/lib/simulation/interaction";
import { setupHiDPICanvas } from "@/lib/simulation/canvas";
import type { ChargeConfig } from "@/lib/simulation/gauss-law";
import { drawGaussScene } from "./gauss-law/drawGaussScene";
import { GaussLawControls } from "./gauss-law/GaussLawControls";
import { GaussChallengePanel } from "./gauss-law/GaussChallengePanel";
import { GaussLawNotes } from "./gauss-law/GaussLawNotes";
import { useGaussChallenge } from "./gauss-law/useGaussChallenge";

const DEFAULT_CHARGE = 5;
const DEFAULT_SURFACE_RADIUS = 120;
const CENTERED = { x: 0.5, y: 0.5 };

export default function GaussLaw() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const [config, setConfig] = useState<ChargeConfig>("point");
  const [charge, setCharge] = useState(DEFAULT_CHARGE);
  const [surfaceRadius, setSurfaceRadius] = useState(DEFAULT_SURFACE_RADIUS);
  const [showField, setShowField] = useState(true);
  const [showFlux, setShowFlux] = useState(true);
  const [challengeActive, setChallengeActive] = useState(false);

  const particlesRef = useRef(new ParticleSystem());
  const challengeRef = useRef<ChallengeState>(createChallengeState());
  const popupsRef = useRef<ScorePopup[]>([]);
  const timeRef = useRef(0);
  const surfaceDraggingRef = useRef(false);
  const surfaceCenterRef = useRef(CENTERED); // normalized canvas coords

  const sceneRef = useRef({ config, charge, surfaceRadius, showField, showFlux, challengeActive });
  useEffect(() => {
    sceneRef.current = { config, charge, surfaceRadius, showField, showFlux, challengeActive };
  }, [config, charge, surfaceRadius, showField, showFlux, challengeActive]);

  const onScored = useCallback((result: Score) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;
    challengeRef.current = updateChallengeState(challengeRef.current, result);
    popupsRef.current.push({ text: result.label, points: result.points, x: cx, y: cy, startTime: performance.now() });

    if (result.points === 0) {
      playSFX("incorrect");
      return;
    }
    playSFX("correct");
    playScore(result.points);
    if (result.tier === "perfect") particlesRef.current.emitConfetti(cx, cy, 20);
    else particlesRef.current.emitGlow(cx, cy, 10, "#22c55e");
  }, []);

  const quiz = useGaussChallenge(onScored);

  // The canvas shows the geometry the student is asked about (answers stay hidden).
  useEffect(() => {
    if (!challengeActive) return;
    setConfig(quiz.challenge.cfg);
    setCharge(quiz.challenge.q);
    setSurfaceRadius(quiz.challenge.radiusPx);
    surfaceCenterRef.current = CENTERED;
  }, [challengeActive, quiz.challenge]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    const s = sceneRef.current;
    drawGaussScene(ctx, {
      cfg: s.config,
      q: s.charge,
      surfaceCenter: { x: surfaceCenterRef.current.x * W, y: surfaceCenterRef.current.y * H },
      surfaceRadius: s.surfaceRadius,
      width: W,
      height: H,
      time: timeRef.current,
      showField: s.showField,
      showFlux: s.showFlux,
      hideAnswers: s.challengeActive,
    });

    particlesRef.current.draw(ctx);
    const now = performance.now();
    popupsRef.current = popupsRef.current.filter((p) => renderScorePopup(ctx, p, now));
    if (challengeRef.current.active) renderScoreboard(ctx, W - 172, H - 140, 160, 120, challengeRef.current);
  }, []);

  useEffect(() => {
    const animate = () => {
      timeRef.current += 0.016;
      particlesRef.current.update(0.016);
      draw();
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const container = canvas.parentElement;
      if (!container) return;
      const isMobile = container.clientWidth < 640;
      setupHiDPICanvas(canvas, container.clientWidth, Math.min(container.clientWidth * (isMobile ? 1 : 0.55), 500));
      draw();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return createDragHandler(canvas, {
      onDragStart: (x, y) => {
        if (sceneRef.current.challengeActive) return false;
        const scx = surfaceCenterRef.current.x * canvas.clientWidth;
        const scy = surfaceCenterRef.current.y * canvas.clientHeight;
        surfaceDraggingRef.current = Math.hypot(x - scx, y - scy) < sceneRef.current.surfaceRadius + 20;
        return surfaceDraggingRef.current;
      },
      onDrag: (x, y) => {
        if (!surfaceDraggingRef.current) return;
        surfaceCenterRef.current = {
          x: Math.max(0.1, Math.min(0.9, x / canvas.clientWidth)),
          y: Math.max(0.1, Math.min(0.9, y / canvas.clientHeight)),
        };
      },
      onDragEnd: () => {
        surfaceDraggingRef.current = false;
      },
    });
  }, []);

  const changeConfig = (cfg: ChargeConfig) => {
    setConfig(cfg);
    surfaceCenterRef.current = CENTERED;
    playSFX("click");
  };

  const toggleChallenge = () => {
    if (challengeActive) {
      setChallengeActive(false);
      challengeRef.current = createChallengeState();
      return;
    }
    setChallengeActive(true);
    challengeRef.current = { ...createChallengeState(), active: true, description: "Predict the flux" };
    quiz.next();
    playSFX("powerup");
  };

  const reset = () => {
    surfaceCenterRef.current = CENTERED;
    setSurfaceRadius(DEFAULT_SURFACE_RADIUS);
    setCharge(DEFAULT_CHARGE);
    playSFX("pop");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-gray-950">
        <canvas ref={canvasRef} className="w-full cursor-grab active:cursor-grabbing" />
      </div>

      <GaussLawControls
        config={config}
        charge={charge}
        surfaceRadius={surfaceRadius}
        showField={showField}
        showFlux={showFlux}
        challengeActive={challengeActive}
        onConfigChange={changeConfig}
        onChargeChange={setCharge}
        onSurfaceRadiusChange={setSurfaceRadius}
        onToggleField={() => setShowField((v) => !v)}
        onToggleFlux={() => setShowFlux((v) => !v)}
        onToggleChallenge={toggleChallenge}
        onReset={reset}
      />

      {challengeActive && (
        <GaussChallengePanel
          challenge={quiz.challenge}
          guess={quiz.guess}
          feedback={quiz.feedback}
          state={challengeRef.current}
          onGuessChange={quiz.setGuess}
          onCheck={quiz.check}
          onSkip={quiz.next}
        />
      )}

      <GaussLawNotes />
    </div>
  );
}
