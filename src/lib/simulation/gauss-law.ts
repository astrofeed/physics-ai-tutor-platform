/**
 * Physics for the Gauss's law simulation.
 *
 * Geometry is a 2-D cross-section drawn on the canvas at 1 px = 1 mm.
 * The charge sits at the origin; the Gaussian surface is a sphere whose
 * centre and radius are given in pixels. The slider value `q` means
 *   point / sphere : total charge Q      [nC]
 *   line           : linear density λ    [nC/m]   (line lies in the drawing plane, vertical)
 *   plane          : surface density σ   [nC/m²]  (plane lies in the drawing plane, horizontal)
 */

export type ChargeConfig = "point" | "line" | "sphere" | "plane";

export const EPSILON_0 = 8.854187817e-12; // C²/(N·m²)
export const K_COULOMB = 8.99e9; // N·m²/C²
export const METERS_PER_PX = 0.001;
export const SPHERE_RADIUS_PX = 50;
export const MAX_CHARGE = 10; // slider range is ±MAX_CHARGE

export const CHARGE_UNIT: Record<ChargeConfig, string> = {
  point: "nC",
  sphere: "nC",
  line: "nC/m",
  plane: "nC/m²",
};

export const CHARGE_SYMBOL: Record<ChargeConfig, string> = {
  point: "Q",
  sphere: "Q",
  line: "\u03BB",
  plane: "\u03C3",
};

export interface Vec2 {
  x: number;
  y: number;
}

const toMeters = (px: number) => px * METERS_PER_PX;
const nanoToCoulomb = (q: number) => q * 1e-9;

/** Electric field (V/m) at a point given in px relative to the charge centre. Sign of q sets direction. */
export function fieldAt(cfg: ChargeConfig, q: number, px: number, py: number): Vec2 {
  const qC = nanoToCoulomb(q);
  const x = toMeters(px);
  const y = toMeters(py);

  switch (cfg) {
    case "point":
    case "sphere": {
      const r = Math.hypot(x, y);
      if (r < 1e-6) return { x: 0, y: 0 };
      const R = toMeters(SPHERE_RADIUS_PX);
      const mag =
        cfg === "sphere" && r < R ? (K_COULOMB * qC * r) / (R * R * R) : (K_COULOMB * qC) / (r * r);
      return { x: (mag * x) / r, y: (mag * y) / r };
    }
    case "line": {
      const d = Math.abs(x);
      if (d < 1e-6) return { x: 0, y: 0 };
      const mag = qC / (2 * Math.PI * EPSILON_0 * d);
      return { x: mag * Math.sign(x), y: 0 };
    }
    case "plane": {
      if (Math.abs(y) < 1e-6) return { x: 0, y: 0 };
      return { x: 0, y: (qC / (2 * EPSILON_0)) * Math.sign(y) };
    }
  }
}

export function fieldMagnitude(cfg: ChargeConfig, q: number, px: number, py: number): number {
  const e = fieldAt(cfg, q, px, py);
  return Math.hypot(e.x, e.y);
}

/** Volume shared by two spheres of radii a and b whose centres are d apart. */
function sphereIntersectionVolume(a: number, b: number, d: number): number {
  if (d >= a + b) return 0;
  const small = Math.min(a, b);
  if (d + small <= Math.max(a, b)) return (4 / 3) * Math.PI * small ** 3;
  return (
    (Math.PI * (a + b - d) ** 2 * (d * d + 2 * d * b - 3 * b * b + 2 * d * a + 6 * a * b - 3 * a * a)) /
    (12 * d)
  );
}

/**
 * Charge (C) enclosed by a spherical Gaussian surface of radius `surfRPx`
 * whose centre is at (`cxPx`, `cyPx`) relative to the charge.
 */
export function enclosedCharge(cfg: ChargeConfig, q: number, cxPx: number, cyPx: number, surfRPx: number): number {
  const qC = nanoToCoulomb(q);
  const r = toMeters(surfRPx);
  const cx = toMeters(cxPx);
  const cy = toMeters(cyPx);

  switch (cfg) {
    case "point":
      return Math.hypot(cx, cy) < r ? qC : 0;
    case "sphere": {
      const R = toMeters(SPHERE_RADIUS_PX);
      const sphereVolume = (4 / 3) * Math.PI * R ** 3;
      return (qC * sphereIntersectionVolume(R, r, Math.hypot(cx, cy))) / sphereVolume;
    }
    case "line": {
      const d = Math.abs(cx);
      if (d >= r) return 0;
      return qC * 2 * Math.sqrt(r * r - d * d);
    }
    case "plane": {
      const d = Math.abs(cy);
      if (d >= r) return 0;
      return qC * Math.PI * (r * r - d * d);
    }
  }
}

export function fluxFromCharge(qEnc: number): number {
  return qEnc / EPSILON_0;
}

/** Field strength used to normalise arrow lengths: the maximum slider charge at a fixed reference distance. */
export function referenceField(cfg: ChargeConfig, referencePx: number): number {
  const diagonal = referencePx / Math.SQRT2;
  return fieldMagnitude(cfg, MAX_CHARGE, diagonal, diagonal);
}

const RAYS_PER_UNIT_CHARGE = 2.4;
const MIN_RAYS = 4;

/**
 * Number of field-line "rays" drawn for a charge, mimicking the textbook
 * convention that field-line density is proportional to |charge|.
 */
export function fieldRayCount(q: number): number {
  if (q === 0) return 0;
  return Math.max(MIN_RAYS, Math.round(Math.abs(q) * RAYS_PER_UNIT_CHARGE));
}
