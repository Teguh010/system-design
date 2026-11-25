import type { Entity, Flow, Lesson, Link, Scene } from '../types.ts';
import { card, db, link, server, spread, users } from './helpers.ts';

const UPLOADERS = users(0, 0, { label: 'uploaders', sub: '400k/day', count: 3 });

const SHARD_IDS = ['s0', 's1', 's2'] as const;
type Sid = (typeof SHARD_IDS)[number];
const ROW: Record<Sid, number> = { s0: -17, s1: 0, s2: 17 };

function ledger(o: {
  shards?: Sid[];
  solo?: boolean;
  look?: Partial<Record<Sid, Partial<Entity>>>;
  app?: Partial<Entity>;
  links?: Record<string, Link>;
  flows?: Flow[];
  extra?: Record<string, Entity>;
  /** Send most traffic to one shard (hot key demo). */
  hot?: Sid;
} = {}): Scene {
  const solo = o.solo ?? false;
  const ids = solo ? (['s0'] as Sid[]) : (o.shards ?? SHARD_IDS);

  const entities: Record<string, Entity> = {
    users: UPLOADERS,
    app: server(17, 0, {
      label: 'metadata API',
      icon: 'server',
      sub: solo ? 'no router yet' : 'shard router',
      ...(o.app ?? {}),
    }),
    ...o.extra,
  };

  const links: Record<string, Link> = { ua: link('users', 'app', { arrow: true }) };

  ids.forEach((id, i) => {
    const look = o.look?.[id] ?? {};
    entities[id] = db(36, solo ? 0 : ROW[id], {
      label: solo ? 'Postgres' : `shard ${i}`,
      icon: 'database',
      fill: solo ? 0.92 : 0.33,
      ...(solo && { sub: 'all rows' }),
      ...look,
    });
    const lid = `a${id.slice(1)}` as 'a0' | 'a1' | 'a2';
    links[lid] = link('app', id, { arrow: true });
  });
  if (o.links) Object.assign(links, o.links);

  const flows: Flow[] = o.flows
    ?? (o.hot
      ? [
          { route: ['ua', `a${o.hot.slice(1)}`], kind: 'slow', rate: 2.2, bounce: true, speed: 50 },
          ...ids.filter((id) => id !== o.hot).map((id): Flow => ({ route: ['ua', `a${id.slice(1)}`], kind: 'write', rate: 0.35, bounce: true, returnKind: 'res' })),
        ]
      : spread(
          ids.map((id) => ['ua', `a${id.slice(1)}`]),
          2.6,
          { kind: 'write', bounce: true, returnKind: 'res' },
        ));

  return { entities, links, flows };
}

export const sharding: Lesson = {
  id: 'sharding',
  title: 'Sharding',
  summary:
    'A photo backup service outgrows one Postgres — split rows across shards by range or hash, survive a hot tenant, and see what cross-shard queries cost.',
  minutes: 12,
  level: 'intermediate',
  metrics: [
    { id: 'disk', label: 'disk used' },
    { id: 'writes', label: 'writes / s' },
    { id: 'shards', label: 'shards' },
    { id: 'scatter', label: 'cross-shard' },
  ],
  legend: ['req', 'res', ['write', 'insert'], ['slow', 'hot shard']],
  goals: [
    { text: 'See why replication is not enough for growth', step: 1 },
    { text: 'Partition rows with range and hash shard keys', step: 3 },
    { text: 'Spot a hot shard when one key owns traffic', step: 4 },
    { text: 'Feel the pain of scatter-gather queries', step: 6 },
    { text: 'Know why resharding is a planned migration', step: 7 },
  ],
  steps: [
    {
      short: 'Too big',
      chapter: 'problem',
      title: 'Too big for one machine',
      body: [
        '<b>Framebag</b> stores photo metadata — dimensions, hashes, albums — not the files themselves (those live in object storage). The table is <b>1.8 TB</b> on disk and ingests about <b>12,000 writes/s</b> from upload clients.',
        'Read replicas from the last lesson help scroll-heavy queries, but <b>every new row still lands on one leader</b>. Backups take most of a day; vertical scaling is already maxed out.',
      ],
      callout: { kind: 'insight', text: 'Replication copies the same data everywhere. To scale writes and disk, you must split the data itself.' },
      metrics: { disk: { v: '1.8 TB', tone: 'bad' }, writes: { v: '12k/s', tone: 'warn' }, shards: '1', scatter: '—' },
      scene: ledger({
        solo: true,
        look: {
          s0: { badge: { text: 'leader', tone: 'good' }, focus: true },
        },
        links: { a0: link('app', 's0', { label: 'all inserts', labelTone: 'bad', arrow: true }) },
        extra: { card: card(18, -22, 'Growth', ['! disk 92% full', '! 12k writes/s', '# replicas ≠ more writes']) },
      }),
    },
    {
      short: 'Split',
      chapter: 'technique',
      title: 'Horizontal partitioning',
      body: [
        '<b>Sharding</b> means each shard holds a subset of rows on its own database. The app picks a <b>shard key</b> from the row (often <code>user_id</code>) and routes reads and writes to exactly one shard.',
        'Framebag keeps the same schema on every shard; only the row set differs. There is still one logical table, many physical databases.',
      ],
      changes: ['+ idea: partition rows, not tables'],
      metrics: { scatter: 'target: 1 shard/query' },
      scene: ledger({
        solo: true,
        look: { s0: { badge: { text: 'rows 0…∞', tone: 'warn' } } },
        extra: {
          card: card(40, -20, 'Shard key', ['user_id → pick shard', 'album_id? team_id?', '# pick what you query by']),
        },
      }),
    },
    {
      short: 'Range',
      chapter: 'solution',
      title: 'Range sharding',
      body: [
        'The first cut is often <b>range</b> sharding: sort by <code>user_id</code> and split on boundaries — users <code>000…499</code> on shard 0, <code>500…999</code> on shard 1, and so on.',
        'Range is easy to reason about and great for time-ordered keys like <code>created_at</code>. The downside: growth in one segment becomes a <b>hot shard</b> while neighbours stay idle.',
      ],
      changes: ['+ 3 physical shards', '~ router sends writes by user_id range'],
      metrics: { disk: { v: '~600 GB / shard', tone: 'good' }, shards: '3', writes: { v: '~4k/s each', tone: 'good' } },
      scene: ledger({
        look: {
          s0: { sub: 'users 0–499', badge: { text: 'even', tone: 'good' }, focus: true },
          s1: { sub: 'users 500–999', badge: { text: 'even', tone: 'good' }, focus: true },
          s2: { sub: 'users 1000+', badge: { text: 'even', tone: 'good' }, focus: true },
        },
        links: {
          a0: link('app', 's0', { label: 'id < 500', labelTone: 'info', arrow: true }),
          a1: link('app', 's1', { label: '500–999', labelTone: 'info', arrow: true }),
          a2: link('app', 's2', { label: 'id ≥ 1000', labelTone: 'info', arrow: true }),
        },
      }),
    },
    {
      short: 'Hot',
      chapter: 'problem',
      title: 'Case: the enterprise tenant',
      body: [
        'A photography studio puts <b>40,000 employees</b> on one corporate <code>team_id</code>. Range sharding by low user IDs parked the whole company on <b>shard 0</b>. Inserts spike to 8,000/s while shard 2 sits at 5% CPU.',
        'This is a <b>hot shard</b> (sometimes a hot key). Fixing it means changing the shard key or salting hot keys across shards — not buying a bigger box for one partition.',
      ],
      callout: { kind: 'warning', text: 'If your shard key has super-users — celebs, enterprise tenants, national launches — range sharding will concentrate them.' },
      changes: ['~ one tenant dominates shard 0', '~ uneven disk growth returns'],
      metrics: { writes: { v: '8k/s on shard 0', tone: 'bad' }, disk: { v: 'shard 0 88%', tone: 'bad' } },
      scene: ledger({
        hot: 's0',
        look: {
          s0: { meter: { label: 'inserts', value: 0.88, tone: 'bad' }, badge: { text: 'hot', tone: 'bad' }, fill: 0.88, focus: true },
          s1: { meter: { label: 'inserts', value: 0.12, tone: 'good' }, fill: 0.3 },
          s2: { meter: { label: 'inserts', value: 0.08, tone: 'good' }, fill: 0.27 },
        },
        links: { a0: link('app', 's0', { label: 'studio bulk', labelTone: 'bad', arrow: true }) },
      }),
    },
    {
      short: 'Hash',
      chapter: 'solution',
      title: 'Hash sharding',
      body: [
        'Switch the router to <b>hash sharding</b>: <code>shard = hash(user_id) % N</code>. The studio’s users scatter across shards; insert rates even out. You lose neat range scans on user ID unless you query every shard.',
        'Consistent hashing (next lesson) softens the pain when <code>N</code> changes. For now, modulo hashing is the simple baseline.',
      ],
      predict: {
        question: 'You move from range to hash(user_id) % 3. What happens to the studio’s concentrated load?',
        options: ['All traffic stays on shard 0', 'Load spreads across shards', 'Writes drop to zero', 'Every query hits all 3 shards'],
        answer: 1,
        explain: 'Hashing spreads unrelated user_ids pseudo-randomly. Point lookups still hit one shard; only scatter queries need every shard.',
      },
      changes: ['~ router: hash % 3', '~ hot shard load flattened'],
      metrics: { writes: { v: '~4k/s each', tone: 'good' }, disk: { v: 'balanced', tone: 'good' } },
      scene: ledger({
        look: {
          s0: { sub: 'hash ≡ 0', badge: { text: '33%', tone: 'good' } },
          s1: { sub: 'hash ≡ 1', badge: { text: '33%', tone: 'good' } },
          s2: { sub: 'hash ≡ 2', badge: { text: '33%', tone: 'good' } },
        },
        links: {
          a0: link('app', 's0', { label: 'hash→0', labelTone: 'good', arrow: true }),
          a1: link('app', 's1', { label: 'hash→1', labelTone: 'good', arrow: true }),
          a2: link('app', 's2', { label: 'hash→2', labelTone: 'good', arrow: true }),
        },
      }),
    },
    {
      short: 'Scatter',
      chapter: 'problem',
      title: 'Case: admin search across users',
      body: [
        'Support searches for every photo tagged “wedding” last month. With hash sharding there is <b>no single shard</b> to ask — the API must <b>scatter</b> the same query to all three databases and <b>gather</b> results.',
        'Cross-shard queries are correct but expensive: 3× database work, higher tail latency, tricky pagination. Product teams learn to push filters through the shard key when possible.',
      ],
      changes: ['+ scatter-gather query', '~ 3 parallel lookups'],
      metrics: { scatter: { v: '3 shards/query', tone: 'bad' } },
      scene: ledger({
        flows: [
          { route: ['ua', 'a0'], rate: 1.2, bounce: true },
          { route: ['ua', 'a1'], rate: 1.2, bounce: true },
          { route: ['ua', 'a2'], rate: 1.2, bounce: true },
        ],
        links: {
          a0: link('app', 's0', { label: 'tag search', labelTone: 'warn', arrow: true }),
          a1: link('app', 's1', { label: 'tag search', labelTone: 'warn', arrow: true }),
          a2: link('app', 's2', { label: 'tag search', labelTone: 'warn', arrow: true }),
        },
        extra: { card: card(18, 20, 'Query plan', ['! fan-out to every shard', 'merge + sort', '# avoid if possible']) },
      }),
    },
    {
      short: 'Reshard',
      chapter: 'tradeoff',
      title: 'Adding a fourth shard',
      body: [
        'Disk is climbing again. Ops want a <b>fourth shard</b>. With <code>hash % 3</code>, almost every row must move when you switch to <code>% 4</code> — a long migration with dual-write or backfill jobs.',
        '<b>Resharding</b> is not a weekend toggle. Framebag plans it like a release: new router config, copy data, verify counts, cut over, keep the old shards read-only until TTL passes.',
      ],
      predict: {
        question: 'You double shard count from 3 to 6 with plain modulo hashing. What is the usual migration cost?',
        options: ['No rows move — only new writes change', 'Most rows may need a new home', 'Only the hot shard moves', 'Reads stop; writes continue'],
        answer: 1,
        explain: 'Modulo remaps keys when N changes. That is why consistent hashing exists — but even then, resharding is deliberate ops work.',
      },
      changes: ['+ shard 3 (planned)', '~ remap hash % N → % (N+1)'],
      metrics: { shards: { v: '3 → 4', tone: 'warn' }, scatter: 'same' },
      scene: ledger({
        shards: ['s0', 's1', 's2'],
        look: { s0: { fill: 0.78 }, s1: { fill: 0.8 }, s2: { fill: 0.76 } },
        extra: {
          s3: db(50, 0, { label: 'shard 3', sub: 'empty', ghost: true, fill: 0, badge: { text: 'planned', tone: 'info' } }),
          card: card(56, 14, 'Migration', ['dual-write window', 'backfill jobs', '! weeks of care']),
        },
        app: { sub: 'router v2 pending' },
      }),
    },
    {
      short: 'Pick key',
      chapter: 'insight',
      title: 'Choosing a shard key',
      body: [
        'A good shard key matches how you <b>write</b> and <b>read</b> most of the time: high cardinality, no single super-tenant, and co-locates rows you fetch together.',
        'Framebag keeps <code>user_id</code> — uploads and album lists are per user. Global analytics move to a warehouse; the OLTP path stays single-shard.',
      ],
      changes: ['~ OLTP queries carry shard key', '~ global search uses warehouse'],
      metrics: { scatter: { v: 'rare', tone: 'good' } },
      scene: ledger({
        look: {
          s0: { badge: { text: 'user rows', tone: 'good' } },
          s1: { badge: { text: 'user rows', tone: 'good' } },
          s2: { badge: { text: 'user rows', tone: 'good' } },
        },
        app: { sub: 'user_id in every path' },
      }),
    },
    {
      short: 'Recap',
      chapter: 'recap',
      title: 'Recap',
      body: [
        'Framebag’s sharding cheat sheet:',
        `<table class="compare"><thead><tr><th>goal</th><th>pattern</th><th>cost</th><th>see</th></tr></thead><tbody>
          <tr><td>more write capacity</td><td class="good">split shards</td><td>ops + routing</td><td>this lesson</td></tr>
          <tr><td>even growth</td><td>hash shard key</td><td>scatter queries</td><td>consistent-hashing</td></tr>
          <tr><td>hot tenant</td><td>salt / sub-shard</td><td>complex router</td><td>this lesson</td></tr>
          <tr><td>scale reads only</td><td>replicas</td><td>lag</td><td>replication</td></tr></tbody></table>`,
        'Check yourself: weekly revenue report needs every user’s invoices. Shard by user_id — one query or many? (Many: scatter to each shard unless invoices are copied to an analytics store.)',
      ],
      scene: ledger({
        look: {
          s0: { sub: 'hash ≡ 0' },
          s1: { sub: 'hash ≡ 1' },
          s2: { sub: 'hash ≡ 2' },
        },
        app: { badge: { text: 'router', tone: 'good' } },
      }),
    },
  ],
};