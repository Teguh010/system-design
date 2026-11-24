import { Stage } from '../engine/stage.ts';
import type { Lesson, MetricValue, PacketKind } from '../types.ts';
import { esc, q, replayClass } from './dom.ts';
import { markVisited, setLastStep, visited } from './store.ts';

const PACKET_LABELS: Record<PacketKind, string> = {
  req: 'request',
  res: 'response',
  slow: 'slow',
  write: 'write',
  fail: 'failure',
  poison: 'bad traffic',
  ping: 'control',
};

const CALLOUT_LABELS = { insight: 'Insight', tip: 'Tip', warning: 'Watch out' } as const;

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export class LessonView {
  readonly lesson: Lesson;
  private root: HTMLElement;
  private stage: Stage;
  private i = -1;
  private shown = new Map<string, string>();

  constructor(host: HTMLElement, lesson: Lesson) {
    this.lesson = lesson;
    host.innerHTML = `
      <div class="lesson">
        <aside class="panel">
          <div class="panel-head">
            <a class="back" href="#/">← All lessons</a>
            <div class="eyebrow">${esc(lesson.module)} · ${lesson.minutes} min · ${lesson.level}</div>
            <h1 class="lesson-title">${esc(lesson.title)}</h1>
            <ol class="dots" aria-label="Steps">${lesson.steps
              .map((s, i) => `<li><a href="#/${lesson.id}/${i + 1}" data-i="${i}" title="${i + 1}. ${esc(s.short)}"><span>${i + 1}</span></a></li>`)
              .join('')}</ol>
          </div>
          <article class="step" aria-live="polite"></article>
          <nav class="step-nav">
            <button class="btn prev" type="button">← Back</button>
            <span class="counter"></span>
            <button class="btn primary next" type="button">Next →</button>
          </nav>
        </aside>
        <section class="stage-wrap">
          <div class="metrics">${lesson.metrics
            .map((m) => `<div class="metric" data-id="${m.id}"><span class="m-label">${esc(m.label)}</span><span class="m-val">—</span></div>`)
            .join('')}</div>
          <div class="stage"></div>
          <div class="stage-foot">
            <div class="legend">${lesson.legend
              .map((l) => {
                const [kind, label] = Array.isArray(l) ? l : [l, PACKET_LABELS[l]];
                return `<span class="lg"><i class="sw sw-${kind}"></i>${esc(label)}</span>`;
              })
              .join('')}</div>
            <div class="controls">
              <button class="icon-btn pause" type="button" title="Pause traffic (Space)" aria-label="Pause">❚❚</button>
              <button class="icon-btn replay" type="button" title="Replay step (R)" aria-label="Replay">↻</button>
              <button class="icon-btn fit" type="button" title="Fit to view (F)">Fit</button>
            </div>
          </div>
          <p class="stage-hint">drag to pan · scroll or double-click to zoom</p>
        </section>
      </div>`;
    this.root = q(host, '.lesson');
    this.stage = new Stage(q(this.root, '.stage'));

    q(this.root, '.prev').addEventListener('click', () => this.nav(-1));
    q(this.root, '.next').addEventListener('click', () => this.nav(1));
    q(this.root, '.pause').addEventListener('click', () => this.togglePause());
    q(this.root, '.replay').addEventListener('click', () => this.stage.replay());
    q(this.root, '.fit').addEventListener('click', () => this.stage.fit());
    document.addEventListener('keydown', this.onKey);
  }

  destroy() {
    document.removeEventListener('keydown', this.onKey);
    this.stage.destroy();
  }

  go(index: number) {
    const steps = this.lesson.steps;
    const i = Math.max(0, Math.min(steps.length - 1, index));
    if (i === this.i) return;
    const first = this.i === -1;
    this.i = i;
    const step = steps[i]!;

    const article = q<HTMLElement>(this.root, '.step');
    const callout = step.callout
      ? `<aside class="callout co-${step.callout.kind}"><b>${CALLOUT_LABELS[step.callout.kind]}</b> ${step.callout.text}</aside>`
      : '';
    const goals =
      i === 0
        ? `<div class="goals"><h3>In this lesson</h3><ol>${this.lesson.goals
            .map((g) => `<li><a href="#/${this.lesson.id}/${g.step}">${esc(g.text)}</a></li>`)
            .join('')}</ol></div>`
        : '';
    article.innerHTML = `
      <div class="step-meta"><span class="chip ch-${step.chapter}">${step.chapter}</span><span class="step-no">${esc(step.short)}</span></div>
      <h2>${esc(step.title)}</h2>
      ${step.body.map((p) => (p.trimStart().startsWith('<table') ? p : `<p>${p}</p>`)).join('')}
      ${callout}
      ${goals}`;
    article.scrollTop = 0;
    q<HTMLElement>(this.root, '.panel').scrollTop = 0;
    replayClass(article, 'enter');

    markVisited(this.lesson.id, i);
    setLastStep(this.lesson.id, i + 1);
    const seen = visited(this.lesson.id);
    this.root.querySelectorAll<HTMLAnchorElement>('.dots a').forEach((a, j) => {
      a.classList.toggle('is-current', j === i);
      a.classList.toggle('is-seen', seen.has(j));
      if (j === i) a.setAttribute('aria-current', 'step');
      else a.removeAttribute('aria-current');
    });

    q(this.root, '.counter').textContent = `${i + 1} / ${steps.length}`;
    q<HTMLButtonElement>(this.root, '.prev').disabled = i === 0;
    q(this.root, '.next').textContent = i === steps.length - 1 ? 'Finish ✓' : 'Next →';

    this.renderMetrics(i);
    this.stage.setScene(step.scene, { jumpCamera: first });
    document.title = `${step.title} — ${this.lesson.title} · Scale Lab`;
  }

  private renderMetrics(i: number) {
    const values: Record<string, MetricValue> = {};
    for (const s of this.lesson.steps.slice(0, i + 1)) Object.assign(values, s.metrics);
    for (const m of this.lesson.metrics) {
      const el = q<HTMLElement>(this.root, `.metric[data-id="${m.id}"] .m-val`);
      const v = values[m.id] ?? '—';
      const text = typeof v === 'string' ? v : v.v;
      el.textContent = text;
      el.className = `m-val${typeof v === 'string' ? '' : ` tone-${v.tone}`}`;
      if (this.shown.has(m.id) && this.shown.get(m.id) !== text) replayClass(el, 'flash');
      this.shown.set(m.id, text);
    }
  }

  private nav(delta: number) {
    const next = this.i + delta;
    if (next >= this.lesson.steps.length) location.hash = '#/';
    else if (next >= 0) location.hash = `#/${this.lesson.id}/${next + 1}`;
  }

  private togglePause() {
    this.stage.setPaused(!this.stage.isPaused);
    const btn = q(this.root, '.pause');
    btn.textContent = this.stage.isPaused ? '▶' : '❚❚';
    btn.setAttribute('aria-label', this.stage.isPaused ? 'Play' : 'Pause');
    btn.classList.toggle('is-on', this.stage.isPaused);
  }

  private onKey = (ev: KeyboardEvent) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey || isTyping(ev.target)) return;
    const key = ev.key.toLowerCase();
    if (key === 'arrowright' || key === 'pagedown') this.nav(1);
    else if (key === 'arrowleft' || key === 'pageup') this.nav(-1);
    else if (key === ' ') this.togglePause();
    else if (key === 'r') this.stage.replay();
    else if (key === 'f') this.stage.fit();
    else return;
    ev.preventDefault();
  };
}
