"use client";

import {
  type ChargeConfig,
  CHARGE_SYMBOL,
  CHARGE_UNIT,
  MAX_CHARGE,
  METERS_PER_PX,
} from "@/lib/simulation/gauss-law";

const CONFIG_OPTIONS: Array<{ value: ChargeConfig; label: string; activeClass: string }> = [
  { value: "point", label: "Point Charge", activeClass: "bg-red-600 text-white" },
  { value: "line", label: "Line Charge", activeClass: "bg-purple-600 text-white" },
  { value: "sphere", label: "Charged Sphere", activeClass: "bg-green-600 text-white" },
  { value: "plane", label: "Charged Plane", activeClass: "bg-amber-600 text-white" },
];

const inactiveClass =
  "border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800";

const toggleClass = (on: boolean, onClass: string) =>
  `px-4 h-10 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${on ? onClass : inactiveClass}`;

interface GaussLawControlsProps {
  config: ChargeConfig;
  charge: number;
  surfaceRadius: number;
  showField: boolean;
  showFlux: boolean;
  /** Challenge mode fixes the geometry so the picture matches the question. */
  challengeActive: boolean;
  onConfigChange: (cfg: ChargeConfig) => void;
  onChargeChange: (q: number) => void;
  onSurfaceRadiusChange: (r: number) => void;
  onToggleField: () => void;
  onToggleFlux: () => void;
  onToggleChallenge: () => void;
  onReset: () => void;
}

export function GaussLawControls(p: GaussLawControlsProps) {
  const radiusCm = (p.surfaceRadius * METERS_PER_PX * 100).toFixed(1);

  return (
    <>
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
          Charge Configuration
        </label>
        <div className="flex flex-wrap gap-2">
          {CONFIG_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => p.onConfigChange(opt.value)}
              disabled={p.challengeActive}
              className={toggleClass(p.config === opt.value, opt.activeClass)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Charge <span className="normal-case">{CHARGE_SYMBOL[p.config]}</span> (
            <span className="normal-case">{CHARGE_UNIT[p.config]}</span>)
          </label>
          <div className="flex items-center gap-3 mt-2">
            <input
              type="range"
              min={-MAX_CHARGE}
              max={MAX_CHARGE}
              step={0.5}
              value={p.charge}
              disabled={p.challengeActive}
              onChange={(e) => p.onChargeChange(Number(e.target.value))}
              className="flex-1 accent-blue-500"
            />
            <span className="text-sm font-mono font-bold text-gray-900 dark:text-gray-100 w-24 text-right">
              {p.charge} {CHARGE_UNIT[p.config]}
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Gaussian Surface Radius
          </label>
          <div className="flex items-center gap-3 mt-2">
            <input
              type="range"
              min={30}
              max={220}
              step={5}
              value={p.surfaceRadius}
              disabled={p.challengeActive}
              onChange={(e) => p.onSurfaceRadiusChange(Number(e.target.value))}
              className="flex-1 accent-green-500"
            />
            <span className="text-sm font-mono font-bold text-gray-900 dark:text-gray-100 w-24 text-right">
              {radiusCm} cm
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={p.onToggleField} className={toggleClass(p.showField, "bg-cyan-600 text-white")}>
          E-Field Arrows
        </button>
        <button onClick={p.onToggleFlux} className={toggleClass(p.showFlux, "bg-green-600 text-white")}>
          Flux at Surface
        </button>
        <div className="h-10 w-px bg-gray-200 dark:bg-gray-700" />
        <button onClick={p.onToggleChallenge} className={toggleClass(p.challengeActive, "bg-amber-600 text-white")}>
          {p.challengeActive ? "Exit Challenge" : "Predict the Flux"}
        </button>
        <button onClick={p.onReset} disabled={p.challengeActive} className={toggleClass(false, "")}>
          Reset
        </button>
      </div>
    </>
  );
}
