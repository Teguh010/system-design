import type { Entity, Flow, Lesson, Link, Scene } from '../types.ts';
import { cache, card, db, link, server, users } from './helpers.ts';

const VISITORS = users(0, 0, { label: 'visitors' });
const APP = server(14, 0, { label: 'app server' });
const CACHE = cache(27, -12, { label: 'cache', sub: 'Redis' });
const DB = db(27, 12, { label: 'database' });

const HIT: Flow = { route: ['ua', 'ac'], rate: 3, bounce: true };
const MISS: Flow = { route: ['ua', 'ac', '~ac', 'ad'], kind: 'slow', rate: 0.35, bounce: true };

function aside(o: { entities?: Record<string, Entity>; links?: Record<string, Link>; flows?: Flow[] } = {}): Scene {
  return {
    entities: { users: VISITORS, app: APP, cache: CACHE, db: DB, ...o.entities },
    links: { ua: link('users', 'app'), ac: link('app', 'cache'), ad: link('app', 'db'), ...o.links },
    flows: o.flows ?? [HIT, MISS],
  };
}

export const caching: Lesson = {
  id: 'caching',
  title: 'Caching',
  summary: 'Keep answers you have already computed close at hand — and deal with the two hard parts: stale data and stampedes.',
  minutes: 13,
  level: 'beginner',
  metrics: [
    { id: 'hit', label: 'hit rate' },
    { id: 'dbLoad', label: 'db reads / s' },
    { id: 'latency', label: 'avg read' },
    { id: 'stale', label: 'max staleness' },
  ],
  legend: ['req', 'res', ['slow', 'cache miss'], ['write', 'write'], 'fail'],
  goals: [
    { text: 'Use the cache-aside pattern', step: 2 },
    { text: 'Calculate what a hit rate is worth', step: 3 },
    { text: 'Choose expiry and eviction', step: 4 },
    { text: 'Keep cached data fresh after writes', step: 5 },
    { text: 'Survive a thundering herd', step: 7 },
  ],
  steps: [
    {
      short: 'Same question',
      chapter: 'setup',
      title: 'The same question, again and again',
      body: [
        'A shop’s product page shows name, price, photos and stock. Thousands of visitors open the same 500 popular products every minute, and every view runs the same database queries for data that changes a few times a day.',
        'The database is at 90% and climbing. Most of that work produces answers it has already produced a second ago.',
      ],
      metrics: { hit: '—', dbLoad: { v: '5,000', tone: 'warn' }, latency: '12 ms', stale: '0' },
      scene: {
        entities: { users: VISITORS, app: APP, db: { ...DB, badge: { text: '90% busy', tone: 'warn' } } },
        links: { ua: link('users', 'app'), ad: link('app', 'db') },
        flows: [{ route: ['ua', 'ad'], rate: 3, bounce: true }],
      },
    },
    {
      short: 'Cache-aside',
      chapter: 'technique',
      title: 'Cache-aside',
      body: [
        'Put an in-memory cache next to the app. For each read: look in the cache first. On a <b>hit</b>, return immediately. On a <b>miss</b>, query the database, store the result in the cache, then return it.',
        'This is <b>cache-aside</b> (or lazy loading): the app manages the cache, and only data someone actually asks for ends up in it. Most reads now never reach the database.',
      ],
      callout: { kind: 'tip', text: 'Cache the result the page needs (the whole product view), not each little query behind it. Fewer keys, more hits.' },
      metrics: { hit: { v: '90%', tone: 'good' }, dbLoad: { v: '500', tone: 'good' }, latency: { v: '1.6 ms', tone: 'good' } },
      scene: aside(),
    },
    {
      short: 'Hit rate math',
      chapter: 'technique',
      title: 'What a hit rate is worth',
      body: [
        'Database load is the miss rate times traffic. At 90% hits the database sees 1 in 10 reads; at 99%, 1 in 100. Going from 90% to 99% looks small but cuts database load by another 10×.',
        'Average latency is a weighted mix: with a 0.5 ms cache and a 12 ms database, 90% hits gives 0.9 × 0.5 + 0.1 × 12 ≈ 1.7 ms. Misses dominate the average, so the last few percent of hit rate are worth chasing.',
      ],
      metrics: { hit: { v: '99%', tone: 'good' }, dbLoad: { v: '50', tone: 'good' }, latency: { v: '0.6 ms', tone: 'good' } },
      scene: aside({
        flows: [HIT, { ...MISS, rate: 0.08 }],
        entities: { card: card(40, -16, 'Hit rate → load', ['hit   db share  avg read', '90%   1/10      ~1.7 ms', '99%   1/100     ~0.6 ms', '99.9% 1/1000    ~0.5 ms']) },
      }),
    },
    {
      short: 'Expiry',
      chapter: 'technique',
      title: 'Expiry and eviction',
      body: [
        'Memory is finite, so two rules decide what stays. A <b>TTL</b> (time to live) removes an entry after, say, five minutes, bounding how old cached data can get. An <b>eviction policy</b> decides what to drop when the cache is full — usually <b>LRU</b>, least recently used.',
        'Size the cache for the <i>hot set</i>, not the whole database: if 500 products get 90% of views, caching those few megabytes captures nearly all the benefit.',
      ],
      metrics: { stale: '≤ 5 min' },
      scene: aside({
        entities: {
          cache: { ...CACHE, badge: { text: 'TTL 5 min · LRU', tone: 'info' } },
          card: card(45, -14, 'Eviction', ['TTL   drop after 5 min', 'LRU   full? drop least recent', 'LFU   full? drop least used']),
        },
      }),
    },
    {
      short: 'Stale price',
      chapter: 'problem',
      title: 'Case: the stale price',
      body: [
        'An admin drops a kettle from €49 to €39 for a flash sale. The database is updated instantly, but the cached product page still says €49 for up to five minutes. Shoppers see one price and are charged another.',
        'Two fixes, usually combined: on every write, <b>delete</b> (or update) the cached key so the next read reloads it; and keep the TTL as a safety net in case an invalidation is ever missed.',
      ],
      callout: { kind: 'warning', text: 'Every cache is a copy, and copies drift. Decide how stale each kind of data is allowed to be — prices and stock rarely tolerate much.' },
      metrics: { stale: { v: 'up to 5 min', tone: 'bad' } },
      scene: aside({
        entities: {
          admin: users(14, 20, { label: 'admin', count: 1 }),
          cache: { ...CACHE, badge: { text: 'still €49', tone: 'bad' } },
          db: { ...DB, badge: { text: 'now €39', tone: 'good' } },
        },
        links: { xd: link('admin', 'db') },
        flows: [HIT, MISS, { route: ['xd'], kind: 'write', rate: 0.5 }],
      }),
    },
    {
      short: 'Write paths',
      chapter: 'tradeoff',
      title: 'Write-through and write-behind',
      body: [
        'Cache-aside invalidates on write. Two other patterns route writes through the cache itself. <b>Write-through</b>: write to the cache and the database together, so the cache is always fresh, at the cost of slower writes. <b>Write-behind</b>: write to the cache and flush to the database later in batches — very fast, but a cache crash can lose writes.',
        `<table class="compare"><thead><tr><th>pattern</th><th>freshness</th><th>write speed</th><th>risk</th></tr></thead><tbody>
          <tr><td>cache-aside + delete</td><td>good</td><td class="good">fast</td><td>brief misses after writes</td></tr>
          <tr><td>write-through</td><td class="good">best</td><td>slower</td><td>caches data nobody reads</td></tr>
          <tr><td>write-behind</td><td class="good">best</td><td class="good">fastest</td><td class="bad">can lose writes</td></tr></tbody></table>`,
      ],
      metrics: { stale: { v: '≈ 0 (on write)', tone: 'good' } },
      scene: aside({
        entities: { cache: { ...CACHE, badge: { text: 'write-through', tone: 'info' } } },
        links: { cd: link('cache', 'db', { dashed: true }) },
        flows: [HIT, { route: ['ua', 'ac', 'cd'], kind: 'write', rate: 0.6 }],
      }),
    },
    {
      short: 'Herd',
      chapter: 'problem',
      title: 'Case: the thundering herd',
      body: [
        'The homepage’s “deals of the day” key expires at 12:00:00. In the next 50 ms, 2,000 requests miss at once, and all 2,000 run the same expensive query. The database stalls, queries time out, and the cache never gets refilled — a <b>cache stampede</b>.',
        'Defences: let only one request rebuild a missing key while the others wait (<b>request coalescing</b>, “single flight”); add random jitter to TTLs so keys don’t expire together; or serve the stale value while one worker refreshes it in the background.',
      ],
      callout: { kind: 'tip', text: '“Stale-while-revalidate” is often the best answer: a slightly old deal is far better than an error page.' },
      metrics: { hit: { v: '0% (expired)', tone: 'bad' }, dbLoad: { v: '2,000 at once', tone: 'bad' }, latency: { v: 'timeouts', tone: 'bad' } },
      scene: aside({
        entities: {
          cache: { ...CACHE, badge: { text: 'key expired', tone: 'warn' } },
          db: { ...DB, badge: { text: 'overloaded', tone: 'bad' } },
        },
        flows: [
          { route: ['ua', 'ac', '~ac', 'ad'], kind: 'slow', rate: 3, fail: 0.6, speed: 90 },
          { route: ['ua'], rate: 1.2, fail: 0.4 },
        ],
      }),
    },
    {
      short: 'Layers',
      chapter: 'insight',
      title: 'Caches at every layer',
      body: [
        'The Redis box is one cache among many. The browser caches images and scripts; a CDN caches whole responses near users; the app can keep a tiny in-process cache for the very hottest keys; the database keeps recently used pages in its buffer pool; the disk has its own cache.',
        'Each layer is faster and smaller than the one below it. Good designs decide deliberately what each layer may hold and for how long.',
      ],
      metrics: { hit: { v: '99%', tone: 'good' }, dbLoad: { v: '50', tone: 'good' }, latency: { v: '0.6 ms', tone: 'good' }, stale: '≤ 5 min' },
      scene: aside({
        entities: {
          users: { ...VISITORS, badge: { text: 'browser cache', tone: 'info' } },
          app: { ...APP, badge: { text: 'in-process cache', tone: 'info' } },
          card: card(42, -16, 'Layers', ['browser        ~0 ms', 'CDN            ~5 ms', 'in-process     ~µs', 'Redis          ~0.5 ms', 'db buffer pool ~1 ms']),
        },
        flows: [HIT, { ...MISS, rate: 0.08 }],
      }),
    },
    {
      short: 'Recap',
      chapter: 'recap',
      title: 'Recap',
      body: [
        'A cache turns repeated work into a memory lookup. The rest is managing the copy:',
        `<table class="compare"><thead><tr><th>question</th><th>usual answer</th></tr></thead><tbody>
          <tr><td>what to cache</td><td>hot, read-heavy, expensive results</td></tr>
          <tr><td>how to read</td><td>cache-aside: check, miss → db → fill</td></tr>
          <tr><td>how big</td><td>the hot set, with LRU eviction</td></tr>
          <tr><td>freshness</td><td>delete on write + TTL as a safety net</td></tr>
          <tr><td>stampedes</td><td>single-flight, TTL jitter, stale-while-revalidate</td></tr></tbody></table>`,
        'Check yourself: the hit rate drops from 95% to 85%. By how much does database load grow? (Misses go from 5% to 15% — three times the load.)',
      ],
      scene: aside({ flows: [HIT, { ...MISS, rate: 0.08 }] }),
    },
  ],
};
