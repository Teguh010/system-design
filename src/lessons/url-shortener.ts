import type { Entity, Flow, Lesson, Link, Scene } from '../types.ts';
import { cache, card, db, lb, link, queue, server, service, spread, users, worker } from './helpers.ts';

// ── reusable pieces ──────────────────────────────────────────

const U = users(0, 0, { label: 'users' });
const APP = server(14, 0, { label: 'app server' });
const DB = db(28, 0, { label: 'database', sub: 'code → long_url' });
const IDS = service(14, -21, { label: 'ID service', sub: 'hands out ID blocks' });

const draft: Record<string, Link> = { ua: link('users', 'app'), ad: link('app', 'db') };

const redirect = (rate = 2.4): Flow => ({ route: ['ua', 'ad'], rate, bounce: true });
const create = (extra: Partial<Flow> = {}): Flow => ({ route: ['ua', 'ad'], kind: 'write', rate: 0.5, ...extra });

const APPS = ['appA', 'app', 'appB'] as const;
const SHARDS = ['db0', 'db', 'db2'] as const;
const LB_LINK = { appA: 'laA', app: 'la', appB: 'laB' } as const;
const CACHE_LINK = { appA: 'aAc', app: 'ac', appB: 'aBc' } as const;
const SHARD_LINK = { db0: 'c0', db: 'cd', db2: 'c2' } as const;
const QUEUE_LINK = { appA: 'aAq', app: 'aq', appB: 'aBq' } as const;

/** The scaled-out design from step 9 onward. */
function scaled(opts: { analytics?: boolean; extra?: Record<string, Entity>; links?: Record<string, Link>; flows?: Flow[] } = {}): Scene {
  const entities: Record<string, Entity> = {
    users: U,
    lb: lb(10, 0, { label: 'load balancer' }),
    appA: server(20, -14, { label: 'app 1' }),
    app: server(20, 0, { label: 'app 2' }),
    appB: server(20, 14, { label: 'app 3' }),
    ids: service(11, -22, { label: 'ID service' }),
    cache: cache(31, 0, { label: 'cache', sub: 'hot codes in RAM' }),
    db0: db(42, -14, { label: 'shard 0' }),
    db: db(42, 0, { label: 'shard 1' }),
    db2: db(42, 14, { label: 'shard 2' }),
  };
  const links: Record<string, Link> = {
    ul: link('users', 'lb'),
    ai: link('appA', 'ids', { dashed: true }),
    ...opts.links,
  };
  for (const a of APPS) {
    links[LB_LINK[a]] = link('lb', a);
    links[CACHE_LINK[a]] = link(a, 'cache');
  }
  for (const s of SHARDS) links[SHARD_LINK[s]] = link('cache', s);

  const hits = spread(
    APPS.map((a) => ['ul', LB_LINK[a], CACHE_LINK[a]]),
    3,
    { bounce: true },
  );
  const misses = spread(
    APPS.flatMap((a) => SHARDS.map((s) => ['ul', LB_LINK[a], CACHE_LINK[a], SHARD_LINK[s]])),
    0.45,
    { kind: 'slow', bounce: true },
  );
  const flows = [...hits, ...misses, { route: ['ai'], kind: 'ping' as const, rate: 0.25, bounce: true, returnKind: 'ping' as const }];

  if (opts.analytics) {
    Object.assign(entities, {
      queue: queue(31, 28, { label: 'click queue' }),
      worker: worker(42, 30, { label: 'workers' }),
      stats: db(53, 30, { label: 'stats store' }),
    });
    for (const a of APPS) links[QUEUE_LINK[a]] = link(a, 'queue', { dashed: true });
    links.qw = link('queue', 'worker');
    links.ws = link('worker', 'stats');
    flows.push(...spread(APPS.map((a) => [QUEUE_LINK[a], 'qw', 'ws']), 1.2, { kind: 'write' }));
  }
  Object.assign(entities, opts.extra);
  flows.push(...(opts.flows ?? []));
  return { entities, links, flows };
}

// ── the lesson ───────────────────────────────────────────────

export const urlShortener: Lesson = {
  id: 'url-shortener',
  title: 'Design a URL Shortener',
  summary: 'From a one-line brief to a service that turns billions of short codes into redirects in a couple of milliseconds.',
  minutes: 15,
  level: 'intermediate',
  metrics: [
    { id: 'latency', label: 'redirect time' },
    { id: 'dbLoad', label: 'db reads' },
    { id: 'codes', label: 'short codes' },
    { id: 'scale', label: 'scale' },
  ],
  legend: ['req', 'res', ['slow', 'cache miss'], ['write', 'write / click event'], ['ping', 'id block'], ['poison', 'abuse'], 'fail'],
  goals: [
    { text: 'Turn a brief into requirements and numbers', step: 1 },
    { text: 'Generate codes that never collide and can’t be guessed', step: 4 },
    { text: 'Make redirects fast with a cache', step: 7 },
    { text: 'Spread billions of rows across machines', step: 9 },
    { text: 'Keep analytics and abuse checks off the hot path', step: 10 },
  ],
  steps: [
    {
      short: 'The brief',
      chapter: 'setup',
      title: 'The brief: build a link shortener',
      body: [
        'This lesson puts the earlier ideas to work on one design. The job: a service like bit.ly. Someone pastes a long URL and gets back a short one such as <code>sho.rt/k3X9pQz</code>. Anyone who opens the short link lands on the original page.',
        'Start with requirements, not boxes. <b>Must</b>: create a short link, and redirect. <b>Nice to have</b>: links that expire, click counts. <b>Qualities</b>: redirects must be fast and must essentially never fail — when a shortener dies, every link it ever handed out dies with it. Creating a link is allowed to be a little slower.',
      ],
      callout: { kind: 'insight', text: 'Three questions open every design: what must it do, how much of it, and which quality wins when you can’t have them all?' },
      metrics: { latency: '—', dbLoad: '—', codes: '—', scale: '—' },
      scene: {
        entities: {
          users: U,
          app: service(14, 0, { label: 'sho.rt', sub: 'to be designed', ghost: true }),
          card: card(14, -18, 'Requirements', ['create  long URL → code', 'open    code → redirect', '# later: expiry, click counts', '! redirects: fast, always up']),
        },
        links: { ua: link('users', 'app', { dashed: true }) },
        flows: [{ route: ['ua'], rate: 1.6, bounce: true }],
      },
    },
    {
      short: 'Numbers',
      chapter: 'setup',
      title: 'Put numbers on it',
      body: [
        'Napkin math before architecture. Assume <b>120 million</b> new links a month — roughly 46 writes a second. If a link is opened about 80 times over its life, redirects average around 3,700 a second; with a 3× daily peak, about <b>11,000 a second</b>.',
        'Keep links for five years: 120M × 60 months ≈ 7.2 billion rows. At ~400 bytes each that is close to <b>3 TB</b>. Two things stand out: reads outnumber writes 80 to 1, and the data is huge but trivially shaped — one key, one value.',
      ],
      callout: { kind: 'tip', text: 'Let the numbers pick the architecture. A lopsided read/write ratio points at caching; terabytes of key → value rows point at partitioning.' },
      metrics: { scale: '11k/s peak · 3 TB' },
      scene: {
        entities: {
          users: U,
          app: service(14, 0, { label: 'sho.rt', sub: 'to be designed', ghost: true }),
          card: card(14, -18, 'Napkin math', ['writes   120M/mo ≈ 46/s', 'reads    × 80   ≈ 3.7k/s', 'peak     × 3    ≈ 11k/s', 'storage  7.2B × 400 B ≈ 3 TB']),
        },
        links: { ua: link('users', 'app', { dashed: true }) },
        flows: [
          { route: ['ua'], rate: 4, bounce: true },
          { route: ['ua'], kind: 'write', rate: 0.15 },
        ],
      },
    },
    {
      short: 'First draft',
      chapter: 'solution',
      title: 'The simplest thing that works',
      body: [
        'One app server, one database. The table needs two columns that matter: <code>code</code> (the primary key) and <code>long_url</code>. Creating a link inserts a row; a redirect is a primary-key lookup followed by an HTTP redirect.',
        'This comfortably handles a few hundred clicks a second. Always draw this version first — it is the baseline every later box has to earn its place against.',
      ],
      metrics: { latency: '~15 ms', dbLoad: 'every click', codes: '?', scale: { v: '1 server', tone: 'warn' } },
      scene: {
        entities: { users: U, app: APP, db: DB },
        links: draft,
        flows: [redirect(), create()],
      },
    },
    {
      short: 'Hash it?',
      chapter: 'problem',
      title: 'Where do codes come from? Try hashing',
      body: [
        'An obvious idea: hash the long URL (MD5, say) and keep the first 7 characters. The same URL always gets the same code, and no server needs to coordinate with another.',
        'The catch is <b>collisions</b>. Seven base62 characters give 62⁷ ≈ 3.5 trillion codes, which sounds like plenty. But the birthday paradox says collisions show up long before the space is full — at 7 billion links you would expect millions of them. Every create turns into <i>insert, collide, rehash, retry</i>, and two servers can race for the same code.',
      ],
      callout: { kind: 'warning', text: 'Truncating a hash throws away the very property that made it attractive: that different inputs give different outputs.' },
      metrics: { codes: { v: 'hash → collisions', tone: 'bad' } },
      scene: {
        entities: {
          users: U,
          app: APP,
          db: { ...DB, badge: { text: 'collision!', tone: 'bad' } },
          card: card(28, -18, 'md5(url)[0:7]', ['a.com/report  → 9f2Kd1z', 'b.org/cats    → 9f2Kd1z', '! same code, two URLs']),
        },
        links: draft,
        flows: [redirect(1.6), create({ rate: 1.2, fail: 0.4 })],
      },
    },
    {
      short: 'Count it',
      chapter: 'solution',
      title: 'Count, then encode',
      body: [
        'Flip it around: give every new link a unique integer, then write that number in base62 (<code>0-9 a-z A-Z</code>). Distinct numbers give distinct codes, so there is nothing to check and nothing to retry.',
        'A single global counter would be a bottleneck and a single point of failure, so an <b>ID service</b> hands out <b>blocks</b>: an app server reserves IDs 5,000,000–5,000,999 in one call and spends them locally. If a server crashes, a few unused IDs are simply skipped — harmless.',
        'Even 7.2 billion only needs 6 characters; 7 characters last for 3.5 trillion links.',
      ],
      callout: { kind: 'tip', text: 'When you need unique values from many machines, coordinate rarely and in bulk — reserve ranges, don’t ask per item.' },
      metrics: { codes: { v: 'base62(id)', tone: 'good' } },
      scene: {
        entities: {
          users: U,
          app: APP,
          db: DB,
          ids: IDS,
          card: card(28, -18, 'base62(id)', ['id 125           → 21', 'id 7,200,000,000 → 7RgsUg', 'id 7,200,000,001 → 7RgsUh', '✓ never collides']),
        },
        links: { ...draft, ai: link('app', 'ids', { dashed: true }) },
        flows: [redirect(), create(), { route: ['ai'], kind: 'ping', rate: 0.3, bounce: true, returnKind: 'ping' }],
      },
    },
    {
      short: 'Guessable',
      chapter: 'problem',
      title: 'Case: codes you can count',
      body: [
        'Look at the card from the last step: <code>7RgsUg</code> is followed by <code>7RgsUh</code>. Sequential codes leak. A script can walk the whole space and harvest links people assumed were private — shared documents, invoices, password-reset pages.',
        'Fix it without giving up uniqueness: scramble the counter with a <b>reversible</b> function before encoding — multiply by a large odd constant modulo 62⁷, or run a tiny Feistel cipher. Every ID still maps to exactly one code, but neighbours no longer look like neighbours.',
      ],
      callout: { kind: 'insight', text: 'Unique and unpredictable are different requirements. A counter gives you the first; a one-to-one shuffle adds the second.' },
      metrics: { codes: { v: 'guessable', tone: 'bad' } },
      scene: {
        entities: {
          users: U,
          scraper: users(0, 16, { label: 'scraper', count: 1, badge: { text: 'enumerating', tone: 'bad' } }),
          app: APP,
          db: DB,
          ids: IDS,
          card: card(28, -18, 'shuffle(id) → base62', ['7RgsUg → kq0P3vZ', '7RgsUh → 2LxeA9m', '✓ unique, not guessable']),
        },
        links: { ...draft, ai: link('app', 'ids', { dashed: true }), xa: link('scraper', 'app') },
        flows: [redirect(1.6), { route: ['xa', 'ad'], kind: 'poison', rate: 3, bounce: true, returnKind: 'res' }],
      },
    },
    {
      short: 'Cache',
      chapter: 'solution',
      title: 'Reads dominate: cache them',
      body: [
        'Clicks are wildly uneven: a small share of links gets most of the traffic. And a code → URL mapping <b>never changes</b> once written. That is the perfect cache workload.',
        'Put an in-memory cache (Redis, Memcached) in front of the database. Hits come back in well under a millisecond; only misses reach the database, which refills the cache on the way back. With a 90% hit rate the database sees a tenth of the clicks.',
        'Because mappings are immutable there is no invalidation headache — except when a link is deleted or expires, and then you just delete the key.',
      ],
      callout: { kind: 'tip', text: 'Immutable data is the easiest thing in the world to cache. Look for it in every design.' },
      metrics: { codes: { v: 'base62(shuffle(id))', tone: 'good' }, latency: { v: '~2 ms', tone: 'good' }, dbLoad: { v: '~10% of clicks', tone: 'good' } },
      scene: {
        entities: { users: U, app: APP, ids: IDS, cache: cache(28, 0, { label: 'cache', sub: 'hot codes in RAM' }), db: db(42, 0, { label: 'database' }) },
        links: { ua: link('users', 'app'), ac: link('app', 'cache'), cd: link('cache', 'db'), ai: link('app', 'ids', { dashed: true }) },
        flows: [
          { route: ['ua', 'ac'], rate: 3, bounce: true },
          { route: ['ua', 'ac', 'cd'], kind: 'slow', rate: 0.35, bounce: true },
          { route: ['ua', 'ac', 'cd'], kind: 'write', rate: 0.25 },
        ],
      },
    },
    {
      short: '301 or 302',
      chapter: 'tradeoff',
      title: 'Which redirect: 301 or 302?',
      body: [
        '<b>301 Moved Permanently</b> lets browsers remember the redirect. Repeat visitors skip your servers entirely — cheaper and faster — but you stop seeing those clicks, and you can never change where the link points for them.',
        '<b>302 Found</b> (or 307) is temporary: every click comes back to you. More load, but accurate analytics, and the freedom to edit, expire or block a link later.',
        `<table class="compare"><thead><tr><th></th><th>301</th><th>302</th></tr></thead><tbody>
          <tr><td>server load</td><td class="good">lower</td><td>every click</td></tr>
          <tr><td>click analytics</td><td class="bad">lost after first visit</td><td class="good">complete</td></tr>
          <tr><td>edit / block later</td><td class="bad">no</td><td class="good">yes</td></tr></tbody></table>`,
      ],
      callout: { kind: 'insight', text: 'Most commercial shorteners pick 302. For them the clicks are the product.' },
      metrics: { latency: { v: '~2 ms · 302', tone: 'good' } },
      scene: {
        entities: {
          users: U,
          app: APP,
          ids: IDS,
          cache: cache(28, 0, { label: 'cache', sub: 'hot codes in RAM' }),
          db: db(42, 0, { label: 'database' }),
          card: card(35, -18, 'Redirect', ['301  cached by the browser', '# cheap, but clicks vanish', '302  every click comes back', '✓ analytics, editable']),
        },
        links: { ua: link('users', 'app'), ac: link('app', 'cache'), cd: link('cache', 'db'), ai: link('app', 'ids', { dashed: true }) },
        flows: [
          { route: ['ua', 'ac'], rate: 3, bounce: true },
          { route: ['ua', 'ac', 'cd'], kind: 'slow', rate: 0.35, bounce: true },
        ],
      },
    },
    {
      short: 'Scale out',
      chapter: 'solution',
      title: 'Three terabytes: spread it out',
      body: [
        '3 TB and 11,000 reads a second at peak won’t sit comfortably on one machine — and one machine is one failure away from breaking every link ever shared. Scale both tiers.',
        '<b>App servers</b> keep no state, so put several behind a <b>load balancer</b> and add more when needed. The <b>data</b> is partitioned by a hash of the code: each shard owns a slice of the keys, and a lookup touches exactly one shard. Each shard keeps replicas so a dead disk isn’t a dead link.',
        'Lookups by primary key with no joins are exactly what stores like DynamoDB or Cassandra are built for; a sharded Postgres works too.',
      ],
      callout: { kind: 'tip', text: 'Shard on the key you look things up by. Every query here is “give me code X”, so the code is the shard key.' },
      metrics: { scale: { v: '3 apps · 3 shards', tone: 'good' } },
      scene: scaled(),
    },
    {
      short: 'Clicks',
      chapter: 'technique',
      title: 'Counting clicks without slowing them',
      body: [
        'Analytics must stay off the redirect path. If each redirect waited for a counter update in some database, a slow analytics store would make every link on the internet that points at you slow.',
        'Instead, the app drops a small <b>click event</b> — code, time, country, referrer — onto a queue (Kafka, SQS) and answers immediately. <b>Workers</b> consume events in batches and update the stats store. If the workers fall behind, clicks get counted a little late; redirects never notice.',
      ],
      callout: { kind: 'insight', text: 'Ask of every piece of work: does the user have to wait for this? If not, move it off the request path.' },
      metrics: { latency: { v: '~2 ms (unchanged)', tone: 'good' } },
      scene: scaled({ analytics: true }),
    },
    {
      short: 'Abuse',
      chapter: 'problem',
      title: 'Case: spammers love shorteners',
      body: [
        'A short link hides where it really goes, which makes shorteners a favourite tool for phishing and malware. Bots also hammer the create endpoint to mint millions of throwaway links.',
        'Defend in layers. <b>Rate-limit</b> creates per account and per IP at the load balancer. <b>Scan</b> new URLs against blocklists asynchronously — the queue and workers already exist. When a link turns out to be bad, flip it to a warning page — one more reason to have chosen 302.',
      ],
      callout: { kind: 'warning', text: 'Any free, public write endpoint becomes an abuse target. Budget for it in the design, not after the incident.' },
      scene: scaled({
        analytics: true,
        extra: {
          lb: lb(10, 0, { label: 'load balancer', badge: { text: 'rate limit', tone: 'warn' } }),
          worker: worker(42, 30, { label: 'workers', sub: 'clicks + URL scanning' }),
          bots: users(0, 16, { label: 'spam bots', count: 2, badge: { text: 'abuse', tone: 'bad' } }),
        },
        links: { bl: link('bots', 'lb') },
        flows: [
          { route: ['bl'], kind: 'poison', rate: 4, fail: 0.85 },
          { route: ['bl', 'la', 'aq', 'qw'], kind: 'poison', rate: 0.6, fail: 1 },
        ],
      }),
    },
    {
      short: 'Recap',
      chapter: 'recap',
      title: 'The finished design',
      body: [
        'Every box on the stage exists because a number or a failure asked for it:',
        `<table class="compare"><thead><tr><th>decision</th><th>choice</th><th>because</th></tr></thead><tbody>
          <tr><td>short codes</td><td>base62(shuffle(id))</td><td>unique without checks, not guessable</td></tr>
          <tr><td>ID allocation</td><td>blocks from an ID service</td><td>no per-request coordination</td></tr>
          <tr><td>read path</td><td>cache in front of storage</td><td>80 reads per write, immutable data</td></tr>
          <tr><td>redirect</td><td>302</td><td>analytics and control over links</td></tr>
          <tr><td>storage</td><td>sharded by code, replicated</td><td>3 TB, one-key lookups</td></tr>
          <tr><td>analytics, scanning</td><td>queue + workers</td><td>keep the hot path tiny</td></tr></tbody></table>`,
        'Check yourself: could you explain why the redirect path never touches the queue, and what happens to a click if every worker is down? (It waits in the queue; the redirect still works.)',
      ],
      callout: { kind: 'insight', text: 'Simple problem statements hide most of the design. The work is in the numbers, the failure cases and the trade-offs.' },
      scene: scaled({ analytics: true }),
    },
  ],
};
