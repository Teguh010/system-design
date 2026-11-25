import type { Entity, IconName } from '../types.ts';
import { convexHull, project, pts, type Pt } from './iso.ts';
import { svg, textWidth } from './svg.ts';

/** Geometry in the entity's local space (origin = its projected ground anchor). */
export interface Geo {
  hull: Pt[];
  center: Pt;
  /** Ground footprint as a 2:1 ellipse centred at (cx, 0): where shadows and focus glows sit. */
  foot: { cx: number; rx: number } | null;
}

export interface DrawOpts {
  /** Rack units from this index up are new since the last step and drop in. */
  newFrom?: number;
}

/** Pseudo-random but stable LED timing, so a rack blinks the same way on every replay. */
const blink = (i: number) => `--d:${((i * 7919) % 29) / 10}s;--p:${1.6 + ((i * 104729) % 17) / 10}s`;

type G = SVGGElement;

function line(g: G, a: Pt, b: Pt, cls = 'deco') {
  svg('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: cls }, g);
}

/** A w × d × h box centred on the origin, sitting at height z0; returns its corner points. */
function box(g: G, w: number, d: number, h: number, z0 = 0): Pt[] {
  const hw = w / 2;
  const hd = d / 2;
  const A0 = project(-hw, -hd, z0);
  const B0 = project(hw, -hd, z0);
  const C0 = project(hw, hd, z0);
  const A1 = project(-hw, -hd, z0 + h);
  const B1 = project(hw, -hd, z0 + h);
  const C1 = project(hw, hd, z0 + h);
  const D1 = project(-hw, hd, z0 + h);
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

/** A laptop on a small platform: the browser / end user. */
function laptop(g: G): Pt[] {
  const platform = box(g, 3, 2.4, 0.3);
  const z0 = 0.3;
  const keys = box(g, 1.7, 1.2, 0.12, z0);
  const zt = z0 + 0.12;
  for (const t of [-0.25, 0.1]) line(g, project(-0.6, t, zt), project(0.6, t, zt));
  // Screen hinged on the back edge of the keyboard, leaning back slightly.
  const screen: Pt[] = [project(-0.85, 0.6, zt), project(0.85, 0.6, zt), project(0.85, 0.85, zt + 1.05), project(-0.85, 0.85, zt + 1.05)];
  svg('polygon', { points: pts(screen), class: 'face f-l' }, g);
  const c: Pt = [(screen[0]![0] + screen[2]![0]) / 2, (screen[0]![1] + screen[2]![1]) / 2];
  const inset = screen.map(([x, y]): Pt => [c[0] + (x - c[0]) * 0.8, c[1] + (y - c[1]) * 0.78]);
  svg('polygon', { points: pts(inset), class: 'screen' }, g);
  return [...platform, ...keys, ...screen];
}

const ICONS: Record<IconName, (g: G) => void> = {
  globe: (g) => {
    svg('circle', { cx: 0, cy: 0, r: 9 }, g);
    svg('ellipse', { cx: 0, cy: 0, rx: 4, ry: 9 }, g);
    svg('path', { d: 'M -9 0 H 9 M -7.5 -4.5 H 7.5 M -7.5 4.5 H 7.5' }, g);
  },
  server: (g) => {
    svg('rect', { x: -8, y: -8, width: 16, height: 6.5, rx: 2 }, g);
    svg('rect', { x: -8, y: 1.5, width: 16, height: 6.5, rx: 2 }, g);
    svg('path', { d: 'M -4.5 -4.75 h 0.1 M -4.5 4.75 h 0.1' }, g);
  },
  database: (g) => {
    svg('ellipse', { cx: 0, cy: -6, rx: 8, ry: 3 }, g);
    svg('path', { d: 'M -8 -6 V 6 A 8 3 0 0 0 8 6 V -6 M -8 0 A 8 3 0 0 0 8 0' }, g);
  },
  bolt: (g) => {
    svg('path', { d: 'M 2 -9 L -5 1 H 0 L -2 9 L 5 -1 H 0 Z' }, g);
  },
};

/** Draws an icon lying flat on the top face centred at (cx, cy). */
function icon(g: G, name: IconName, cx: number, cy: number, s: number) {
  const grp = svg('g', { class: 'icon', transform: `matrix(${s} ${s / 2} ${-s} ${s / 2} ${cx} ${cy})` }, g);
  ICONS[name](grp);
}

function led(g: G, at: Pt, i: number, act = false) {
  svg('circle', { cx: at[0], cy: at[1], r: 1.6, class: act ? 'led led-act' : 'led', style: blink(i) }, g);
}

const UNIT_H = 0.62;
const UNIT_GAP = 0.08;

/** `n` rack units stacked on each other, each with vents, a status LED and an activity LED. */
function rack(g: G, n: number, newFrom: number): Pt[] {
  const points: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const z = i * (UNIT_H + UNIT_GAP);
    const isNew = i >= newFrom;
    const u = svg('g', { class: isNew ? 'unit is-new' : 'unit', style: `--j:${i - newFrom}` }, g);
    points.push(...box(u, 2, 2, UNIT_H, z));
    for (const t of [0.22, 0.4]) line(u, project(-0.8, -1, z + UNIT_H * t + 0.1), project(0.1, -1, z + UNIT_H * t + 0.1));
    led(u, project(0.45, -1, z + UNIT_H / 2), i * 2);
    led(u, project(0.72, -1, z + UNIT_H / 2), i * 2 + 1, true);
  }
  return points;
}

/** Tank level drawn over the front of a cylinder, from the bottom up to `fill`. */
export function paintFill(g: SVGGElement, fill: number) {
  const rx = Number(g.dataset.rx);
  const ry = Number(g.dataset.ry);
  const H = Number(g.dataset.h);
  const f = Math.max(0, Math.min(1, fill));
  const L = H * f;
  const tone = f >= 0.85 ? 'bad' : f >= 0.6 ? 'warn' : 'good';
  g.setAttribute('class', `db-fill tone-${tone}${f >= 0.95 ? ' is-full' : ''}`);
  g.replaceChildren();
  if (f <= 0.005) return;
  svg('path', { d: `M ${-rx} ${-L} L ${-rx} 0 A ${rx} ${ry} 0 0 0 ${rx} 0 L ${rx} ${-L} A ${rx} ${ry} 0 0 1 ${-rx} ${-L} Z`, class: 'db-liquid' }, g);
  svg('path', { d: `M ${-rx} ${-L} A ${rx} ${ry} 0 0 0 ${rx} ${-L}`, class: 'db-level' }, g);
}

function tank(g: G, r: number, h: number, fill: number | undefined): Pt[] {
  const rx = 14 * Math.SQRT2 * r;
  const ry = 7 * Math.SQRT2 * r;
  const H = 14 * h;
  svg('path', { d: `M ${-rx} ${-H} L ${-rx} 0 A ${rx} ${ry} 0 0 0 ${rx} 0 L ${rx} ${-H} Z`, class: 'face f-l' }, g);
  svg('path', { d: `M 0 ${ry - H} L 0 ${ry} A ${rx} ${ry} 0 0 0 ${rx} 0 L ${rx} ${-H} A ${rx} ${ry} 0 0 1 0 ${ry - H} Z`, class: 'face f-r' }, g);
  if (fill !== undefined) {
    const lvl = svg('g', { 'data-rx': rx, 'data-ry': ry, 'data-h': H }, g);
    paintFill(lvl, fill);
  }
  // Disk platters: each band lights up in turn while the database is being read.
  for (let i = 1; i <= 2; i++) {
    const y = -H + (H * i) / 3;
    svg('path', { d: `M ${-rx} ${y} A ${rx} ${ry} 0 0 0 ${rx} ${y}`, class: 'deco band', style: `--b:${i}` }, g);
  }
  svg('ellipse', { cx: 0, cy: -H, rx, ry, class: 'face f-top' }, g);
  led(g, [rx * 0.62, ry * 0.78 - H * 0.12], 3, true);
  const out: Pt[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    out.push([rx * Math.cos(a), ry * Math.sin(a)], [rx * Math.cos(a), -H + ry * Math.sin(a)]);
  }
  return out;
}

function drawShape(g: G, e: Entity, opts: DrawOpts): { points: Pt[]; h: number } {
  switch (e.kind) {
    case 'client':
      return { points: laptop(g), h: 1.2 };
    case 'server': {
      if (e.count !== undefined) {
        const n = Math.max(1, Math.min(5, Math.round(e.count)));
        return { points: rack(g, n, opts.newFrom ?? n), h: n * (UNIT_H + UNIT_GAP) - UNIT_GAP };
      }
      const h = 2.4;
      const p = box(g, 2, 2, h);
      for (const z of [0.8, 1.6]) line(g, project(-0.8, -1, z), project(0.8, -1, z));
      [0.4, 1.2, 2.0].forEach((z, i) => led(g, project(0.6, -1, z), i, i === 0));
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
      return { points: tank(g, 1.05, h, e.fill), h };
    }
    case 'user': {
      const n = Math.max(1, Math.min(3, e.count ?? 3));
      const spots = n === 1 ? [[0, 0] as [number, number]] : CROWD.slice(0, n);
      return { points: spots.flatMap(([dx, dy]) => person(g, dx, dy)), h: 1.4 };
    }
    case 'tree': {
      const leaves = Math.max(3, Math.min(5, e.count ?? 3));
      const nodes: [number, number, number][] = [[0, 0, 1.85]];
      const spread = 0.9;
      nodes.push([-spread, 0, 1.02], [spread, 0, 1.02]);
      for (let i = 0; i < leaves; i++) {
        const t = leaves === 1 ? 0 : (i - (leaves - 1) / 2) * spread;
        nodes.push([t, 0, 0.12]);
      }
      const hull: Pt[] = [];
      const centers: Pt[] = [];
      for (const [dx, dy, z] of nodes) {
        const [ox, oy] = project(dx, dy, 0);
        const sub = svg('g', { transform: `translate(${ox} ${oy})` }, g);
        hull.push(...box(sub, 0.78, 0.58, 0.3, z));
        centers.push(project(dx, dy, z + 0.3));
      }
      const root = centers[0]!;
      for (let i = 1; i <= 2 && i < centers.length; i++) line(g, root, centers[i]!);
      for (let i = 1; i <= 2 && i < centers.length; i++) {
        const mid = centers[i]!;
        for (let j = 3; j < centers.length; j++) {
          if (Math.abs((nodes[j]?.[0] ?? 0) - (nodes[i]?.[0] ?? 0)) < spread * 0.75) line(g, mid, centers[j]!);
        }
      }
      return { points: hull, h: 2.4 };
    }
    case 'stack': {
      const layers = Math.max(2, Math.min(6, e.count ?? 4));
      const hull: Pt[] = [];
      for (let i = 0; i < layers; i++) {
        const z = i * 0.4;
        const shrink = i * 0.06;
        hull.push(...box(g, 2.6 - shrink, 1.9 - shrink * 0.4, 0.22, z));
        if (i < layers - 1) {
          const y = 0.85 - shrink * 0.2;
          line(g, project(-1.05 + shrink, y, z + 0.22), project(1.05 - shrink, y, z + 0.22), 'deco');
        }
      }
      return { points: hull, h: layers * 0.4 + 0.35 };
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

function meter(g: G, m: NonNullable<Entity['meter']>, cy: number): number {
  const pct = `${Math.round(Math.max(0, Math.min(1, m.value)) * 100)}%`;
  const lw = textWidth(m.label, 10, 600);
  const pw = textWidth(pct, 10, 700);
  const bar = 30;
  const w = 10 + lw + 7 + bar + 7 + pw + 10;
  const x = -w / 2;
  const grp = svg('g', { class: `meter tone-${m.tone ?? 'info'}` }, g);
  svg('rect', { x, y: cy - 9, width: w, height: 18, rx: 9, class: 'meter-bg' }, grp);
  svg('text', { x: x + 10, y: cy, 'dominant-baseline': 'central', class: 'meter-label' }, grp).textContent = m.label;
  const bx = x + 10 + lw + 7;
  svg('rect', { x: bx, y: cy - 2.5, width: bar, height: 5, rx: 2.5, class: 'meter-track' }, grp);
  svg('rect', { x: bx, y: cy - 2.5, width: Math.max(2, bar * Math.min(1, m.value)), height: 5, rx: 2.5, class: 'meter-fill' }, grp);
  svg('text', { x: bx + bar + 7, y: cy, 'dominant-baseline': 'central', class: 'meter-pct' }, grp).textContent = pct;
  return w;
}

function drawCard(g: G, e: Entity): Omit<Geo, 'foot'> {
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
export function drawEntity(g: G, e: Entity, opts: DrawOpts = {}): Geo {
  if (e.kind === 'card') return { ...drawCard(g, e), foot: null };
  const k = e.size ?? 1;
  const sg = k === 1 ? g : svg('g', { transform: `scale(${k})` }, g);
  const { points: raw, h } = drawShape(sg, e, opts);
  if (e.icon) {
    const [cx, cy] = project(0, 0, h);
    icon(sg, e.icon, cx, cy, e.kind === 'db' ? 0.62 : 0.8);
  }
  const points = raw.map(([x, y]): Pt => [x * k, y * k]);
  const shape = convexHull(points);
  const xs = shape.map((p) => p[0]);
  const foot = { cx: (Math.min(...xs) + Math.max(...xs)) / 2, rx: (Math.max(...xs) - Math.min(...xs)) / 2 };
  // A soft contact shadow so shapes sit on the floor instead of floating over it.
  g.insertBefore(svg('ellipse', { cx: foot.cx, cy: 2, rx: foot.rx * 1.08, ry: foot.rx * 0.54, class: 'ent-shadow' }), g.firstChild);
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
  let above = top - 14;
  if (e.meter) {
    box(meter(g, e.meter, above), above - 9, above + 9);
    above -= 22;
  }
  const badge = e.badge ?? (e.down ? { text: 'DOWN', tone: 'bad' as const } : undefined);
  if (badge) box(pill(g, badge.text, above, `badge tone-${badge.tone ?? 'info'}`, 10), above - 9, above + 9);
  return { hull: convexHull([...points, ...extra]), center: project(0, 0, (h * k) / 2), foot };
}
