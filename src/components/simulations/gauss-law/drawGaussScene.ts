import { drawArrow, drawInfoPanel } from "@/lib/simulation/drawing";
import {
  type ChargeConfig,
  type Vec2,
  CHARGE_SYMBOL,
  CHARGE_UNIT,
  MAX_CHARGE,
  METERS_PER_PX,
  SPHERE_RADIUS_PX,
  enclosedCharge,
  fieldAt,
  fieldRayCount,
  fluxFromCharge,
  referenceField,
} from "@/lib/simulation/gauss-law";

export interface GaussScene {
  cfg: ChargeConfig;
  q: number;
  surfaceCenter: Vec2;
  surfaceRadius: number;
  width: number;
  height: number;
  time: number;
  showField: boolean;
  showFlux: boolean;
  hideAnswers: boolean;
}

const FIELD_COLOR = "56,189,248";
const FIELD_REFERENCE_PX = 40;
const SURFACE_REFERENCE_PX = 120;
const SURFACE_SAMPLE_COUNT = 20;
const RADIAL_DISTANCES = [40, 75, 115, 165, 225];
const LINE_OFFSETS = [40, 80, 130, 190, 260];
const PLANE_OFFSETS = [35, 75, 125, 185];

const chargeCenter = (scene: GaussScene): Vec2 => ({ x: scene.width / 2, y: scene.height / 2 });

const pxToCm = (px: number) => (px * METERS_PER_PX * 100).toFixed(1);

/** 0..1 visual weight of a field strength; sqrt keeps weak-but-nonzero fields visible. */
function fieldScale(magnitude: number, reference: number): number {
  return reference > 0 ? Math.sqrt(Math.min(magnitude / reference, 1)) : 0;
}

function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

function drawPointCharge(ctx: CanvasRenderingContext2D, c: Vec2, q: number) {
  const positive = q >= 0;
  const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 45);
  glow.addColorStop(0, positive ? "rgba(239,68,68,0.5)" : "rgba(59,130,246,0.5)");
  glow.addColorStop(1, positive ? "rgba(239,68,68,0)" : "rgba(59,130,246,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 45, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = positive ? "#ef4444" : "#3b82f6";
  ctx.beginPath();
  ctx.arc(c.x, c.y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = positive ? "#fca5a5" : "#93c5fd";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(positive ? "+" : "\u2212", c.x, c.y + 1);
  ctx.textBaseline = "alphabetic";

  ctx.font = "10px ui-monospace, monospace";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`Q = ${q} nC`, c.x, c.y + 32);
}

function drawLineCharge(ctx: CanvasRenderingContext2D, c: Vec2, q: number, H: number) {
  const glow = ctx.createLinearGradient(c.x - 20, 0, c.x + 20, 0);
  glow.addColorStop(0, "rgba(168,85,247,0)");
  glow.addColorStop(0.5, "rgba(168,85,247,0.25)");
  glow.addColorStop(1, "rgba(168,85,247,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(c.x - 20, 0, 40, H);

  ctx.strokeStyle = "#a855f7";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(c.x, 0);
  ctx.lineTo(c.x, H);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#a855f7";
  for (let y = 20; y < H; y += 30) {
    ctx.beginPath();
    ctx.arc(c.x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.font = "10px ui-monospace, monospace";
  ctx.fillStyle = "#c4b5fd";
  ctx.textAlign = "left";
  ctx.fillText("infinite line charge", c.x + 12, H - 30);
  ctx.fillText(`\u03BB = ${q} nC/m`, c.x + 12, H - 16);
}

function drawChargedSphere(ctx: CanvasRenderingContext2D, c: Vec2, q: number) {
  const R = SPHERE_RADIUS_PX;
  const grad = ctx.createRadialGradient(c.x - 10, c.y - 10, 5, c.x, c.y, R);
  grad.addColorStop(0, "rgba(34,197,94,0.4)");
  grad.addColorStop(0.7, "rgba(34,197,94,0.15)");
  grad.addColorStop(1, "rgba(34,197,94,0.05)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = "10px ui-monospace, monospace";
  ctx.fillStyle = "#86efac";
  ctx.textAlign = "center";
  ctx.fillText(`R = ${pxToCm(R)} cm`, c.x, c.y + R + 16);
  ctx.fillText(`Q = ${q} nC (uniform)`, c.x, c.y + R + 30);

  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawChargedPlane(ctx: CanvasRenderingContext2D, c: Vec2, q: number, W: number) {
  const glow = ctx.createLinearGradient(0, c.y - 20, 0, c.y + 20);
  glow.addColorStop(0, "rgba(245,158,11,0)");
  glow.addColorStop(0.5, "rgba(245,158,11,0.2)");
  glow.addColorStop(1, "rgba(245,158,11,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, c.y - 20, W, 40);

  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, c.y);
  ctx.lineTo(W, c.y);
  ctx.stroke();

  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 12px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let x = 30; x < W; x += 40) {
    ctx.fillText(q >= 0 ? "+" : "\u2212", x, c.y);
  }
  ctx.textBaseline = "alphabetic";

  ctx.font = "10px ui-monospace, monospace";
  ctx.fillStyle = "#fcd34d";
  ctx.textAlign = "right";
  ctx.fillText(`\u03C3 = ${q} nC/m\u00B2`, W - 12, c.y - 14);
}

function drawCharge(ctx: CanvasRenderingContext2D, scene: GaussScene) {
  const c = chargeCenter(scene);
  switch (scene.cfg) {
    case "point":
      return drawPointCharge(ctx, c, scene.q);
    case "line":
      return drawLineCharge(ctx, c, scene.q, scene.height);
    case "sphere":
      return drawChargedSphere(ctx, c, scene.q);
    case "plane":
      return drawChargedPlane(ctx, c, scene.q, scene.width);
  }
}

/** Anchor points for the field arrows; their number grows with |charge| like textbook field lines. */
function fieldArrowAnchors(scene: GaussScene): Vec2[] {
  const rays = fieldRayCount(scene.q);
  const c = chargeCenter(scene);
  const anchors: Vec2[] = [];

  switch (scene.cfg) {
    case "point":
    case "sphere":
      for (let i = 0; i < rays; i++) {
        const angle = (i / rays) * Math.PI * 2;
        for (const d of RADIAL_DISTANCES) {
          anchors.push({ x: c.x + Math.cos(angle) * d, y: c.y + Math.sin(angle) * d });
        }
      }
      break;
    case "line": {
      const rows = Math.min(rays, Math.floor(scene.height / 22));
      for (let j = 0; j < rows; j++) {
        const y = (scene.height * (j + 0.5)) / rows;
        for (const d of LINE_OFFSETS) {
          anchors.push({ x: c.x - d, y }, { x: c.x + d, y });
        }
      }
      break;
    }
    case "plane": {
      const cols = Math.min(rays, Math.floor(scene.width / 28));
      for (let j = 0; j < cols; j++) {
        const x = (scene.width * (j + 0.5)) / cols;
        for (const d of PLANE_OFFSETS) {
          anchors.push({ x, y: c.y - d }, { x, y: c.y + d });
        }
      }
      break;
    }
  }
  return anchors;
}

function drawFieldArrows(ctx: CanvasRenderingContext2D, scene: GaussScene) {
  const c = chargeCenter(scene);
  const reference = referenceField(scene.cfg, FIELD_REFERENCE_PX);
  const margin = 10;

  for (const a of fieldArrowAnchors(scene)) {
    if (a.x < margin || a.x > scene.width - margin || a.y < margin || a.y > scene.height - margin) continue;
    const e = fieldAt(scene.cfg, scene.q, a.x - c.x, a.y - c.y);
    const mag = Math.hypot(e.x, e.y);
    if (mag === 0) continue;

    const s = fieldScale(mag, reference);
    const len = 6 + s * 26;
    const alpha = 0.25 + s * 0.65;
    drawArrow(ctx, a.x, a.y, (e.x / mag) * len, (e.y / mag) * len, `rgba(${FIELD_COLOR},${alpha})`, {
      lineWidth: 1.5,
      headSize: 5,
    });
  }
}

function drawGaussianSurface(ctx: CanvasRenderingContext2D, scene: GaussScene) {
  const { surfaceCenter: sc, surfaceRadius: r } = scene;
  const pulse = Math.sin(scene.time * 2) * 0.15 + 1;
  ctx.save();
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 6]);
  ctx.shadowColor = "#22c55e";
  ctx.shadowBlur = 8 * pulse;
  ctx.beginPath();
  ctx.arc(sc.x, sc.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.font = "bold 10px ui-monospace, monospace";
  ctx.fillStyle = "#4ade80";
  ctx.textAlign = "center";
  ctx.fillText("Gaussian Surface", sc.x, sc.y - r - 10);
}

/** E·n̂ sampled around the surface: green where flux leaves, red where it enters. */
function drawSurfaceFlux(ctx: CanvasRenderingContext2D, scene: GaussScene) {
  const c = chargeCenter(scene);
  const { surfaceCenter: sc, surfaceRadius: r } = scene;
  const reference = referenceField(scene.cfg, SURFACE_REFERENCE_PX);

  for (let i = 0; i < SURFACE_SAMPLE_COUNT; i++) {
    const angle = (i / SURFACE_SAMPLE_COUNT) * Math.PI * 2;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const sx = sc.x + nx * r;
    const sy = sc.y + ny * r;

    const e = fieldAt(scene.cfg, scene.q, sx - c.x, sy - c.y);
    const eDotN = e.x * nx + e.y * ny;
    const s = fieldScale(Math.abs(eDotN), reference);
    const len = s * 30;
    if (len < 2) continue;

    const outward = eDotN >= 0;
    const color = outward ? `rgba(34,197,94,${0.5 + s * 0.4})` : `rgba(239,68,68,${0.5 + s * 0.4})`;
    const dir = outward ? 1 : -1;
    drawArrow(ctx, sx, sy, nx * dir * len, ny * dir * len, color, { lineWidth: 2, headSize: 5 });
  }
}

function drawEnclosedIndicator(ctx: CanvasRenderingContext2D, scene: GaussScene) {
  const { surfaceCenter: sc, surfaceRadius: r } = scene;
  const phase = (scene.time * 0.8) % 1;
  ctx.strokeStyle = `rgba(34,197,94,${0.3 - phase * 0.3})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sc.x, sc.y, r * (0.3 + phase * 0.7), 0, Math.PI * 2);
  ctx.stroke();
}

function drawFluxBar(ctx: CanvasRenderingContext2D, scene: GaussScene, flux: number) {
  const maxFlux = fluxFromCharge(MAX_CHARGE * 1e-9);
  const fraction = Math.min(Math.abs(flux) / maxFlux, 1);
  const x = 12;
  const y = scene.height - 40;
  const w = 200;
  const h = 12;

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.roundRect(x - 4, y - 20, w + 8, h + 32, 6);
  ctx.fill();

  ctx.font = "bold 10px ui-monospace, monospace";
  ctx.fillStyle = "#38bdf8";
  ctx.textAlign = "left";
  ctx.fillText(`|\u03A6| = ${Math.abs(flux).toExponential(2)} N\u00B7m\u00B2/C`, x, y - 6);

  ctx.fillStyle = "rgba(56,189,248,0.15)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();

  if (fraction > 0) {
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.roundRect(x, y, w * fraction, h, h / 2);
    ctx.fill();
  }
}

function drawReadout(ctx: CanvasRenderingContext2D, scene: GaussScene, qEnc: number, flux: number) {
  const hidden = scene.hideAnswers;
  const label = scene.cfg.charAt(0).toUpperCase() + scene.cfg.slice(1);
  drawInfoPanel(ctx, 12, 12, 230, 115, "GAUSS\u2019S LAW", [
    { label: "Config:", value: label, color: "#94a3b8" },
    {
      label: `${CHARGE_SYMBOL[scene.cfg]}:`,
      value: `${scene.q} ${CHARGE_UNIT[scene.cfg]}`,
      color: "#94a3b8",
    },
    {
      label: "Q_enc:",
      value: hidden ? "???" : `${(qEnc * 1e9).toFixed(2)} nC`,
      color: hidden || qEnc === 0 ? "#94a3b8" : "#22c55e",
    },
    {
      label: "Flux \u03A6:",
      value: hidden ? "???" : `${flux.toExponential(2)} N\u00B7m\u00B2/C`,
      color: hidden ? "#94a3b8" : "#38bdf8",
    },
    { label: "Surface R:", value: `${pxToCm(scene.surfaceRadius)} cm`, color: "#a78bfa" },
  ]);

  ctx.font = "12px system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.textAlign = "right";
  ctx.fillText("Drag the Gaussian surface \u2022 Resize with slider", scene.width - 12, scene.height - 10);
}

export function drawGaussScene(ctx: CanvasRenderingContext2D, scene: GaussScene) {
  const c = chargeCenter(scene);
  drawBackground(ctx, scene.width, scene.height);
  drawCharge(ctx, scene);
  if (scene.showField) drawFieldArrows(ctx, scene);
  drawGaussianSurface(ctx, scene);
  if (scene.showFlux) drawSurfaceFlux(ctx, scene);

  const qEnc = enclosedCharge(
    scene.cfg,
    scene.q,
    scene.surfaceCenter.x - c.x,
    scene.surfaceCenter.y - c.y,
    scene.surfaceRadius,
  );
  const flux = fluxFromCharge(qEnc);
  if (qEnc !== 0) drawEnclosedIndicator(ctx, scene);
  drawReadout(ctx, scene, qEnc, flux);
  if (!scene.hideAnswers) drawFluxBar(ctx, scene, flux);
}
