import type { Entity, Flow, Lesson, Link, Scene } from '../types.ts';
import { card, db, link, server, spread, users } from './helpers.ts';

const READERS = users(0, 0, { label: 'readers', sub: '2M/day', count: 3 });

function shelf(o: {
  withReplica?: boolean;
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
  const withReplica = o.withReplica ?? true;
  const leaderDown = o.leaderDown ?? false;
  const promoted = o.promoteReplica ?? false;

  const entities: Record<string, Entity> = {
    readers: READERS,
    app: server(18, 0, { label: 'API fleet', icon: 'server', sub: '3 instances' }),
    leader: db(38, -12, {
      label: 'leader',
      sub: leaderDown ? 'unreachable' : 'writes',
      icon: 'database',
      ...(leaderDown ? { badge: { text: 'DOWN', tone: 'bad' as const } } : {}),
      down: leaderDown,
      ...(o.leader ?? {}),
    }),
    ...o.extra,
  };

  if (withReplica) {
    entities.replica = db(38, 14, {
      label: promoted ? 'leader' : 'follower',
      sub: promoted ? 'promoted' : 'read-only',
      icon: 'database',
      badge: promoted ? { text: 'new leader', tone: 'warn' } : { text: 'follower', tone: 'info' },
      ...(o.replica ?? {}),
    });
  }

  if (o.standby) {
    entities.standby = db(50, 0, {
      label: 'standby',
      sub: 'other AZ',
      ghost: true,
      ...(o.standby ?? {}),
    });
  }

  const links: Record<string, Link> = {
    ra: link('readers', 'app', { arrow: true }),
    wl: link('app', 'leader', { arrow: true, ...(leaderDown && { dashed: true }) }),
    ...(withReplica && { rr: link('app', 'replica', { arrow: true }) }),
    ...(withReplica && {
      lr: link('leader', 'replica', {
        arrow: true,
        dashed: !o.sync,
        label: o.sync ? 'sync repl' : 'WAL stream',
        labelTone: o.sync ? 'good' : 'warn',
        ...(leaderDown && { dashed: true }),
      }),
    }),
    ...(o.standby && { ls: link('leader', 'standby', { dashed: true, curve: 0.15, label: 'standby' }) }),
    ...o.links,
  };

  const defaultFlows: Flow[] = withReplica
    ? [
        ...spread([['ra', 'rr']], 2.4, { bounce: true }),
        ...spread([['ra', 'wl']], 1.0, { kind: 'write', bounce: true, returnKind: 'res' }),
        ...(leaderDown ? [] : [{ route: ['lr'], kind: 'write' as const, rate: 0.8 }]),
      ]
    : [...spread([['ra', 'wl']], 3.2, { bounce: true }), { route: ['ra', 'wl'], kind: 'write', rate: 0.9, bounce: true, returnKind: 'res' }];

  const flows: Flow[] = o.flows ?? defaultFlows;

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
    { id: 'reads', label: 'reads on primary' },
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
      short: 'One DB',
      chapter: 'problem',
      title: 'One database, every scroll',
      body: [
        'Shelfmark serves millions of feed scrolls per day. Almost all traffic is <code>SELECT</code>; saves and unfollows are a thin trickle. Yet every scroll still hits the same Postgres — there is nowhere else to go.',
        'Write CPU stays comfortable; <b>read I/O is saturated</b>. The on-call page is not “writes failing” — it is “disk cannot keep up with reads”.',
      ],
      callout: { kind: 'insight', text: 'Most products read far more than they write. One machine doing both roles hits a read ceiling long before write CPU.' },
      metrics: { lag: '—', reads: { v: '100%', tone: 'bad' }, failover: '?' },
      scene: shelf({
        withReplica: false,
        leader: {
          label: 'Postgres',
          sub: 'solo copy',
          meter: { label: 'read I/O', value: 0.98, tone: 'bad' },
        },
        links: { wl: link('app', 'leader', { label: 'all traffic', labelTone: 'bad', arrow: true }) },
        extra: {
          card: card(18, -22, 'On-call', ['! read I/O 100%', '✓ write latency OK', '# single Postgres']),
        },
      }),
    },
    {
      short: 'Replica',
      chapter: 'technique',
      title: 'Add a follower copy',
      body: [
        'The first scaling move: keep the <b>leader</b> for writes, add a <b>follower</b> (Postgres calls it a read replica) that tails the WAL and answers read-only queries. Shelfmark routes feed and search to the follower.',
        'The API fleet needs two pools: leader endpoint for mutations, follower endpoint for read-mostly traffic.',
      ],
      predict: {
        question: 'You move ~70% of reads to a new replica. What should happen to read I/O on the primary?',
        options: ['Stays pegged at 100%', 'Drops sharply', 'Doubles — replication counts as reads', 'Hits zero — primary idles'],
        answer: 1,
        explain: 'Offloaded SELECTs no longer touch the primary disk. Replication stream is sequential WAL, not the same as millions of random feed queries.',
      },
      changes: ['+ follower (warm copy)', '~ feeds can hit follower'],
      metrics: { reads: { v: '~30%', tone: 'good' } },
      scene: shelf({
        leader: { meter: { label: 'read I/O', value: 0.55, tone: 'warn' }, sub: 'writes' },
        links: {
          rr: link('app', 'replica', { label: 'SELECT feed', labelTone: 'good', arrow: true }),
          wl: link('app', 'leader', { label: 'writes', labelTone: 'good', arrow: true }),
          lr: link('leader', 'replica', { label: 'WAL', labelTone: 'info', arrow: true, dashed: true }),
        },
      }),
    },
    {
      short: 'Routing',
      chapter: 'solution',
      title: 'Reads to followers, writes to leader',
      body: [
        'Now the app sends <b>reads to followers</b> and <b>writes only to the leader</b>. The leader’s read I/O cools down; the follower takes the scroll traffic. Need more read capacity? Add another follower — each one is another read-only copy.',
        'Followers apply the leader’s WAL in order. They never accept mutations, or histories diverge. This shines on read-heavy apps; write-heavy ones still bottleneck on one leader.',
      ],
      callout: { kind: 'insight', text: 'Replication copies an existing leader. It does not replace consensus when two nodes could both accept writes.' },
      chaos: {
        leader: {
          text: 'Writes fail immediately — there is no other writable node. Reads on the replica still work, but they freeze at the last replicated byte. Shelfmark cannot save new bookmarks until failover.',
          metrics: { reads: { v: 'follower only', tone: 'warn' }, failover: { v: 'writes fail', tone: 'bad' } },
        },
        replica: {
          text: 'Reads fail for feed and search, but the leader still accepts saves. Traffic piles back onto the leader — read I/O climbs again until you restore a follower.',
          metrics: { reads: { v: '100% leader', tone: 'bad' } },
        },
      },
      changes: ['~ reads → followers', '~ writes → leader only', '~ leader read I/O 98% → 30%'],
      metrics: { reads: { v: '~20%', tone: 'good' } },
      scene: shelf({
        leader: { meter: { label: 'read I/O', value: 0.3, tone: 'good' }, sub: 'writes only' },
        replica: { sub: 'reads', meter: { label: 'read I/O', value: 0.72, tone: 'warn' } },
        links: {
          wl: link('app', 'leader', { label: 'writes', labelTone: 'good', arrow: true }),
          rr: link('app', 'replica', { label: 'reads', labelTone: 'good', arrow: true }),
          lr: link('leader', 'replica', { label: 'replication log', labelTone: 'warn', arrow: true, dashed: true }),
        },
      }),
    },
    {
      short: 'Async',
      chapter: 'technique',
      title: 'Asynchronous replication',
      body: [
        'Default replication is <b>asynchronous</b>: the leader acknowledges a save before the WAL ships to the follower. Shelfmark’s p95 <b>replication lag</b> is about 200 ms — invisible on a lazy feed, visible right after “Save”.',
        'That lag is the window where the follower is behind. Writes stay fast; readers on the follower might see an older timeline.',
      ],
      changes: ['+ async WAL shipping', '~ leader does not wait for follower fsync'],
      metrics: { lag: { v: '~200 ms', tone: 'warn' } },
      scene: shelf({
        replica: { meter: { label: 'lag', value: 0.35, tone: 'warn' } },
        flows: [
          ...spread([['ra', 'rr']], 2.0, { bounce: true }),
          ...spread([['ra', 'wl']], 1.0, { kind: 'write', bounce: true, returnKind: 'res' }),
          { route: ['lr'], kind: 'write', rate: 0.7 },
        ],
      }),
    },
    {
      short: 'Stale',
      chapter: 'problem',
      title: 'Case: saved, but the feed still looks empty',
      body: [
        'A user taps “Save” and gets <code>201 Created</code> from the leader. They pull to refresh; the feed API reads a follower and the row is not there yet. For ~200 ms the UI looks broken.',
        'That is a <b>stale read</b>. Mitigations: read-your-writes routing (stick that user to primary briefly), sync replication for money rows, or optimistic UI until the replica catches up.',
      ],
      callout: { kind: 'warning', text: 'If clients read from followers, you must decide what to do during lag — ignore it, mask it, or pay for sync.' },
      changes: ['~ refresh hits follower during lag', '~ newest row not visible yet'],
      metrics: { lag: { v: '200 ms', tone: 'bad' } },
      scene: shelf({
        flows: [
          { route: ['ra', 'wl'], kind: 'write', rate: 1.0, bounce: true, returnKind: 'res' },
          { route: ['ra', 'rr'], kind: 'slow', rate: 1.0, bounce: true },
        ],
        replica: { badge: { text: 'behind', tone: 'bad' } },
        links: { rr: link('app', 'replica', { label: 'stale feed', labelTone: 'bad', arrow: true }) },
      }),
    },
    {
      short: 'Sync',
      chapter: 'tradeoff',
      title: 'Synchronous replication',
      body: [
        'For balance and billing rows, Shelfmark enables <b>synchronous</b> replication: the leader waits until at least one follower acknowledges before confirming the write. Lag nears zero; every commit pays for a round trip.',
        'Most teams stay async by default and enable sync only where stale reads are unacceptable.',
      ],
      predict: {
        question: 'You switch critical writes to synchronous replication. Which number usually rises first?',
        options: ['Read I/O on the primary', 'Replication lag', 'Write latency (p95)', 'Feed hit rate'],
        answer: 2,
        explain: 'The leader must wait for the replica before replying. Reads and lag improve; commits get slower — that is the trade you are buying.',
      },
      changes: ['~ leader waits for follower ack', '~ write p95 +3 ms (illustrative)'],
      metrics: { lag: { v: '~0 ms', tone: 'good' } },
      scene: shelf({
        sync: true,
        replica: { badge: { text: 'caught up', tone: 'good' } },
        leader: { meter: { label: 'write wait', value: 0.45, tone: 'warn' } },
        links: { lr: link('leader', 'replica', { label: 'sync repl', labelTone: 'good', arrow: true }) },
      }),
    },
    {
      short: 'Failover',
      chapter: 'problem',
      title: 'Case: primary disk dies',
      body: [
        'An AZ loses power. The <b>leader</b> stops answering. Inserts fail until ops <b>promotes</b> a follower: stop read-only mode, accept writes, point apps at the new leader.',
        'Automation (Patroni, RDS failover) does this in minutes; manual runbooks take longer. WAL not yet shipped may be <b>lost</b> with async replication — your <b>RPO</b>.',
      ],
      changes: ['+ leader marked down', '~ follower promoted to leader'],
      metrics: { failover: { v: 'promote replica', tone: 'warn' }, lag: '?' },
      scene: shelf({
        leaderDown: true,
        promoteReplica: true,
        flows: [
          { route: ['ra', 'wl'], kind: 'fail', rate: 0.7 },
          { route: ['ra', 'rr'], kind: 'write', rate: 1.2, bounce: true, returnKind: 'res' },
        ],
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
        'The nightmare is <b>split brain</b>: two nodes both believe they are primary and accept writes. Data diverges; merging is painful. Runbooks use fencing (STONITH), consensus (Raft — see <i>Consensus</i>), or cloud APIs that enforce one writable endpoint.',
        'Followers are copies, not voters. Promotion must be deliberate and coordinated.',
      ],
      changes: ['~ runbook: exactly one writer'],
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
        '<b>RPO</b> (recovery point objective): how much data you can lose — WAL not replicated before crash. Async might be seconds; sync might be zero.',
        '<b>RTO</b> (recovery time objective): how long until service is back. A hot replica in-region is minutes; restoring cold backup is hours. Shelfmark keeps a <b>standby</b> in another AZ for DR drills.',
      ],
      changes: ['+ standby in second AZ', '~ DR targets: RPO / RTO'],
      metrics: { failover: { v: 'RTO ~3 min', tone: 'good' } },
      scene: shelf({
        standby: { badge: { text: 'DR copy', tone: 'info' } },
        links: { ls: link('leader', 'standby', { dashed: true, label: 'async DR', labelTone: 'info' }) },
        leader: { meter: { label: 'read I/O', value: 0.25, tone: 'good' } },
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
      scene: shelf({
        leader: { sub: 'writes', badge: { text: 'write path', tone: 'good' }, meter: { label: 'read I/O', value: 0.2, tone: 'good' } },
        replica: { label: 'follower', badge: { text: 'read scale', tone: 'good' } },
        links: {
          wl: link('app', 'leader', { label: 'writes', labelTone: 'good', arrow: true }),
          rr: link('app', 'replica', { label: 'reads', labelTone: 'good', arrow: true }),
        },
      }),
    },
  ],
};