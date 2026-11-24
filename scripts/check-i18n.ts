// Checks every lesson translation against its English source: same step/paragraph counts,
// matching callouts, and no label keys that do not appear in the diagrams.

import { existsSync } from 'node:fs';
const root = new URL('../src/', import.meta.url).pathname;
const { allLessons } = await import(root + 'course.ts');
let problems = 0;
for (const entry of allLessons) {
  const lesson = entry.lesson; if (!lesson) continue;
  const file = `${root}lessons/i18n/id/${lesson.id}.ts`;
  if (!existsSync(file)) { problems++; console.log(lesson.id, 'NO TRANSLATION'); continue; }
  const o = (await import(file)).default;
  const strings = new Set<string>();
  const add = (s?: string) => s && strings.add(s);
  lesson.legend.forEach((l: any) => Array.isArray(l) && add(l[1]));
  for (const s of lesson.steps) {
    for (const e of Object.values<any>(s.scene.entities)) {
      add(e.label); add(e.sub); add(e.title); add(e.badge?.text);
      e.lines?.forEach((l: string) => add(/^[!✓#] /.test(l) ? l.slice(2) : l));
    }
    for (const v of Object.values<any>(s.metrics ?? {})) add(typeof v === 'string' ? v : v.v);
  }
  const unused = Object.keys(o.labels ?? {}).filter((k) => !strings.has(k));
  if (o.steps.length !== lesson.steps.length) { problems++; console.log(lesson.id, 'step count', o.steps.length, lesson.steps.length); }
  lesson.steps.forEach((s: any, i: number) => {
    const so = o.steps[i];
    if (so?.body?.length !== s.body.length) { problems++; console.log(lesson.id, 'step', i + 1, 'body', so?.body?.length, s.body.length); }
    if (!!s.callout !== !!so?.callout) { problems++; console.log(lesson.id, 'step', i + 1, 'callout mismatch'); }
  });
  if (o.goals.length !== lesson.goals.length || o.metrics.length !== lesson.metrics.length) { problems++; console.log(lesson.id, 'goals/metrics count'); }
  if (unused.length) { problems++; console.log(lesson.id, 'UNUSED label keys:', unused); }
}
console.log(problems ? `${problems} problem(s)` : 'OK');
