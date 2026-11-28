'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { allLessons, course, findInCourse, type CourseModule } from '../src/course';
import { Stage } from '../src/engine/stage';
import { LOCALES, type Locale } from '../src/i18n';
import { getPathname } from '../src/i18n/navigation';
import { lb, link, server, spread, users } from '../src/lessons/helpers';
import { resolveBeat } from '../src/lessons/beats';
import { labFor, type Lab } from '../src/lessons/labs';
import type { InspectorPanel, Lesson, MetricValue, Scene, Step, WaterfallSegment } from '../src/types';
import { currentTheme, load, markVisited, save, setLastStep, setTheme } from '../src/ui/store';
import { glossaryAbbrevLabel, glossaryExpansion, glossaryInProse } from '../src/glossary/enrich.ts';
import { GlossaryHtml, GlossaryPlain, GlossaryScope } from './Glossary';

type Progress = { visited: Record<string, number[]>; last: Record<string, number> };
type Place = { module: CourseModule; moduleIndex: number; lessonIndex: number };
const emptyProgress: Progress = { visited: {}, last: {} };
const openModules = new Set<string>();
const pad2 = (n: number) => String(n).padStart(2, '0');
const path = (locale: Locale, href: string) => `${getPathname({ locale, href }).replace(/\/$/, '')}/`;
const homePath = (locale: Locale) => path(locale, '/');
const lessonPath = (locale: Locale, lessonId: string, step: number) => path(locale, `/lessons/${lessonId}/${step}`);
const readProgress = (): Progress => ({ visited: load('visited', {}), last: load('last', {}) });
const seenFor = (progress: Progress, id: string) => new Set(progress.visited[id] ?? []);
const complete = (progress: Progress, id: string) => {
  const lesson = allLessons.find((entry) => entry.id === id)?.lesson;
  return !!lesson && seenFor(progress, id).size >= lesson.steps.length;
};
const resumePath = (locale: Locale, progress: Progress, id: string) =>
  lessonPath(locale, id, complete(progress, id) ? 1 : (progress.last[id] ?? 1));

const HERO: Scene = {
  entities: { users: users(0, 0), lb: lb(10, 0), a: server(20, -15), b: server(20, 0), c: server(20, 15, { down: true }) },
  links: { ul: link('users', 'lb'), la: link('lb', 'a'), lb: link('lb', 'b'), lc: link('lb', 'c', { dashed: true }) },
  flows: [...spread([['ul', 'la'], ['ul', 'lb']], 3, { bounce: true }), { route: ['ul', 'lc'], kind: 'req', rate: 0.5, fail: 1 }],
};

function Diagram({ scene, stageRef, jump, breakable = '', broken = '', onEntityClick }: {
  scene: Scene; stageRef: React.RefObject<Stage | null>; jump: boolean;
  /** Comma-separated entity ids, kept as strings so effect dependencies stay stable. */
  breakable?: string; broken?: string; onEntityClick?: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const onClick = useRef(onEntityClick);
  useEffect(() => { onClick.current = onEntityClick; });
  useEffect(() => {
    if (!host.current) return;
    const stage = new Stage(host.current);
    stage.onEntityClick = (id) => onClick.current?.(id);
    stageRef.current = stage;
    first.current = true;
    return () => {
      stageRef.current = null;
      stage.destroy();
    };
  }, [stageRef]);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const ids = (s: string) => (s ? s.split(',') : []);
    stage.setChaos(ids(breakable), ids(broken));
    stage.setScene(scene, { jumpCamera: first.current || jump });
    first.current = false;
  }, [scene, stageRef, jump, breakable, broken]);
  return <div ref={host} className={jump ? 'hero-art' : 'stage'} aria-hidden={jump || undefined} />;
}

function Sidebar({ locale, currentId, progress }: { locale: Locale; currentId: string | undefined; progress: Progress }) {
  const t = useTranslations();
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const module = course.find((m) => m.lessons.some((l) => l.id === currentId));
    if (module) openModules.add(module.id);
    setOpen(new Set(openModules));
  }, [currentId]);
  const done = allLessons.filter((l) => complete(progress, l.id)).length;
  return <nav className="course-nav" aria-label={t('nav.course')}>
    <div className="cn-head">
      <span className="cn-title"><svg viewBox="0 0 20 16" width="18" height="14" aria-hidden="true"><path d="M1 3a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2z" /></svg>{t('nav.course')}</span>
      <span className="cn-count">{t('nav.lessons', { n: allLessons.length })}</span>
    </div>
    <ol className="cn-modules">{course.map((m, mi) => {
      const isOpen = open.has(m.id);
      return <li key={m.id} className={`cn-module${isOpen ? ' is-open' : ''}`}>
        <button className="cn-mod" type="button" aria-expanded={isOpen} onClick={() => {
          const next = new Set(open);
          if (next.has(m.id)) next.delete(m.id); else next.add(m.id);
          if (next.has(m.id)) openModules.add(m.id); else openModules.delete(m.id);
          setOpen(next);
        }}>
          <span className="chev" aria-hidden="true">›</span><i className="folder" style={{ '--m': m.color } as CSSProperties} aria-hidden="true" />
          <span className="cn-mod-name">{pad2(mi + 1)}. {m.title[locale]}</span>
          <span className="cn-mod-count">{m.lessons.filter((l) => complete(progress, l.id)).length}/{m.lessons.length}</span>
        </button>
        <ol className="cn-lessons">{m.lessons.map((l) => <li key={l.id}>{l.lesson
          ? <Link href={resumePath(locale, progress, l.id)} className={`cn-lesson${l.id === currentId ? ' is-current' : ''}${complete(progress, l.id) ? ' is-done' : ''}`} aria-current={l.id === currentId ? 'page' : undefined}>{l.title[locale]}</Link>
          : <span className="cn-lesson is-soon">{l.title[locale]}<em>{t('nav.soon')}</em></span>}</li>)}</ol>
      </li>;
    })}</ol>
    <div className="cn-progress"><span>{t('nav.progress')}</span><span className="cn-progress-n">{done} / {allLessons.length}</span><div className="bar"><i style={{ width: `${done / allLessons.length * 100}%` }} /></div></div>
  </nav>;
}

function Home({ locale, progress }: { locale: Locale; progress: Progress }) {
  const t = useTranslations();
  const stage = useRef<Stage | null>(null);
  useEffect(() => { document.title = 'Scale Lab'; }, []);
  return <div className="home">
    <section className="hero"><div className="hero-text">
      <p className="eyebrow">{t('home.eyebrow')}</p>
      <h1>{t.rich('home.title', { em: (chunks) => <em>{chunks}</em> })}</h1>
      <p className="lede">{t('home.lede')}</p>
      <p className="keys">{t.rich('home.keys', { kbd: (chunks) => <kbd>{chunks}</kbd> })}</p>
    </div><Diagram scene={HERO} stageRef={stage} jump /></section>
    {course.map((m, mi) => <section className="module" key={m.id}>
      <h2><i className="folder" style={{ '--m': m.color } as CSSProperties} aria-hidden="true" />{pad2(mi + 1)}. {m.title[locale]}</h2>
      <div className="cards">{m.lessons.map((l, li) => {
        const meta = <div className="lc-meta"><span>{t('lesson.of', { i: li + 1, n: m.lessons.length })}</span>{l.lesson && <><span>{t('lesson.min', { n: l.lesson.minutes })}</span><span>{t('lesson.steps', { n: l.lesson.steps.length })}</span></>}</div>;
        if (!l.lesson) return <div key={l.id} className="lesson-card is-soon">{meta}<h3>{l.title[locale]}</h3><span className="cta">{t('home.soon')}</span></div>;
        const seen = seenFor(progress, l.id).size;
        const pct = Math.round(Math.min(seen, l.lesson.steps.length) / l.lesson.steps.length * 100);
        const cta = seen === 0 ? t('home.start') : complete(progress, l.id) ? t('home.review') : t('home.continue');
        return <Link key={l.id} className="lesson-card" href={resumePath(locale, progress, l.id)}>{meta}<h3>{l.title[locale]}</h3><div className="lc-foot"><div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div><span className="cta">{cta} →</span></div></Link>;
      })}</div>
    </section>)}
  </div>;
}

function valuesAt(lesson: Lesson, i: number): Record<string, MetricValue> {
  return Object.assign({}, ...lesson.steps.slice(0, i + 1).map((s) => s.metrics));
}

/** `?record=1` hides everything but the title, metrics and diagram, for screen recording. */
function useRecordMode() {
  const [record, setRecord] = useState(false);
  useEffect(() => {
    const on = new URLSearchParams(window.location.search).get('record') === '1';
    setRecord(on);
    document.documentElement.classList.toggle('is-record', on);
    return () => document.documentElement.classList.remove('is-record');
  }, []);
  return record;
}

function usePresenterMode() {
  const [presenter, setPresenter] = useState(false);
  useEffect(() => {
    setPresenter(new URLSearchParams(window.location.search).get('presenter') === '1');
  }, []);
  return presenter;
}

type Num = { pre: string; n: number; dec: number; grouped: boolean; post: string };
const separators = (locale: Locale) => (locale === 'id' ? { group: '.', dec: ',' } : { group: ',', dec: '.' });

function parseNum(text: string, locale: Locale): Num | null {
  const { group, dec } = separators(locale);
  const g = `\\${group}`;
  const d = `\\${dec}`;
  const m = new RegExp(`^(.*?)(\\d[\\d${g}]*(?:${d}\\d+)?)(.*)$`).exec(text);
  if (!m) return null;
  const raw = m[2]!;
  const [int = '', frac] = raw.split(dec);
  return { pre: m[1]!, n: Number(`${int.split(group).join('')}${frac ? `.${frac}` : ''}`), dec: frac?.length ?? 0, grouped: int.includes(group), post: m[3]! };
}

function formatNum(n: number, like: Num, locale: Locale) {
  const { group, dec } = separators(locale);
  const [int = '', frac] = n.toFixed(like.dec).split('.');
  const body = like.grouped ? int.replace(/\B(?=(\d{3})+(?!\d))/g, group) : int;
  return `${like.pre}${body}${frac ? `${dec}${frac}` : ''}${like.post}`;
}

/** A metric card whose number counts to its new value, with a small pop when it changes. */
function Metric({ label, value, locale }: { label: string; value: MetricValue; locale: Locale }) {
  const text = typeof value === 'string' ? value : value.v;
  const [shown, setShown] = useState(text);
  const prev = useRef(text);
  const card = useRef<HTMLDivElement>(null);
  const val = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const from = prev.current;
    prev.current = text;
    if (from === text) return;
    for (const [el, cls] of [[card.current, 'is-changed'], [val.current, 'flash']] as const) {
      if (!el) continue;
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
    }
    const a = parseNum(from, locale);
    const b = parseNum(text, locale);
    // Count only between like units (or up from “?” / “—”); otherwise just swap the text.
    if (!b || (a && (a.pre !== b.pre || a.post !== b.post)) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(text);
      return;
    }
    const start = a?.n ?? 0;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 700);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(k >= 1 ? text : formatNum(start + (b.n - start) * e, b, locale));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, locale]);
  return <div className="metric" ref={card}><span className="m-label">{label}</span><span ref={val} className={`m-val${typeof value === 'string' ? '' : ` tone-${value.tone}`}`}>{shown}</span></div>;
}

function Changes({ lesson, index }: { lesson: Lesson; index: number }) {
  const t = useTranslations();
  if (!index) return null;
  const before = valuesAt(lesson, index - 1);
  const after = valuesAt(lesson, index);
  const value = (v: MetricValue | undefined) => typeof v === 'string' ? v : v?.v;
  const rows: [string, string][] = (lesson.steps[index]?.changes ?? []).map((c) => {
    const match = /^([+~-]) (.*)$/.exec(c);
    return match ? [match[1]!, match[2]!] : ['~', c];
  });
  for (const m of lesson.metrics) {
    const a = value(before[m.id]), b = value(after[m.id]);
    if (b === undefined || a === b) continue;
    rows.push(a === undefined || a === '?' || a === '—' ? ['+', `${m.label}: ${b}`] : ['~', `${m.label}: ${a} → ${b}`]);
  }
  if (!rows.length) return null;
  return <div className="changes"><h3>{t('step.changed')}</h3><ul>{rows.map(([sign, content], j) => <li key={j} className={`ch-${sign === '+' ? 'add' : sign === '-' ? 'remove' : 'change'}`}><i aria-hidden="true">{sign === '-' ? '−' : sign}</i><span><GlossaryPlain text={content} /></span></li>)}</ul></div>;
}

function LabCard({ lab, locale, values, note, onChange, onReset }: {
  lab: Lab; locale: Locale; values: Record<string, number>; note: string;
  onChange: (id: string, v: number) => void; onReset: () => void;
}) {
  const t = useTranslations();
  return <div className="play-card lab-card">
    <div className="play-head"><h3>{lab.title[locale]}</h3><button type="button" className="btn small" onClick={onReset}>{t('lab.reset')}</button></div>
    <p className="play-intro">{lab.intro[locale]}</p>
    <div className="lab-controls">{lab.controls.map((c) => {
      const v = values[c.id] ?? c.value;
      return <label className="lab-control" key={c.id}>
        <span className="lab-label">{c.label[locale]}</span>
        <output>{v} {c.unit}</output>
        <input type="range" aria-label={c.label[locale]} min={c.min} max={c.max} step={c.step} value={v} onChange={(e) => onChange(c.id, Number(e.target.value))} />
      </label>;
    })}</div>
    <p className="lab-note" aria-live="polite">{note}</p>
  </div>;
}

function ChaosCard({ step, broken, onToggle, onRepair }: { step: Step; broken: string[]; onToggle: (id: string) => void; onRepair: () => void }) {
  const t = useTranslations();
  const name = (id: string) => step.scene.entities[id]?.label ?? id;
  return <div className="play-card chaos-card">
    <div className="play-head"><h3>{t('chaos.title')}</h3>{broken.length > 0 && <button type="button" className="btn small" onClick={onRepair}>{t('chaos.repair')}</button>}</div>
    <p className="play-intro">{t('chaos.intro')}</p>
    <div className="chaos-targets">{Object.keys(step.chaos ?? {}).map((id) => <button key={id} type="button" className={`chaos-target${broken.includes(id) ? ' is-on' : ''}`} aria-pressed={broken.includes(id)} onClick={() => onToggle(id)}>{name(id)}</button>)}</div>
    {broken.map((id) => <div className="chaos-effect" key={id}>
      <b>{t('chaos.down', { name: name(id) })}</b>
      <p><GlossaryHtml html={step.chaos?.[id]?.text ?? ''} /></p>
    </div>)}
  </div>;
}

function PredictCard({ predict, choice, onPick, onSkip }: {
  predict: NonNullable<Step['predict']>; choice: number | undefined; onPick: (i: number) => void; onSkip: () => void;
}) {
  const t = useTranslations();
  const answered = choice !== undefined;
  const correct = choice === predict.answer;
  if (!answered) {
    return <div className="predict-card">
      <div className="predict-head"><span>{t('predict.title')}</span><button type="button" className="btn small" onClick={onSkip}>{t('predict.skip')}</button></div>
      <p className="predict-prompt">{t('predict.prompt')}</p>
      <p className="predict-q"><GlossaryHtml html={predict.question} /></p>
      <div className="predict-opts">{predict.options.map((opt, i) => (
        <button key={i} type="button" className="predict-opt" onClick={() => onPick(i)}>
          <kbd>{i + 1}</kbd><span><GlossaryPlain text={opt} /></span>
        </button>
      ))}</div>
      <p className="predict-keys">{t.rich('predict.keys', { n: predict.options.length, kbd: (chunks) => <kbd>{chunks}</kbd> })}</p>
    </div>;
  }
  return <div className={`predict-card is-done ${choice === -1 ? 'is-skip' : correct ? 'is-good' : 'is-bad'}`}>
    <div className="predict-head"><span>{choice === -1 ? t('predict.title') : correct ? `✓ ${t('predict.correct')}` : t('predict.wrong')}</span></div>
    <p className="predict-explain"><GlossaryHtml html={predict.explain} /></p>
  </div>;
}

function formatDuration(ms: number, locale: Locale): string {
  const tag = locale === 'id' ? 'id-ID' : 'en-US';
  if (ms >= 1000) {
    const s = new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(ms / 1000);
    return locale === 'id' ? `${s} dtk` : `${s} s`;
  }
  return `${new Intl.NumberFormat(tag).format(Math.round(ms))} ms`;
}

function StudioDock({ waterfall, inspector, locale }: {
  waterfall: WaterfallSegment[] | undefined; inspector: InspectorPanel | undefined; locale: Locale;
}) {
  const t = useTranslations();
  if (!waterfall?.length && !inspector) return null;
  const totalMs = (waterfall ?? []).reduce((sum, s) => sum + Math.max(0, s.ms), 0);
  return <div className="studio-dock">
    {waterfall && waterfall.length > 0 && (
      <div className="wf-panel">
        <div className="wf-head">
          <span className="wf-title">{t('studio.waterfall')}</span>
          <span className="wf-total">{formatDuration(totalMs, locale)} {t('studio.total')}</span>
        </div>
        <div className="wf-bar" role="img" aria-label={t('studio.waterfall')}>
          {waterfall.map((seg, i) => {
            const pct = totalMs > 0 ? (Math.max(0, seg.ms) / totalMs) * 100 : 100 / waterfall.length;
            return <div key={i} className={`wf-seg tone-${seg.tone ?? 'info'}${seg.active ? ' is-active' : ''}`} style={{ flexGrow: Math.max(0.06, seg.ms || 1), flexBasis: `${pct.toFixed(1)}%` }} title={`${seg.label}: ${formatDuration(seg.ms, locale)}`}>
              <span>{seg.label}</span>
            </div>;
          })}
        </div>
        <div className="wf-legend">
          {waterfall.map((seg, i) => (
            <span key={i} className={`wf-item tone-${seg.tone ?? 'info'}${seg.active ? ' is-active' : ''}`}>
              <i />{seg.label} <b>{formatDuration(seg.ms, locale)}</b>
            </span>
          ))}
        </div>
      </div>
    )}
    {inspector && (
      <div className="insp-panel">
        <div className="insp-title">{inspector.title}</div>
        <div className="insp-lines">
          {inspector.lines.map((raw, i) => {
            const tone = raw.startsWith('! ') ? 'bad' : raw.startsWith('✓ ') ? 'good' : raw.startsWith('# ') ? 'muted' : raw.startsWith('> ') ? 'active' : '';
            const text = tone ? raw.slice(2) : raw;
            return <div key={i} className={`insp-line${tone ? ` is-${tone}` : ''}`}>{text}</div>;
          })}
        </div>
      </div>
    )}
  </div>;
}

type StudioMsg =
  | { type: 'state'; lessonId: string; step: number; beatIndex: number; paused: boolean }
  | { type: 'replay' };

function PresenterConsole({ lesson, locale, index, beatIndex, paused, onNav, onStepBeat, onSelectBeat, onTogglePause, onReplay }: {
  lesson: Lesson; locale: Locale; index: number; beatIndex: number; paused: boolean;
  onNav: (delta: number) => void; onStepBeat: (delta: number) => void; onSelectBeat: (i: number) => void;
  onTogglePause: () => void; onReplay: () => void;
}) {
  const t = useTranslations();
  const current = lesson.steps[index]!;
  const beats = current.beats ?? [];
  const [running, setRunning] = useState(false);
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return <div className="presenter-shell">
    <header className="pres-head">
      <div>
        <span className="pres-eyebrow">{t('studio.presenter')} · {t('studio.sync')}</span>
        <h1>{lesson.title} — {t('step.label', { i: index + 1, n: lesson.steps.length })}</h1>
      </div>
      <div className="pres-timer">
        <span className="pres-clock">{mm}:{ss}</span>
        <button type="button" className="btn small" onClick={() => setRunning((r) => !r)}>{running ? t('studio.timerPause') : t('studio.timerStart')}</button>
        <button type="button" className="btn small" onClick={() => { setRunning(false); setSec(0); }}>{t('studio.timerReset')}</button>
      </div>
    </header>
    <div className="pres-grid">
      <section className="pres-script">
        <div className="pres-step-title">{current.title}</div>
        <div className="pres-body">
          {current.body.map((p, i) =>
            p.trimStart().startsWith('<table')
              ? <div key={i} dangerouslySetInnerHTML={{ __html: p }} />
              : <p key={i} dangerouslySetInnerHTML={{ __html: p }} />,
          )}
        </div>
        {current.callout && <aside className={`callout co-${current.callout.kind}`}><b>{t(`callout.${current.callout.kind}`)}</b><span>{current.callout.text}</span></aside>}
      </section>
      <aside className="pres-cues">
        <div className="pres-cues-head">
          <h2>{t('studio.beats')}</h2>
          <div className="pres-btns">
            <button type="button" className="btn small" onClick={onReplay}>↻ {t('stage.replay')}</button>
            <button type="button" className="btn small" onClick={onTogglePause}>{paused ? `▶ ${t('stage.play')}` : `❚❚ ${t('stage.pause')}`}</button>
          </div>
        </div>
        {beats.length > 0 ? (
          <ol className="pres-beat-list">
            {beats.map((b, i) => (
              <li key={i}>
                <button type="button" className={`pres-beat${i === beatIndex ? ' is-active' : i < beatIndex ? ' is-done' : ''}`} onClick={() => onSelectBeat(i)}>
                  <span>{i + 1}</span><b>{b.label ?? t('stage.beatOf', { i: i + 1, n: beats.length })}</b>
                </button>
              </li>
            ))}
          </ol>
        ) : <p className="pres-empty">—</p>}
        <div className="pres-nav">
          <button type="button" className="btn" disabled={index === 0} onClick={() => onNav(-1)}>← {t('step.back')}</button>
          <button type="button" className="btn" disabled={!beats.length || beatIndex === 0} onClick={() => onStepBeat(-1)}>↑ {t('stage.prevBeat')}</button>
          <button type="button" className="btn primary" disabled={!beats.length || beatIndex >= beats.length - 1} onClick={() => onStepBeat(1)}>↓ {t('stage.nextBeat')}</button>
          <button type="button" className="btn primary" disabled={index >= lesson.steps.length - 1} onClick={() => onNav(1)}>
            {lesson.steps[index + 1] ? `${t('step.nextTo', { short: lesson.steps[index + 1]!.short })} →` : `${t('step.finish')} ✓`}
          </button>
        </div>
        <p className="pres-note">{locale === 'id' ? 'Buka tab lain dengan ?record=1 untuk menangkap visualisasi layar penuh.' : 'Open a second window with ?record=1 to capture the clean visualization.'}</p>
      </aside>
    </div>
  </div>;
}

function LessonScreen({ lesson, place, locale, step, progress, wide, onProgress, onStepNavigation, onToggleSidebar }: {
  lesson: Lesson; place: Place; locale: Locale; step: number; progress: Progress; wide: boolean; onProgress: () => void; onStepNavigation: () => void; onToggleSidebar: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const stage = useRef<Stage | null>(null);
  const timeline = useRef<HTMLOListElement>(null);
  const firstStep = useRef(true);
  const stepCard = useRef<HTMLDivElement>(null);
  const record = useRecordMode();
  const presenter = usePresenterMode();
  const [paused, setPaused] = useState(false);
  const [activeStep, setActiveStep] = useState(step);
  const index = Math.max(0, Math.min(lesson.steps.length - 1, Number.isFinite(activeStep) ? Math.trunc(activeStep) - 1 : 0));
  const current = lesson.steps[index]!;
  const n = lesson.steps.length;
  const seen = seenFor(progress, lesson.id);

  const [predictions, setPredictions] = useState<Record<string, number>>(() => load<Record<string, number>>('predict', {}));
  const predictKey = `${lesson.id}:${index}`;
  const predictChoice = current.predict ? predictions[predictKey] : undefined;
  const gated = !!current.predict && predictChoice === undefined && !wide && !record && !presenter;
  const displayIndex = gated && index > 0 ? index - 1 : index;
  const displayStep = lesson.steps[displayIndex]!;
  const values = valuesAt(lesson, displayIndex);
  const answerPredict = useCallback((choice: number) => {
    setPredictions((prev) => {
      const next = { ...prev, [predictKey]: choice };
      save('predict', next);
      return next;
    });
  }, [predictKey]);

  const stageGlossary = useMemo(
    () =>
      gated
        ? []
        : glossaryInProse(
            current.title,
            ...current.body,
            current.callout?.text ?? '',
          ),
    [current, gated],
  );

  // Beats: optional micro-animation keyframes inside a single step.
  const beats = displayStep.beats ?? [];
  const lab = gated ? undefined : labFor(lesson.id, index + 1);
  const showLab = !!lab && !wide;
  const hasBeats = beats.length > 0;
  const [beatIndex, setBeatIndex] = useState(0);
  useEffect(() => { setBeatIndex(0); }, [index]);
  const resolved = useMemo(() => resolveBeat(displayStep, beatIndex), [displayStep, beatIndex]);

  // Lab: metrics follow the sliders live; the diagram follows shortly after so packets keep flowing.
  const defaults = useMemo(() => Object.fromEntries((lab?.controls ?? []).map((c) => [c.id, c.value])), [lab]);
  const [labValues, setLabValues] = useState(defaults);
  const [sceneValues, setSceneValues] = useState(defaults);
  useEffect(() => { setLabValues(defaults); setSceneValues(defaults); }, [defaults]);
  useEffect(() => {
    const id = setTimeout(() => setSceneValues(labValues), 180);
    return () => clearTimeout(id);
  }, [labValues]);
  const labResult = useMemo(() => (lab ? lab.compute(labValues, locale, current.scene) : null), [lab, labValues, locale, current.scene]);
  const labScene = useMemo(() => (lab ? lab.compute(sceneValues, locale, current.scene).scene : null), [lab, sceneValues, locale, current.scene]);

  // Chaos: entities the reader has broken on this step, in the order they were broken.
  const [broken, setBroken] = useState<string[]>([]);
  useEffect(() => setBroken([]), [index, wide]);
  const canBreak = !!current.chaos && !wide && !gated;
  const toggleBroken = useCallback((id: string) => {
    if (!current.chaos?.[id] || wide) return;
    setBroken((b) => (b.includes(id) ? b.filter((x) => x !== id) : [...b, id]));
  }, [current.chaos, wide]);
  const brokenKey = broken.join(',');
  const chaosScene = useMemo(() => {
    const baseScene = resolved.scene;
    if (!brokenKey) return baseScene;
    const ids = brokenKey.split(',');
    return { ...baseScene, entities: Object.fromEntries(Object.entries(baseScene.entities).map(([id, e]) => [id, ids.includes(id) ? { ...e, down: true } : e])) };
  }, [resolved.scene, brokenKey]);

  const stageScene = hasBeats ? chaosScene : ((showLab ? labScene : null) ?? chaosScene);
  const shownValues: Record<string, MetricValue> = Object.assign(
    {},
    values,
    resolved.metrics,
    ...(showLab && labResult ? [labResult.metrics] : []),
    ...(gated ? [] : broken.map((id) => current.chaos?.[id]?.metrics)),
  );
  useEffect(() => setActiveStep(step), [step]);
  useEffect(() => {
    const onPopState = () => {
      const match = new RegExp(`^/${locale}/lessons/${lesson.id}/(\\d+)/?$`).exec(window.location.pathname);
      if (match) setActiveStep(Number(match[1]));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [locale, lesson.id]);
  const goToStep = useCallback((next: number) => {
    if (next === index + 1) return;
    window.history.pushState(null, '', lessonPath(locale, lesson.id, next) + window.location.search);
    setActiveStep(next);
    onStepNavigation();
  }, [index, locale, lesson.id, onStepNavigation]);
  const onStepLink = (event: MouseEvent<HTMLAnchorElement>, next: number) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    goToStep(next);
  };
  const nav = useCallback((delta: number) => {
    const next = index + delta;
    if (next >= n) router.push(homePath(locale));
    else if (next >= 0) goToStep(next + 1);
  }, [index, n, router, locale, goToStep]);
  const channel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined' || (!presenter && !record)) return;
    const ch = new BroadcastChannel('scale-lab-studio');
    channel.current = ch;
    if (record) {
      ch.onmessage = (ev: MessageEvent<StudioMsg>) => {
        const msg = ev.data;
        if (msg.type === 'replay') {
          setBeatIndex(0);
          if (stage.current?.isPaused) {
            stage.current.setPaused(false);
            setPaused(false);
          }
          stage.current?.replay();
          return;
        }
        if (msg.type === 'state') {
          if (msg.lessonId !== lesson.id) {
            router.push(lessonPath(locale, msg.lessonId, msg.step) + window.location.search);
            return;
          }
          if (msg.step !== index + 1) goToStep(msg.step);
          setBeatIndex(msg.beatIndex);
          if (stage.current && stage.current.isPaused !== msg.paused) {
            stage.current.setPaused(msg.paused);
            setPaused(msg.paused);
          }
        }
      };
    }
    return () => {
      channel.current = null;
      ch.close();
    };
  }, [presenter, record, lesson.id, locale, router, index, goToStep]);

  useEffect(() => {
    if (!presenter) return;
    channel.current?.postMessage({ type: 'state', lessonId: lesson.id, step: index + 1, beatIndex, paused } satisfies StudioMsg);
  }, [presenter, lesson.id, index, beatIndex, paused]);

  const togglePause = useCallback(() => {
    if (presenter) {
      setPaused((p) => !p);
      return;
    }
    const instance = stage.current;
    if (!instance) return;
    const next = !instance.isPaused;
    instance.setPaused(next);
    setPaused(next);
    if (!next && hasBeats && beatIndex >= beats.length - 1) setBeatIndex(0);
  }, [presenter, hasBeats, beatIndex, beats.length]);
  const replay = useCallback(() => {
    setBeatIndex(0);
    if (presenter) {
      setPaused(false);
      channel.current?.postMessage({ type: 'replay' } satisfies StudioMsg);
      return;
    }
    if (stage.current?.isPaused) {
      stage.current.setPaused(false);
      setPaused(false);
    }
    stage.current?.replay();
  }, [presenter]);
  const stepBeat = useCallback((delta: number) => {
    if (!hasBeats) return;
    setBeatIndex((i) => Math.max(0, Math.min(beats.length - 1, i + delta)));
  }, [hasBeats, beats.length]);
  useEffect(() => {
    markVisited(lesson.id, index);
    setLastStep(lesson.id, index + 1);
    onProgress();
    document.title = `${current.title} · ${lesson.title} · Scale Lab`;
    if (stepCard.current) stepCard.current.scrollTop = 0;
    const a = timeline.current?.querySelector<HTMLAnchorElement>('a[aria-current="step"]');
    const li = a?.parentElement;
    if (li && timeline.current) timeline.current.scrollTo({ left: li.offsetLeft - timeline.current.clientWidth / 2 + li.offsetWidth / 2, behavior: firstStep.current ? 'auto' : 'smooth' });
    firstStep.current = false;
  }, [lesson.id, lesson.title, index, current.title, onProgress]);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target;
      if (ev.metaKey || ev.ctrlKey || ev.altKey || (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))) return;
      const key = ev.key.toLowerCase();
      if (gated && /^[1-9]$/.test(key) && current.predict && Number(key) <= current.predict.options.length) {
        answerPredict(Number(key) - 1);
      } else if (gated && key === 'arrowright') {
        answerPredict(-1);
      } else if (key === 'arrowright' || key === 'pagedown') nav(1);
      else if (key === 'arrowleft' || key === 'pageup') nav(-1);
      else if ((key === 'arrowdown' || key === '.') && hasBeats) stepBeat(1);
      else if ((key === 'arrowup' || key === ',') && hasBeats) stepBeat(-1);
      else if (key === '[') onToggleSidebar();
      else if (key === ' ') togglePause();
      else if (key === 'r') replay();
      else if (key === 'f') stage.current?.fit();
      else return;
      ev.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [nav, togglePause, replay, stepBeat, hasBeats, onToggleSidebar, gated, current.predict, answerPredict]);
  if (presenter) {
    return <PresenterConsole
      lesson={lesson}
      locale={locale}
      index={index}
      beatIndex={beatIndex}
      paused={paused}
      onNav={nav}
      onStepBeat={stepBeat}
      onSelectBeat={setBeatIndex}
      onTogglePause={togglePause}
      onReplay={replay}
    />;
  }

  return <GlossaryScope locale={locale} className="lesson">
    <section className={`center${showLab || canBreak ? ' has-play' : ''}`}>
      <header className="l-head"><div className="crumbs"><Link href={homePath(locale)}>{pad2(place.moduleIndex + 1)}. {place.module.title[locale]}</Link><span>/</span>{t('lesson.of', { i: place.lessonIndex + 1, n: place.module.lessons.length })}</div>
        <div className="l-title-row"><h1>{lesson.title}</h1><div className="pills"><span className="pill-chip p-time">◷ {t('lesson.min', { n: lesson.minutes })}</span><span className="pill-chip p-level">▮ {t(`level.${lesson.level}`)}</span><span className="pill-chip p-steps">☰ {t('lesson.steps', { n })}</span></div></div><p className="l-summary"><GlossaryPlain text={lesson.summary} /></p>
      </header>
      <div className="stage-card"><div className="stage-top">
        <div className="metrics">{lesson.metrics.map((m) => <Metric key={m.id} label={m.label} value={shownValues[m.id] ?? '—'} locale={locale} />)}</div>
        <div className="stage-aside">
          <div className="legend">{lesson.legend.map((l, i) => {
            const [kind, label] = Array.isArray(l) ? l : [l, t(`packet.${l}`)];
            return <span className="lg" key={i}><i className={`sw sw-${kind}`} />{label}</span>;
          })}</div>
          <div className="controls"><button className="btn small replay" type="button" title="R" onClick={replay}>↻ {t('stage.replay')}</button><button className={`btn small pause${paused ? ' is-on' : ''}`} type="button" title="Space" onClick={togglePause}>{paused ? `▶ ${t('stage.play')}` : `❚❚ ${t('stage.pause')}`}</button><button className="btn small fit" type="button" title="F" onClick={() => stage.current?.fit()}>⤢ {t('stage.fit')}</button></div>
        </div>
      </div>
      <div className="stage-shell">
        <Diagram scene={stageScene} stageRef={stage} jump={false} breakable={canBreak ? Object.keys(current.chaos ?? {}).join(',') : ''} broken={canBreak ? brokenKey : ''} onEntityClick={toggleBroken} />
        {stageGlossary.length > 0 && (
          <ul className="glossary-stage" aria-label={t('glossary.stageList')}>
            {stageGlossary.map((e) => {
              const full = glossaryExpansion(e, 'en');
              return (
                <li key={e.id}>
                  <span className="glossary-stage-abbr">{glossaryAbbrevLabel(e)}</span>
                  {full && <span className="glossary-stage-exp"> ({full})</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <StudioDock waterfall={stageScene.waterfall} inspector={stageScene.inspector} locale={locale} />
      <div className="stage-foot">
        {record && (resolved.beat?.label || displayStep.short) && (
          <span className="record-beat">{displayStep.short}{resolved.beat?.label ? ` · ${resolved.beat.label}` : ''}</span>
        )}
        <span className={`stage-hint${canBreak ? ' is-chaos' : ''}`}>{canBreak ? t('chaos.hint') : t('stage.hint')}</span>
      </div></div>
      {showLab && labResult && <LabCard lab={lab} locale={locale} values={labValues} note={labResult.note} onChange={(id, v) => setLabValues((s) => ({ ...s, [id]: v }))} onReset={() => setLabValues(defaults)} />}
      {canBreak && <ChaosCard step={current} broken={broken} onToggle={toggleBroken} onRepair={() => setBroken([])} />}
      <div className="timeline-card"><div className="tl-head"><span>{t('lesson.timeline')}</span><span className="tl-count">{t('lesson.stepOf', { i: index + 1, n })}</span></div><ol className="timeline" ref={timeline}>{lesson.steps.map((s, i) => <li key={i}><Link href={lessonPath(locale, lesson.id, i + 1)} onClick={(event) => onStepLink(event, i + 1)} data-i={i} className={`${i === index ? 'is-current' : ''}${seen.has(i) ? ' is-seen' : ''}`} aria-current={i === index ? 'step' : undefined}><span className="tl-dot">{i + 1}</span><span className="tl-label">{s.short}</span></Link></li>)}</ol></div>
    </section>
    <aside className="side"><div className="step-card" ref={stepCard}><div className="step-top"><span className="step-no">{t('step.label', { i: index + 1, n })}</span><span className={`chip ch-${current.chapter}`}>{t(`chapter.${current.chapter}`)}</span></div>
      <article className="step enter" aria-live="polite" key={index}><h2><GlossaryPlain text={current.title} /></h2>
        {current.predict && (
          <PredictCard predict={current.predict} choice={predictChoice} onPick={answerPredict} onSkip={() => answerPredict(-1)} />
        )}
        {!gated && (
          <div className="step-body">
            {current.body.map((p, i) =>
              p.trimStart().startsWith('<table')
                ? <div key={i}><GlossaryHtml html={p} /></div>
                : <p key={i}><GlossaryHtml html={p} /></p>,
            )}
            {current.callout && (
              <aside className={`callout co-${current.callout.kind}`}>
                <b>{t(`callout.${current.callout.kind}`)}</b>
                <span><GlossaryHtml html={current.callout.text} /></span>
              </aside>
            )}
            <Changes lesson={lesson} index={index} />
          </div>
        )}
      </article>
      <nav className="step-nav"><button className="btn prev" type="button" disabled={index === 0} onClick={() => nav(-1)}>← {t('step.back')}</button><button className="btn primary next" type="button" onClick={() => nav(1)}>{lesson.steps[index + 1] ? `${t('step.nextTo', { short: lesson.steps[index + 1]!.short })} →` : `${t('step.finish')} ✓`}</button></nav>
      <p className="keys">{t.rich('step.keys', { kbd: (chunks) => <kbd>{chunks}</kbd> })}</p>
    </div><div className="learn-card"><h3>{t('lesson.learn')}</h3><ul className="learn">{lesson.goals.map((g, i) => <li key={i}><Link href={lessonPath(locale, lesson.id, g.step)} onClick={(event) => onStepLink(event, g.step)} data-step={g.step} className={seen.has(g.step - 1) ? 'is-done' : undefined}><i className="check" aria-hidden="true" /><GlossaryPlain text={g.text} /></Link></li>)}</ul></div>
      {hasBeats && (
        <div className="beat-card" role="group" aria-label={t('stage.beatOf', { i: beatIndex + 1, n: beats.length })}>
          <div className="beat-head">
            <span className="beat-label">{resolved.beat?.label ?? t('stage.beatOf', { i: beatIndex + 1, n: beats.length })}</span>
            <span className="beat-count">{t('stage.beatOf', { i: beatIndex + 1, n: beats.length })}</span>
          </div>
          <div className="beat-controls">
            <button className="beat-nav" type="button" disabled={beatIndex === 0} aria-label={t('stage.prevBeat')} title="↑ / ," onClick={() => stepBeat(-1)}>‹</button>
            <div className="beat-dots">{beats.map((b, i) => (
              <button key={i} type="button" className={`beat-dot${i === beatIndex ? ' is-active' : i < beatIndex ? ' is-done' : ''}`} aria-current={i === beatIndex ? 'step' : undefined} title={b.label ?? String(i + 1)} onClick={() => setBeatIndex(i)}>{i + 1}</button>
            ))}</div>
            <button className="beat-nav" type="button" disabled={beatIndex >= beats.length - 1} aria-label={t('stage.nextBeat')} title="↓ / ." onClick={() => stepBeat(1)}>›</button>
          </div>
        </div>
      )}
    </aside>
  </GlossaryScope>;
}

export default function ScaleLab({ locale, lessonId, step = 1, lesson }: { locale: Locale; lessonId?: string; step?: number; lesson?: Lesson }) {
  const t = useTranslations();
  const router = useRouter();
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [navOpen, setNavOpen] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const [studio, setStudio] = useState(false);
  const refreshProgress = useCallback(() => setProgress(readProgress()), []);
  const closeNav = useCallback(() => setNavOpen(false), []);
  const toggleSidebar = useCallback(() => {
    setNavHidden((prev) => {
      const next = !prev;
      save('navHidden', next);
      return next;
    });
  }, []);
  const toggleStudio = useCallback(() => {
    setStudio((prev) => {
      const next = !prev;
      save('studio', next);
      return next;
    });
  }, []);
  const found = lessonId ? findInCourse(lessonId) : undefined;
  useEffect(() => {
    refreshProgress();
    setNavHidden(load('navHidden', false));
    const params = new URLSearchParams(window.location.search);
    const forceStudio = params.get('studio') === '1' || params.get('record') === '1' || params.get('presenter') === '1';
    setStudio(forceStudio || load('studio', false));
    const saved = load<'light' | 'dark' | null>('theme', null);
    document.documentElement.dataset.theme = saved === 'dark' || (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }, [refreshProgress]);
  useEffect(() => {
    document.documentElement.dataset.studio = studio ? '1' : '0';
  }, [studio]);
  useEffect(() => {
    save('lang', locale);
  }, [locale]);
  useEffect(() => {
    setNavOpen(false);
  }, [lessonId, step, locale]);
  useEffect(() => {
    document.body.classList.toggle('nav-open', navOpen);
    return () => document.body.classList.remove('nav-open');
  }, [navOpen]);
  useEffect(() => {
    const on = navHidden && !!lesson;
    document.documentElement.classList.toggle('is-wide', on);
    return () => document.documentElement.classList.remove('is-wide');
  }, [navHidden, lesson]);
  useEffect(() => {
    const onStorage = () => refreshProgress();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshProgress]);
  const switchLocale = (next: Locale) => {
    if (next === locale) return;
    const pathStep = Number(window.location.pathname.split('/').filter(Boolean).at(-1));
    const currentStep = Number.isFinite(pathStep) && pathStep >= 1 ? pathStep : step;
    router.push(lesson ? lessonPath(next, lesson.id, Math.max(1, Math.min(lesson.steps.length, Number.isFinite(currentStep) ? Math.trunc(currentStep) : 1))) : homePath(next));
  };
  return <>
    <header className="top"><button className="icon-btn menu" type="button" aria-label={t('nav.menu')} aria-expanded={navOpen} onClick={() => setNavOpen(!navOpen)}>☰</button>
      <button className={`icon-btn sidebar-toggle${navHidden ? ' is-on' : ''}`} type="button" title={`${navHidden ? t('nav.showSidebar') : t('nav.hideSidebar')} ([)`} aria-label={navHidden ? t('nav.showSidebar') : t('nav.hideSidebar')} aria-pressed={navHidden} onClick={toggleSidebar}><svg viewBox="0 0 18 16" width="15" height="13" aria-hidden="true"><rect x="1" y="1.5" width="16" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><line x1="6.5" y1="1.5" x2="6.5" y2="14.5" stroke="currentColor" strokeWidth="1.5" /></svg><span>{t('nav.wide')}</span></button>
      <Link className="brand" href={homePath(locale)}><svg viewBox="0 0 28 28" width="22" height="22" aria-hidden="true"><polygon points="14,3 25,8.5 14,14 3,8.5" className="logo-top" /><polygon points="3,8.5 14,14 14,25 3,19.5" className="logo-l" /><polygon points="25,8.5 14,14 14,25 25,19.5" className="logo-r" /></svg>Scale Lab</Link>
      <div className="top-right"><button className={`btn small studio-toggle${studio ? ' is-on' : ''}`} type="button" aria-pressed={studio} onClick={toggleStudio}>✦ {t('nav.studio')}</button><div className="lang" role="group" aria-label={t('lang.label')}>{LOCALES.map((l) => <button key={l.id} type="button" title={l.name} aria-pressed={l.id === locale} onClick={() => switchLocale(l.id)}>{l.short}</button>)}</div><button className="icon-btn theme" type="button" title={t('theme.toggle')} aria-label={t('theme.toggle')} onClick={() => setTheme(currentTheme() === 'dark' ? 'light' : 'dark')}>◐</button></div>
    </header>
    <div className={`shell${navHidden ? ' is-nav-hidden' : ''}`}><Sidebar locale={locale} currentId={lesson?.id} progress={progress} /><div className="nav-scrim" onClick={closeNav} /><main id="view">{lesson && found ? <LessonScreen key={`${locale}/${lesson.id}`} lesson={lesson} place={found} locale={locale} step={step} progress={progress} wide={navHidden} onProgress={refreshProgress} onStepNavigation={closeNav} onToggleSidebar={toggleSidebar} /> : <Home locale={locale} progress={progress} />}</main></div>
  </>;
}
