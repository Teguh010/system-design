export type Pt = [number, number];

export const UNIT_X = 14;
export const UNIT_Y = 7;
export const UNIT_Z = 14;

/** 2:1 isometric projection from grid space to screen pixels. */
export function project(x: number, y: number, z = 0): Pt {
  return [UNIT_X * (x + y), UNIT_Y * (x - y) - UNIT_Z * z];
}

const round = (n: number) => Math.round(n * 100) / 100;

export const fmt = (p: Pt) => `${round(p[0])},${round(p[1])}`;
export const pts = (list: Pt[]) => list.map(fmt).join(' ');

const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];

export function convexHull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const turn = (o: Pt, a: Pt, b: Pt) => cross([a[0] - o[0], a[1] - o[1]], [b[0] - o[0], b[1] - o[1]]);
  const lower: Pt[] = [];
  for (const pt of p) {
    while (lower.length >= 2 && turn(lower[lower.length - 2]!, lower[lower.length - 1]!, pt) <= 0) lower.pop();
    lower.push(pt);
  }
  const upper: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i]!;
    while (upper.length >= 2 && turn(upper[upper.length - 2]!, upper[upper.length - 1]!, pt) <= 0) upper.pop();
    upper.push(pt);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Distance factor t at which the ray `c + t·d` leaves the convex polygon (0 if it never hits). */
export function rayExit(c: Pt, d: Pt, poly: Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const e: Pt = [b[0] - a[0], b[1] - a[1]];
    const den = cross(d, e);
    if (Math.abs(den) < 1e-9) continue;
    const w: Pt = [a[0] - c[0], a[1] - c[1]];
    const t = cross(w, e) / den;
    const u = cross(w, d) / den;
    if (t >= 0 && u >= -1e-9 && u <= 1 + 1e-9 && t < best) best = t;
  }
  return best === Infinity ? 0 : best;
}
