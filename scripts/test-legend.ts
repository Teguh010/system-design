import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allLessons } from '../src/course.ts';
import type { PacketKind } from '../src/types.ts';

test('every packet colour on stage is in the legend, and the legend lists nothing unused', () => {
  for (const { lesson } of allLessons) {
    if (!lesson?.steps.length) continue;
    const used = new Set<PacketKind>();
    for (const step of lesson.steps)
      for (const f of step.scene.flows ?? []) {
        used.add(f.kind ?? 'req');
        if (f.bounce) used.add(f.returnKind ?? 'res');
        if (f.fail) used.add('fail');
      }
    const legend = new Set(lesson.legend.map((l) => (Array.isArray(l) ? l[0] : l)));
    assert.deepEqual([...used].filter((k) => !legend.has(k)), [], `${lesson.id}: packets missing from the legend`);
    assert.deepEqual([...legend].filter((k) => !used.has(k)), [], `${lesson.id}: legend entries never drawn`);
  }
});
