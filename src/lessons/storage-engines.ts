import type { Entity, Flow, Lesson, Link, Scene } from '../types.ts';
import { card, cache, db, link, spread, stack, worker } from './helpers.ts';

const SENSORS = worker(0, 0, { label: 'ingest workers' });

type Engine = 'btree' | 'lsm';

function pipeline(
  engine: Engine,
  o: {
    extra?: Record<string, Entity>;
    flows?: Flow[];
    links?: Record<string, Link>;
    stackLayers?: number;
    look?: Partial<Record<'store' | 'mem' | 'levels', Partial<Entity>>>;
  } = {},
): Scene {
  const entities: Record<string, Entity> = {
    workers: SENSORS,
    ingest: db(18, 0, { label: 'ingest API', icon: 'server', sub: 'append only' }),
    ...(engine === 'btree'
      ? {
          store: db(38, 0, {
            label: 'PostgreSQL',
            sub: 'B-tree pages',
            icon: 'database',
            ...(o.look?.store ?? {}),
          }),
        }
      : {
          mem: cache(36, -17, { label: 'memtable', sub: 'sorted RAM buffer', ...(o.look?.mem ?? {}) }),
          levels: stack(36, 16, {
            label: 'SSTable levels',
            sub: 'L0 → L2',
            count: o.stackLayers ?? 4,
            ...(o.look?.levels ?? {}),
          }),
        }),
    ...o.extra,
  };

  const links: Record<string, Link> = {
    wi: link('workers', 'ingest', { arrow: true }),
    ...(engine === 'btree'
      ? { is: link('ingest', 'store', { arrow: true }) }
      : {
          im: link('ingest', 'mem', { arrow: true }),
          ml: link('mem', 'levels', { arrow: true }),
        }),
    ...o.links,
  };

  const routes = engine === 'btree' ? [['wi', 'is'] as string[]] : [['wi', 'im'] as string[]];

  const flows: Flow[] = o.flows ?? [...spread(routes, 3.2, { kind: 'write', bounce: true, returnKind: 'res' })];

  return { entities, links, flows };
}

export const storageEngines: Lesson = {
  id: 'storage-engines',
  title: 'Storage Engines',
  summary:
    'A fleet telemetry pipeline writes sensor events all day — see why B-tree pages hurt on append-only ingest, and how LSM trees trade compaction work for fast sequential writes.',
  minutes: 13,
  level: 'intermediate',
  metrics: [
    { id: 'ingest', label: 'write rate' },
    { id: 'wamp', label: 'write amplification' },
    { id: 'ramp', label: 'read amplification' },
  ],
  legend: ['write', 'res', ['slow', 'random I/O'], 'ping'],
  goals: [
    { text: 'Feel B-tree page splits on heavy inserts', step: 2 },
    { text: 'Batch writes through a memtable and SSTables', step: 5 },
    { text: 'Follow a read across memtable + levels', step: 6 },
    { text: 'See compaction rewrite data on disk', step: 7 },
    { text: 'Balance write vs read amplification', step: 9 },
  ],
  steps: [
    {
      short: 'Flood',
      chapter: 'setup',
      title: '50k events per second',
      body: [
        'FleetPulse ingests GPS and temperature readings from delivery vans — about <b>50k events per second</b>, 24 hours a day. Each event becomes one row: timestamp, vehicle ID, value. Dashboards read slowly; the pain is write volume.',
        'The team started on plain PostgreSQL. CPUs look fine on SELECTs, but disk queues spike and ingest lag climbs every rush hour.',
      ],
      metrics: { ingest: { v: '50k/s', tone: 'warn' }, wamp: '?', ramp: '?' },
      scene: pipeline('btree', { look: { store: { badge: { text: 'B-tree', tone: 'info' } } } }),
    },
    {
      short: 'Splits',
      chapter: 'problem',
      title: 'Case: B-tree pages keep splitting',
      body: [
        'PostgreSQL stores rows in <b>B-tree</b> pages (see the <i>indexes</i> lesson). Inserts land in sorted order by primary key, but secondary indexes and fill factors still force random page writes and splits. Every burst of inserts rewrites tree nodes scattered across disk.',
        'Throughput caps not because the CPU cannot parse JSON, but because each event may touch multiple 8 KB pages with seeking in between — <b>write amplification</b> hidden inside the engine.',
      ],
      callout: { kind: 'warning', text: 'Random in-place updates are what rotating disks and NVMe queues hate most; append-mostly workloads fight B-tree mechanics.' },
      changes: ['+ sustained append workload', '~ inserts update scattered pages'],
      metrics: { wamp: { v: '~15× bytes', tone: 'bad' }, ingest: { v: '12k/s cap', tone: 'bad' } },
      scene: pipeline('btree', {
        look: { store: { meter: { label: 'page writes', value: 0.9, tone: 'bad' }, badge: { text: 'splits', tone: 'bad' } } },
        links: { is: link('ingest', 'store', { label: 'INSERT row', labelTone: 'bad', arrow: true }) },
        // Acks crawl back: every insert waits on scattered page writes.
        flows: [{ route: ['wi', 'is'], kind: 'write', rate: 2.8, bounce: true, returnKind: 'slow', speed: 90 }],
      }),
    },
    {
      short: 'Pattern',
      chapter: 'insight',
      title: 'Append-only wants sequential I/O',
      body: [
        'FleetPulse rarely updates a row in place — it only appends. The access pattern wants <b>large sequential writes</b> and deferred sorting, not immediate global balance.',
        'Storage engines tuned for analytics and logs (RocksDB, Cassandra’s LSM, ClickHouse merges) share one idea: buffer in memory, flush immutable files, merge later.',
      ],
      changes: ['~ workload is insert-only', '+ sorting can happen asynchronously'],
      scene: pipeline('btree', {
        extra: { card: card(20, -20, 'Access pattern', ['writes   append-only', 'reads    ranges + aggregates', '# updates rare']) },
      }),
    },
    {
      short: 'Memtable',
      chapter: 'technique',
      title: 'LSM: sort in RAM first',
      body: [
        'An <b>LSM tree</b> (log-structured merge tree) accepts writes into a <b>memtable</b> — an in-memory sorted buffer. When it fills, it flushes to disk as an immutable <b>SSTable</b> file (sorted string table): append one big sequential file, no in-place edits.',
        'Old data stays in older files until a background <b>compaction</b> job merges them into deeper levels.',
      ],
      changes: ['+ writes land in memtable only', '~ engine switches from B-tree layout'],
      metrics: { ingest: { v: '48k/s', tone: 'good' } },
      scene: pipeline('lsm', { look: { mem: { badge: { text: 'sorted buffer', tone: 'good' } } } }),
    },
    {
      short: 'Flush',
      chapter: 'solution',
      title: 'Flush to level 0',
      body: [
        'When the memtable reaches a threshold — say 64 MB — the engine freezes it, writes a new SSTable to <b>level 0</b>, and starts a fresh memtable. Ingest workers see steady latency; only the flush pauses briefly.',
        'The stacked files in the diagram are those levels: newest at the bottom (L0), larger sorted runs higher up.',
      ],
      callout: { kind: 'insight', text: 'Writes become large sequential appends; sorting happens once in RAM before the flush.' },
      changes: ['+ memtable → L0 file', '~ disk sees big sequential writes'],
      metrics: { wamp: { v: '~2× bytes', tone: 'good' } },
      scene: pipeline('lsm', {
        stackLayers: 3,
        look: { levels: { badge: { text: 'L0 file', tone: 'good' } }, mem: { meter: { label: 'fill', value: 0.2, tone: 'good' } } },
        links: { im: link('ingest', 'mem', { label: 'append', labelTone: 'good', arrow: true }), ml: link('mem', 'levels', { label: 'flush', arrow: true }) },
        flows: [{ route: ['wi', 'im'], kind: 'write', rate: 3, bounce: true, returnKind: 'res' }],
      }),
    },
    {
      short: 'Read path',
      chapter: 'technique',
      title: 'Reads check every active file',
      body: [
        'A dashboard asks for “vehicle 42, last hour”. The engine checks the live memtable, then every SSTable that might overlap — newest to oldest — and merges the hits. Nothing is lost because keys only move through immutable files.',
        'That is <b>read amplification</b>: one logical query may touch several files and bloom filters. Usually acceptable when writes dominate and reads are batched.',
      ],
      changes: ['~ query scans memtable + files', '+ bloom filter may skip files'],
      metrics: { ramp: { v: '6 files', tone: 'warn' } },
      scene: pipeline('lsm', {
        stackLayers: 4,
        look: { levels: { meter: { label: 'files', value: 0.55, tone: 'warn' } } },
        links: { ml: link('mem', 'levels', { label: 'merge read', labelTone: 'info', arrow: 'both' }) },
        flows: [
          { route: ['wi', 'im'], kind: 'ping', rate: 0.8, bounce: true },
          { route: ['im', 'ml'], kind: 'ping', rate: 0.8, bounce: true },
        ],
      }),
    },
    {
      short: 'Compact',
      chapter: 'solution',
      title: 'Compaction rewrites data',
      body: [
        'If L0 sprouted a dozen tiny files, reads would slow down forever. A <b>compaction</b> job picks overlapping files, merges them into a larger L1 file, and deletes the inputs. Deskew happens offline while ingestion continues into a fresh memtable.',
        'Compaction is extra disk bandwidth — write amplification returning as housekeeping. Tuners trade compaction aggressiveness vs read speed.',
      ],
      changes: ['+ background merge job', '~ same keys rewritten into deeper level'],
      metrics: { wamp: { v: '~5× bytes', tone: 'warn' }, ramp: { v: '2 files', tone: 'good' } },
      scene: pipeline('lsm', {
        stackLayers: 4,
        look: { levels: { badge: { text: 'compacting', tone: 'info' } } },
        extra: { card: card(10, -22, 'Compaction', ['pick L0 files', 'merge sort keys', '! delete inputs']) },
        flows: [{ route: ['im', 'ml'], kind: 'write', rate: 0.6, bounce: true }],
      }),
    },
    {
      short: 'Trade-off',
      chapter: 'tradeoff',
      title: 'Amplification on both sides',
      body: [
        'B-trees pay write amplification up front on every insert; LSM defers it to compaction. B-tree reads touch one well-organized tree; LSM reads may fan out across files unless compaction keeps levels tidy.',
        'Neither is “faster” — they match different workloads. FleetPulse chose LSM because ingest was 100× heavier than ad-hoc reads.',
      ],
      changes: ['~ write amp moves to compaction window', '~ read amp tied to file count'],
      metrics: { ingest: { v: '50k/s', tone: 'good' }, wamp: { v: '5× (async)', tone: 'warn' }, ramp: { v: '2–6 files', tone: 'warn' } },
      scene: pipeline('lsm', {
        stackLayers: 4,
        look: { mem: { badge: { text: 'hot writes', tone: 'good' } }, levels: { badge: { text: 'cold files', tone: 'info' } } },
      }),
    },
    {
      short: 'Choose',
      chapter: 'insight',
      title: 'Pick the engine to the pattern',
      body: [
        'Lean B-tree when you need strong single-row consistency, many secondary indexes, and mixed read/write on the same rows — classic OLTP. Lean LSM when you ingest streams, tolerate eventual compaction lag, and can batch reads.',
        'Some databases hide both (MySQL InnoDB B-tree, Cassandra LSM). The lesson is to notice which one you are standing on when tuning disk or buying hardware.',
      ],
      scene: {
        entities: {
          card: card(20, 0, 'Engine fit', [
            'B-tree    OLTP · many indexes',
            'LSM       logs · metrics · MV',
            '# same DB, different table engines possible',
          ]),
        },
        links: {},
        flows: [],
      },
    },
    {
      short: 'Recap',
      chapter: 'recap',
      title: 'Recap',
      body: [
        'FleetPulse’s storage choices:',
        `<table class="compare"><thead><tr><th>engine</th><th>writes</th><th>reads</th><th>cost later</th><th>see</th></tr></thead><tbody>
          <tr><td>B-tree</td><td>in-place pages</td><td class="good">few touches</td><td>page splits</td><td>indexes</td></tr>
          <tr><td>LSM</td><td class="good">sequential flush</td><td>many files</td><td>compaction</td><td>this lesson</td></tr></tbody></table>`,
        'Check yourself: you append sensor readings but occasionally rewrite the latest value per vehicle ID. Pure append LSM or update-friendly B-tree? (Updates per key fight pure append; consider B-tree, or LSM with upserts and careful compaction — know your overwrite pattern.)',
      ],
      scene: pipeline('lsm', { stackLayers: 4, look: { levels: { badge: { text: 'compacted', tone: 'good' } } } }),
    },
  ],
};