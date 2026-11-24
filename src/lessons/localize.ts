import type { Locale } from '../i18n/index.ts';
import type { Entity, Lesson, LessonOverlay, MetricValue, Scene } from '../types.ts';

const overlays = import.meta.glob<{ default: LessonOverlay }>('./i18n/*/*.ts');

const PREFIX = /^([!✓#] )/;

function apply(lesson: Lesson, o: LessonOverlay): Lesson {
  const labels = o.labels ?? {};
  const tr = (s: string | undefined) => (s === undefined ? s : (labels[s] ?? s));
  const line = (s: string) => {
    const m = PREFIX.exec(s);
    return m ? m[1] + (tr(s.slice(2)) ?? '') : (tr(s) ?? s);
  };
  const metric = (v: MetricValue): MetricValue => (typeof v === 'string' ? tr(v)! : { ...v, v: tr(v.v)! });
  const entity = (e: Entity): Entity => {
    const out: Entity = { ...e };
    if (e.label !== undefined) out.label = tr(e.label)!;
    if (e.sub !== undefined) out.sub = tr(e.sub)!;
    if (e.title !== undefined) out.title = tr(e.title)!;
    if (e.lines) out.lines = e.lines.map(line);
    if (e.badge) out.badge = { ...e.badge, text: tr(e.badge.text)! };
    if (e.meter) out.meter = { ...e.meter, label: tr(e.meter.label)! };
    return out;
  };
  const scene = (s: Scene): Scene => ({
    ...s,
    entities: Object.fromEntries(Object.entries(s.entities).map(([k, e]) => [k, entity(e)])),
    ...(s.links && { links: Object.fromEntries(Object.entries(s.links).map(([k, l]) => [k, l.label ? { ...l, label: tr(l.label)! } : l])) }),
  });

  return {
    ...lesson,
    title: o.title ?? lesson.title,
    summary: o.summary ?? lesson.summary,
    metrics: lesson.metrics.map((m, i) => ({ ...m, label: o.metrics?.[i] ?? m.label })),
    legend: lesson.legend.map((l) => (Array.isArray(l) ? [l[0], tr(l[1])!] : l)),
    goals: lesson.goals.map((g, i) => ({ ...g, text: o.goals?.[i] ?? g.text })),
    steps: lesson.steps.map((step, i) => {
      const so = o.steps?.[i];
      return {
        ...step,
        short: so?.short ?? step.short,
        title: so?.title ?? step.title,
        body: step.body.map((p, j) => so?.body?.[j] ?? p),
        ...(step.callout && { callout: { ...step.callout, text: so?.callout ?? step.callout.text } }),
        ...(step.changes && { changes: step.changes.map((c, j) => so?.changes?.[j] ?? c) }),
        ...(step.metrics && { metrics: Object.fromEntries(Object.entries(step.metrics).map(([k, v]) => [k, metric(v)])) }),
        scene: scene(step.scene),
      };
    }),
  };
}

const cache = new Map<string, Lesson>();

/** The lesson in `locale`, loading its translation file on demand. Falls back to English. */
export async function localize(lesson: Lesson, locale: Locale): Promise<Lesson> {
  if (locale === 'en') return lesson;
  const key = `${locale}/${lesson.id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const load = overlays[`./i18n/${locale}/${lesson.id}.ts`];
  if (!load) return lesson;
  const out = apply(lesson, (await load()).default);
  cache.set(key, out);
  return out;
}
