import type { Entity, Flow, Lesson, Link, Scene } from '../types.ts';
import { card, client, db, link, server, tree } from './helpers.ts';

const AGENT = client(0, 0, { label: 'support desk' });

type Look = Partial<Record<'db' | 'idx', Partial<Entity>>>;

function desk(o: {
  look?: Look;
  extra?: Record<string, Entity>;
  flows?: Flow[];
  links?: Record<string, Link>;
  index?: boolean;
  count?: number;
} = {}): Scene {
  const entities: Record<string, Entity> = {
    agent: AGENT,
    app: server(18, 0, { label: 'orders API', icon: 'server' }),
    db: db(38, 0, { label: 'orders DB', sub: 'heap table', icon: 'database', ...(o.look?.db ?? {}) }),
    ...(o.index && { idx: tree(38, -16, { label: 'email index', sub: 'B-tree', count: o.count ?? 3, ...(o.look?.idx ?? {}) }) }),
    ...o.extra,
  };
  const links: Record<string, Link> = {
    ca: link('agent', 'app', { arrow: true }),
    ad: link('app', 'db', { arrow: true }),
    ...(o.index && { ai: link('app', 'idx', { dashed: true, curve: 0.12 }) }),
    ...o.links,
  };
  const flows: Flow[] = o.flows ?? [
    { route: ['ca', 'ad'], rate: 1.8, bounce: true },
    ...(o.index ? [{ route: ['ca', 'ai'], kind: 'ping' as const, rate: 0.8, bounce: true }] : []),
  ];
  return { entities, links, flows };
}

export const indexes: Lesson = {
  id: 'indexes',
  title: 'Indexes',
  summary:
    'Support agents at a craft marketplace search millions of orders by email — indexes turn full-table scans into short B-tree walks, if you match how you query.',
  minutes: 12,
  level: 'beginner',
  metrics: [
    { id: 'rows', label: 'rows read' },
    { id: 'lookup', label: 'lookup time' },
    { id: 'write', label: 'write cost' },
  ],
  legend: ['req', 'res', ['slow', 'full scan'], 'write', 'ping'],
  goals: [
    { text: 'See what a full-table scan costs at scale', step: 2 },
    { text: 'Connect B-tree levels to fewer rows read', step: 4 },
    { text: 'Build a composite index that matches your filters', step: 6 },
    { text: 'Pay for index maintenance on every insert', step: 8 },
    { text: 'Pick indexes from real query shapes, not habit', step: 9 },
  ],
  steps: [
    {
      short: 'Slow search',
      chapter: 'setup',
      title: '“Find order by email”',
      body: [
        'PatchCraft’s support desk handles refunds. Agents type a customer email into the admin tool and expect the matching order in a second. At 4 million orders, the page often spins for eight seconds — long enough that agents open three tabs and compare results.',
        'The orders table is healthy: inserts and checkouts keep working. The pain is one read pattern that got heavier as the store grew.',
      ],
      metrics: { rows: '4M?', lookup: { v: '~8 s', tone: 'bad' }, write: '?' },
      scene: desk({ look: { db: { badge: { text: '4M rows', tone: 'warn' } } } }),
    },
    {
      short: 'Full scan',
      chapter: 'problem',
      title: 'Case: every lookup walks the table',
      body: [
        'The API runs <code>SELECT * FROM orders WHERE email = ?</code>. With no helpful structure, the database performs a <b>full table scan</b>: it reads row after row until it finds matches — millions of them for a common email domain.',
        'CPU and disk stay busy even though the agent only needed a handful of orders. Cost scales with table size, not with how selective the email is.',
      ],
      callout: { kind: 'warning', text: 'If rows examined ≫ rows returned, you are paying storage bandwidth to rediscover data the engine already stores.' },
      changes: ['+ support lookup by email', '~ query reads the whole heap'],
      metrics: { rows: { v: '~4M / lookup', tone: 'bad' }, lookup: { v: 'grows with table', tone: 'bad' } },
      scene: desk({
        look: { db: { meter: { label: 'disk read', value: 0.92, tone: 'bad' }, badge: { text: 'seq scan', tone: 'bad' } } },
        links: { ad: link('app', 'db', { label: 'WHERE email', labelTone: 'bad', arrow: true }) },
        flows: [{ route: ['ca', 'ad'], kind: 'slow', rate: 0.9, bounce: true }],
      }),
    },
    {
      short: 'Heap',
      chapter: 'technique',
      title: 'Table order is not lookup order',
      body: [
        'Rows on disk follow insert order — great for append, terrible for “find by email”. An <b>index</b> is a separate structure that sorts keys the way you query them, pointing back to the rows in the heap.',
        'You still keep one table; you add a side structure maintained by the database. Reads can use the index; writes must update both.',
      ],
      changes: ['+ index is separate from heap', '~ lookups follow index order, not insert order'],
      metrics: { write: { v: 'table only', tone: 'info' } },
      scene: desk({
        extra: {
          heap: card(22, -22, 'Two structures', [
            'heap table   rows in insert order',
            'index        keys sorted for lookup',
            '# arrows → row ids (pointers)',
          ]),
        },
      }),
    },
    {
      short: 'B-tree',
      chapter: 'solution',
      title: 'A B-tree for email',
      body: [
        'PostgreSQL builds a <b>B-tree</b> index on <code>email</code>. Internally it is a shallow tree of sorted keys — typically three levels for millions of rows — so each lookup touches only a handful of pages.',
        'The diagram shows the shape: one root, a few branches, leaf nodes with sorted emails and pointers to rows.',
      ],
      callout: { kind: 'insight', text: 'B-trees keep depth low by storing many keys per page — that is why they are the default secondary index in SQL databases.' },
      changes: ['+ CREATE INDEX on email', '+ B-tree sits beside heap'],
      metrics: { rows: { v: '~3 pages', tone: 'good' }, lookup: { v: '~15 ms', tone: 'good' } },
      scene: desk({
        index: true,
        look: { idx: { badge: { text: 'depth 3', tone: 'good' } }, db: { badge: { text: '4M rows', tone: 'info' } } },
        links: {
          ad: link('app', 'db', { label: 'fetch row', labelTone: 'good', arrow: true }),
          ai: link('app', 'idx', { label: 'seek email', labelTone: 'good', arrow: true }),
        },
      }),
    },
    {
      short: 'Fast path',
      chapter: 'insight',
      title: 'Seek, then fetch',
      body: [
        'The agent’s query becomes two hops: walk the B-tree to the matching keys, then follow pointers to the handful of rows in the heap. Disk read meter collapses because the engine no longer touches unrelated pages.',
        'This is why the same table can serve both checkout inserts and lightning-fast support search — different paths for different shapes.',
      ],
      changes: ['~ reads scale with matches, not table size'],
      metrics: { rows: { v: '4–12 rows', tone: 'good' }, lookup: { v: '~15 ms', tone: 'good' } },
      scene: desk({
        index: true,
        look: { db: { meter: { label: 'disk read', value: 0.12, tone: 'good' } }, idx: { meter: { label: 'seek', value: 0.25, tone: 'good' } } },
        flows: [
          { route: ['ca', 'ai'], kind: 'ping' as const, rate: 1.1, bounce: true },
          { route: ['ca', 'ad'], rate: 1.4, bounce: true },
        ],
      }),
    },
    {
      short: 'Composite',
      chapter: 'technique',
      title: 'Filter by email and status',
      body: [
        'Product adds a filter: “open orders for this email”. The query adds <code>AND status = ’open’</code>. A lone index on email still finds every order for the address — then the database filters status row by row.',
        'A <b>composite index</b> on <code>(email, status)</code> matches the filter order: seek the email range, then only the <code>open</code> slice within it.',
      ],
      changes: ['+ filter on status', '+ composite index (email, status)'],
      scene: desk({
        index: true,
        look: { idx: { label: '(email,status)', sub: 'composite B-tree', badge: { text: 'both columns', tone: 'good' } } },
        links: { ad: link('app', 'db', { label: 'email AND open', labelTone: 'good', arrow: true }) },
        extra: { card: card(22, 22, 'Index column order', ['(email, status)  ✓ filter as written', '(status, email)  ✗ seeks wrong half']) },
      }),
    },
    {
      short: 'Wrong order',
      chapter: 'problem',
      title: 'Case: index column order matters',
      body: [
        'Someone builds <code>(status, email)</code> instead. The query still filters on email first, but the index is sorted primarily by status — “open”, “shipped”, “refunded” — with emails scattered inside each bucket. The planner falls back to scanning a huge status slice.',
        'Composite indexes are not magic: the leftmost prefix must match how the <code>WHERE</code> clause works.',
      ],
      callout: { kind: 'tip', text: 'Write the filter you use every day, then mirror its order in the index.' },
      changes: ['~ wrong column order → wide range scan'],
      metrics: { rows: { v: '800k / lookup', tone: 'warn' }, lookup: { v: '~900 ms', tone: 'warn' } },
      scene: desk({
        index: true,
        look: { idx: { label: '(status,email)', badge: { text: 'mismatch', tone: 'bad' } }, db: { meter: { label: 'disk read', value: 0.7, tone: 'warn' } } },
        flows: [{ route: ['ca', 'ad'], kind: 'slow', rate: 0.8, bounce: true }],
      }),
    },
    {
      short: 'Writes',
      chapter: 'tradeoff',
      title: 'Every insert updates the index',
      body: [
        'Checkout still inserts one row per order. The database writes the heap page <i>and</i> inserts the email into the B-tree — extra random I/O to keep the index sorted. That is the <b>write amplification</b> of indexes.',
        'A handful of well-chosen indexes are cheap. Dozens of indexes on the same table make every insert fan out across all of them.',
      ],
      changes: ['+ INSERT touches heap + each index', '~ write latency rises with index count'],
      metrics: { write: { v: 'heap + B-tree', tone: 'warn' } },
      scene: desk({
        index: true,
        look: { db: { badge: { text: 'INSERT', tone: 'info' } }, idx: { badge: { text: '+1 key', tone: 'warn' } } },
        links: { ad: link('app', 'db', { label: 'INSERT order', arrow: true }), ai: link('app', 'idx', { label: 'maintain index', labelTone: 'warn', arrow: true }) },
        flows: [{ route: ['ca', 'ad'], kind: 'write', rate: 1.2, bounce: true }],
      }),
    },
    {
      short: 'Choose',
      chapter: 'insight',
      title: 'Index what you query',
      body: [
        'Keep indexes aligned to real workloads: support search needs <code>email</code>; dashboards that slice by <code>status + date</code> need their own composite. Skip indexes on columns you never filter or join on.',
        'When a query is hot, capture its plan — <code>EXPLAIN</code> shows whether you hit an index or scan the world.',
      ],
      metrics: { write: { v: '3 indexes', tone: 'good' } },
      scene: desk({
        index: true,
        count: 4,
        extra: { card: card(20, -22, 'PatchCraft indexes', ['orders(email)', 'orders(email,status)', 'shipments(tracking)', '# no index on nickname']) },
      }),
    },
    {
      short: 'Recap',
      chapter: 'recap',
      title: 'Recap',
      body: [
        'Index decisions for PatchCraft:',
        `<table class="compare"><thead><tr><th>situation</th><th>approach</th><th>watch for</th><th>see</th></tr></thead><tbody>
          <tr><td>find by email</td><td class="good">B-tree on email</td><td>full scans at scale</td><td>this lesson</td></tr>
          <tr><td>email + status</td><td class="good">composite index</td><td>column order</td><td>this lesson</td></tr>
          <tr><td>heavy inserts</td><td>few indexes</td><td>write amplification</td><td>storage engines</td></tr>
          <tr><td>duplicate indexes</td><td>drop redundant</td><td>extra writes</td><td>this lesson</td></tr></tbody></table>`,
        'Check yourself: agents search by email; finance reports filter by <code>created_at</code> range. One index or two, and on which columns? (At least two: <code>email</code> for support; <code>created_at</code> or <code>(created_at, …)</code> for reports — only if those queries exist.)',
      ],
      scene: desk({ index: true, look: { idx: { badge: { text: 'keys sorted', tone: 'good' } }, db: { badge: { text: 'rows stay', tone: 'info' } } } }),
    },
  ],
};