import type { Entity, Flow, Lesson, Link, Scene } from '../types.ts';
import { card, db, link, server, spread, users } from './helpers.ts';

const READERS = users(0, 0, { label: 'readers' });

function shelf(o: {
  leader?: Partial<Entity>;
  replica?: Partial<Entity>;
  standby?: Partial<Entity>;
  leaderDown?: boolean;
  promoteReplica?: boolean;
  extra?: Record<string, Entity>;
  links?: Record<string, Link>;
  flows?: Flow[];
  sync?: boolean;
} = {}): Scene {
  const leaderDown = o.leaderDown ?? false;
  const promoted = o.promoteReplica ?? false;

  const entities: Record<string, Entity> = {
    readers: READERS,
    app: server(18, 0, { label: 'API fleet', icon: 'server', sub: '3 instances' }),
    leader: db(38, -12, {
      label: 'primary',
      sub: 'writes only',
      icon: 'database',
      badge: leaderDown ? { text: 'DOWN', tone: 'bad' } : { text: 'leader', tone: 'good' },
      down: leaderDown,
      ...(o.leader ?? {}),
    }),
    replica: db(38, 14, {
      label: 'read replica',
      sub: promoted ? 'promoted' : 'async follower',
      icon: 'database',
      badge: promoted ? { text: 'new leader', tone: 'warn' } : { text: 'replica', tone: 'info' },
      ...(o.replica ?? {}),
    }),
    ...(o.standby && {
      standby: db(50, 0, {
        label: 'standby',
        sub: 'other AZ',
        ghost: true,
        ...(o.standby ?? {}),
      }),
    }),
    ...o.extra,
  };

  const links: Record<string, Link> = {
    ra: link('readers', 'app', { arrow: true }),
    wl: link('app', 'leader', { arrow: true, ...(leaderDown && { dashed: true }) }),
    rr: link('app', 'replica', { arrow: true }),
    lr: link('leader', 'replica', {
      arrow: true,
      dashed: !o.sync,
      label: o.sync ? 'sync repl' : 'WAL stream',
      labelTone: o.sync ? 'good' : 'warn',
      ...(leaderDown && { dashed: true }),
    }),
    ...(o.standby && { ls: link('leader', 'standby', { dashed: true, curve: 0.15, label: 'standby' }) }),
    ...o.links,
  };

  const flows: Flow[] = o.flows ?? [
    ...spread([['ra', 'rr']], 2.8, { bounce: true }),
    ...spread([['ra', 'wl']], 1.1, { kind: 'write', bounce: true, returnKind: 'res' }),
    ...(leaderDown ? [] : [{ route: ['lr'], kind: 'write' as const, rate: 0.9 }]),
  ];

  return { entities, links, flows };
}

export const replication: Lesson = {
  id: 'replication',
  title: 'Replication',
  summary:
    'A bookmarking app outgrows one Postgres — add read replicas, accept replication lag, and rehearse failover without inventing a second writer.',
  minutes: 12,
  level: 'intermediate',
  metrics: [
    { id: 'lag', label: 'replication lag' },
    { id: 'reads', label: 'reads routed' },
    { id: 'failover', label: 'leader lost →' },
  ],
  legend: ['req', 'res', 'write', ['slow', 'stale read']],
  goals: [
    { text: 'Send writes to one leader and reads elsewhere', step: 3 },
    { text: 'See stale data when replication lags', step: 5 },
    { text: 'Compare async vs synchronous replication', step: 6 },
    { text: 'Promote a replica when the leader dies', step: 7 },
    { text: 'Know what RPO and RTO mean in practice', step: 9 },
  ],
  steps: [
    {
      short: 'Hot reads',
      chapter: 'setup',
      title: 'The feed is melting the database',
      body: [
        'Shelfmark lets people save articles and scroll an infinite feed. **Millions of readers**, fewer writers — but every scroll hammers the same Postgres with <code>SELECT</code>s while a trickle of inserts updates timelines.',
        'CPU is fine on writes; **read I/O pegs at 100%**. Indexes from the last lesson help single lookups, yet listing a feed still reads thousands of rows per request.',
      ],
      metrics: { lag: '—', reads: { v: '100% primary', tone: 'bad' }, failover: '?' },
      scene: shelf({ leader: { meter: { label: 'read I/O', value: 0.95, tone: 'bad' } } }),
    },
    {
      short: 'Replica',
      chapter: 'technique',
      title: 'Add a read replica',
      body: [
        'The fix everyone tries first: keep the **primary** for writes, add a **replica** that continuously copies data and serves read-only queries. No second source of truth yet — just a warm copy on another machine.',
        'The API fleet must learn two connection strings: <code>PRIMARY</code> for mutations, <code>REPLICA</code> for feeds and search.',
      ],
      changes: ['+ second Postgres instance', '~ reads can target replica'],
      metrics: { reads: { v: '70% replica', tone: 'good' } },
      scene: shelf({
        replica: { badge: { text: 'read-only', tone: 'info' } },
        links: { rr: link('app', 'replica', { label: 'SELECT feed', labelTone: 'good', arrow: true }) },
      }),
    },
    {
      short: 'Leader',
      chapter: 'solution',
      title: 'One leader for writes',
      body: [
        'Only the **leader** accepts <code>INSERT</code>, <code>UPDATE</code>, <code>DELETE</code>. Replicas apply the same changes in order via the write-ahead log — they never originate mutations, or you risk two divergent histories.',
        'Shelfmark’s app servers share one routing rule: mutations go to `leader`; everything else can hit `replica` until consistency matters.',
      ],
      callout: { kind: 'insight', text: 'Replication copies an existing leader. It does not replace a consensus protocol when two nodes could both accept writes.' },
      changes: ['~ writes pinned to leader', '~ replica applies log in order'],
      metrics: { reads: { v: '80% replica', tone: 'good' } },
      scene: shelf({
        links: {
          wl: link('app', 'leader', { label: 'writes', labelTone: 'good', arrow: true }),
          rr: link('app', 'replica', { label: 'reads', labelTone: 'good', arrow: true }),
        },
      }),
    },
    {
      short: 'Async',
      chapter: 'technique',
      title: 'Asynchronous replication',
      body: [
        'By default replication is **asynchronous**: the leader acknowledges a save before the WAL ships to the replica. Shelfmark’s p95 **replication lag** is about 200 ms — usually invisible on a feed, sometimes not.',
        'That lag is the window where the replica is behind. Writes succeed fast; readers on the replica might see yesterday’s bookmark count.',
      ],
      changes: ['+ async WAL shipping', '~ leader does not wait for replica fsync'],
      metrics: { lag: { v: '~200 ms', tone: 'warn' } },
      scene: shelf({ replica: { meter: { label: 'lag', value: 0.35, tone: 'warn' } } }),
    },
    {
      short: 'Stale',
      chapter: 'problem',
      title: 'Case: saved, but the feed still looks empty',
      body: [
        'A user taps “Save” and gets a 201 from the leader. They pull to refresh; the feed API reads the replica and the new row has not arrived yet. For two hundred milliseconds the UI looks broken.',
        'This is a **stale read**. Fixes: read-your-writes routing (stick that user to primary briefly), or synchronous replication for critical paths, or show optimistic UI until the replica catches up.',
      ],
      callout: { kind: 'warning', text: 'If clients read from replicas, you must decide what to do during lag — ignore it, mask it, or pay for sync.' },
      changes: ['~ user refreshes during lag window', '~ replica missing freshest row'],
      metrics: { lag: { v: '200 ms', tone: 'bad' } },
      scene: shelf({
        flows: [
          { route: ['ra', 'wl'], kind: 'write', rate: 1.2, bounce: true, returnKind: 'res' },
          { route: ['ra', 'rr'], kind: 'slow', rate: 1.1, bounce: true },
        ],
        replica: { badge: { text: 'behind', tone: 'bad' } },
      }),
    },
    {
      short: 'Sync',
      chapter: 'tradeoff',
      title: 'Synchronous replication',
      body: [
        'For “money” rows, Shelfmark enables **synchronous** replication: the leader waits until at least one replica acknowledges before confirming the write. Lag drops near zero; write latency rises because every save pays for a round trip.',
        'You choose per transaction or cluster-wide — most teams async by default, sync only where stale reads are unacceptable.',
      ],
      changes: ['~ leader waits for replica ack', '~ write p95 +3 ms (illustrative)'],
      metrics: { lag: { v: '~0 ms', tone: 'good' } },
      scene: shelf({
        sync: true,
        replica: { badge: { text: 'caught up', tone: 'good' } },
        leader: { meter: { label: 'write wait', value: 0.45, tone: 'warn' } },
      }),
    },
    {
      short: 'Failover',
      chapter: 'problem',
      title: 'Case: primary disk dies',
      body: [
        'A cloud AZ loses power. The **leader** stops answering. Inserts fail until someone **promotes** the replica: stop applying as follower, accept writes, reconfigure DNS or service discovery so apps find the new leader.',
        'Automation (Patroni, RDS failover) does this in minutes; manual runbooks take longer. The last WAL seconds on the old leader may be **lost** if replication was async — your **RPO**.',
      ],
      changes: ['+ leader marked down', '~ replica elevated to writer'],
      metrics: { failover: { v: 'promote replica', tone: 'warn' }, lag: '?' },
      scene: shelf({
        leaderDown: true,
        promoteReplica: true,
        flows: [{ route: ['ra', 'wl'], kind: 'fail', rate: 0.8 }, { route: ['ra', 'rr'], kind: 'write', rate: 1.4, bounce: true, returnKind: 'res' }],
        links: {
          wl: link('app', 'leader', { label: 'timeout', labelTone: 'bad', arrow: true }),
          rr: link('app', 'replica', { label: 'writes now', labelTone: 'warn', arrow: true }),
        },
      }),
    },
    {
      short: 'Split',
      chapter: 'insight',
      title: 'Avoid two leaders',
      body: [
        'The scary failure is **split brain**: two nodes both believe they are primary and accept writes. Data diverges and merging is painful. Runbooks use STONITH (fence the old leader), consensus (Raft — see <i>Consensus</i>), or cloud APIs that guarantee only one writable endpoint.',
        'Replicas are copies, not voters. Promotion must be a deliberate, coordinated step.',
      ],
      changes: ['~ runbook enforces single writer'],
      scene: shelf({
        extra: {
          card: card(18, -22, 'Failover rules', [
            'one writable leader',
            'fence old node',
            '! never two primaries',
          ]),
        },
        leaderDown: true,
        promoteReplica: true,
      }),
    },
    {
      short: 'RPO/RTO',
      chapter: 'insight',
      title: 'Measure recovery in time and data',
      body: [
        '**RPO** (recovery point objective): how much data you can lose — the WAL not replicated before crash. Async might be seconds; sync might be zero.',
        '**RTO** (recovery time objective): how long until service is back. A hot replica in the same region is minutes; restoring a backup tape is hours. Shelfmark keeps a **standby** in another AZ with replication for DR drills.',
      ],
      changes: ['+ standby in second AZ', '~ DR measured as RPO / RTO'],
      metrics: { failover: { v: 'RTO ~3 min', tone: 'good' } },
      scene: shelf({
        standby: { badge: { text: 'DR copy', tone: 'info' } },
        links: { ls: link('leader', 'standby', { dashed: true, label: 'async DR', labelTone: 'info' }) },
      }),
    },
    {
      short: 'Recap',
      chapter: 'recap',
      title: 'Recap',
      body: [
        'Shelfmark’s replication cheat sheet:',
        `<table class="compare"><thead><tr><th>goal</th><th>pattern</th><th>cost</th><th>see</th></tr></thead><tbody>
          <tr><td>scale reads</td><td class="good">read replicas</td><td>staleness</td><td>this lesson</td></tr>
          <tr><td>no stale reads</td><td>sync replication</td><td>slower writes</td><td>this lesson</td></tr>
          <tr><td>survive AZ loss</td><td>promote + standby</td><td>RPO / RTO</td><td>redundancy</td></tr>
          <tr><td>split data</td><td>sharding</td><td>ops complexity</td><td>sharding</td></tr></tbody></table>`,
        'Check yourself: feeds can be 200 ms stale; account balance cannot. Same replica pool or route balance queries to sync standby? (Route balances to leader or sync replica; feeds stay on async replica.)',
      ],
      scene: shelf({ replica: { badge: { text: 'read scale', tone: 'good' } }, leader: { badge: { text: 'write path', tone: 'good' } } }),
    },
  ],
};