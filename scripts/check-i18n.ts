// Checks every lesson translation against its English source: same step/paragraph counts,
// matching callouts, and no label keys that do not appear in the diagrams.

import { existsSync } from 'node:fs';
const root = new URL('../src/', import.meta.url).pathname;
const { allLessons } = await import(root + 'course.ts');
const { localize, applyLessonOverlay } = await import(root + 'lessons/localize.ts');
let problems = 0;
for (const entry of allLessons) {
  const lesson = entry.lesson; if (!lesson) continue;
  const file = `${root}lessons/i18n/id/${lesson.id}.ts`;
  if (!existsSync(file)) { problems++; console.log(lesson.id, 'NO TRANSLATION'); continue; }
  const o = (await import(file)).default;
  const localized = await localize(lesson, 'id');
  if (localized === lesson || JSON.stringify(localized) !== JSON.stringify(applyLessonOverlay(lesson, o))) {
    problems++; console.log(lesson.id, 'TRANSLATION LOADER MISSING OR INCORRECT');
  }
  const strings = new Set<string>();
  const add = (s?: string) => s && strings.add(s);
  lesson.legend.forEach((l: any) => Array.isArray(l) && add(l[1]));
  for (const s of lesson.steps) {
    for (const e of Object.values<any>(s.scene.entities)) {
      add(e.label); add(e.sub); add(e.title); add(e.badge?.text);
      e.lines?.forEach((l: string) => add(/^[!✓#] /.test(l) ? l.slice(2) : l));
    }
    for (const l of Object.values<any>(s.scene.links ?? {})) add(l.label);
    for (const e of Object.values<any>(s.scene.entities)) add(e.meter?.label);
    for (const v of Object.values<any>(s.metrics ?? {})) add(typeof v === 'string' ? v : v.v);
    for (const c of Object.values<any>(s.chaos ?? {}))
      for (const v of Object.values<any>(c.metrics ?? {})) add(typeof v === 'string' ? v : v.v);
  }
  const unused = Object.keys(o.labels ?? {}).filter((k) => !strings.has(k));
  if (o.steps.length !== lesson.steps.length) { problems++; console.log(lesson.id, 'step count', o.steps.length, lesson.steps.length); }
  lesson.steps.forEach((s: any, i: number) => {
    const so = o.steps[i];
    if (so?.body?.length !== s.body.length) { problems++; console.log(lesson.id, 'step', i + 1, 'body', so?.body?.length, s.body.length); }
    if (!!s.callout !== !!so?.callout) { problems++; console.log(lesson.id, 'step', i + 1, 'callout mismatch'); }
    if ((s.changes?.length ?? 0) !== (so?.changes?.length ?? 0)) { problems++; console.log(lesson.id, 'step', i + 1, 'changes', so?.changes?.length ?? 0, s.changes?.length ?? 0); }
    const chaosKeys = (x: any) => Object.keys(x ?? {}).sort().join(',');
    if (chaosKeys(s.chaos) !== chaosKeys(so?.chaos)) { problems++; console.log(lesson.id, 'step', i + 1, 'chaos keys', chaosKeys(so?.chaos), chaosKeys(s.chaos)); }
    for (const id of Object.keys(s.chaos ?? {}))
      if (!s.scene.entities[id]) { problems++; console.log(lesson.id, 'step', i + 1, 'chaos target missing from scene:', id); }
  });
  if (o.goals.length !== lesson.goals.length || o.metrics.length !== lesson.metrics.length) { problems++; console.log(lesson.id, 'goals/metrics count'); }
  if (unused.length) { problems++; console.log(lesson.id, 'UNUSED label keys:', unused); }
}
console.log(problems ? `${problems} problem(s)` : 'OK');
if (problems) process.exitCode = 1;
