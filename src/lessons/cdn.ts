import type { Entity, Flow, Lesson, Link, Scene } from '../types.ts';
import { card, cdn, link, server, users } from './helpers.ts';

const CITIES = [
  ['jkt', 'Jakarta', -20],
  ['sao', 'São Paulo', 0],
  ['fra', 'Frankfurt', 20],
] as const;
type City = (typeof CITIES)[number][0];

const ORIGIN = server(44, 0, { label: 'origin', sub: 'us-east' });

interface EdgeOpts {
  shield?: boolean;
  edgeLook?: Partial<Record<City, Partial<Entity>>>;
  userLook?: Partial<Record<City, Partial<Entity>>>;
  missRate?: number;
  extra?: Record<string, Entity>;
  flows?: Flow[];
}

function edges(o: EdgeOpts = {}): Scene {
  const entities: Record<string, Entity> = { origin: ORIGIN, ...o.extra };
  const links: Record<string, Link> = {};
  const flows: Flow[] = [];
  if (o.shield) {
    entities.shield = cdn(30, 0, { label: 'origin shield' });
    links.so = link('shield', 'origin');
  }
  for (const [id, name, v] of CITIES) {
    entities[`u-${id}`] = { ...users(0, v, { label: name, count: 2 }), ...o.userLook?.[id] };
    entities[`e-${id}`] = { ...cdn(15, v, { label: `edge ${name}` }), ...o.edgeLook?.[id] };
    links[`ue-${id}`] = link(`u-${id}`, `e-${id}`);
    links[`eo-${id}`] = link(`e-${id}`, o.shield ? 'shield' : 'origin');
    flows.push({ route: [`ue-${id}`], rate: 1.4, bounce: true });
    flows.push({ route: [`ue-${id}`, `eo-${id}`, ...(o.shield ? ['so'] : [])], kind: 'slow', rate: o.missRate ?? 0.2, bounce: true });
  }
  if (o.shield) flows.push({ route: ['so'], kind: 'slow', rate: 0.1, bounce: true });
  flows.push(...(o.flows ?? []));
  return { entities, links, flows };
}

export const cdns: Lesson = {
  id: 'cdn',
  title: 'CDNs',
  summary: 'Put copies of your content a few milliseconds from every user, and learn which responses must never be shared.',
  minutes: 11,
  level: 'beginner',
  metrics: [
    { id: 'rtt', label: 'RTT from Jakarta' },
    { id: 'hit', label: 'edge hit rate' },
    { id: 'origin', label: 'origin req / s' },
    { id: 'egress', label: 'origin egress' },
  ],
  legend: ['req', 'res', ['slow', 'edge miss → origin'], ['poison', 'poisoned cache'], 'fail'],
  goals: [
    { text: 'Why distance dominates for far-away users', step: 1 },
    { text: 'How edges serve cached copies', step: 2 },
    { text: 'Control caching with Cache-Control', step: 3 },
    { text: 'Protect the origin with a shield', step: 5 },
    { text: 'Never cache private responses', step: 7 },
  ],
  steps: [
    {
      short: 'Far away',
      chapter: 'setup',
      title: 'Far from home',
      body: [
        'A photo-sharing site runs in one data centre in Virginia (us-east). Readers in Frankfurt are about 90 ms away, São Paulo about 120 ms, Jakarta about 230 ms per round trip. A page needs several round trips plus dozens of images, so Jakarta waits seconds for what Virginia sees in a blink.',
        'The speed of light in fibre doesn’t improve with a bigger server. The only fix for distance is to put the content closer.',
      ],
      metrics: { rtt: { v: '230 ms', tone: 'bad' }, hit: '—', origin: '3,000', egress: { v: '4 Gbit/s', tone: 'warn' } },
      scene: {
        entities: {
          origin: { ...ORIGIN, badge: { text: 'serves everything', tone: 'warn' } },
          ...Object.fromEntries(CITIES.map(([id, name, v]) => [`u-${id}`, users(0, v, { label: name, count: 2 })])),
        },
        links: Object.fromEntries(CITIES.map(([id]) => [`uo-${id}`, link(`u-${id}`, 'origin')])),
        flows: CITIES.map(([id]): Flow => ({ route: [`uo-${id}`], kind: 'slow', rate: 1, bounce: true, speed: 110 })),
      },
    },
    {
      short: 'Edges',
      chapter: 'technique',
      title: 'Edges near users',
      body: [
        'A <b>CDN</b> (content delivery network) runs hundreds of cache servers — <b>edges</b> — in cities around the world. DNS or anycast routing sends each user to a nearby edge.',
        'The first request for <code>/img/sunset.jpg</code> in Jakarta misses: the edge fetches it from the origin, stores it, and returns it. Every later request in that region is served from Jakarta in a few milliseconds, and the origin never sees it.',
      ],
      callout: { kind: 'insight', text: 'A CDN is a cache that also solves geography.' },
      metrics: { rtt: { v: '8 ms (edge)', tone: 'good' }, hit: { v: '92%', tone: 'good' }, origin: { v: '240', tone: 'good' }, egress: { v: '0.3 Gbit/s', tone: 'good' } },
      scene: edges(),
    },
    {
      short: 'Cache-Control',
      chapter: 'technique',
      title: 'Cache-Control decides',
      body: [
        'The origin tells every cache what it may do through the <code>Cache-Control</code> response header. <code>max-age=31536000, immutable</code> says “keep this for a year, it will never change”. <code>max-age=60</code> allows a minute. <code>no-store</code> forbids caching altogether.',
        'A common split: static assets (images, scripts, fonts) cached for a long time; HTML pages for seconds or revalidated each time; personal API responses never cached by shared caches.',
      ],
      scene: edges({
        extra: {
          card: card(30, -24, 'Cache-Control', ['/img/*, /assets/*   max-age=1y, immutable', '/news/today        max-age=60', '/api/me            private, no-store']),
        },
      }),
    },
    {
      short: 'Stuck bug',
      chapter: 'problem',
      title: 'Case: a bug cached for a year',
      body: [
        'A release ships a broken <code>/assets/app.js</code> with <code>max-age=1y</code>. The team fixes it within minutes, but edges and browsers keep serving the cached broken file. Purging the CDN helps the edges — not the browsers that already stored it.',
        'The standard fix is to make long-cached file names change with their content: <code>app.3f9a2c.js</code>. A new release references a new name, so nothing stale is ever requested again. Then “cache forever” is safe.',
      ],
      callout: { kind: 'tip', text: 'Long TTLs only for content-hashed file names. Short TTLs (or revalidation) for anything with a fixed URL.' },
      scene: edges({
        edgeLook: Object.fromEntries(CITIES.map(([id]) => [id, { badge: { text: 'old app.js', tone: 'bad' as const } }])),
        flows: CITIES.map(([id]): Flow => ({ route: [`ue-${id}`], rate: 0.6, fail: 0.8 })),
      }),
    },
    {
      short: 'Shield',
      chapter: 'technique',
      title: 'An origin shield',
      body: [
        'With hundreds of edges, each one misses independently: a new image can be fetched from the origin hundreds of times. An <b>origin shield</b> is a middle cache layer that all edges ask first, so the origin sees roughly one fetch per object instead of one per edge.',
        'The shield also absorbs purge storms and traffic spikes, and lets a small origin survive a global launch.',
      ],
      metrics: { origin: { v: '40', tone: 'good' }, egress: { v: '0.05 Gbit/s', tone: 'good' } },
      scene: edges({ shield: true }),
    },
    {
      short: 'Dynamic',
      chapter: 'technique',
      title: 'Faster even when not cacheable',
      body: [
        'Personal pages can’t be cached, but they still benefit. The user’s TLS handshake ends at the nearby edge (two short round trips instead of two long ones), and the edge keeps warm, long-lived connections to the origin over the provider’s backbone.',
        'Many CDNs also run small programs at the edge — redirects, A/B splits, authentication checks — so some requests never travel to the origin at all.',
      ],
      metrics: { rtt: '8 ms + backbone' },
      scene: edges({
        shield: true,
        missRate: 0.5,
        extra: { card: card(30, -24, 'Uncacheable request', ['TLS handshake   at the edge', 'edge → origin   warm connection', '# saves ~2 long round trips']) },
      }),
    },
    {
      short: 'Wrong key',
      chapter: 'problem',
      title: 'Case: someone else’s account page',
      body: [
        'An engineer adds <code>max-age=300</code> to <code>/account</code> to reduce load. The CDN caches by URL. Ana in Jakarta opens her account page; seconds later Budi opens <code>/account</code> and the edge serves him <b>Ana’s</b> page — name, address and order history.',
        'Responses that depend on who is asking must say so: <code>Cache-Control: private</code> or <code>no-store</code>, or a cache key that includes the user. Treat CDN configuration as security-sensitive code.',
      ],
      callout: { kind: 'warning', text: 'Caching a private response in a shared cache is a data leak, not a performance bug.' },
      scene: edges({
        userLook: { jkt: { badge: { text: 'sees Ana’s page', tone: 'bad' } } },
        edgeLook: { jkt: { badge: { text: 'cached /account', tone: 'bad' } } },
        flows: [{ route: ['ue-jkt'], kind: 'poison', rate: 1.2, bounce: true, returnKind: 'poison' }],
      }),
    },
    {
      short: 'Recap',
      chapter: 'recap',
      title: 'Recap',
      body: [
        'A CDN moves copies toward users and load away from the origin:',
        `<table class="compare"><thead><tr><th>topic</th><th>rule of thumb</th></tr></thead><tbody>
          <tr><td>static assets</td><td>content-hashed names, cached for a year</td></tr>
          <tr><td>HTML / public API</td><td>short max-age or revalidate</td></tr>
          <tr><td>personal data</td><td>private / no-store — never in shared caches</td></tr>
          <tr><td>many edges</td><td>origin shield to collapse misses</td></tr>
          <tr><td>uncacheable</td><td>still gains from TLS at the edge and warm connections</td></tr></tbody></table>`,
        'Check yourself: an image is requested 1,000 times a minute from 50 edges and cached for a day. Roughly how many origin fetches per day with and without a shield? (Without: about 50, one per edge. With a shield: about 1.)',
      ],
      scene: edges({ shield: true }),
    },
  ],
};
