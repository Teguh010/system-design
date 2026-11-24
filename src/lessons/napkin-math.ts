import type { Entity, Flow, Lesson, Link, Scene } from '../types.ts';
import { cache, card, cdn, db, lb, link, server, spread, users } from './helpers.ts';

const CROWD = users(0, 0, { label: '5M daily users' });
const BRIEF = card(18, 16, 'The brief: Cookbook', [
  '5M daily active users',
  'each makes ~30 requests a day',
  'each views ~20 photos a day',
  '200k new recipes a day, 1 photo (3 MB)',
  '# one server? how much disk?',
]);

const guess = (label: string, sub?: string): Entity => server(18, 0, { label, ...(sub && { sub }), ghost: true });

const lonely = (extra: Record<string, Entity>, rate = 2): Scene => ({
  entities: { users: CROWD, s1: guess('one server?'), ...extra },
  links: { us: link('users', 's1', { dashed: true }) },
  flows: [{ route: ['us'], rate, bounce: true }],
});

// Eight servers on an arc around the load balancer, so no link crosses another server.
// Components taught in Module 02 (load balancer, CDN, cache) are drawn as ghosts: the numbers ask for them.
const GRID: [string, number, number][] = ['s2', 's3', 's4', 's1', 's5', 's6', 's7', 's8'].map((id, i) => {
  const a = ((-70 + i * 20) * Math.PI) / 180;
  const r = 270;
  return [id, 10 + (r * Math.cos(a)) / 14, (r * Math.sin(a)) / 7];
});

/** From the storage step on, the fleet collapses into one box standing for all eight. */
function system(opts: { cdn?: boolean; cache?: boolean; card?: Entity } = {}): Scene {
  const entities: Record<string, Entity> = {
    users: CROWD,
    lb: lb(12, 0, { label: 'load balancer', ghost: true }),
    s1: server(24, 0, { label: '8 × app server' }),
    meta: db(38, -8, { label: 'recipe db', sub: '~365 GB / year' }),
    photos: db(38, 10, { label: 'object storage', sub: '~220 TB / year' }),
  };
  const links: Record<string, Link> = {
    ul: link('users', 'lb'),
    ls: link('lb', 's1'),
    sm: link('s1', 'meta'),
    sp: link('s1', 'photos'),
  };
  const flows: Flow[] = [
    { route: ['ul', 'ls', 'sm'], rate: 2.2, bounce: true },
    { route: ['ul', 'ls', 'sp'], kind: 'write', rate: 0.4 },
  ];
  if (opts.cdn) {
    entities.cdn = cdn(16, 18, { label: 'CDN', sub: 'resized photos', ghost: true });
    links.uc = link('users', 'cdn');
    links.cp = link('cdn', 'photos', { dashed: true });
    flows.push({ route: ['uc'], rate: 4, bounce: true }, { route: ['cp'], kind: 'slow', rate: 0.3, bounce: true });
  }
  if (opts.cache) {
    entities.cache = cache(24, -20, { label: 'cache', sub: 'hot 20% ≈ 75 GB', ghost: true });
    links.sc = link('s1', 'cache');
    flows[0] = { route: ['ul', 'ls', 'sc'], rate: 2.2, bounce: true };
    flows.push({ route: ['ul', 'ls', 'sm'], kind: 'slow', rate: 0.4, bounce: true });
  }
  if (opts.card) entities.card = opts.card;
  return { entities, links, flows };
}

export const napkinMath: Lesson = {
  id: 'napkin-math',
  title: 'Napkin Math',
  summary: 'Turn a product brief into requests per second, servers, terabytes and bandwidth — with arithmetic that fits on a napkin.',
  minutes: 12,
  level: 'beginner',
  metrics: [
    { id: 'rps', label: 'avg req / s' },
    { id: 'peak', label: 'peak req / s' },
    { id: 'servers', label: 'servers' },
    { id: 'storage', label: 'storage / year' },
    { id: 'egress', label: 'egress' },
  ],
  legend: ['req', 'res', ['write', 'upload'], ['slow', 'cache miss / origin fetch']],
  goals: [
    { text: 'Convert daily users into requests per second', step: 2 },
    { text: 'Size for the peak, not the average', step: 3 },
    { text: 'Estimate servers and storage', step: 4 },
    { text: 'Estimate bandwidth and memory', step: 6 },
    { text: 'Learn a few numbers worth memorising', step: 8 },
  ],
  steps: [
    {
      short: 'The question',
      chapter: 'setup',
      title: 'One server, or a hundred?',
      body: [
        'You are designing <b>Cookbook</b>, a recipe-sharing app. Before choosing a database or drawing boxes you need a feel for the scale: is this one machine, or a fleet?',
        'Napkin math gets you the order of magnitude in minutes. Round aggressively, keep one significant figure, and only care whether the answer is 10, 100 or 1,000.',
      ],
      callout: { kind: 'insight', text: 'Precision is not the goal. Being within a factor of two or three is enough to pick an architecture.' },
      metrics: { rps: '?', peak: '?', servers: '?', storage: '?', egress: '?' },
      scene: lonely({ card: BRIEF }),
    },
    {
      short: 'Requests / s',
      chapter: 'technique',
      title: 'From users to requests per second',
      body: [
        'Multiply users by actions: 5 million × 30 = 150 million requests a day. A day has 86,400 seconds; call it <b>100,000 (10⁵)</b> so the division is painless.',
        '150 million ÷ 100,000 ≈ <b>1,500 requests per second</b> on average. Rounding the day up makes the estimate a little low, which is fine — the next step adds a generous factor anyway.',
      ],
      metrics: { rps: '~1,500' },
      scene: lonely({ card: card(18, 16, 'Requests per second', ['5M × 30      = 150M / day', '1 day        ≈ 10⁵ s', '150M / 10⁵   ≈ 1,500 / s']) }, 3),
    },
    {
      short: 'Peak',
      chapter: 'technique',
      title: 'Size for the peak',
      body: [
        'Traffic is never flat. People cook in the evening, and a recipe going viral on a Sunday can multiply that again. A common rule of thumb: <b>peak ≈ 2–3 × average</b>. Systems have to survive the peak, not the average.',
        'Here that is about <b>4,500 requests per second</b>. Write the assumption down — it is the number most worth revisiting once real traffic arrives.',
      ],
      metrics: { peak: '~4,500' },
      scene: lonely({ s1: guess('one server?', 'peak ≈ 4,500 / s'), card: card(18, 16, 'Peak', ['evenings   ≈ 3 × average', '1,500 × 3  ≈ 4,500 / s', '# launches & holidays: more']) }, 5),
    },
    {
      short: 'Servers',
      chapter: 'technique',
      title: 'How many servers?',
      body: [
        'A stateless API server on modern hardware handles somewhere between a few hundred and a few thousand simple requests a second. Take <b>1,000</b> as a planning number and check it with a load test later.',
        '4,500 ÷ 1,000 ≈ 5 servers running flat out. You don’t want flat out (remember the knee of the curve), so aim for about 70%: roughly 7, plus one spare so a crash or a deploy doesn’t tip you over. <b>About eight servers</b> — a small fleet, not one machine and not a hundred. Spreading requests across them is the job of a load balancer (Module 02).',
      ],
      metrics: { servers: '~8' },
      scene: {
        entities: {
          users: CROWD,
          lb: lb(10, 0, { label: 'load balancer', ghost: true }),
          ...Object.fromEntries(GRID.map(([id, u, v]) => [id, server(u, v)])),
          card: card(44, 0, 'Servers', ['1 server   ≈ 1,000 req/s', '4,500 / 1,000 ≈ 5 at 100%', 'at 70% → 7, +1 spare', '✓ ~8 servers']),
        },
        links: { ul: link('users', 'lb'), ...Object.fromEntries(GRID.map(([id]) => [`l-${id}`, link('lb', id)])) },
        flows: spread(
          GRID.map(([id]) => ['ul', `l-${id}`]),
          5,
          { bounce: true },
        ),
      },
    },
    {
      short: 'Storage',
      chapter: 'technique',
      title: 'How much storage?',
      body: [
        'Photos dominate: 200,000 a day × 3 MB = 600 GB a day, or about <b>220 TB a year</b>. That belongs in object storage such as S3, not in a database.',
        'Recipe text and metadata — say 5 KB each — add only about 1 GB a day, roughly 365 GB a year, which an ordinary database handles comfortably. Splitting big, simple blobs from small, structured rows is one of the most common results of a storage estimate.',
      ],
      metrics: { storage: '~220 TB' },
      scene: system({
        card: card(24, -20, 'Storage', ['photos   200k × 3 MB = 600 GB/day', '         × 365       ≈ 220 TB/yr', 'recipes  200k × 5 KB = 1 GB/day', '         × 365       ≈ 365 GB/yr']),
      }),
    },
    {
      short: 'Bandwidth',
      chapter: 'technique',
      title: 'Bandwidth: where the bytes are',
      body: [
        'Reads are where the bytes are: 5 million users × 20 photos × 3 MB ≈ 300 TB served per day — about <b>3 GB per second</b> on average, or 24 Gbit/s, and more at peak.',
        'A handful of app servers should never push that. Serve images from a <b>CDN</b> (Module 02), and store resized versions: a phone screen rarely needs the 3 MB original when a 200 KB version looks the same. Resizing alone cuts egress about 15×.',
      ],
      callout: { kind: 'tip', text: 'Bandwidth estimates are usually where CDNs and image resizing justify themselves.' },
      metrics: { egress: { v: '~3 GB/s', tone: 'warn' } },
      scene: system({
        cdn: true,
        card: card(24, -20, 'Egress', ['5M × 20 × 3 MB  = 300 TB / day', '300 TB / 10⁵ s  ≈ 3 GB/s', '! ≈ 24 Gbit/s before the peak']),
      }),
    },
    {
      short: 'Memory',
      chapter: 'technique',
      title: 'What fits in memory?',
      body: [
        'Views follow a power law: a small share of recipes gets most of the traffic. If the hottest 20% of a year’s recipe data — about 75 GB — sits in memory, most reads never touch the database.',
        '75 GB fits on one or two cache nodes (caching is covered in Module 02). A two-line calculation turns “do we need a huge caching tier?” into “a couple of Redis boxes”.',
      ],
      scene: system({
        cdn: true,
        cache: true,
        card: card(42, -24, 'Cache size', ['recipe data / year   365 GB', 'hot 20%              ~75 GB', 'one cache node       64–256 GB', '✓ fits on 1–2 nodes']),
      }),
    },
    {
      short: 'Numbers',
      chapter: 'insight',
      title: 'Numbers worth remembering',
      body: [
        'A handful of numbers lets you do most estimates in your head. The gaps between them are the point: RAM is about a thousand times faster than an SSD read, and one round trip across an ocean costs as much time as nearly a million memory reads.',
        'Combine them with two time conversions and powers of ten, and you can sanity-check most design claims in a minute.',
      ],
      scene: system({
        cdn: true,
        cache: true,
        card: card(42, -24, 'Worth memorising', [
          'RAM read              100 ns',
          'SSD random read       100 µs',
          'round trip, same DC   0.5 ms',
          'HDD seek              10 ms',
          'round trip, US ↔ EU   80 ms',
          '# 1 day ≈ 10⁵ s   1 year ≈ 3 × 10⁷ s',
        ]),
      }),
    },
    {
      short: 'Recap',
      chapter: 'recap',
      title: 'From brief to boxes',
      body: [
        'Five lines of arithmetic produced most of the architecture:',
        `<table class="compare"><thead><tr><th>estimate</th><th>result</th><th>so the design needs</th></tr></thead><tbody>
          <tr><td>average load</td><td>~1,500 req/s</td><td>more than one server</td></tr>
          <tr><td>peak load</td><td>~4,500 req/s</td><td>~8 stateless servers + load balancer</td></tr>
          <tr><td>photo storage</td><td>~220 TB / year</td><td>object storage, not a database</td></tr>
          <tr><td>recipe data</td><td>~365 GB / year</td><td>one ordinary database</td></tr>
          <tr><td>egress</td><td>~3 GB/s</td><td>a CDN and resized images</td></tr>
          <tr><td>hot data</td><td>~75 GB</td><td>a small cache</td></tr></tbody></table>`,
        'Check yourself: if Cookbook grows to 50M daily users, which box changes the most? (Bandwidth and storage grow 10×; the CDN and object storage absorb that, while the app tier grows to roughly 80 servers.)',
      ],
      callout: { kind: 'insight', text: 'Estimate first, then design to fit the numbers — never the other way round.' },
      scene: system({ cdn: true, cache: true }),
    },
  ],
};
