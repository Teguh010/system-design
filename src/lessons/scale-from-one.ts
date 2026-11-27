import type { Lesson } from '../types.ts';
import { cache, card, cdn, client, db, lb, link, queue, server, users } from './helpers.ts';

export const scaleFromOne: Lesson = {
  id: 'scale-from-one',
  title: 'From One Server to Scale',
  summary: 'Start with a real app on one single machine, watch what breaks first when traffic explodes, and build the mental map behind every system design choice.',
  minutes: 10,
  level: 'beginner',
  metrics: [
    { id: 'traffic', label: 'traffic' },
    { id: 'response', label: 'response' },
    { id: 'cpu', label: 'CPU' },
    { id: 'status', label: 'status' },
  ],
  legend: ['req', 'res', ['slow', 'queued / slow'], ['fail', 'timed out']],
  goals: [
    { text: 'Run an entire app on one single machine', step: 1 },
    { text: 'Spot what breaks first when traffic explodes', step: 2 },
    { text: 'Separate the application from the database', step: 3 },
    { text: 'Balance the four trade-off compasses', step: 4 },
    { text: 'Connect the three bottlenecks to the rest of the course', step: 7 },
  ],
  steps: [
    {
      short: 'One box',
      chapter: 'setup',
      title: 'Day one: one machine is plenty',
      body: [
        'Meet <code>kopikita.app</code>, a neighbourhood coffee pre-order app you launched last week. On day one, the entire product runs on <b>one single server</b>: your web code and your database share the same CPU, memory, and disk.',
        'With twenty orders a day, life is easy. Requests finish in <b>45 ms</b>, CPU sits at 8%, and adding a second machine right now would only waste money and time.',
      ],
      callout: { kind: 'insight', text: 'Every big architecture starts simple. Complexity is a tax you pay only when growth forces your hand.' },
      metrics: {
        traffic: '20 / day',
        response: { v: '45 ms', tone: 'good' },
        cpu: { v: '8%', tone: 'good' },
        status: { v: 'healthy', tone: 'good' },
      },
      beats: [
        {
          label: 'Launch day',
          duration: 2200,
          entities: {
            customers: { focus: true, badge: { text: '20 orders / day', tone: 'good' } },
            box: { meter: { label: 'CPU', value: 0.08, tone: 'good' } },
            trace: {
              lines: ['> app + database on 1 machine', '# 20 orders/day · CPU at 8%', '# simple, cheap, zero network hops'],
            },
          },
          flows: [{ route: ['cb'], rate: 0.9, bounce: true, once: 2 }],
        },
        {
          label: 'Steady 45 ms',
          entities: {
            customers: { focus: false },
            box: { focus: true, badge: { text: '45 ms', tone: 'good' } },
            trace: {
              lines: ['✓ app + database on 1 machine', '> 20 orders/day · CPU at 8%', '✓ simple, cheap, zero network hops'],
            },
          },
          flows: [{ route: ['cb'], rate: 1.1, bounce: true }],
        },
      ],
      scene: {
        entities: {
          customers: users(0, 0, { count: 1, label: 'customers' }),
          box: server(24, 0, { label: 'single server', sub: 'app + database', icon: 'server', meter: { label: 'CPU', value: 0.08, tone: 'good' } }),
          trace: card(24, -18, 'Day 1 · 1 box', [
            '✓ app + database on 1 machine',
            '> 20 orders/day · CPU at 8%',
            '✓ simple, cheap, zero network hops',
          ]),
        },
        links: { cb: link('customers', 'box', { arrow: true, label: 'order coffee' }) },
        flows: [{ route: ['cb'], rate: 1.1, bounce: true }],
      },
    },
    {
      short: 'Viral spike',
      chapter: 'problem',
      title: 'Then your app goes viral overnight',
      body: [
        'A food creator posts a short clip about your app, and suddenly <b>500 people per second</b> tap Order at the same time. That one box now has to parse HTTP requests, compute promo discounts, and read and write the database on the same hardware.',
        'CPU pins at <b>100%</b>, the app and database fight over memory, requests pile up for eight seconds, and nearly half of them time out. Nothing in your code changed — only the scale did.',
      ],
      callout: { kind: 'warning', text: 'When app and database share one machine, a traffic spike on one starves the other.' },
      changes: ['+ traffic jumps from 20/day to 500 req/s', '~ app and database fight for the same CPU and RAM'],
      metrics: {
        traffic: { v: '500 / s', tone: 'warn' },
        response: { v: '8.4 s', tone: 'bad' },
        cpu: { v: '100%', tone: 'bad' },
        status: { v: 'timing out', tone: 'bad' },
      },
      beats: [
        {
          label: 'Traffic spike',
          duration: 2200,
          entities: {
            customers: { count: 3, focus: true, badge: { text: '500 req / s', tone: 'warn' } },
            box: { focus: true, meter: { label: 'CPU', value: 0.92, tone: 'warn' }, badge: { text: 'RAM full', tone: 'warn' } },
            trace: {
              title: 'Overload · 1 box',
              lines: ['! 500 req/s hit one machine', '> CPU hits 100% (app + DB fight)', '# queue builds to 8.4 s'],
            },
          },
          flows: [
            { route: ['cb'], kind: 'slow', rate: 2.2, bounce: true, speed: 55 },
          ],
        },
        {
          label: 'Timeouts',
          entities: {
            customers: { count: 3, badge: { text: '500 req / s', tone: 'bad' } },
            box: { focus: true, meter: { label: 'CPU', value: 1, tone: 'bad' }, badge: { text: 'overloaded', tone: 'bad' } },
            trace: {
              title: 'Overload · 1 box',
              lines: ['! 500 req/s hit one machine', '! CPU hits 100% (app + DB fight)', '> queue builds to 8.4 s → errors'],
            },
          },
          flows: [
            { route: ['cb'], kind: 'slow', rate: 1.8, bounce: true, speed: 45 },
            { route: ['cb'], kind: 'req', rate: 1.8, fail: 0.7 },
          ],
        },
      ],
      scene: {
        entities: {
          customers: users(0, 0, { count: 3, label: 'customers' }),
          box: server(24, 0, { label: 'single server', sub: 'app + database', icon: 'server', meter: { label: 'CPU', value: 1, tone: 'bad' }, badge: { text: 'overloaded', tone: 'bad' } }),
          trace: card(24, -18, 'Overload · 1 box', [
            '! 500 req/s hit one machine',
            '! CPU hits 100% (app + DB fight)',
            '> queue builds to 8.4 s → errors',
          ]),
        },
        links: { cb: link('customers', 'box', { arrow: true, label: '500 req/s', labelTone: 'bad' }) },
        flows: [
          { route: ['cb'], kind: 'slow', rate: 1.8, bounce: true, speed: 45 },
          { route: ['cb'], kind: 'req', rate: 1.8, fail: 0.7 },
        ],
      },
    },
    {
      short: 'Split tiers',
      chapter: 'technique',
      title: 'Separate the kitchen from the pantry',
      body: [
        'The first clean move is splitting the <b>app server</b> and the <b>database</b> onto two separate machines. Now web traffic and data storage have their own CPU, memory, and disks, and you can upgrade either side independently.',
        'Response time drops back to <b>120 ms</b> and errors disappear. Even better: you can now see clearly whether slowness lives in your app code or in your database.',
      ],
      changes: ['+ database moved to its own machine', '~ app and DB stop fighting for CPU and RAM'],
      metrics: {
        response: { v: '120 ms', tone: 'good' },
        cpu: { v: '62%', tone: 'warn' },
        status: { v: 'recovered', tone: 'good' },
      },
      beats: [
        {
          label: 'Move DB out',
          duration: 2200,
          camera: { focus: ['app', 'db'] },
          entities: {
            customers: { dim: true },
            app: { focus: true, badge: { text: 'app only', tone: 'good' } },
            db: { focus: true, badge: { text: 'dedicated DB', tone: 'good' } },
            trace: {
              title: '2-tier split',
              lines: ['> separate app & database', '# each gets its own CPU + RAM', '# response drops to 120 ms'],
            },
          },
          flows: [{ route: ['ad'], rate: 1.5, bounce: true, once: 2 }],
        },
        {
          label: 'Recovered · 120 ms',
          entities: {
            customers: { dim: false },
            app: { focus: true, meter: { label: 'CPU', value: 0.62, tone: 'warn' } },
            db: { badge: { text: 'healthy', tone: 'good' } },
            trace: {
              title: '2-tier split',
              lines: ['✓ separate app & database', '✓ each gets its own CPU + RAM', '> response drops to 120 ms'],
            },
          },
          flows: [{ route: ['ca', 'ad'], rate: 1.8, bounce: true }],
        },
      ],
      scene: {
        entities: {
          customers: users(0, 0, { count: 3, label: 'customers' }),
          app: server(20, 0, { label: 'app server', sub: 'kopikita.app', icon: 'server', count: 2, meter: { label: 'CPU', value: 0.62, tone: 'warn' } }),
          db: db(38, 0, { label: 'database', icon: 'database', fill: 0.45, badge: { text: 'healthy', tone: 'good' } }),
          trace: card(28, -18, '2-tier split', [
            '✓ separate app & database',
            '✓ each gets its own CPU + RAM',
            '> response drops to 120 ms',
          ]),
        },
        links: {
          ca: link('customers', 'app', { arrow: true, label: '500 req/s' }),
          ad: link('app', 'db', { arrow: true, label: 'queries' }),
        },
        flows: [{ route: ['ca', 'ad'], rate: 1.8, bounce: true }],
      },
    },
    {
      short: '4 compasses',
      chapter: 'insight',
      title: 'System design is choosing trade-offs',
      body: [
        'Splitting into two machines fixed today’s fire, yet notice something important: every architecture choice nudges <b>four compasses</b> — <b>Latency</b> (how fast for one person), <b>Throughput</b> (how many per second), <b>Reliability</b> (surviving crashes), and <b>Cost</b> (money and complexity).',
        'There is no free upgrade. Adding a second machine improved throughput and isolation, but cost more money and added a network hop between app and database. Keep these four compasses in mind for every lesson ahead.',
      ],
      callout: { kind: 'insight', text: 'System design is not memorizing tool names. It is deciding which of the four compasses matters most right now.' },
      beats: [
        {
          label: 'Latency',
          duration: 2100,
          entities: {
            trace: {
              title: '4 Trade-off Compasses',
              lines: ['> 1. Latency     how fast is 1 click?', '# 2. Throughput  how many per second?', '# 3. Reliability stays up if a box dies?', '# 4. Cost        money + complexity'],
            },
          },
        },
        {
          label: 'Throughput',
          duration: 2100,
          entities: {
            trace: {
              lines: ['✓ 1. Latency     how fast is 1 click?', '> 2. Throughput  how many per second?', '# 3. Reliability stays up if a box dies?', '# 4. Cost        money + complexity'],
            },
          },
        },
        {
          label: 'Reliability',
          duration: 2100,
          entities: {
            trace: {
              lines: ['✓ 1. Latency     how fast is 1 click?', '✓ 2. Throughput  how many per second?', '> 3. Reliability stays up if a box dies?', '# 4. Cost        money + complexity'],
            },
          },
        },
        {
          label: 'Cost',
          entities: {
            trace: {
              lines: ['✓ 1. Latency     how fast is 1 click?', '✓ 2. Throughput  how many per second?', '✓ 3. Reliability stays up if a box dies?', '> 4. Cost        money + complexity'],
            },
          },
        },
      ],
      scene: {
        entities: {
          customers: users(0, 0, { count: 3, label: 'customers' }),
          app: server(20, 0, { label: 'app server', sub: 'kopikita.app', icon: 'server', count: 2, meter: { label: 'CPU', value: 0.62, tone: 'warn' } }),
          db: db(38, 0, { label: 'database', icon: 'database', fill: 0.45 }),
          trace: card(24, 21, '4 Trade-off Compasses', [
            '✓ 1. Latency     how fast is 1 click?',
            '✓ 2. Throughput  how many per second?',
            '✓ 3. Reliability stays up if a box dies?',
            '> 4. Cost        money + complexity',
          ]),
        },
        links: {
          ca: link('customers', 'app', { arrow: true, label: '500 req/s' }),
          ad: link('app', 'db', { arrow: true, label: '0.5 ms hop' }),
        },
        flows: [{ route: ['ca', 'ad'], rate: 1.5, bounce: true }],
      },
    },
    {
      short: '3 bottlenecks',
      chapter: 'technique',
      title: 'The three places systems hit a wall',
      body: [
        'As <code>kopikita.app</code> keeps growing, problems always show up in one of three places: <b>Compute</b> (your app CPU runs out of room), <b>Storage</b> (your database disk fills up or locks up on heavy reads), or <b>Network</b> (distant users wait on long trips across the globe).',
        'Step through the moments below to watch the camera zoom into each bottleneck. Each wall needs a completely different fix — buying a faster CPU will not shorten an ocean.',
      ],
      changes: ['~ mapped the 3 walls: compute, storage, and network distance'],
      beats: [
        {
          label: '1. Compute wall',
          duration: 2400,
          camera: { focus: ['app', 'trace'] },
          entities: {
            customers: { dim: true },
            db: { dim: true },
            app: { focus: true, meter: { label: 'CPU', value: 0.98, tone: 'bad' }, badge: { text: 'CPU 98%', tone: 'bad' } },
            trace: {
              title: '3 Bottlenecks',
              lines: ['> 1. Compute  app CPU maxed out', '# 2. Storage  DB full / slow reads', '# 3. Network  far users wait on RTT'],
            },
          },
          flows: [{ route: ['ca'], kind: 'slow', rate: 2.2, bounce: true, speed: 65 }],
        },
        {
          label: '2. Storage wall',
          duration: 2400,
          camera: { focus: ['db', 'trace'] },
          entities: {
            customers: { dim: true },
            app: { dim: true, meter: { label: 'CPU', value: 0.25, tone: 'good' } },
            db: { dim: false, focus: true, fill: 0.92, badge: { text: 'disk 92% · slow', tone: 'bad' } },
            trace: {
              lines: ['✓ 1. Compute  app CPU maxed out', '> 2. Storage  DB full / slow reads', '# 3. Network  far users wait on RTT'],
            },
          },
          links: { ad: { label: 'slow queries', labelTone: 'bad' } },
          flows: [{ route: ['ad'], kind: 'slow', rate: 1.8, bounce: true, speed: 55 }],
        },
        {
          label: '3. Network wall',
          entities: {
            customers: { dim: true },
            app: { dim: false, focus: true, badge: { text: 'CPU fine', tone: 'good' } },
            db: { dim: true, fill: 0.45 },
            far: { ghost: false, focus: true, badge: { text: '300 ms RTT', tone: 'bad' } },
            trace: {
              lines: ['✓ 1. Compute  app CPU maxed out', '✓ 2. Storage  DB full / slow reads', '> 3. Network  far users wait on RTT'],
            },
          },
          camera: { focus: ['far', 'app', 'trace'] },
          links: { fa: { label: '300 ms RTT', labelTone: 'bad' } },
          flows: [{ route: ['fa'], kind: 'slow', rate: 0.8, bounce: true, speed: 45 }],
        },
      ],
      scene: {
        entities: {
          customers: users(0, 0, { count: 3, label: 'nearby' }),
          far: client(0, 18, { label: 'far away', sub: '300 ms RTT', ghost: true }),
          app: server(22, 0, { label: 'app server', icon: 'server', count: 2, meter: { label: 'CPU', value: 0.5, tone: 'good' } }),
          db: db(40, 0, { label: 'database', icon: 'database', fill: 0.45 }),
          trace: card(26, -20, '3 Bottlenecks', [
            '✓ 1. Compute  app CPU maxed out',
            '✓ 2. Storage  DB full / slow reads',
            '> 3. Network  far users wait on RTT',
          ]),
        },
        links: {
          ca: link('customers', 'app', { arrow: true, label: '30 ms RTT' }),
          fa: link('far', 'app', { arrow: true, label: '300 ms RTT' }),
          ad: link('app', 'db', { arrow: true, label: 'queries' }),
        },
        flows: [
          { route: ['ca', 'ad'], rate: 1.4, bounce: true },
          { route: ['fa'], kind: 'slow', rate: 0.7, bounce: true, speed: 45 },
        ],
      },
    },
    {
      short: 'One crash',
      chapter: 'problem',
      title: 'When one machine dies, everything dies',
      predict: {
        question: 'Your app and database now sit on two separate boxes. If only the database crashes, what happens to visitors?',
        options: [
          'Only checkout breaks; reading the menu stays fast',
          'The whole site fails because the app cannot answer without its data',
          'Requests automatically reroute to the app server disk',
        ],
        answer: 1,
        explain: 'Separating machines isolates CPU and memory, but with only one copy of each tier, either box is still a single point of failure.',
      },
      body: [
        'Splitting into two machines helped capacity, yet look at our third compass — <b>Reliability</b>. We still have only one app server and one database.',
        'Try breaking either component on the diagram. If the app crashes, nobody connects; if the database crashes, the app has no data to serve. That vulnerability is called a <b>single point of failure</b>.',
      ],
      callout: { kind: 'warning', text: 'One machine per role means zero redundancy. Reliability requires backups that can take over automatically.' },
      chaos: {
        app: {
          text: 'Nobody can reach <code>kopikita.app</code> at all. Every request fails at the front door until the app server comes back.',
          metrics: { response: { v: 'timeout', tone: 'bad' }, status: { v: 'site down', tone: 'bad' } },
        },
        db: {
          text: 'The app server is alive, but without the database it has no menu, prices, or orders to load — every page returns an error.',
          metrics: { response: { v: '500 error', tone: 'bad' }, status: { v: 'site down', tone: 'bad' } },
        },
      },
      metrics: {
        response: { v: '120 ms', tone: 'good' },
        cpu: { v: '62%', tone: 'warn' },
        status: { v: '1 crash = down', tone: 'warn' },
      },
      scene: {
        entities: {
          customers: users(0, 0, { count: 3, label: 'customers' }),
          app: server(20, 0, { label: 'app server', icon: 'server', count: 2, meter: { label: 'CPU', value: 0.62, tone: 'warn' } }),
          db: db(38, 0, { label: 'database', icon: 'database', fill: 0.45 }),
          trace: card(24, -18, 'Single point of failure', [
            '! only 1 app server',
            '! only 1 database',
            '> click either box below to break it',
          ]),
        },
        links: {
          ca: link('customers', 'app', { arrow: true, label: '500 req/s' }),
          ad: link('app', 'db', { arrow: true, label: 'queries' }),
        },
        flows: [{ route: ['ca', 'ad'], rate: 1.8, bounce: true }],
      },
    },
    {
      short: 'Scale map',
      chapter: 'solution',
      title: 'How one server grows into a full architecture',
      body: [
        'Now every piece of the course has a clear reason to exist. Instead of random boxes, each component fixes a specific wall you just saw:',
        'A <b>Load Balancer + extra servers</b> solve compute and reliability (Module 02). A <b>Cache & CDN</b> protect the database and shorten distant trips (Module 02). <b>Replicas & Shards</b> scale storage (Module 03), and <b>Queues</b> absorb spikes (Module 04).',
      ],
      callout: { kind: 'tip', text: 'Dashed ghost boxes are future tools we will unlock step by step — never add them until a real bottleneck demands them.' },
      changes: ['+ roadmap boxes previewed as ghosts for Modules 02–04'],
      metrics: {
        status: { v: 'course map', tone: 'info' },
      },
      beats: [
        {
          label: 'Compute → LB',
          duration: 2200,
          camera: { focus: ['lb', 'app', 'trace'] },
          entities: {
            cache: { ghost: true, dim: true },
            cdn: { ghost: true, dim: true },
            replica: { ghost: true, dim: true },
            q: { ghost: true, dim: true },
            lb: { focus: true, badge: { text: 'Module 02', tone: 'info' } },
            app: { focus: true, badge: { text: 'fleet', tone: 'info' } },
            trace: {
              title: 'Course Scale Map',
              lines: ['> Compute  → Load balancer + fleet', '# Network  → CDN near users', '# Storage  → Cache + DB replicas', '# Spikes   → Message queues'],
            },
          },
          flows: [{ route: ['cl', 'la'], rate: 1.6, bounce: true }],
        },
        {
          label: 'Network → CDN',
          duration: 2200,
          camera: { focus: ['customers', 'cdn', 'trace'] },
          entities: {
            lb: { dim: true },
            app: { dim: true },
            cdn: { dim: false, focus: true, badge: { text: 'Module 02', tone: 'info' } },
            trace: {
              lines: ['✓ Compute  → Load balancer + fleet', '> Network  → CDN near users', '# Storage  → Cache + DB replicas', '# Spikes   → Message queues'],
            },
          },
          flows: [{ route: ['ccdn'], rate: 1.5, bounce: true }],
        },
        {
          label: 'Storage → Cache + DB',
          duration: 2200,
          camera: { focus: ['app', 'cache', 'db', 'replica', 'trace'] },
          entities: {
            cdn: { dim: true },
            app: { dim: false },
            cache: { dim: false, focus: true, badge: { text: 'Module 02', tone: 'info' } },
            db: { dim: false, focus: true },
            replica: { dim: false, focus: true, badge: { text: 'Module 03', tone: 'info' } },
            trace: {
              lines: ['✓ Compute  → Load balancer + fleet', '✓ Network  → CDN near users', '> Storage  → Cache + DB replicas', '# Spikes   → Message queues'],
            },
          },
          flows: [
            { route: ['ac'], rate: 1.4, bounce: true },
            { route: ['ad', 'dr'], rate: 0.9, bounce: true },
          ],
        },
        {
          label: 'Full map',
          entities: {
            lb: { dim: false, badge: { text: 'Module 02', tone: 'info' } },
            app: { dim: false },
            cdn: { dim: false, badge: { text: 'Module 02', tone: 'info' } },
            cache: { dim: false, badge: { text: 'Module 02', tone: 'info' } },
            replica: { dim: false, badge: { text: 'Module 03', tone: 'info' } },
            q: { dim: false, focus: true, badge: { text: 'Module 04', tone: 'info' } },
            trace: {
              lines: ['✓ Compute  → Load balancer + fleet', '✓ Network  → CDN near users', '✓ Storage  → Cache + DB replicas', '> Spikes   → Message queues'],
            },
          },
          flows: [
            { route: ['cl', 'la', 'ad'], rate: 1.4, bounce: true },
            { route: ['ccdn'], rate: 1.2, bounce: true },
            { route: ['aq'], rate: 0.9, bounce: true },
          ],
        },
      ],
      scene: {
        entities: {
          customers: users(0, 0, { count: 3, label: 'customers' }),
          cdn: cdn(11, 18, { label: 'CDN', ghost: true, badge: { text: 'Module 02', tone: 'info' } }),
          lb: lb(13, 0, { label: 'load balancer', ghost: true, badge: { text: 'Module 02', tone: 'info' } }),
          app: server(26, 0, { label: 'app fleet', icon: 'server', count: 3 }),
          cache: cache(26, -18, { label: 'cache', ghost: true, badge: { text: 'Module 02', tone: 'info' } }),
          db: db(42, 0, { label: 'primary DB', icon: 'database', fill: 0.45 }),
          replica: db(56, 0, { label: 'replica', ghost: true, badge: { text: 'Module 03', tone: 'info' } }),
          q: queue(42, 18, { label: 'queue', ghost: true, badge: { text: 'Module 04', tone: 'info' } }),
          trace: card(46, -21, 'Course Scale Map', [
            '✓ Compute  → Load balancer + fleet',
            '✓ Network  → CDN near users',
            '✓ Storage  → Cache + DB replicas',
            '> Spikes   → Message queues',
          ]),
        },
        links: {
          cl: link('customers', 'lb', { arrow: true }),
          ccdn: link('customers', 'cdn', { arrow: true, dashed: true }),
          la: link('lb', 'app', { arrow: true }),
          ac: link('app', 'cache', { arrow: true, dashed: true }),
          ad: link('app', 'db', { arrow: true }),
          dr: link('db', 'replica', { arrow: true, dashed: true }),
          aq: link('app', 'q', { arrow: true, dashed: true }),
        },
        flows: [
          { route: ['cl', 'la', 'ad'], rate: 1.4, bounce: true },
          { route: ['ccdn'], rate: 1.2, bounce: true },
          { route: ['aq'], rate: 0.9, bounce: true },
        ],
      },
    },
    {
      short: 'Recap',
      chapter: 'recap',
      title: 'Start simple, measure, then scale',
      body: [
        'One machine is the right starting point until real traffic proves otherwise. When it struggles, match the bottleneck to the compass you want to move:',
        `<table class="compare"><thead><tr><th>wall</th><th>symptom</th><th>compass hurt</th><th>next step</th></tr></thead><tbody>
          <tr><td>shared box</td><td>app &amp; DB fight</td><td>latency, reliability</td><td>split app &amp; DB</td></tr>
          <tr><td>compute</td><td>CPU at 100%</td><td>throughput</td><td>scale &amp; balance (Mod 02)</td></tr>
          <tr><td>storage</td><td>slow / full DB</td><td>latency, throughput</td><td>cache &amp; replicas (Mod 02–03)</td></tr>
          <tr><td>distance</td><td>far users wait</td><td>latency</td><td>CDN &amp; edge (Mod 02)</td></tr></tbody></table>`,
        'Check yourself: before adding a load balancer or cache, how do you know where a single slow click is spending its time? (You trace one request end to end — which is exactly what we dissect in the next lesson!)',
      ],
      callout: { kind: 'insight', text: 'Next up: zoom into a single click to see where time goes across DNS, handshakes, server work, and distance.' },
      metrics: {
        traffic: '20 → 500/s',
        response: { v: '45 → 120 ms', tone: 'good' },
        cpu: '62%',
        status: { v: 'ready for ep 2', tone: 'good' },
      },
      scene: {
        entities: {
          customers: users(0, 0, { count: 3, label: 'customers' }),
          app: server(20, 0, { label: 'app server', icon: 'server', count: 2, meter: { label: 'CPU', value: 0.62, tone: 'warn' } }),
          db: db(38, 0, { label: 'database', icon: 'database', fill: 0.45 }),
          trace: card(24, -18, 'Before adding more boxes…', [
            '✓ 1 box is fine until traffic grows',
            '✓ 4 compasses guide every trade-off',
            '> next: trace 1 click millisecond by ms',
          ]),
        },
        links: {
          ca: link('customers', 'app', { arrow: true, label: 'where does time go?' }),
          ad: link('app', 'db', { arrow: true, label: 'queries' }),
        },
        flows: [{ route: ['ca', 'ad'], rate: 1.3, bounce: true }],
      },
    },
  ],
};
