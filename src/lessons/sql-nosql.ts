import type { Entity, Flow, Lesson, Link, Scene } from '../types.ts';
import { card, db, link, server, spread, users } from './helpers.ts';

const BUYERS = users(0, 0, { label: 'fans' });

type Look = Partial<Record<'sql' | 'doc', Partial<Entity>>>;

function podium(o: {
  look?: Look;
  extra?: Record<string, Entity>;
  flows?: Flow[];
  links?: Record<string, Link>;
  doc?: boolean;
  card?: Entity;
} = {}): Scene {
  const entities: Record<string, Entity> = {
    users: BUYERS,
    app: server(18, 0, { label: 'ticket API', icon: 'server', ...(o.extra?.app ?? {}) }),
    sql: db(36, -10, {
      label: 'PostgreSQL',
      sub: 'seats · orders',
      icon: 'database',
      ...(o.look?.sql ?? {}),
    }),
    ...(o.doc && {
      doc: db(36, 10, {
        label: 'document store',
        sub: 'event catalog',
        ...(o.look?.doc ?? {}),
      }),
    }),
    ...o.extra,
  };
  const links: Record<string, Link> = {
    ua: link('users', 'app', { arrow: true }),
    as: link('app', 'sql', { arrow: true }),
    ...(o.doc && { ad: link('app', 'doc', { arrow: true }) }),
    ...o.links,
  };

  const defaultFlows: Flow[] = [
    ...spread([['ua', 'as']], 2.2, { bounce: true }),
    ...(o.doc ? spread([['ua', 'ad']], 1.4, { bounce: true }) : []),
  ];

  return { entities, links, flows: o.flows ?? defaultFlows };
}

export const sqlNosql: Lesson = {
  id: 'sql-nosql',
  title: 'SQL vs NoSQL',
  summary:
    'A concert ticket app shows when relations and ACID transactions are non‑negotiable — and when a document store fits better — because the access pattern picks the database.',
  minutes: 12,
  level: 'beginner',
  metrics: [
    { id: 'model', label: 'source of truth' },
    { id: 'safety', label: 'double-book risk' },
    { id: 'flex', label: 'ad-hoc queries' },
  ],
  legend: ['req', 'res', ['write', 'checkout'], ['fail', 'race']],
  goals: [
    { text: 'See why “one database for everything” breaks on seats', step: 2 },
    { text: 'Use rows, keys and transactions to protect inventory', step: 4 },
    { text: 'Spot workloads that want flexible documents instead', step: 6 },
    { text: 'Notice duplication when two stores disagree', step: 7 },
    { text: 'Choose storage from how you read and write data', step: 9 },
  ],
  steps: [
    {
      short: 'Oversold',
      chapter: 'setup',
      title: 'Two fans, one seat',
      body: [
        'Nova Hall is selling tickets for a comeback show. Within minutes social media is full of screenshots: two different confirmation emails for <b>seat B12</b>. Support can see both orders in the spreadsheet export — the show is oversold.',
        'The team built <code>nova-tickets</code> on a single API and one database. It felt fast to ship. Now they need to understand what kind of database actually matches how tickets are bought.',
      ],
      metrics: { model: 'one database', safety: { v: 'oversold seats', tone: 'bad' }, flex: '?' },
      scene: podium({ look: { sql: { badge: { text: 'B12 × 2', tone: 'bad' } } } }),
    },
    {
      short: 'Race',
      chapter: 'problem',
      title: 'Case: checkout without a transaction',
      body: [
        'Checkout is two steps: read whether seat B12 is free, then insert an order row. Two fans click “Buy” in the same second. Both reads see “free”. Both inserts succeed — the bug you just saw.',
        'This is a <b>race</b>: the outcome depends on timing, not on business rules. Fixing it is not “be careful in code”; the store has to make conflicting updates impossible.',
      ],
      callout: { kind: 'warning', text: 'If two writers can pass the same check-then-act sequence, you need atomicity from the database or an explicit lock.' },
      changes: ['+ two checkout requests at once', '~ seat status checked separately from insert'],
      metrics: { safety: { v: 'read → write gap', tone: 'bad' } },
      scene: podium({
        look: { sql: { badge: { text: 'B12 free ×2', tone: 'bad' }, meter: { label: 'writes', value: 0.85, tone: 'warn' } } },
        flows: [
          { route: ['ua', 'as'], kind: 'write', rate: 1.1, bounce: true, returnKind: 'res' },
          { route: ['ua', 'as'], kind: 'write', rate: 1.1, bounce: true, returnKind: 'res' },
        ],
      }),
    },
    {
      short: 'Relational',
      chapter: 'technique',
      title: 'Model the rules in tables',
      body: [
        'A <b>relational</b> model fits inventory: an <code>events</code> row, many <code>seats</code> rows keyed by event, and <code>orders</code> rows that reference exactly one seat. Foreign keys stop orphan rows; uniqueness on <code>(event_id, seat)</code> stops duplicates at rest.',
        'The diagram shows the shape the app will query: “is this seat taken?” becomes a single join or lookup by key, not a scan of a blob.',
      ],
      changes: ['+ tables for events · seats · orders', '+ uniqueness on seat per event'],
      metrics: { model: { v: 'normalized tables', tone: 'good' } },
      scene: podium({
        extra: {
          card: card(18, -22, 'Relational sketch', [
            'events   id, name, starts_at',
            'seats    event_id, row, seat, status',
            'orders   id, seat_id, fan_email',
            '! UNIQUE (event_id, row, seat)',
          ]),
        },
      }),
    },
    {
      short: 'ACID',
      chapter: 'solution',
      title: 'Wrap checkout in a transaction',
      body: [
        'The API opens a <b>transaction</b>: <code>BEGIN</code>, lock seat B12 (<code>SELECT … FOR UPDATE</code>), insert the order, <code>COMMIT</code>. The second fan’s transaction blocks until the first finishes, then sees “taken” and rolls back.',
        'That bundle is the <b>ACID</b> guarantee relational engines are built for: the seat cannot be sold twice, even under load. Latency rises slightly on hot seats, but correctness wins.',
      ],
      callout: { kind: 'insight', text: 'Pick SQL when several rows must move together and invariants must hold every time.' },
      changes: ['~ checkout is one atomic unit', '~ second buyer waits or fails cleanly'],
      metrics: { safety: { v: 'serialized seats', tone: 'good' } },
      scene: podium({
        look: { sql: { badge: { text: 'txn holds lock', tone: 'good' }, meter: { label: 'lock wait', value: 0.35, tone: 'info' } } },
        links: { as: link('app', 'sql', { label: 'BEGIN … COMMIT', labelTone: 'good', arrow: true }) },
        flows: [{ route: ['ua', 'as'], kind: 'write', rate: 1.6, bounce: true, returnKind: 'res' }],
      }),
    },
    {
      short: 'Analytics',
      chapter: 'problem',
      title: 'Case: marketing wants a living catalog',
      body: [
        'Overselling is fixed, but product now wants a browsable catalog: fuzzy search on artist bios, JSON tags, hero images, and A/B copy — fields that change weekly and do not need joins to seats.',
        'Forcing that into dozens of nullable SQL columns makes migrations painful. Reads are “fetch document by slug”; writes are “replace whole page”. That is a different access pattern from checkout.',
      ],
      changes: ['+ catalog pages change often', '~ reads are whole documents by id'],
      metrics: { flex: { v: 'wide rows hurt', tone: 'warn' } },
      scene: podium({
        look: { sql: { badge: { text: '42 nullable cols', tone: 'warn' } } },
        extra: { card: card(18, 22, 'Marketing fields', ['bio_html', 'tags[]', 'hero_assets', 'experiments', '! not seat inventory']) },
      }),
    },
    {
      short: 'Documents',
      chapter: 'technique',
      title: 'Store the catalog as documents',
      body: [
        'They add a <b>document</b> database for the marketing catalog: one JSON document per event page, versioned independently. The ticket API still uses PostgreSQL for seats; browse traffic hits the document store.',
        '<b>NoSQL</b> here does not mean “no rules” — it means the schema is flexible inside each document and you optimize for key lookups instead of arbitrary joins.',
      ],
      changes: ['+ document DB for catalog only', '~ ticket rows stay in SQL'],
      metrics: { model: { v: 'SQL + documents', tone: 'good' }, flex: { v: 'shape per page', tone: 'good' } },
      scene: podium({
        doc: true,
        look: { doc: { badge: { text: 'by slug', tone: 'good' } } },
        links: {
          ua: link('users', 'app', { arrow: true }),
          as: link('app', 'sql', { label: 'checkout', arrow: true }),
          ad: link('app', 'doc', { label: 'GET /events/{slug}', arrow: true }),
        },
      }),
    },
    {
      short: 'Drift',
      chapter: 'problem',
      title: 'Case: two sources of truth diverge',
      body: [
        'A typo in the SQL <code>events.starts_at</code> column is fixed for checkout, but marketing forgets to update the catalog document. Fans see “8 pm” on the website and “7 pm” on the ticket PDF.',
        'Splitting stores trades flexibility for <b>consistency between systems</b>. You need a single writer, sync jobs, or accept that some fields are authoritative in only one place.',
      ],
      callout: { kind: 'warning', text: 'Every extra database is another place data can disagree unless you design ownership.' },
      changes: ['~ start time differs per store', '~ fans see conflicting copy'],
      metrics: { safety: { v: 'metadata drift', tone: 'warn' } },
      scene: podium({
        doc: true,
        look: {
          sql: { badge: { text: 'starts 19:00', tone: 'good' } },
          doc: { badge: { text: 'starts 20:00', tone: 'bad' } },
        },
        links: {
          as: link('app', 'sql', { label: 'source: SQL', labelTone: 'good', arrow: true }),
          ad: link('app', 'doc', { label: 'stale doc', labelTone: 'bad', arrow: true }),
        },
      }),
    },
    {
      short: 'Polyglot',
      chapter: 'solution',
      title: 'Polyglot persistence',
      body: [
        'The fix is explicit ownership: PostgreSQL is the <b>source of truth</b> for anything that can oversell seats; the catalog DB is rebuilt from an event bus or nightly job. Marketing edits draft documents, then publish pushes the canonical fields downstream.',
        'Most real products look like this — not “SQL <i>or</i> NoSQL”, but SQL <i>where transactions matter</i> and documents <i>where the shape is fluid</i>.',
      ],
      changes: ['+ publish pipeline syncs times', '~ catalog is derived, not authoritative for seats'],
      metrics: { safety: { v: 'owned fields', tone: 'good' } },
      scene: podium({
        doc: true,
        look: { sql: { badge: { text: 'authoritative', tone: 'good' } }, doc: { badge: { text: 'derived view', tone: 'info' } } },
        links: {
          ad: link('app', 'doc', { label: 'sync job', labelTone: 'info', arrow: true }),
        },
        extra: { card: card(27, -22, 'Ownership', ['seats/orders → SQL', 'pages/tags → documents', 'publish → copy fields once']) },
      }),
    },
    {
      short: 'Choose',
      chapter: 'insight',
      title: 'Let the access pattern choose',
      body: [
        'Ask how data is <b>read</b> and <b>written</b>, not which logo is fashionable. Many related rows that must move together → relational + transactions. Whole-object reads, evolving fields, huge scale on a simple key → document or wide-column store.',
        'Key-value caches and search indexes are further specializations; they sit beside the system of record rather than replacing it.',
      ],
      metrics: { flex: { v: 'pattern-first', tone: 'good' } },
      scene: podium({
        doc: true,
        look: { sql: { meter: { label: 'txn/s', value: 0.55, tone: 'good' } }, doc: { meter: { label: 'reads/s', value: 0.7, tone: 'good' } } },
      }),
    },
    {
      short: 'Recap',
      chapter: 'recap',
      title: 'Recap',
      body: [
        'Nova Hall’s story in one table:',
        `<table class="compare"><thead><tr><th>need</th><th>lean toward</th><th>why</th><th>see</th></tr></thead><tbody>
          <tr><td>no double-selling seats</td><td class="good">SQL + ACID</td><td>locks + constraints</td><td>this lesson</td></tr>
          <tr><td>flexible marketing pages</td><td class="good">documents</td><td>whole-object reads</td><td>this lesson</td></tr>
          <tr><td>both at once</td><td>two stores + sync</td><td>different patterns</td><td>replication</td></tr>
          <tr><td>faster lookups</td><td>indexes</td><td>avoid full scans</td><td>indexes</td></tr></tbody></table>`,
        'Check yourself: checkout must never sell the last VIP pass twice, but the “about the artist” blurb changes daily. One database or two, and which owns which fields? (Two: SQL owns passes; documents own marketing copy; sync published times from SQL.)',
      ],
      scene: podium({ doc: true, look: { sql: { badge: { text: 'seats safe', tone: 'good' } }, doc: { badge: { text: 'pages flexible', tone: 'good' } } } }),
    },
  ],
};