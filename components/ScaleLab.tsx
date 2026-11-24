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
import { labFor, type Lab } from '../src/lessons/labs';
import type { Lesson, MetricValue, Predict, Scene, Step } from '../src/types';
import { currentTheme, load, markVisited, save, setLastStep, setTheme } from '../src/ui/store';

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
  return <div className="changes"><h3>{t('step.changed')}</h3><ul>{rows.map(([sign, content], j) => <li key={j} className={`ch-${sign === '+' ? 'add' : sign === '-' ? 'remove' : 'change'}`}><i aria-hidden="true">{sign === '-' ? '−' : sign}</i><span>{content}</span></li>)}</ul></div>;
}

const kbd = (chunks: React.ReactNode) => <kbd>{chunks}</kbd>;

function PredictCard({ predict, onChoose, onSkip }: { predict: Predict; onChoose: (i: number) => void; onSkip: () => void }) {
  const t = useTranslations();
  return <div className="predict">
    <span className="predict-tag">{t('predict.label')}</span>
    <p className="predict-q">{predict.question}</p>
    <ol className="predict-opts">{predict.options.map((o, i) => <li key={i}>
      <button type="button" className="predict-opt" onClick={() => onChoose(i)}><kbd>{i + 1}</kbd><span>{o}</span></button>
    </li>)}</ol>
    <div className="predict-foot">
      <span className="keys">{t.rich('predict.keys', { n: predict.options.length, kbd })}</span>
      <button type="button" className="btn small" onClick={onSkip}>{t('predict.skip')}</button>
    </div>
  </div>;
}

function PredictResult({ predict, choice }: { predict: Predict; choice: number | undefined }) {
  const t = useTranslations();
  const correct = choice === predict.answer;
  const answer = predict.options[predict.answer]!;
  return <div className={`predict-result ${choice === undefined ? 'is-skipped' : correct ? 'is-correct' : 'is-wrong'}`}>
    <p className="pr-verdict">
      {choice !== undefined && <b>{correct ? t('predict.correct') : t('predict.wrong')}</b>}
      {!correct && <span>{t('predict.answer', { answer })}</span>}
    </p>
    {choice !== undefined && !correct && <p className="pr-yours">{t('predict.yours', { choice: predict.options[choice] ?? '' })}</p>}
    <p className="pr-explain" dangerouslySetInnerHTML={{ __html: predict.explain }} />
  </div>;
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
      <p dangerouslySetInnerHTML={{ __html: step.chaos?.[id]?.text ?? '' }} />
    </div>)}
  </div>;
}

const readAnswers = (lessonId: string) => load<Record<string, Record<string, number>>>('predict', {})[lessonId] ?? {};
function saveAnswer(lessonId: string, index: number, choice: number) {
  const all = load<Record<string, Record<string, number>>>('predict', {});
  save('predict', { ...all, [lessonId]: { ...all[lessonId], [index]: choice } });
}

function LessonScreen({ lesson, place, locale, step, progress, onProgress, onStepNavigation }: {
  lesson: Lesson; place: Place; locale: Locale; step: number; progress: Progress; onProgress: () => void; onStepNavigation: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const stage = useRef<Stage | null>(null);
  const timeline = useRef<HTMLOListElement>(null);
  const firstStep = useRef(true);
  const stepCard = useRef<HTMLDivElement>(null);
  const shown = useRef(new Map<string, string>());
  const [paused, setPaused] = useState(false);
  const [activeStep, setActiveStep] = useState(step);
  const index = Math.max(0, Math.min(lesson.steps.length - 1, Number.isFinite(activeStep) ? Math.trunc(activeStep) - 1 : 0));
  const current = lesson.steps[index]!;
  const n = lesson.steps.length;
  const seen = seenFor(progress, lesson.id);
  const values = valuesAt(lesson, index);

  // Predict: answers come from storage after mount, so the first render always asks.
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [skipped, setSkipped] = useState<Set<number>>(() => new Set());
  useEffect(() => setAnswers(readAnswers(lesson.id)), [lesson.id]);
  const choice = answers[index];
  const pending = !!current.predict && choice === undefined && !skipped.has(index);
  const choose = useCallback((i: number) => {
    saveAnswer(lesson.id, index, i);
    setAnswers((a) => ({ ...a, [index]: i }));
  }, [lesson.id, index]);
  const skip = useCallback(() => setSkipped((s) => new Set(s).add(index)), [index]);

  // Lab: metrics follow the sliders live; the diagram follows shortly after so packets keep flowing.
  const lab = labFor(lesson.id, index + 1);
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
  useEffect(() => setBroken([]), [index]);
  const canBreak = !pending && !!current.chaos;
  const toggleBroken = useCallback((id: string) => {
    if (!current.chaos?.[id]) return;
    setBroken((b) => (b.includes(id) ? b.filter((x) => x !== id) : [...b, id]));
  }, [current.chaos]);
  const brokenKey = broken.join(',');
  const chaosScene = useMemo(() => {
    if (!brokenKey) return current.scene;
    const ids = brokenKey.split(',');
    return { ...current.scene, entities: Object.fromEntries(Object.entries(current.scene.entities).map(([id, e]) => [id, ids.includes(id) ? { ...e, down: true } : e])) };
  }, [current.scene, brokenKey]);

  const stageScene = pending ? (lesson.steps[index - 1]?.scene ?? current.scene) : (labScene ?? chaosScene);
  const shownValues: Record<string, MetricValue> = pending
    ? valuesAt(lesson, Math.max(0, index - 1))
    : Object.assign({}, values, labResult?.metrics, ...broken.map((id) => current.chaos?.[id]?.metrics));
  const shownKey = JSON.stringify(shownValues);
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
    window.history.pushState(null, '', lessonPath(locale, lesson.id, next));
    setActiveStep(next);
    onStepNavigation();
  }, [index, locale, lesson.id, onStepNavigation]);
  const onStepLink = (event: MouseEvent<HTMLAnchorElement>, next: number) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    goToStep(next);
  };
  const nav = useCallback((delta: number) => {
    if (delta > 0 && pending) return skip();
    const next = index + delta;
    if (next >= n) router.push(homePath(locale));
    else if (next >= 0) goToStep(next + 1);
  }, [index, n, router, locale, goToStep, pending, skip]);
  const togglePause = useCallback(() => {
    const instance = stage.current;
    if (!instance) return;
    const next = !instance.isPaused;
    instance.setPaused(next);
    setPaused(next);
  }, []);
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
      const option = pending && current.predict && /^[1-9]$/.test(key) ? Number(key) - 1 : -1;
      if (option >= 0 && option < (current.predict?.options.length ?? 0)) choose(option);
      else if (key === 'arrowright' || key === 'pagedown') nav(1);
      else if (key === 'arrowleft' || key === 'pageup') nav(-1);
      else if (key === ' ') togglePause();
      else if (key === 'r') stage.current?.replay();
      else if (key === 'f') stage.current?.fit();
      else return;
      ev.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [nav, togglePause, pending, current.predict, choose]);
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>('.metric[data-id] .m-val');
    for (const el of elements) {
      const id = el.parentElement?.dataset.id;
      if (!id) continue;
      const value = el.textContent ?? '';
      if (shown.current.has(id) && shown.current.get(id) !== value) {
        el.classList.remove('flash');
        void el.offsetWidth;
        el.classList.add('flash');
      }
      shown.current.set(id, value);
    }
  }, [index, lesson, shownKey]);
  return <div className="lesson">
    <section className={`center${(lab && !pending) || canBreak ? ' has-play' : ''}`}>
      <header className="l-head"><div className="crumbs"><Link href={homePath(locale)}>{pad2(place.moduleIndex + 1)}. {place.module.title[locale]}</Link><span>/</span>{t('lesson.of', { i: place.lessonIndex + 1, n: place.module.lessons.length })}</div>
        <div className="l-title-row"><h1>{lesson.title}</h1><div className="pills"><span className="pill-chip p-time">◷ {t('lesson.min', { n: lesson.minutes })}</span><span className="pill-chip p-level">▮ {t(`level.${lesson.level}`)}</span><span className="pill-chip p-steps">☰ {t('lesson.steps', { n })}</span></div></div><p className="l-summary">{lesson.summary}</p>
      </header>
      <div className="stage-card"><div className="stage-top">
        <div className="metrics">{lesson.metrics.map((m) => {
          const v = shownValues[m.id] ?? '—';
          return <div className="metric" data-id={m.id} key={m.id}><span className="m-label">{m.label}</span><span className={`m-val${typeof v === 'string' ? '' : ` tone-${v.tone}`}`}>{typeof v === 'string' ? v : v.v}</span></div>;
        })}</div>
        <div className="controls"><button className="btn small replay" type="button" title="R" onClick={() => stage.current?.replay()}>↻ {t('stage.replay')}</button><button className={`btn small pause${paused ? ' is-on' : ''}`} type="button" title="Space" onClick={togglePause}>{paused ? `▶ ${t('stage.play')}` : `❚❚ ${t('stage.pause')}`}</button><button className="btn small fit" type="button" title="F" onClick={() => stage.current?.fit()}>⤢ {t('stage.fit')}</button></div>
      </div><Diagram scene={stageScene} stageRef={stage} jump={false} breakable={canBreak ? Object.keys(current.chaos ?? {}).join(',') : ''} broken={canBreak ? brokenKey : ''} onEntityClick={toggleBroken} /><div className="stage-foot"><div className="legend">{lesson.legend.map((l, i) => {
        const [kind, label] = Array.isArray(l) ? l : [l, t(`packet.${l}`)];
        return <span className="lg" key={i}><i className={`sw sw-${kind}`} />{label}</span>;
      })}</div><span className={`stage-hint${canBreak ? ' is-chaos' : ''}`}>{canBreak ? t('chaos.hint') : t('stage.hint')}</span></div></div>
      {lab && labResult && !pending && <LabCard lab={lab} locale={locale} values={labValues} note={labResult.note} onChange={(id, v) => setLabValues((s) => ({ ...s, [id]: v }))} onReset={() => setLabValues(defaults)} />}
      {canBreak && <ChaosCard step={current} broken={broken} onToggle={toggleBroken} onRepair={() => setBroken([])} />}
      <div className="timeline-card"><div className="tl-head"><span>{t('lesson.timeline')}</span><span className="tl-count">{t('lesson.stepOf', { i: index + 1, n })}</span></div><ol className="timeline" ref={timeline}>{lesson.steps.map((s, i) => <li key={i}><Link href={lessonPath(locale, lesson.id, i + 1)} onClick={(event) => onStepLink(event, i + 1)} data-i={i} className={`${i === index ? 'is-current' : ''}${seen.has(i) ? ' is-seen' : ''}`} aria-current={i === index ? 'step' : undefined}><span className="tl-dot">{i + 1}</span><span className="tl-label">{s.short}</span></Link></li>)}</ol></div>
    </section>
    <aside className="side"><div className="step-card" ref={stepCard}><div className="step-top"><span className="step-no">{t('step.label', { i: index + 1, n })}</span><span className={`chip ch-${current.chapter}`}>{t(`chapter.${current.chapter}`)}</span></div>
      <article className="step enter" aria-live="polite" key={`${index}${pending ? '-ask' : ''}`}><h2>{current.title}</h2>
        {pending && current.predict && <PredictCard predict={current.predict} onChoose={choose} onSkip={skip} />}
        <div className="step-body" hidden={pending}>
          {!pending && current.predict && <PredictResult predict={current.predict} choice={choice} />}
          {current.body.map((p, i) => p.trimStart().startsWith('<table') ? <div key={i} dangerouslySetInnerHTML={{ __html: p }} /> : <p key={i} dangerouslySetInnerHTML={{ __html: p }} />)}
          {current.callout && <aside className={`callout co-${current.callout.kind}`}><b>{t(`callout.${current.callout.kind}`)}</b><span dangerouslySetInnerHTML={{ __html: current.callout.text }} /></aside>}
          {!pending && <Changes lesson={lesson} index={index} />}
        </div>
      </article>
      <nav className="step-nav"><button className="btn prev" type="button" disabled={index === 0} onClick={() => nav(-1)}>← {t('step.back')}</button><button className="btn primary next" type="button" onClick={() => nav(1)}>{lesson.steps[index + 1] ? `${t('step.nextTo', { short: lesson.steps[index + 1]!.short })} →` : `${t('step.finish')} ✓`}</button></nav>
      <p className="keys">{t.rich('step.keys', { kbd: (chunks) => <kbd>{chunks}</kbd> })}</p>
    </div><div className="learn-card"><h3>{t('lesson.learn')}</h3><ul className="learn">{lesson.goals.map((g, i) => <li key={i}><Link href={lessonPath(locale, lesson.id, g.step)} onClick={(event) => onStepLink(event, g.step)} data-step={g.step} className={seen.has(g.step - 1) ? 'is-done' : undefined}><i className="check" aria-hidden="true" />{g.text}</Link></li>)}</ul></div></aside>
  </div>;
}

export default function ScaleLab({ locale, lessonId, step = 1, lesson }: { locale: Locale; lessonId?: string; step?: number; lesson?: Lesson }) {
  const t = useTranslations();
  const router = useRouter();
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [navOpen, setNavOpen] = useState(false);
  const refreshProgress = useCallback(() => setProgress(readProgress()), []);
  const closeNav = useCallback(() => setNavOpen(false), []);
  const found = lessonId ? findInCourse(lessonId) : undefined;
  useEffect(() => {
    refreshProgress();
    const saved = load<'light' | 'dark' | null>('theme', null);
    document.documentElement.dataset.theme = saved === 'dark' || (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }, [refreshProgress]);
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
      <Link className="brand" href={homePath(locale)}><svg viewBox="0 0 28 28" width="22" height="22" aria-hidden="true"><polygon points="14,3 25,8.5 14,14 3,8.5" className="logo-top" /><polygon points="3,8.5 14,14 14,25 3,19.5" className="logo-l" /><polygon points="25,8.5 14,14 14,25 25,19.5" className="logo-r" /></svg>Scale Lab</Link>
      <div className="top-right"><div className="lang" role="group" aria-label={t('lang.label')}>{LOCALES.map((l) => <button key={l.id} type="button" title={l.name} aria-pressed={l.id === locale} onClick={() => switchLocale(l.id)}>{l.short}</button>)}</div><button className="icon-btn theme" type="button" title={t('theme.toggle')} aria-label={t('theme.toggle')} onClick={() => setTheme(currentTheme() === 'dark' ? 'light' : 'dark')}>◐</button></div>
    </header>
    <div className="shell"><Sidebar locale={locale} currentId={lesson?.id} progress={progress} /><div className="nav-scrim" onClick={closeNav} /><main id="view">{lesson && found ? <LessonScreen key={`${locale}/${lesson.id}`} lesson={lesson} place={found} locale={locale} step={step} progress={progress} onProgress={refreshProgress} onStepNavigation={closeNav} /> : <Home locale={locale} progress={progress} />}</main></div>
  </>;
}
