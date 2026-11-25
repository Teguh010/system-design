import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestLifecycle } from '../src/lessons/request-lifecycle.ts';
import { formatMs, pageLoad, requestLifecycleLab } from '../src/lessons/labs/request-lifecycle.ts';

const text = (v: unknown) => (typeof v === 'string' ? v : (v as { v: string }).v);
const metricsAt = (step: number) => Object.assign({}, ...requestLifecycle.steps.slice(0, step).map((s) => s.metrics));

test('the page-load model reproduces the lesson’s static steps', () => {
  for (const [step, rtt, work] of [[7, 30, 25], [8, 30, 410], [9, 300, 25]] as const) {
    const expected = metricsAt(step);
    const b = pageLoad(rtt, work);
    for (const id of ['dns', 'connect', 'server', 'download', 'total'] as const) assert.equal(formatMs(b[id], 'en', id === 'total'), text(expected[id]), `step ${step} ${id}`);
  }
});

test('the lab formats numbers per locale and names the biggest term', () => {
  const base = requestLifecycle.steps[9]!.scene;
  const en = requestLifecycleLab.compute({ rtt: 300, work: 25 }, 'en', base);
  const id = requestLifecycleLab.compute({ rtt: 300, work: 25 }, 'id', base);
  assert.equal(text(en.metrics.download), '1,000 ms');
  assert.equal(text(id.metrics.download), '1.000 ms');
  assert.equal(text(id.metrics.total), '~2,0 dtk');
  assert.match(en.note, /download/);
  assert.equal(en.scene.entities.far, undefined);
  assert.equal(en.scene.entities.live?.kind, 'card');
  assert.ok(en.scene.entities.live?.lines?.some((l) => l.includes('~2.0 s')));
  assert.ok(id.scene.entities.live?.lines?.some((l) => l.includes('~2,0 dtk')));
  assert.equal(en.scene.entities.cheat?.kind, 'card');
});
