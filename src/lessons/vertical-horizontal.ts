import type { Entity, Flow, Lesson, Link, Scene } from '../types.ts';
import { card, db, lb, link, server, spread, users } from './helpers.ts';

const STUDENTS = users(0, 0, { label: 'students' });
const DB = db(30, 0, { label: 'database' });

function single(app: Entity, extra: Record<string, Entity> = {}, flows?: Flow[]): Scene {
  return {
    entities: { users: STUDENTS, app, db: DB, ...extra },
    links: { ua: link('users', 'app'), ad: link('app', 'db') },
    flows: flows ?? [{ route: ['ua', 'ad'], rate: 2.6, bounce: true }],
  };
}

const FLEET = ['app', 'app2', 'app3'] as const;
const ROW: Record<(typeof FLEET)[number], number> = { app: -17, app2: 0, app3: 17 };

function fleet(opts: { down?: (typeof FLEET)[number]; dbSize?: number; extra?: Record<string, Entity> } = {}): Scene {
  const entities: Record<string, Entity> = {
    users: STUDENTS,
    lb: lb(11, 0, { label: 'load balancer' }),
    db: opts.dbSize ? db(34, 0, { label: 'bigger database', size: opts.dbSize }) : db(34, 0, { label: 'database' }),
    ...opts.extra,
  };
  const links: Record<string, Link> = { ul: link('users', 'lb') };
  const alive: string[][] = [];
  FLEET.forEach((id, i) => {
    entities[id] = server(22, ROW[id], { label: `app ${i + 1}`, ...(opts.down === id && { down: true }) });
    links[`l-${id}`] = link('lb', id, opts.down === id ? { dashed: true } : {});
    links[`d-${id}`] = link(id, 'db');
    if (opts.down !== id) alive.push(['ul', `l-${id}`, `d-${id}`]);
  });
  return { entities, links, flows: spread(alive, 3, { bounce: true }) };
}

export const verticalHorizontal: Lesson = {
  id: 'vertical-horizontal',
  title: 'Vertical vs Horizontal Scaling',
  summary: 'When one server is not enough you can buy a bigger one or add more. Each path has a ceiling and a price.',
  minutes: 11,
  level: 'beginner',
  metrics: [
    { id: 'load', label: 'cpu load' },
    { id: 'capacity', label: 'capacity' },
    { id: 'cost', label: 'monthly cost' },
    { id: 'spof', label: 'single point of failure' },
  ],
  legend: ['req', 'res', 'fail'],
  goals: [
    { text: 'Scale up: what a bigger machine buys you', step: 2 },
    { text: 'Why vertical scaling hits a ceiling', step: 3 },
    { text: 'Scale out: adding machines behind a load balancer', step: 5 },
    { text: 'What scaling out costs in complexity', step: 6 },
    { text: 'Combine both in a real system', step: 8 },
  ],
  steps: [
    {
      short: 'Running out',
      chapter: 'setup',
      title: 'One server is running out',
      body: [
        '<b>StudyHub</b>, a homework-help site, runs on one app server and one database. It was fine all term. Now exams are coming, traffic has doubled, and the server sits at 85% CPU every evening — right on the knee of the latency curve.',
        'There are two ways to get more capacity: make the machine <b>bigger</b> (scale up, or <i>vertical</i> scaling) or add <b>more</b> machines (scale out, or <i>horizontal</i> scaling). This lesson tries both.',
      ],
      callout: { kind: 'insight', text: 'Scaling is about capacity and about failure. Keep both in mind as you compare the options.' },
      metrics: { load: { v: '85%', tone: 'warn' }, capacity: '1×', cost: '$400', spof: { v: 'yes', tone: 'warn' } },
      scene: single(server(15, 0, { label: 'app server', badge: { text: '85% CPU', tone: 'warn' } })),
    },
    {
      short: 'Scale up',
      chapter: 'technique',
      title: 'Scale up: a bigger machine',
      body: [
        'The quickest fix is a larger instance: twice the cores, twice the memory. Nothing in the code changes — no new boxes, no new failure modes, no load balancer. Restart on the new hardware and the CPU graph drops to 40%.',
        'For many systems this is the right first move. Modern servers are enormous, and a single well-tuned machine can carry far more than most products ever need.',
      ],
      callout: { kind: 'tip', text: 'Before adding machines, check whether a bigger one solves the problem for the next year. Simple wins.' },
      metrics: { load: { v: '40%', tone: 'good' }, capacity: '2×', cost: '$900' },
      scene: single(server(15, 0, { label: 'bigger server', size: 1.4, badge: { text: '40% CPU', tone: 'good' } })),
    },
    {
      short: 'Ceiling',
      chapter: 'insight',
      title: 'Scaling up has a ceiling',
      body: [
        'Keep doubling and two things happen. Prices rise faster than capacity: the largest machines carry a premium, so each extra core costs more than the last. And eventually there is simply no bigger machine to buy.',
        'Some limits arrive earlier than CPU: network bandwidth of one host, the number of open connections, how long a restart or a disk rebuild takes on a huge box. You can postpone those, not remove them.',
      ],
      metrics: { capacity: '8×', cost: { v: '$5,000+', tone: 'warn' } },
      scene: single(server(15, 0, { label: 'biggest server', size: 1.9 }), {
        card: card(15, -26, 'Bigger costs more per core', ['  4 cores    $150 / month', ' 16 cores    $650', ' 64 cores  $2,800', '192 cores  $9,500', '# illustrative prices']),
      }),
    },
    {
      short: 'One box fails',
      chapter: 'problem',
      title: 'Case: the one big box fails',
      body: [
        'At 21:00 on the night before an exam, the big server’s power supply dies. Every student gets an error. However powerful one machine is, it is still <b>one</b> machine: a single point of failure.',
        'Restarting on new hardware takes minutes; restoring a crashed database can take hours. Vertical scaling gives you capacity, but no redundancy.',
      ],
      callout: { kind: 'warning', text: 'Capacity and availability are different problems. A bigger machine solves the first and makes the second more expensive.' },
      metrics: { load: { v: '—', tone: 'bad' }, spof: { v: 'yes — down', tone: 'bad' } },
      scene: single(server(15, 0, { label: 'biggest server', size: 1.9, down: true }), {}, [{ route: ['ua'], rate: 2.6, fail: 1 }]),
    },
    {
      short: 'Scale out',
      chapter: 'technique',
      title: 'Scale out: more machines',
      body: [
        'Instead of one huge server, run three ordinary ones behind a <b>load balancer</b>. The balancer gives users one address and spreads their requests across the servers.',
        'Capacity now grows in steps you can buy one at a time, and cost grows roughly linearly: three small machines cost about three times one small machine. Need more for exam week? Add two more, then remove them afterwards.',
      ],
      metrics: { load: { v: '45% each', tone: 'good' }, capacity: '3× (add more)', cost: '$1,350' },
      scene: fleet(),
    },
    {
      short: 'The price',
      chapter: 'tradeoff',
      title: 'Scaling out has a price too',
      body: [
        'More machines means more moving parts. You need a load balancer (and a spare for it), a way to deploy to every server, and monitoring that covers all of them.',
        'Most importantly, the servers must be interchangeable: a request can land on any of them, so none may keep anything important only in its own memory or on its own disk. That design rule — <b>stateless</b> servers — gets its own lesson next in this module.',
      ],
      scene: fleet({
        extra: { card: card(34, -24, 'What you now need', ['load balancer (+ a spare)', 'deploys to N servers', 'monitoring for N servers', '! servers must be stateless']) },
      }),
    },
    {
      short: 'Lose one',
      chapter: 'solution',
      title: 'Losing one is fine',
      body: [
        'Now the same power supply dies in app 2. The load balancer notices the failed health checks and stops sending it traffic. Apps 1 and 3 carry the load at 70% each; students notice nothing.',
        'This is the real prize of scaling out: <b>redundancy</b>. Plan for “N + 1” — enough servers that losing any one still leaves enough capacity.',
      ],
      callout: { kind: 'tip', text: 'Size the fleet so that it survives losing its largest member at peak traffic.' },
      metrics: { load: { v: '70% on 2', tone: 'warn' }, spof: { v: 'no (app tier)', tone: 'good' } },
      scene: fleet({ down: 'app2' }),
    },
    {
      short: 'Both',
      chapter: 'insight',
      title: 'Real systems do both',
      body: [
        'Stateless app servers are easy to scale out, so they usually are. Databases are harder: splitting data across machines brings real complexity (see <i>Sharding</i> later). So databases are often scaled <b>up</b> first, with replicas added for reads and failover.',
        'The usual path: one box → bigger box → many app servers + one big database → read replicas → sharding, each step only when the numbers demand it.',
      ],
      metrics: { capacity: '3× app, 2× db', cost: '$2,250', spof: { v: 'the database', tone: 'warn' } },
      scene: fleet({ dbSize: 1.5 }),
    },
    {
      short: 'Recap',
      chapter: 'recap',
      title: 'Recap',
      body: [
        'Two directions, two different sets of trade-offs:',
        `<table class="compare"><thead><tr><th></th><th>scale up</th><th>scale out</th></tr></thead><tbody>
          <tr><td>how</td><td>bigger machine</td><td>more machines + load balancer</td></tr>
          <tr><td>code changes</td><td class="good">none</td><td>servers must be stateless</td></tr>
          <tr><td>ceiling</td><td class="bad">largest machine you can buy</td><td class="good">far higher</td></tr>
          <tr><td>cost curve</td><td class="bad">grows faster than capacity</td><td class="good">roughly linear</td></tr>
          <tr><td>failure</td><td class="bad">one box down = all down</td><td class="good">lose one, keep serving</td></tr></tbody></table>`,
        'Check yourself: your database is at 80% CPU and the app tier at 30%. Which do you scale, and how? (The database — probably up first, since splitting data is the expensive step; adding app servers would not help.)',
      ],
      scene: fleet({ dbSize: 1.5 }),
    },
  ],
};
