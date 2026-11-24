import type { CourseModule } from '../course.ts';
import { Stage } from '../engine/stage.ts';
import { L, t } from '../i18n/index.ts';
import type { Lesson, MetricValue } from '../types.ts';
import { esc, q, replayClass } from './dom.ts';
import { pad2 } from './sidebar.ts';
import { markVisited, setLastStep, visited } from './store.ts';

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export interface LessonPlace {
  module: CourseModule;
  moduleIndex: number;
  lessonIndex: number;
}

export class LessonView {
  readonly lesson: Lesson;
  private root: HTMLElement;
  private stage: Stage;
  private i = -1;
  private shown = new Map<string, string>();
  private onProgress: () => void;

  constructor(host: HTMLElement, lesson: Lesson, place: LessonPlace, onProgress: () => void) {
    this.lesson = lesson;
    this.onProgress = onProgress;
    const { module, moduleIndex, lessonIndex } = place;
    host.innerHTML = `
      <div class="lesson">
        <section class="center">
          <header class="l-head">
            <div class="crumbs"><a href="#/">${pad2(moduleIndex + 1)}. ${esc(L(module.title))}</a><span>/</span>${t('lesson.of', { i: lessonIndex + 1, n: module.lessons.length })}</div>
            <div class="l-title-row">
              <h1>${esc(lesson.title)}</h1>
              <div class="pills">
                <span class="pill-chip p-time">◷ ${t('lesson.min', { n: lesson.minutes })}</span>
                <span class="pill-chip p-level">▮ ${t(`level.${lesson.level}`)}</span>
                <span class="pill-chip p-steps">☰ ${t('lesson.steps', { n: lesson.steps.length })}</span>
              </div>
            </div>
            <p class="l-summary">${esc(lesson.summary)}</p>
          </header>
          <div class="stage-card">
            <div class="stage-top">
              <div class="metrics">${lesson.metrics
                .map((m) => `<div class="metric" data-id="${m.id}"><span class="m-label">${esc(m.label)}</span><span class="m-val">—</span></div>`)
                .join('')}</div>
              <div class="controls">
                <button class="btn small replay" type="button" title="R">↻ ${t('stage.replay')}</button>
                <button class="btn small pause" type="button" title="Space">❚❚ ${t('stage.pause')}</button>
                <button class="btn small fit" type="button" title="F">⤢ ${t('stage.fit')}</button>
              </div>
            </div>
            <div class="stage"></div>
            <div class="stage-foot">
              <div class="legend">${lesson.legend
                .map((l) => {
                  const [kind, label] = Array.isArray(l) ? l : [l, t(`packet.${l}`)];
                  return `<span class="lg"><i class="sw sw-${kind}"></i>${esc(label)}</span>`;
                })
                .join('')}</div>
              <span class="stage-hint">${t('stage.hint')}</span>
            </div>
          </div>
          <div class="timeline-card">
            <div class="tl-head"><span>${t('lesson.timeline')}</span><span class="tl-count"></span></div>
            <ol class="timeline">${lesson.steps
              .map((s, i) => `<li><a href="#/${lesson.id}/${i + 1}" data-i="${i}"><span class="tl-dot">${i + 1}</span><span class="tl-label">${esc(s.short)}</span></a></li>`)
              .join('')}</ol>
          </div>
        </section>
        <aside class="side">
          <div class="step-card">
            <div class="step-top"><span class="step-no"></span><span class="chip"></span></div>
            <article class="step" aria-live="polite"></article>
            <nav class="step-nav">
              <button class="btn prev" type="button">← ${t('step.back')}</button>
              <button class="btn primary next" type="button"></button>
            </nav>
            <p class="keys">${t('step.keys')}</p>
          </div>
          <div class="learn-card">
            <h3>${t('lesson.learn')}</h3>
            <ul class="learn">${lesson.goals
              .map((g) => `<li><a href="#/${lesson.id}/${g.step}" data-step="${g.step}"><i class="check" aria-hidden="true"></i>${esc(g.text)}</a></li>`)
              .join('')}</ul>
          </div>
        </aside>
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
    const n = steps.length;

    q(this.root, '.step-no').textContent = t('step.label', { i: i + 1, n });
    const chip = q(this.root, '.step-top .chip');
    chip.className = `chip ch-${step.chapter}`;
    chip.textContent = t(`chapter.${step.chapter}`);

    const article = q<HTMLElement>(this.root, '.step');
    const callout = step.callout
      ? `<aside class="callout co-${step.callout.kind}"><b>${t(`callout.${step.callout.kind}`)}</b><span>${step.callout.text}</span></aside>`
      : '';
    article.innerHTML = `
      <h2>${esc(step.title)}</h2>
      ${step.body.map((p) => (p.trimStart().startsWith('<table') ? p : `<p>${p}</p>`)).join('')}
      ${callout}`;
    q<HTMLElement>(this.root, '.step-card').scrollTop = 0;
    replayClass(article, 'enter');

    markVisited(this.lesson.id, i);
    setLastStep(this.lesson.id, i + 1);
    const seen = visited(this.lesson.id);

    const timeline = q<HTMLElement>(this.root, '.timeline');
    timeline.querySelectorAll<HTMLAnchorElement>('a').forEach((a, j) => {
      a.classList.toggle('is-current', j === i);
      a.classList.toggle('is-seen', seen.has(j));
      if (j === i) {
        a.setAttribute('aria-current', 'step');
        // Keep the current step in view without scrolling the page itself.
        const li = a.parentElement!;
        timeline.scrollTo({ left: li.offsetLeft - timeline.clientWidth / 2 + li.offsetWidth / 2, behavior: first ? 'auto' : 'smooth' });
      } else a.removeAttribute('aria-current');
    });
    q(this.root, '.tl-count').textContent = t('lesson.stepOf', { i: i + 1, n });

    this.root.querySelectorAll<HTMLAnchorElement>('.learn a').forEach((a) => {
      a.classList.toggle('is-done', seen.has(Number(a.dataset.step) - 1));
    });

    q<HTMLButtonElement>(this.root, '.prev').disabled = i === 0;
    const next = steps[i + 1];
    q(this.root, '.next').textContent = next ? `${t('step.nextTo', { short: next.short })} →` : `${t('step.finish')} ✓`;

    this.renderMetrics(i);
    this.stage.setScene(step.scene, { jumpCamera: first });
    document.title = `${step.title} · ${this.lesson.title} · Scale Lab`;
    this.onProgress();
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
    const paused = !this.stage.isPaused;
    this.stage.setPaused(paused);
    const btn = q(this.root, '.pause');
    btn.textContent = paused ? `▶ ${t('stage.play')}` : `❚❚ ${t('stage.pause')}`;
    btn.classList.toggle('is-on', paused);
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
