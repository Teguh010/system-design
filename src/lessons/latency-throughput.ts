import type { Entity, Flow, Lesson, Link, Scene } from '../types.ts';
import { card, db, lb, link, queue, server, service, spread, users } from './helpers.ts';

const FANS = users(0, 0, { label: 'fans' });
const API = server(20, 0, { label: 'ticket API', sub: '1 worker' });
const LINE = queue(10, 0, { label: 'waiting line' });

const single = (extra: Record<string, Entity> = {}): Scene => ({
  entities: { fans: FANS, api: API, ...extra },
  links: { fa: link('fans', 'api') },
  flows: [{ route: ['fa'], rate: 2, bounce: true }],
});

const WORKERS = { api2: -21, api: -7, api3: 7, api4: 21 } as const;
const workerIds = Object.keys(WORKERS) as (keyof typeof WORKERS)[];

function fleet(opts: { extra?: Record<string, Entity>; links?: Record<string, Link>; flows?: Flow[]; slowShare?: number } = {}): Scene {
  const entities: Record<string, Entity> = { fans: FANS, lb: lb(10, 0, { label: 'load balancer' }), ...opts.extra };
  const links: Record<string, Link> = { fl: link('fans', 'lb'), ...opts.links };
  workerIds.forEach((id, i) => {
    entities[id] = server(20, WORKERS[id], { label: `worker ${i + 1}` });
    links[`l${id}`] = link('lb', id);
  });
  const routes = workerIds.map((id) => ['fl', `l${id}`]);
  const flows: Flow[] = [...spread(routes, 3, { bounce: true })];
  if (opts.slowShare) flows.push(...spread(routes, opts.slowShare, { kind: 'slow', bounce: true, speed: 40 }));
  flows.push(...(opts.flows ?? []));
  return { entities, links, flows };
}

// Laid out on an arc so labels and badges don't collide.
const BACKENDS = [
  ['seats', 30, -34],
  ['pricing', 36, -17],
  ['profile', 38, 0],
  ['payment', 36, 17],
  ['fraud', 30, 34],
] as const;

export const latencyThroughput: Lesson = {
  id: 'latency-throughput',
  title: 'Latency & Throughput',
  summary: 'Two numbers that describe every system under load — and why a busy server gets slow long before it is “full”.',
  minutes: 13,
  level: 'beginner',
  metrics: [
    { id: 'latency', label: 'latency' },
    { id: 'throughput', label: 'throughput' },
    { id: 'load', label: 'utilisation' },
    { id: 'inflight', label: 'in flight' },
  ],
  legend: ['req', 'res', ['slow', 'slow / queued'], ['write', 'batched write'], ['fail', 'timed out']],
  goals: [
    { text: 'Tell latency and throughput apart', step: 1 },
    { text: 'Compute capacity and work in flight (Little’s Law)', step: 2 },
    { text: 'Explain why latency explodes near full utilisation', step: 4 },
    { text: 'Read percentiles instead of averages', step: 7 },
    { text: 'Reason about fan-out and batching', step: 8 },
  ],
  steps: [
    {
      short: 'Two numbers',
      chapter: 'setup',
      title: 'Two different numbers',
      body: [
        'Concert tickets go on sale at 10:00 and thousands of fans hit the ticket API at once. Two numbers describe how it copes. <b>Latency</b> is how long one fan waits for an answer. <b>Throughput</b> is how many answers the system produces per second.',
        'Think of a motorway: latency is how long your journey takes; throughput is how many cars pass a bridge per hour. A road can carry lots of cars and still be slow, or be empty and fast.',
      ],
      callout: { kind: 'insight', text: 'Improving one does not automatically improve the other. Always ask which of the two a problem is about.' },
      metrics: { latency: '?', throughput: '?', load: '?', inflight: '?' },
      scene: single({ card: card(20, -16, 'Two questions', ['latency     how long does one take?', 'throughput  how many per second?', '# related, but not the same']) }),
    },
    {
      short: 'Capacity',
      chapter: 'technique',
      title: 'The capacity of one worker',
      body: [
        'Say each request needs 50 ms of CPU time and the API handles one request at a time. That worker can finish at most 1000 ÷ 50 = <b>20 requests a second</b>, no matter how fast requests arrive.',
        'That ceiling is its <b>capacity</b>. At 10 requests a second the worker is busy half the time, and a request takes about 50 ms plus network time. What happens as arrivals approach the ceiling is the interesting part.',
      ],
      metrics: { latency: '50 ms', throughput: '10/s (max 20)', load: '50%' },
      scene: single({ card: card(20, -16, 'One worker', ['work per request   50 ms', 'capacity           1000 / 50 = 20/s', 'arriving           10/s → 50% busy']) }),
    },
    {
      short: 'In flight',
      chapter: 'insight',
      title: 'Little’s Law: work in flight',
      body: [
        'One simple rule ties the numbers together: <b>items in the system = arrival rate × time each spends there</b>, written L = λ × W. Ten requests a second that each take 0.05 s means that, on average, half a request is in progress.',
        'It holds for anything — threads, database connections, shoppers in a store. If 2,000 requests a second each take 0.2 s, you need room for 400 at once. Use it to size thread pools, connection pools and concurrency limits.',
      ],
      metrics: { inflight: '0.5' },
      scene: single({ card: card(20, -16, 'L = λ × W', ['10/s   × 0.05 s  = 0.5 in flight', '2000/s × 0.2 s   = 400 in flight', '# size pools with this']) }),
    },
    {
      short: 'Overload',
      chapter: 'problem',
      title: 'Demand passes capacity',
      body: [
        'At 10:00 sharp, 30 requests a second arrive at a worker that can finish 20. Every second ten more join the line than leave it. The line grows without limit, and so does the wait: after one minute a new request queues behind 600 others — 30 seconds. Many fans give up and their requests time out.',
        'Nothing is broken; the server is running at full speed. The system is <b>overloaded</b>, and in an overload latency is set by the queue, not by the work.',
      ],
      callout: { kind: 'warning', text: 'Throughput can’t go above capacity. Anything extra turns into waiting.' },
      metrics: {
        latency: { v: '30 s and rising', tone: 'bad' },
        throughput: { v: '20/s (max)', tone: 'warn' },
        load: { v: '150%', tone: 'bad' },
        inflight: { v: '600+', tone: 'bad' },
      },
      scene: {
        entities: { fans: FANS, line: { ...LINE, badge: { text: 'growing', tone: 'bad' } }, api: { ...API, badge: { text: '100% busy', tone: 'warn' } } },
        links: { fq: link('fans', 'line'), qa: link('line', 'api') },
        flows: [
          { route: ['fq', 'qa'], kind: 'slow', rate: 2.4, bounce: true, speed: 45 },
          { route: ['fq'], rate: 2.2, fail: 0.6 },
        ],
      },
    },
    {
      short: 'The knee',
      chapter: 'insight',
      title: 'The knee of the curve',
      body: [
        'Trouble starts well before 100%. Requests don’t arrive evenly; they come in clumps. With random arrivals, the average time spent waiting in line grows like <b>ρ ÷ (1 − ρ)</b> service times, where ρ is utilisation.',
        'At 50% busy you wait about one extra service time. At 80%, four. At 90%, nine. At 95%, nineteen. The curve is flat, then shoots up — the “knee”. That is why teams plan to run at around 60–70% at peak, not 95%.',
      ],
      callout: { kind: 'tip', text: 'Headroom isn’t waste. It is what keeps latency flat when traffic bunches up.' },
      metrics: { latency: { v: '~500 ms', tone: 'warn' }, throughput: '18/s', load: { v: '90%', tone: 'warn' }, inflight: '9' },
      scene: {
        entities: {
          fans: FANS,
          line: LINE,
          api: { ...API, badge: { text: '90% busy', tone: 'warn' } },
          card: card(20, -24, 'Wait vs. busy', ['busy  extra wait', '50%    1 × work', '80%    4 × work', '90%    9 × work', '! 95%   19 × work']),
        },
        links: { fq: link('fans', 'line'), qa: link('line', 'api') },
        flows: [
          { route: ['fq', 'qa'], rate: 1.6, bounce: true },
          { route: ['fq', 'qa'], kind: 'slow', rate: 0.8, bounce: true, speed: 55 },
        ],
      },
    },
    {
      short: 'More workers',
      chapter: 'solution',
      title: 'Add workers',
      body: [
        'Capacity scales with workers. Four workers can finish 80 requests a second; with 30 arriving, each is under 40% busy and sits on the flat part of the curve. The line drains and latency falls back to roughly the cost of the work.',
        'More capacity cures overload. It does nothing for a request that is slow on its own — that needs a faster query or less work per request.',
      ],
      metrics: {
        latency: { v: '~80 ms', tone: 'good' },
        throughput: { v: '30/s (max 80)', tone: 'good' },
        load: { v: '38%', tone: 'good' },
        inflight: '2.4',
      },
      scene: fleet(),
    },
    {
      short: 'Percentiles',
      chapter: 'insight',
      title: 'Averages hide the pain',
      body: [
        'An average hides the people who suffer. If 99 requests take 50 ms and one takes 2 seconds, the average is a comfortable 70 ms — and one fan in a hundred is staring at a spinner.',
        'Report <b>percentiles</b> instead. p50 is the typical request; p99 is the boundary of the slowest 1%. A single page view makes dozens of requests, so a bad p99 is something most visitors meet on most visits.',
      ],
      callout: { kind: 'insight', text: 'Set goals on p95 or p99, not on the mean. The mean is the number nobody experiences.' },
      metrics: { latency: { v: 'avg 70 ms · max 2 s', tone: 'warn' } },
      scene: fleet({
        slowShare: 0.6,
        extra: { card: card(34, -14, '100 requests', ['99 × 50 ms', ' 1 × 2,000 ms', 'average   70 ms', 'p50       50 ms', '! slowest  2,000 ms']) },
      }),
    },
    {
      short: 'Fan-out',
      chapter: 'problem',
      title: 'Case: fan-out multiplies the tail',
      body: [
        'To build the checkout page, the API calls five services in parallel and waits for all of them. Each one is slow only 1% of the time. But the page is slow if <i>any</i> of them is slow: 1 − 0.99⁵ ≈ <b>5% of pages</b>. With 20 services it is 18%.',
        'Fan-out turns a rare tail into a common one. Defences: fewer calls on the critical path, timeouts with sensible fallbacks, and sending a backup request when the first one is late (<b>hedging</b>).',
      ],
      metrics: { latency: { v: '5% of pages slow', tone: 'warn' } },
      scene: {
        entities: {
          fans: FANS,
          api: server(18, 0, { label: 'ticket API' }),
          ...Object.fromEntries(
            BACKENDS.map(([name, u, v]) => [name, service(u, v, { label: name, ...(name === 'fraud' && { badge: { text: 'slow 1%', tone: 'warn' as const } }) })]),
          ),
        },
        links: {
          fa: link('fans', 'api'),
          ...Object.fromEntries(BACKENDS.map(([name]) => [`a-${name}`, link('api', name)])),
        },
        flows: [
          { route: ['fa'], rate: 1.2, bounce: true },
          ...BACKENDS.map(([name]): Flow => ({ route: [`a-${name}`], rate: 1.2, bounce: true })),
          { route: ['a-fraud'], kind: 'slow', rate: 0.5, bounce: true, speed: 35 },
        ],
      },
    },
    {
      short: 'Batching',
      chapter: 'tradeoff',
      title: 'Batching: throughput for latency',
      body: [
        'Every sold ticket must be written to the inventory database. One write per round trip caps a connection at a few hundred writes a second. Grouping 50 orders into one write raises throughput enormously — at the cost of each order waiting a few milliseconds for its batch to fill.',
        'Batching shows up everywhere: Kafka producers, database group commit, GPU inference. The knob always works the same way: bigger batches, more throughput, more waiting.',
      ],
      metrics: { throughput: { v: '~10k writes/s', tone: 'good' }, latency: { v: '+5 ms per order', tone: 'warn' } },
      scene: fleet({
        extra: {
          db: db(34, 0, { label: 'inventory db', badge: { text: 'batch × 50', tone: 'good' } }),
          card: card(34, -20, 'Writes per second', ['1 per round trip   ~500/s', '50 per batch       ~10,000/s', '# + up to 5 ms wait per order']),
        },
        links: Object.fromEntries(workerIds.map((id) => [`${id}-db`, link(id, 'db')])),
        flows: spread(
          workerIds.map((id) => [`${id}-db`]),
          0.8,
          { kind: 'write', bounce: true, returnKind: 'res', speed: 110 },
        ),
      }),
    },
    {
      short: 'Recap',
      chapter: 'recap',
      title: 'Recap',
      body: [
        'The rules of thumb from this lesson fit on one card:',
        `<table class="compare"><thead><tr><th>idea</th><th>rule of thumb</th></tr></thead><tbody>
          <tr><td>capacity</td><td>workers ÷ work per request</td></tr>
          <tr><td>Little’s Law</td><td>in flight = rate × time</td></tr>
          <tr><td>overload</td><td>above capacity, the queue sets latency</td></tr>
          <tr><td>the knee</td><td>wait ≈ ρ ÷ (1 − ρ); plan for 60–70% busy</td></tr>
          <tr><td>percentiles</td><td>goals on p95/p99, not the mean</td></tr>
          <tr><td>fan-out</td><td>1 − (1 − p)ⁿ requests hit the tail</td></tr>
          <tr><td>batching</td><td>more throughput, a little more latency</td></tr></tbody></table>`,
        'Check yourself: an API averages 200 requests a second at 100 ms each. How many requests are in progress at once, and what happens to latency if traffic doubles but capacity doesn’t? (20 in flight; if the doubled load nears capacity, latency climbs steeply, not linearly.)',
      ],
      scene: fleet({ slowShare: 0.2 }),
    },
  ],
};
