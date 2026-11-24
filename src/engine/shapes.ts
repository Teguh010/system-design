import type { Entity } from '../types.ts';
import { convexHull, project, pts, type Pt } from './iso.ts';
import { svg, textWidth } from './svg.ts';

/** Geometry in the entity's local space (origin = its projected ground anchor). */
export interface Geo {
  hull: Pt[];
  center: Pt;
}

type G = SVGGElement;

function line(g: G, a: Pt, b: Pt, cls = 'deco') {
  svg('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: cls }, g);
}

/** A w × d × h box centred on the origin; returns its corner points. */
function box(g: G, w: number, d: number, h: number): Pt[] {
  const hw = w / 2;
  const hd = d / 2;
  const A0 = project(-hw, -hd, 0);
  const B0 = project(hw, -hd, 0);
  const C0 = project(hw, hd, 0);
  const A1 = project(-hw, -hd, h);
  const B1 = project(hw, -hd, h);
  const C1 = project(hw, hd, h);
  const D1 = project(-hw, hd, h);
  svg('polygon', { points: pts([A0, B0, B1, A1]), class: 'face f-l' }, g);
  svg('polygon', { points: pts([B0, C0, C1, B1]), class: 'face f-r' }, g);
  svg('polygon', { points: pts([A1, B1, C1, D1]), class: 'face f-top' }, g);
  return [A0, B0, C0, A1, B1, C1, D1];
}

function cylinder(g: G, r: number, h: number, ox = 0, oy = 0, bands = 0): Pt[] {
  const rx = 14 * Math.SQRT2 * r;
  const ry = 7 * Math.SQRT2 * r;
  const H = 14 * h;
  const at = (x: number, y: number) => `${x + ox} ${y + oy}`;
  svg('path', { d: `M ${at(-rx, -H)} L ${at(-rx, 0)} A ${rx} ${ry} 0 0 0 ${at(rx, 0)} L ${at(rx, -H)} Z`, class: 'face f-l' }, g);
  svg(
    'path',
    { d: `M ${at(0, ry - H)} L ${at(0, ry)} A ${rx} ${ry} 0 0 0 ${at(rx, 0)} L ${at(rx, -H)} A ${rx} ${ry} 0 0 1 ${at(0, ry - H)} Z`, class: 'face f-r' },
    g,
  );
  for (let i = 1; i <= bands; i++) {
    const y = -H + (H * i) / (bands + 1);
    svg('path', { d: `M ${at(-rx, y)} A ${rx} ${ry} 0 0 0 ${at(rx, y)}`, class: 'deco' }, g);
  }
  svg('ellipse', { cx: ox, cy: oy - H, rx, ry, class: 'face f-top' }, g);
  const out: Pt[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    out.push([ox + rx * Math.cos(a), oy + ry * Math.sin(a)], [ox + rx * Math.cos(a), oy - H + ry * Math.sin(a)]);
  }
  return out;
}

function person(g: G, dx: number, dy: number): Pt[] {
  const [ox, oy] = project(dx, dy);
  const body = cylinder(g, 0.42, 0.85, ox, oy);
  const headY = oy - 14 * 0.85 - 9;
  svg('circle', { cx: ox, cy: headY, r: 6, class: 'face f-top' }, g);
  return [...body, [ox - 6, headY - 6], [ox + 6, headY - 6]];
}

const CROWD: [number, number][] = [
  [-0.8, -0.8],
  [0.8, 0.8],
  [0.45, -0.45],
];

function drawShape(g: G, e: Entity): { points: Pt[]; h: number } {
  switch (e.kind) {
    case 'server': {
      const h = 2.4;
      const p = box(g, 2, 2, h);
      for (const z of [0.8, 1.6]) line(g, project(-0.8, -1, z), project(0.8, -1, z));
      for (const z of [0.4, 1.2, 2.0]) svg('circle', { cx: project(0.6, -1, z)[0], cy: project(0.6, -1, z)[1], r: 1.6, class: 'led' }, g);
      return { points: p, h };
    }
    case 'service': {
      const h = 1.8;
      const p = box(g, 2, 2, h);
      line(g, project(-0.7, -1, 0.6), project(0.3, -1, 0.6));
      line(g, project(-0.7, -1, 1.1), project(0.6, -1, 1.1));
      return { points: p, h };
    }
    case 'worker': {
      const h = 1.6;
      const p = box(g, 1.8, 1.8, h);
      for (const t of [-0.5, 0, 0.5]) {
        const c = project(t, -0.9, 0.8);
        svg('circle', { cx: c[0], cy: c[1], r: 2.2, class: 'deco-fill' }, g);
      }
      return { points: p, h };
    }
    case 'cdn': {
      const h = 1.3;
      const p = box(g, 2.2, 2.2, h);
      const ring = [0, 1, 2, 3, 4, 5].map((i): Pt => {
        const a = (i / 6) * Math.PI * 2;
        return project(0.6 * Math.cos(a), 0.6 * Math.sin(a), h);
      });
      svg('polygon', { points: pts(ring), class: 'deco' }, g);
      for (const r of ring) svg('circle', { cx: r[0], cy: r[1], r: 1.8, class: 'deco-fill' }, g);
      const c = project(0, 0, h);
      svg('circle', { cx: c[0], cy: c[1], r: 2.4, class: 'deco-fill' }, g);
      return { points: p, h };
    }
    case 'cache': {
      const h = 1.2;
      const p = box(g, 2, 2, h);
      const bolt: [number, number][] = [
        [0.15, 1.0],
        [-0.3, 0.55],
        [0.0, 0.55],
        [-0.15, 0.2],
        [0.3, 0.68],
        [0.0, 0.68],
      ];
      svg('polygon', { points: pts(bolt.map(([t, z]) => project(t, -1, z))), class: 'deco-fill' }, g);
      return { points: p, h };
    }
    case 'lb': {
      const h = 0.8;
      const p = box(g, 2.4, 2.4, h);
      const from = project(-0.65, -0.65, h);
      for (const o of [-0.55, 0, 0.55]) {
        const to = project(0.6 + o, 0.6 - o, h);
        line(g, from, to);
        svg('circle', { cx: to[0], cy: to[1], r: 2, class: 'deco-fill' }, g);
      }
      return { points: p, h };
    }
    case 'queue': {
      const h = 1.1;
      const w = 3.6;
      const p = box(g, w, 1.4, h);
      for (let i = 1; i < 5; i++) {
        const t = -w / 2 + (i * w) / 5;
        line(g, project(t, -0.7, 0.12), project(t, -0.7, h - 0.12));
      }
      return { points: p, h };
    }
    case 'db': {
      const h = 1.8;
      return { points: cylinder(g, 1.05, h, 0, 0, 2), h };
    }
    case 'user': {
      const n = Math.max(1, Math.min(3, e.count ?? 3));
      const spots = n === 1 ? [[0, 0] as [number, number]] : CROWD.slice(0, n);
      return { points: spots.flatMap(([dx, dy]) => person(g, dx, dy)), h: 1.4 };
    }
    case 'card':
      return { points: [], h: 0 };
  }
}

function pill(g: G, text: string, cy: number, cls: string, size = 11): number {
  const w = textWidth(text, size, 600) + 14;
  const grp = svg('g', { class: cls }, g);
  svg('rect', { x: -w / 2, y: cy - 9, width: w, height: 18, rx: 9 }, grp);
  svg('text', { x: 0, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, grp).textContent = text;
  return w;
}

function drawCard(g: G, e: Entity): Geo {
  const lines = e.lines ?? [];
  const title = e.title ?? '';
  const w = Math.max(textWidth(title, 12, 700), ...lines.map((l) => textWidth(l.replace(/^[!✓#] /, ''), 11))) + 28;
  const h = 34 + lines.length * 17 + 8;
  const x = -w / 2;
  const y = -h / 2;
  svg('rect', { x: x + 4, y: y + 4, width: w, height: h, rx: 10, class: 'card-shadow' }, g);
  svg('rect', { x, y, width: w, height: h, rx: 10, class: 'card-bg' }, g);
  svg('text', { x: x + 14, y: y + 20, class: 'card-title' }, g).textContent = title;
  svg('line', { x1: x + 14, x2: x + w - 14, y1: y + 30, y2: y + 30, class: 'card-rule' }, g);
  lines.forEach((l, i) => {
    const tone = l.startsWith('! ') ? 'bad' : l.startsWith('✓ ') ? 'good' : l.startsWith('# ') ? 'muted' : '';
    const text = tone ? l.slice(2) : l;
    const t = svg('text', { x: x + 14, y: y + 48 + i * 17, class: `card-line ${tone}` }, g);
    t.textContent = text;
    t.setAttribute('xml:space', 'preserve');
  });
  return {
    hull: [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    center: [0, 0],
  };
}

/** Draws an entity into `g` (local space) and returns its outline for link clipping. */
export function drawEntity(g: G, e: Entity): Geo {
  if (e.kind === 'card') return drawCard(g, e);
  const { points, h } = drawShape(g, e);
  const shape = convexHull(points);
  const ys = shape.map((p) => p[1]);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  // Labels join the outline so links stop at their edge instead of crossing the text.
  const extra: Pt[] = [];
  const box = (w: number, y0: number, y1: number) => extra.push([-w / 2, y0], [w / 2, y0], [w / 2, y1], [-w / 2, y1]);
  if (e.label) box(pill(g, e.label, bottom + 14, 'pill'), bottom + 5, bottom + 23);
  if (e.sub) {
    svg('text', { x: 0, y: bottom + 36, 'text-anchor': 'middle', class: 'sub' }, g).textContent = e.sub;
    box(textWidth(e.sub, 10) + 4, bottom + 27, bottom + 40);
  }
  const badge = e.badge ?? (e.down ? { text: 'DOWN', tone: 'bad' as const } : undefined);
  if (badge) box(pill(g, badge.text, top - 14, `badge tone-${badge.tone ?? 'info'}`, 10), top - 23, top - 5);
  return { hull: convexHull([...points, ...extra]), center: project(0, 0, h / 2) };
}
