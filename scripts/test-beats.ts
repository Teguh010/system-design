import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveBeat } from '../src/lessons/beats.ts';
import { client, link, server } from '../src/lessons/helpers.ts';
import type { Step } from '../src/types.ts';

const step: Step = {
  short: 'DNS',
  chapter: 'technique',
  title: 'DNS lookup',
  body: ['Look up the IP.'],
  metrics: { dns: '40 ms', total: '40 ms' },
  scene: {
    entities: {
      browser: client(0, 0, { label: 'you', badge: { text: '203.0.113.7', tone: 'good' } }),
      web: server(20, 0, { label: 'server' }),
    },
    links: { bw: link('browser', 'web', { label: 'open' }) },
    flows: [{ route: ['bw'], rate: 1 }],
  },
  beats: [
    {
      label: 'check cache',
      entities: { browser: { badge: { text: 'cache: miss', tone: 'warn' } } },
      links: { bw: null },
      flows: [],
      metrics: { dns: '?' },
    },
    {
      label: 'ask DNS',
      camera: { focus: ['browser'] },
      entities: { browser: { focus: true }, web: { dim: true } },
      flows: [{ route: ['bw'], kind: 'ping', rate: 1, once: 1 }],
    },
    {
      label: 'got IP',
      metrics: { dns: '40 ms' },
    },
  ],
};

test('resolveBeat patches scene cleanly per beat and carries metrics across beats', () => {
  const b0 = resolveBeat(step, 0);
  assert.equal(b0.beat?.label, 'check cache');
  assert.equal(b0.scene.entities.browser?.badge?.text, 'cache: miss');
  assert.equal(b0.scene.links?.bw, undefined);
  assert.deepEqual(b0.scene.flows, []);
  assert.equal(b0.metrics.dns, '?');

  const b1 = resolveBeat(step, 1);
  assert.equal(b1.scene.entities.browser?.focus, true);
  assert.equal(b1.scene.entities.web?.dim, true);
  assert.deepEqual(b1.scene.camera?.focus, ['browser']);
  assert.equal(b1.scene.entities.browser?.badge?.text, 'cache: miss');
  assert.equal(b1.scene.links?.bw, undefined);
  assert.equal(b1.scene.flows?.[0]?.once, 1);
  assert.equal(b1.metrics.dns, '?');

  const b2 = resolveBeat(step, 2);
  assert.equal(b2.metrics.dns, '40 ms');
  assert.equal(b2.scene.camera, undefined);
  assert.equal(b2.scene.flows?.[0]?.rate, 1);
  assert.equal(b2.scene.entities.browser?.focus, true);
  assert.equal(b2.scene.entities.browser?.badge?.text, 'cache: miss');
  assert.equal(b2.scene.links?.bw, undefined);
});
