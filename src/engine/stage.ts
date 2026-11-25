import type { Entity, Flow, Link, PacketKind, Scene } from '../types.ts';
import { project, rayExit, type Pt } from './iso.ts';
import { drawEntity, paintFill, type Geo } from './shapes.ts';
import { svg, textWidth } from './svg.ts';

interface Pose {
  x: number;
  y: number;
  z: number;
  o: number;
}

interface LiveEnt {
  id: string;
  e: Entity;
  sig: string;
  g: SVGGElement;
  inner: SVGGElement;
  geo: Geo;
  pos: Pose;
  from: Pose;
  to: Pose;
  removing: boolean;
  /** Freshly added: drops in with a small bounce after `delay` ms. */
  entering: boolean;
  delay: number;
  /** A database's tank level, eased between steps. */
  fillG: SVGGElement | null;
  fill: { from: number; to: number; now: number };
  glow: SVGGElement | null;
  hitTimer: number;
}

interface LiveLink {
  id: string;
  l: Link;
  g: SVGGElement;
  path: SVGPathElement;
  label: SVGGElement | null;
  labelSize: [number, number];
  o: number;
  fromO: number;
  toO: number;
  removing: boolean;
  len: number;
  /** Freshly added: the line draws itself from `from` to `to` after `delay` ms. */
  entering: boolean;
  delay: number;
}

interface Seg {
  link: LiveLink;
  rev: boolean;
}

interface Packet {
  flow: Flow;
  kind: PacketKind;
  segs: Seg[];
  i: number;
  d: number;
  back: boolean;
  el: SVGCircleElement;
  trail: SVGCircleElement[];
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ENTER_LIFT = 1.4;
const STEP_MS = 750;
/** Gap between new entities appearing one after another. */
const STAGGER_MS = 140;
const PAD = 44;
const MIN_W = 560;
const MIN_H = 340;
/** Distances (px) behind a packet where its fading trail dots sit. */
const TRAIL = [7, 14];

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const backOut = (k: number) => {
  const c = 1.4;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
};
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpPose = (a: Pose, b: Pose, k: number): Pose => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k), o: lerp(a.o, b.o, k) });
const lerpBox = (a: Box, b: Box, k: number): Box => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) });
const contains = (outer: Box, inner: Box) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let stageCount = 0;

export class Stage {
  readonly svg: SVGSVGElement;
  private layers: { links: SVGGElement; packets: SVGGElement; labels: SVGGElement; ents: SVGGElement; fx: SVGGElement };
  private ents = new Map<string, LiveEnt>();
  private links = new Map<string, LiveLink>();
  private packets: Packet[] = [];
  private flows: { flow: Flow; acc: number }[] = [];
  private scene: Scene | null = null;

  private t0 = 0;
  private dur = 0;
  /** Duration plus the longest stagger delay: when the whole transition is over. */
  private span = 0;
  private dirty = false;

  private view: Box = { x: -MIN_W / 2, y: -MIN_H / 2, w: MIN_W, h: MIN_H };
  private cam: { from: Box; to: Box; t0: number; dur: number } | null = null;
  private manual = false;

  private paused = false;
  private last = 0;
  private raf = 0;
  private cleanup: (() => void)[] = [];
  private arrowId = `arrow-${++stageCount}`;
  private focused: string[] = [];
  private breakable = new Set<string>();
  private broken = new Set<string>();
  /** Called when the reader clicks (not drags) a breakable entity. */
  onEntityClick: ((id: string) => void) | null = null;

  constructor(host: HTMLElement) {
    this.svg = svg('svg', { class: 'stage-svg', role: 'img', 'aria-label': 'System diagram' }, host);
    const defs = svg('defs', {}, this.svg);
    const marker = svg(
      'marker',
      { id: this.arrowId, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 10, markerHeight: 10, orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' },
      defs,
    );
    svg('path', { d: 'M 0 1 L 9 5 L 0 9 Z', class: 'arrow-head' }, marker);
    const pat = svg('pattern', { id: 'iso-dots', width: 28, height: 14, patternUnits: 'userSpaceOnUse' }, defs);
    for (const [cx, cy] of [
      [0, 0],
      [28, 0],
      [0, 14],
      [28, 14],
      [14, 7],
    ])
      svg('circle', { cx: cx!, cy: cy!, r: 1, class: 'grid-dot' }, pat);
    for (const [id, stops] of [
      ['ent-shadow', [[0, 0.32], [0.6, 0.12], [1, 0]]],
      ['focus-glow', [[0, 0.55], [0.45, 0.28], [1, 0]]],
    ] as const) {
      const grad = svg('radialGradient', { id, class: `grad-${id}` }, defs);
      for (const [offset, a] of stops) svg('stop', { offset, 'stop-opacity': a }, grad);
    }
    svg('rect', { x: -6000, y: -6000, width: 12000, height: 12000, fill: 'url(#iso-dots)' }, this.svg);
    this.layers = {
      links: svg('g', { class: 'layer-links' }, this.svg),
      packets: svg('g', { class: 'layer-packets' }, this.svg),
      // Link pills sit above the packets so moving traffic never hides their text.
      labels: svg('g', { class: 'layer-labels' }, this.svg),
      ents: svg('g', { class: 'layer-ents' }, this.svg),
      fx: svg('g', { class: 'layer-fx' }, this.svg),
    };
    this.applyView();
    this.bindInput();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    for (const f of this.cleanup) f();
    this.svg.remove();
  }

  get isPaused() {
    return this.paused;
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.svg.classList.toggle('is-paused', p);
  }

  /**
   * Opt-in failure mode. Breakable entities become clickable; packets that reach a broken entity
   * fail there instead of continuing. Call before `setScene` with the scene that marks them `down`.
   */
  setChaos(breakable: Iterable<string>, broken: Iterable<string>) {
    this.breakable = new Set(breakable);
    this.broken = new Set(broken);
    for (const live of this.ents.values()) this.applyEntClass(live);
  }

  private applyEntClass(live: LiveEnt) {
    const e = live.e;
    const cls = `ent k-${e.kind}${e.ghost ? ' is-ghost' : ''}${e.down ? ' is-down' : ''}${this.breakable.has(live.id) ? ' is-breakable' : ''}`;
    if (live.g.getAttribute('class') !== cls) live.g.setAttribute('class', cls);
  }

  /** Transition to a new scene. `jumpCamera` snaps the view instead of easing it. */
  setScene(scene: Scene, opts: { jumpCamera?: boolean } = {}) {
    this.scene = scene;
    this.dur = reducedMotion() ? 0 : STEP_MS;
    const ids = new Set(Object.keys(scene.entities));

    for (const live of this.ents.values()) {
      if (ids.has(live.id) || live.removing) continue;
      live.removing = true;
      live.entering = false;
      live.delay = 0;
      live.inner.removeAttribute('transform');
      live.from = { ...live.pos };
      live.to = { ...live.pos, z: live.pos.z + ENTER_LIFT, o: 0 };
    }

    let order = 0;
    let maxDelay = 0;
    const firstScene = ![...this.ents.values()].some((l) => !l.removing);
    const touched: string[] = [];
    for (const [id, e] of Object.entries(scene.entities)) {
      const to: Pose = { x: e.x, y: e.y, z: e.z ?? 0, o: 1 };
      let live = this.ents.get(id);
      const prev = live && !live.removing ? live.e : undefined;
      if (!live) {
        const g = svg('g', { 'data-ent': id }, this.layers.ents);
        const inner = svg('g', {}, g);
        const start = { ...to, z: to.z + ENTER_LIFT, o: 0 };
        const delay = this.dur ? order++ * STAGGER_MS : 0;
        live = {
          id, e, sig: '', g, inner, geo: { hull: [], center: [0, 0], foot: null }, pos: start, from: start, to,
          removing: false, entering: !!this.dur, delay, fillG: null, fill: { from: 0, to: 0, now: 0 }, glow: null, hitTimer: 0,
        };
        this.ents.set(id, live);
      } else if (!live.removing) {
        live.entering = false;
        live.delay = 0;
        live.inner.removeAttribute('transform');
      } else {
        // Coming back while it was fading out: treat it as a fresh entrance.
        live.entering = !!this.dur;
        live.delay = this.dur ? order++ * STAGGER_MS : 0;
      }
      maxDelay = Math.max(maxDelay, live.delay);
      live.removing = false;
      live.e = e;
      // The tank level animates in place, so only whether there is one forces a redraw.
      const { x: _x, y: _y, z: _z, fill, focus: _f, ...look } = e;
      const sig = JSON.stringify({ ...look, tank: fill !== undefined });
      if (sig !== live.sig) {
        const grew = prev?.kind === 'server' && e.kind === 'server' && (e.count ?? 0) > (prev.count ?? 0);
        live.sig = sig;
        live.inner.replaceChildren();
        live.geo = drawEntity(live.inner, e, grew ? { newFrom: prev.count ?? 0 } : {});
        live.fillG = live.inner.querySelector<SVGGElement>('.db-fill');
        if (prev && e.kind !== 'card') touched.push(id);
      }
      if (!prev && e.kind !== 'card') touched.push(id);
      const target = fill ?? 0;
      if (prev && target !== live.fill.to) touched.push(id);
      // A database starts empty and fills up as it appears.
      live.fill = { from: prev ? live.fill.now : 0, to: target, now: prev ? live.fill.now : 0 };
      if (live.fillG) paintFill(live.fillG, live.fill.now);
      this.applyEntClass(live);
      live.from = { ...live.pos };
      live.to = to;
    }
    this.applyFocus(scene, firstScene ? [] : touched);

    const links = scene.links ?? {};
    for (const link of this.links.values()) {
      if (links[link.id] || link.removing) continue;
      link.removing = true;
      link.fromO = link.o;
      link.toO = 0;
    }
    for (const [id, l] of Object.entries(links)) {
      let live = this.links.get(id);
      if (!live || JSON.stringify(live.l) !== JSON.stringify(l)) {
        live?.g.remove();
        live?.label?.remove();
        const g = svg('g', { class: `link${l.dashed ? ' is-dashed' : ''}` }, this.layers.links);
        const path = svg('path', {}, g);
        let label: SVGGElement | null = null;
        let labelSize: [number, number] = [0, 0];
        if (l.label) {
          const w = textWidth(l.label, 10, 600) + 14;
          labelSize = [w, 18];
          label = svg('g', { class: `link-pill tone-${l.labelTone ?? 'none'}` }, this.layers.labels);
          svg('rect', { x: -w / 2, y: -9, width: w, height: 18, rx: 9 }, label);
          svg('text', { x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, label).textContent = l.label;
        }
        const o = live?.o ?? 0;
        live = { id, l, g, path, label, labelSize, o, fromO: o, toO: 1, removing: false, len: 0, entering: false, delay: 0 };
        this.links.set(id, live);
      }
      live.removing = false;
      live.fromO = live.o;
      live.toO = 1;
      // A line that isn't visible yet draws itself once both of its ends have landed.
      const ends = [this.ents.get(l.from), this.ents.get(l.to)];
      const endDelay = Math.max(...ends.map((e) => (e?.entering ? e.delay + this.dur * 0.55 : 0)));
      live.entering = !!this.dur && live.o < 0.05;
      live.delay = live.entering ? endDelay : 0;
      maxDelay = Math.max(maxDelay, live.delay);
    }

    this.applyArrows(scene);
    this.clearPackets();
    this.flows = (scene.flows ?? []).map((flow) => ({ flow, acc: Math.random() }));

    this.t0 = performance.now();
    this.span = this.dur ? this.dur + maxDelay : 0;
    this.dirty = true;
    this.update(this.dur ? 0 : Infinity);

    this.manual = false;
    const target = this.targetView(!opts.jumpCamera);
    if (opts.jumpCamera || !this.dur) {
      this.cam = null;
      this.view = target;
      this.applyView();
    } else {
      this.animateView(target, STEP_MS + 100);
    }
  }

  /**
   * A soft neon pool under whatever the step is about: entities marked `focus`, or else the few
   * that this step added or changed.
   */
  private applyFocus(scene: Scene, touched: string[]) {
    const marked = Object.entries(scene.entities).filter(([, e]) => e.focus).map(([id]) => id);
    // Newcomers are the clearest subject; otherwise whatever changed, unless half the stage did.
    const fresh = touched.filter((id) => this.ents.get(id)?.entering);
    const auto = [...new Set(fresh.length ? fresh : touched)];
    const want = new Set(marked.length ? marked : auto.length <= 4 ? auto : []);
    this.focused = [...want];
    for (const live of this.ents.values()) {
      const foot = live.geo.foot;
      const on = want.has(live.id) && !live.removing && !live.e.ghost && !!foot;
      if (!on) {
        const old = live.glow;
        live.glow = null;
        if (old) {
          if (this.dur) old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, easing: 'ease-out' }).onfinish = () => old.remove();
          else old.remove();
        }
        continue;
      }
      if (!live.glow) {
        live.glow = svg('g', { class: 'focus-glow' }, live.g);
        live.g.insertBefore(live.glow, live.inner);
        live.glow.style.animationDelay = `${live.delay + this.dur * 0.4}ms`;
        svg('ellipse', { class: 'fg-pool', fill: 'url(#focus-glow)' }, live.glow);
        svg('ellipse', { class: 'fg-ring' }, live.glow);
        svg('ellipse', { class: 'fg-ring fg-wave' }, live.glow);
      }
      const [pool, ring, wave] = [...live.glow.children] as SVGEllipseElement[];
      const size = (el: SVGEllipseElement | undefined, k: number) => {
        el?.setAttribute('cx', foot.cx.toFixed(1));
        el?.setAttribute('cy', '2');
        el?.setAttribute('rx', (foot.rx * k).toFixed(1));
        el?.setAttribute('ry', (foot.rx * k * 0.5).toFixed(1));
      };
      size(pool, 2);
      size(ring, 1.2);
      size(wave, 1.2);
    }
  }

  /** Activity LEDs flash in the colour of the packet that just arrived. */
  private hit(id: string, kind: PacketKind) {
    const live = this.ents.get(id);
    if (!live || live.removing) return;
    live.g.style.setProperty('--hit', `var(--p-${kind})`);
    live.g.classList.add('is-hit');
    clearTimeout(live.hitTimer);
    live.hitTimer = window.setTimeout(() => live.g.classList.remove('is-hit'), 160);
  }

  /** Arrowheads follow the traffic: a link used in both directions gets one at each end. */
  private applyArrows(scene: Scene) {
    const twoWay = new Set<string>();
    for (const f of scene.flows ?? [])
      for (const hop of f.route) {
        if (f.bounce || hop.startsWith('~')) twoWay.add(hop.replace(/^~/, ''));
      }
    const url = `url(#${this.arrowId})`;
    for (const link of this.links.values()) {
      if (link.removing) continue;
      const mode = link.l.arrow === true ? (twoWay.has(link.id) ? 'both' : 'end') : link.l.arrow;
      if (mode) link.path.setAttribute('marker-end', url);
      else link.path.removeAttribute('marker-end');
      if (mode === 'both') link.path.setAttribute('marker-start', url);
      else link.path.removeAttribute('marker-start');
    }
  }

  /** Re-enter the current scene from empty. */
  replay() {
    if (!this.scene) return;
    for (const e of this.ents.values()) e.g.remove();
    for (const l of this.links.values()) {
      l.g.remove();
      l.label?.remove();
    }
    this.ents.clear();
    this.links.clear();
    const focused = this.focused;
    this.setScene(this.scene);
    // Replaying redraws everything from empty; keep the glow on what the step was about.
    this.applyFocus(this.scene, focused);
  }

  fit() {
    this.manual = false;
    this.animateView(this.targetView(false), 500);
  }

  private tick = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.dirty) {
      const elapsed = now - this.t0;
      this.update(elapsed);
      if (elapsed >= this.span) this.dirty = false;
    }
    if (this.cam) {
      const k = Math.min(1, (now - this.cam.t0) / this.cam.dur);
      this.view = lerpBox(this.cam.from, this.cam.to, easeInOut(k));
      this.applyView();
      if (k >= 1) this.cam = null;
    }
    if (!this.paused) this.stepPackets(dt);
    this.raf = requestAnimationFrame(this.tick);
  };

  /** Advance the scene transition to `elapsed` ms after `setScene`. */
  private update(elapsed: number) {
    const local = (delay: number) => (this.dur ? clamp01((elapsed - delay) / this.dur) : 1);
    for (const live of this.ents.values()) {
      const k = local(live.delay);
      if (live.entering) {
        // Drop in with a small bounce on landing, and grow out of the ground.
        const kz = backOut(k);
        live.pos = {
          x: lerp(live.from.x, live.to.x, easeOut(k)),
          y: lerp(live.from.y, live.to.y, easeOut(k)),
          z: lerp(live.from.z, live.to.z, kz),
          o: lerp(live.from.o, live.to.o, easeOut(Math.min(1, k * 1.8))),
        };
        const s = lerp(0.8, 1, kz);
        if (k >= 1) {
          live.entering = false;
          live.inner.removeAttribute('transform');
        } else live.inner.setAttribute('transform', `scale(${s.toFixed(3)})`);
      } else live.pos = lerpPose(live.from, live.to, easeInOut(k));
      if (live.fillG && live.fill.now !== live.fill.to) {
        live.fill.now = k >= 1 ? live.fill.to : lerp(live.fill.from, live.fill.to, easeInOut(k));
        paintFill(live.fillG, live.fill.now);
      }
      const [px, py] = project(live.pos.x, live.pos.y, live.pos.z);
      live.g.setAttribute('transform', `translate(${px.toFixed(2)} ${py.toFixed(2)})`);
      live.g.style.opacity = live.pos.o.toFixed(3);
      if (live.removing && k >= 1) {
        live.g.remove();
        this.ents.delete(live.id);
      }
    }
    this.sortDepth();
    for (const link of this.links.values()) {
      const k = local(link.delay);
      link.o = lerp(link.fromO, link.toO, link.entering ? easeOut(Math.min(1, k * 2.5)) : easeInOut(k));
      if (link.removing && k >= 1) {
        link.g.remove();
        link.label?.remove();
        this.links.delete(link.id);
        continue;
      }
      this.layoutLink(link, link.entering ? k : 1);
      if (link.entering && k >= 1) link.entering = false;
    }
  }

  /** Painter's algorithm: things nearer the viewer (larger x − y) are drawn later. */
  private sortDepth() {
    const key = (e: LiveEnt) => (e.e.kind === 'card' ? 1e4 : e.pos.x - e.pos.y + (e.pos.x + e.pos.y) * 1e-3);
    const order = [...this.ents.values()].sort((a, b) => key(a) - key(b));
    const kids = this.layers.ents.children;
    if (order.every((e, i) => kids[i] === e.g)) return;
    for (const e of order) this.layers.ents.appendChild(e.g);
  }

  private anchor(e: LiveEnt): Pt {
    return project(e.pos.x, e.pos.y, e.pos.z);
  }

  /** `draw` (0–1) is how much of a newly added line is drawn, from its `from` end. */
  private layoutLink(link: LiveLink, draw = 1) {
    const a = this.ents.get(link.l.from);
    const b = this.ents.get(link.l.to);
    if (!a || !b) {
      link.g.style.opacity = '0';
      if (link.label) link.label.style.opacity = '0';
      link.len = 0;
      return;
    }
    const pa = this.anchor(a);
    const pb = this.anchor(b);
    const ca: Pt = [pa[0] + a.geo.center[0], pa[1] + a.geo.center[1]];
    const cb: Pt = [pb[0] + b.geo.center[0], pb[1] + b.geo.center[1]];
    let ctrl: Pt | null = null;
    if (link.l.curve) {
      const dx = cb[0] - ca[0];
      const dy = cb[1] - ca[1];
      ctrl = [(ca[0] + cb[0]) / 2 - dy * link.l.curve, (ca[1] + cb[1]) / 2 + dx * link.l.curve];
    }
    const clip = (c: Pt, toward: Pt, e: LiveEnt): Pt => {
      const d: Pt = [toward[0] - c[0], toward[1] - c[1]];
      const len = Math.hypot(d[0], d[1]) || 1;
      const local: Pt = [e.geo.center[0], e.geo.center[1]];
      const t = rayExit(local, d, e.geo.hull);
      return [c[0] + d[0] * t + (d[0] / len) * 6, c[1] + d[1] * t + (d[1] / len) * 6];
    };
    const s = clip(ca, ctrl ?? cb, a);
    const t = clip(cb, ctrl ?? ca, b);
    const f = (p: Pt) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
    link.path.setAttribute('d', ctrl ? `M ${f(s)} Q ${f(ctrl)} ${f(t)}` : `M ${f(s)} L ${f(t)}`);
    link.len = link.path.getTotalLength();
    const opacity = (link.o * Math.min(a.pos.o, b.pos.o)).toFixed(3);
    link.g.style.opacity = opacity;
    if (draw < 1 && !link.l.dashed) {
      const shown = link.len * easeInOut(draw);
      link.path.style.strokeDasharray = `${shown.toFixed(1)} ${link.len.toFixed(1)}`;
    } else link.path.style.removeProperty('stroke-dasharray');
    // Arrowheads wait until the line has reached them.
    link.g.classList.toggle('is-drawing', draw < 0.92);
    // Pills pop in once the line is mostly drawn.
    const pop = draw < 1 ? backOut(clamp01((draw - 0.55) / 0.45)) : 1;
    if (link.label) link.label.style.opacity = (Number(opacity) * clamp01(pop)).toFixed(3);
    if (link.label) {
      // Sit the pill beside the line, never on it: push it along the normal (upper side) just far
      // enough that the rectangle clears the line at any angle.
      const m = link.path.getPointAtLength(link.len / 2);
      const p0 = link.path.getPointAtLength(Math.max(0, link.len / 2 - 2));
      const p1 = link.path.getPointAtLength(Math.min(link.len, link.len / 2 + 2));
      const tl = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
      let nx = -(p1.y - p0.y) / tl;
      let ny = (p1.x - p0.x) / tl;
      if (ny > 0 || (Math.abs(ny) < 1e-6 && nx < 0)) {
        nx = -nx;
        ny = -ny;
      }
      const [w, h] = link.labelSize;
      const off = Math.abs(nx) * (w / 2) + Math.abs(ny) * (h / 2) + 5;
      const scale = pop < 1 ? ` scale(${Math.max(0.01, pop).toFixed(3)})` : '';
      link.label.setAttribute('transform', `translate(${(m.x + nx * off).toFixed(1)} ${(m.y + ny * off).toFixed(1)})${scale}`);
    }
  }

  // ── packets ────────────────────────────────────────────────

  private clearPackets() {
    for (const p of this.packets) this.removePacket(p);
    this.packets = [];
  }

  private removePacket(p: Packet) {
    p.el.remove();
    for (const t of p.trail) t.remove();
  }

  private setPacketKind(p: Packet, kind: PacketKind) {
    p.kind = kind;
    p.el.setAttribute('class', `pkt pkt-${kind}`);
    for (const t of p.trail) t.setAttribute('class', `pkt-trail pkt-${kind}`);
  }

  private spawn(flow: Flow) {
    const segs: Seg[] = [];
    for (const id of flow.route) {
      const rev = id.startsWith('~');
      const link = this.links.get(rev ? id.slice(1) : id);
      // No traffic on lines that are still drawing themselves in.
      if (!link || link.removing || (link.entering && link.o < 0.9)) return;
      segs.push({ link, rev });
    }
    if (!segs.length) return;
    const kind = flow.kind ?? 'req';
    const trail = TRAIL.map((_, j) =>
      svg('circle', { r: (3.4 - j * 1).toFixed(1), class: `pkt-trail pkt-${kind}`, opacity: j ? 0.18 : 0.34, cx: -9999, cy: -9999 }, this.layers.packets),
    );
    const el = svg('circle', { r: 4.2, class: `pkt pkt-${kind}`, cx: -9999, cy: -9999 }, this.layers.packets);
    this.packets.push({ flow, kind, segs, i: 0, d: 0, back: false, el, trail });
  }

  private stepPackets(dt: number) {
    for (const f of this.flows) {
      f.acc += f.flow.rate * dt;
      while (f.acc >= 1) {
        f.acc -= 1;
        this.spawn(f.flow);
      }
    }
    const done: Packet[] = [];
    // The entity a packet reaches at the end of a segment.
    const reached = (s: Seg) => (s.rev ? s.link.l.from : s.link.l.to);
    const pointAt = (s: Seg, d: number) => s.link.path.getPointAtLength(s.rev ? s.link.len - d : d);
    for (const p of this.packets) {
      p.d += (p.flow.speed ?? (p.kind === 'slow' ? 70 : 165)) * dt;
      let seg = p.segs[p.i]!;
      let dead = false;
      while (p.d >= seg.link.len) {
        if (this.broken.has(reached(seg))) {
          this.fx('fail', pointAt(seg, seg.link.len));
          dead = true;
          break;
        }
        this.hit(reached(seg), p.kind);
        p.d -= seg.link.len;
        p.i++;
        if (p.i >= p.segs.length) break;
        seg = p.segs[p.i]!;
      }
      if (dead) {
        done.push(p);
        continue;
      }
      if (p.i >= p.segs.length) {
        const last = p.segs[p.segs.length - 1]!;
        const end = last.link.path.getPointAtLength(last.rev ? 0 : last.link.len);
        if (!p.back && p.flow.fail && Math.random() < p.flow.fail) {
          this.fx('fail', end);
          done.push(p);
        } else if (p.flow.bounce && !p.back) {
          p.back = true;
          p.segs = p.segs.map((s) => ({ link: s.link, rev: !s.rev })).reverse();
          p.i = 0;
          p.d = 0;
          this.setPacketKind(p, p.flow.returnKind ?? 'res');
        } else {
          done.push(p);
        }
        continue;
      }
      const pt = pointAt(seg, p.d);
      p.el.setAttribute('cx', pt.x.toFixed(2));
      p.el.setAttribute('cy', pt.y.toFixed(2));
      p.trail.forEach((t, j) => {
        const back = TRAIL[j]!;
        // Hide trail dots that would sit behind the start of the current segment.
        const tp = p.d > back ? pointAt(seg, p.d - back) : null;
        t.setAttribute('cx', tp ? tp.x.toFixed(2) : '-9999');
        t.setAttribute('cy', tp ? tp.y.toFixed(2) : '-9999');
      });
    }
    if (done.length) {
      for (const p of done) this.removePacket(p);
      this.packets = this.packets.filter((p) => !done.includes(p));
    }
  }

  private fx(kind: 'fail', at: DOMPoint) {
    const g = svg('g', { transform: `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})` }, this.layers.fx);
    const inner = svg('g', { class: `fx fx-${kind}` }, g);
    svg('line', { x1: -5, y1: -5, x2: 5, y2: 5 }, inner);
    svg('line', { x1: -5, y1: 5, x2: 5, y2: -5 }, inner);
    setTimeout(() => g.remove(), 800);
  }

  // ── camera ─────────────────────────────────────────────────

  private targetBounds(): Box | null {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const e of this.ents.values()) {
      if (e.removing) continue;
      const bb = e.inner.getBBox();
      const [ax, ay] = project(e.to.x, e.to.y, e.to.z);
      x0 = Math.min(x0, ax + bb.x);
      y0 = Math.min(y0, ay + bb.y);
      x1 = Math.max(x1, ax + bb.x + bb.width);
      y1 = Math.max(y1, ay + bb.y + bb.height);
    }
    if (x0 === Infinity) return null;
    return { x: x0 - PAD, y: y0 - PAD, w: x1 - x0 + PAD * 2, h: y1 - y0 + PAD * 2 };
  }

  private targetView(sticky: boolean): Box {
    const b = this.targetBounds() ?? this.view;
    const w = Math.max(MIN_W, b.w);
    const h = Math.max(MIN_H, b.h);
    const target = { x: b.x - (w - b.w) / 2, y: b.y - (h - b.h) / 2, w, h };
    // Keep the camera still if the new scene already fits and the view isn't much too wide.
    if (sticky && contains(this.view, b) && this.view.w * this.view.h < target.w * target.h * 1.5) return { ...this.view };
    return target;
  }

  private animateView(to: Box, dur: number) {
    if (reducedMotion()) {
      this.view = to;
      this.cam = null;
      this.applyView();
      return;
    }
    this.cam = { from: { ...this.view }, to, t0: performance.now(), dur };
  }

  private applyView() {
    const v = this.view;
    this.svg.setAttribute('viewBox', `${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${v.h.toFixed(1)}`);
  }

  private toSvg(clientX: number, clientY: number): Pt {
    const m = this.svg.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  }

  private zoomAt(clientX: number, clientY: number, f: number, animate: boolean) {
    const [px, py] = this.toSvg(clientX, clientY);
    const v = this.cam?.to ?? this.view;
    const w = Math.min(8000, Math.max(120, v.w * f));
    const s = w / v.w;
    const next = { x: px - (px - v.x) * s, y: py - (py - v.y) * s, w, h: v.h * s };
    this.manual = true;
    if (animate) this.animateView(next, 350);
    else {
      this.cam = null;
      this.view = next;
      this.applyView();
    }
  }

  private bindInput() {
    const el = this.svg;
    const on = <K extends keyof SVGSVGElementEventMap>(type: K, fn: (ev: SVGSVGElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(type, fn as EventListener, opts);
      this.cleanup.push(() => el.removeEventListener(type, fn as EventListener));
    };
    on(
      'wheel',
      (ev) => {
        ev.preventDefault();
        this.zoomAt(ev.clientX, ev.clientY, Math.exp(ev.deltaY * 0.0015), false);
      },
      { passive: false },
    );
    on('dblclick', (ev) => this.zoomAt(ev.clientX, ev.clientY, 0.5, true));
    let drag: { id: number; cx: number; cy: number; view: Box; scale: number; ent: string | null; moved: boolean } | null = null;
    on('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const m = el.getScreenCTM();
      if (!m) return;
      const hit = ev.target instanceof Element ? ev.target.closest('[data-ent]') : null;
      const ent = hit?.getAttribute('data-ent') ?? null;
      // Svg units per screen pixel, frozen for the whole drag so the content tracks the pointer.
      drag = {
        id: ev.pointerId, cx: ev.clientX, cy: ev.clientY, view: { ...this.view }, scale: 1 / m.a,
        ent: ent && this.breakable.has(ent) ? ent : null, moved: false,
      };
      el.setPointerCapture(ev.pointerId);
      el.classList.add('is-dragging');
    });
    on('pointermove', (ev) => {
      if (!drag || ev.pointerId !== drag.id) return;
      if (!drag.moved && Math.hypot(ev.clientX - drag.cx, ev.clientY - drag.cy) < 4) return;
      drag.moved = true;
      const dx = (ev.clientX - drag.cx) * drag.scale;
      const dy = (ev.clientY - drag.cy) * drag.scale;
      this.manual = true;
      this.cam = null;
      this.view = { ...drag.view, x: drag.view.x - dx, y: drag.view.y - dy };
      this.applyView();
    });
    const end = (ev: PointerEvent) => {
      if (drag?.id !== ev.pointerId) return;
      const clicked = ev.type === 'pointerup' && !drag.moved ? drag.ent : null;
      drag = null;
      el.classList.remove('is-dragging');
      if (clicked) this.onEntityClick?.(clicked);
    };
    on('pointerup', end);
    on('pointercancel', end);
  }

  get isManual() {
    return this.manual;
  }
}
