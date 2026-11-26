import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enrichGlossary, glossPlainText, glossaryInProse } from '../src/glossary/enrich.ts';

test('skips terms inside code and keeps tables intact', () => {
  const html = '<p>RTT is short. <code>N+1 query</code> stays plain.</p>';
  const out = enrichGlossary(html);
  assert.match(out, /data-gloss="rtt"/);
  assert.ok(!out.includes('data-gloss="n-plus-one"'));
  assert.match(out, /<code>N\+1 query<\/code>/);
});

test('prefers longer matches and respects word boundaries', () => {
  const text = glossPlainText('round-trip time beats RTT.');
  assert.match(text, /data-gloss="rtt">round-trip time</);
  const trips = glossPlainText('a few round trips add up.');
  assert.match(trips, /data-gloss="rtt">round trips</);
  const app = glossPlainText('application');
  assert.equal(app, 'application');
});

test('lists expansions from step prose in reading order', () => {
  const found = glossaryInProse('Open <b>TCP</b> then <b>TLS</b> on the wire.');
  assert.equal(found.map((e) => e.id).join(','), 'tcp,tls');
});

test('upgrades explicit data-gloss spans', () => {
  const out = enrichGlossary('<p><span data-gloss="cdn">CDN</span> edge.</p>');
  assert.match(out, /class="gloss"/);
  assert.match(out, /data-gloss="cdn"/);
  assert.doesNotMatch(out, /data-gloss="cdn"[^>]*data-gloss="cdn"/);
});