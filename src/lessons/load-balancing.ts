import type { Entity, Flow, Lesson, Link, Scene } from '../types.ts';
import { card, lb, link, server, spread, users } from './helpers.ts';

const DINERS = users(0, 0, { label: 'hungry users' });
const IDS = ['s1', 's2', 's3'] as const;
type Sid = (typeof IDS)[number];
const ROW: Record<Sid, number> = { s1: -17, s2: 0, s3: 17 };

interface PoolOpts {
  look?: Partial<Record<Sid, Partial<Entity>>>;
  /** Share of traffic per server (defaults to even). */
  weights?: Partial<Record<Sid, number>>;
  heavyOn?: Sid;
  health?: boolean;
  lbLook?: Partial<Entity>;
  extra?: Record<string, Entity>;
}

function pool(o: PoolOpts = {}): Scene {
  const entities: Record<string, Entity> = { users: DINERS, lb: { ...lb(11, 0, { label: 'load balancer' }), ...o.lbLook }, ...o.extra };
  const links: Record<string, Link> = { ul: link('users', 'lb') };
  const flows: Flow[] = [];
  IDS.forEach((id, i) => {
    const look = o.look?.[id] ?? {};
    entities[id] = { ...server(24, ROW[id], { label: `server ${i + 1}` }), ...look };
    links[id] = link('lb', id, look.down ? { dashed: true } : {});
    const w = o.weights?.[id] ?? 1;
    if (!look.down && w > 0) flows.push({ route: ['ul', id], rate: w, bounce: true });
    if (o.health) flows.push({ route: [id], kind: 'ping', rate: 0.5, bounce: true, returnKind: 'ping', ...(look.down && { fail: 1 }) });
  });
  if (o.heavyOn) flows.push({ route: ['ul', o.heavyOn], kind: 'slow', rate: 0.9, bounce: true, speed: 40 });
  return { entities, links, flows };
}

export const loadBalancing: Lesson = {
  id: 'load-balancing',
  title: 'Load Balancing',
  summary: 'One address in front of many servers: how a load balancer picks a server, notices failures, and avoids becoming the weak link itself.',
  minutes: 12,
  level: 'beginner',
  metrics: [
    { id: 'algo', label: 'algorithm' },
    { id: 'busiest', label: 'busiest server' },
    { id: 'healthy', label: 'healthy servers' },
    { id: 'p99', label: 'p99 latency' },
  ],
  legend: ['req', 'res', ['slow', 'heavy request'], ['ping', 'health check'], 'fail'],
  goals: [
    { text: 'What a load balancer does', step: 1 },
    { text: 'Round robin vs least connections', step: 2 },
    { text: 'Health checks and taking servers out', step: 5 },
    { text: 'Layer 4 vs layer 7 routing', step: 6 },
    { text: 'Sticky sessions and redundant balancers', step: 7 },
  ],
  steps: [
    {
      short: 'One address',
      chapter: 'setup',
      title: 'Many servers, one address',
      body: [
        'At noon, a food-delivery API gets thousands of orders a minute, served by three identical servers. Users can’t be expected to pick a server — they know one address, <code>api.foodnow.example</code>.',
        'That address belongs to a <b>load balancer</b>. It accepts every connection, chooses a server for each request, and keeps track of which servers are healthy. Two questions decide how well it works: <i>how does it choose?</i> and <i>what happens when something fails?</i>',
      ],
      metrics: { algo: '?', busiest: '?', healthy: '3 / 3', p99: '?' },
      scene: pool(),
    },
    {
      short: 'Round robin',
      chapter: 'technique',
      title: 'Round robin',
      body: [
        'The simplest rule: send request 1 to server 1, request 2 to server 2, request 3 to server 3, then start again. No state, no measurement, perfectly even <i>counts</i>.',
        'When every request costs about the same and every server is the same size, that is all you need. A variant, <b>weighted round robin</b>, gives a bigger server more turns.',
      ],
      metrics: { algo: 'round robin', busiest: '34%', p99: '120 ms' },
      scene: pool({ extra: { card: card(36, -22, 'Round robin', ['req 1 → server 1', 'req 2 → server 2', 'req 3 → server 3', 'req 4 → server 1 …']) } }),
    },
    {
      short: 'Uneven work',
      chapter: 'problem',
      title: 'Case: not all requests are equal',
      body: [
        'Some requests are cheap (“list nearby restaurants”, 10 ms) and some are expensive (“build my order history PDF”, 2 s). Round robin counts requests, not work, so a few heavy ones landing on server 1 pile up there while servers 2 and 3 idle.',
        'Server 1’s queue grows, and every user unlucky enough to be sent there waits. The averages look fine; the p99 does not.',
      ],
      metrics: { busiest: { v: '95% (server 1)', tone: 'bad' }, p99: { v: '2.4 s', tone: 'bad' } },
      scene: pool({ heavyOn: 's1', look: { s1: { badge: { text: 'overloaded', tone: 'bad' } } } }),
    },
    {
      short: 'Least conn',
      chapter: 'technique',
      title: 'Least connections',
      body: [
        'A smarter rule: send each new request to the server with the <b>fewest requests in progress</b>. A server stuck on slow work has more open requests, so it automatically gets fewer new ones.',
        'Close cousins: <b>least response time</b>, and “power of two choices” — pick two servers at random and use the less busy one. That last trick gets most of the benefit with almost no coordination, which matters when there are many balancers.',
      ],
      callout: { kind: 'tip', text: 'If request cost varies a lot, prefer least-connections (or two random choices) over round robin.' },
      metrics: { algo: 'least connections', busiest: { v: '55%', tone: 'good' }, p99: { v: '300 ms', tone: 'good' } },
      scene: pool({ weights: { s1: 0.3, s2: 1.3, s3: 1.3 }, heavyOn: 's1', look: { s1: { badge: { text: 'busy → fewer new', tone: 'warn' } } } }),
    },
    {
      short: 'Health checks',
      chapter: 'technique',
      title: 'Health checks',
      body: [
        'Every few seconds the balancer calls each server, typically <code>GET /healthz</code>. After a few failures in a row it marks the server <b>unhealthy</b> and stops routing to it; after a few successes it brings it back.',
        'Server 3 just crashed. Within about 15 seconds it is out of rotation, and users see at most a handful of errors. A good health check tests what matters (can it reach the database?) without being so strict that a brief hiccup removes every server at once.',
      ],
      metrics: { healthy: { v: '2 / 3', tone: 'warn' }, busiest: '60%' },
      scene: pool({
        health: true,
        look: { s3: { down: true } },
        extra: { card: card(36, -22, 'Health check', ['GET /healthz   every 5 s', '3 failures  → out', '2 successes → back in']) },
      }),
    },
    {
      short: 'L4 vs L7',
      chapter: 'technique',
      title: 'Layer 4 vs layer 7',
      body: [
        'A <b>layer 4</b> balancer sees only TCP connections: addresses and ports. It is very fast and protocol-agnostic, but it can’t look inside requests.',
        'A <b>layer 7</b> balancer speaks HTTP. It can terminate TLS, read the path and headers, and route by them — <code>/api/*</code> to one pool, <code>/images/*</code> to another — and retry a failed request on a different server. Most web traffic today goes through L7 balancers or proxies such as NGINX, Envoy or a cloud ALB.',
      ],
      metrics: { algo: 'L7: route by path', healthy: '4 / 4' },
      scene: {
        entities: {
          users: DINERS,
          lb: lb(11, 0, { label: 'L7 load balancer' }),
          s1: server(24, -21, { label: 'api 1' }),
          s2: server(24, -7, { label: 'api 2' }),
          s3: server(24, 7, { label: 'images 1' }),
          s4: server(24, 21, { label: 'images 2' }),
          card: card(38, 0, 'Routing rules', ['/api/*     → api pool', '/images/*  → image pool', '# TLS ends at the balancer']),
        },
        links: { ul: link('users', 'lb'), s1: link('lb', 's1'), s2: link('lb', 's2'), s3: link('lb', 's3'), s4: link('lb', 's4') },
        flows: [
          ...spread([['ul', 's1'], ['ul', 's2']], 2, { bounce: true }),
          ...spread([['ul', 's3'], ['ul', 's4']], 1.4, { kind: 'write', bounce: true, returnKind: 'res' }),
        ],
      },
    },
    {
      short: 'Sticky',
      chapter: 'tradeoff',
      title: 'Sticky sessions',
      body: [
        'Some apps keep a user’s session in one server’s memory, so the balancer is told to send that user back to the same server every time — <b>sticky sessions</b>, usually via a cookie.',
        'It works, but it fights the balancer: a few heavy users can pin one server, new servers only receive new users, and when a server dies its users lose their sessions. Stickiness is a workaround for state living in the wrong place — the next lesson moves it out.',
      ],
      callout: { kind: 'warning', text: 'Treat sticky sessions as technical debt, not a feature.' },
      metrics: { algo: 'sticky (cookie)', busiest: { v: '80% (server 1)', tone: 'warn' } },
      scene: pool({ weights: { s1: 2, s2: 0.6, s3: 0.4 }, look: { s1: { badge: { text: 'pinned users', tone: 'warn' } } } }),
    },
    {
      short: 'Balance the balancer',
      chapter: 'problem',
      title: 'Case: who balances the balancer?',
      body: [
        'Three healthy servers are useless if the one load balancer in front of them fails. The balancer itself must be redundant.',
        'Common answers: a pair of balancers sharing a <b>floating IP</b> that moves to the standby when the active one stops responding; several balancers listed in DNS; or a managed cloud balancer that is already a distributed fleet. Here the standby takes over in a couple of seconds.',
      ],
      metrics: { healthy: '3 / 3', busiest: '35%' },
      scene: {
        entities: {
          users: DINERS,
          lb: lb(11, -9, { label: 'balancer A', down: true }),
          lb2: lb(11, 9, { label: 'balancer B', badge: { text: 'took over', tone: 'good' } }),
          s1: server(24, -17, { label: 'server 1' }),
          s2: server(24, 0, { label: 'server 2' }),
          s3: server(24, 17, { label: 'server 3' }),
        },
        links: {
          ul: link('users', 'lb', { dashed: true }),
          ul2: link('users', 'lb2'),
          a1: link('lb2', 's1'),
          a2: link('lb2', 's2'),
          a3: link('lb2', 's3'),
        },
        flows: [...spread([['ul2', 'a1'], ['ul2', 'a2'], ['ul2', 'a3']], 3, { bounce: true }), { route: ['ul'], rate: 0.4, fail: 1 }],
      },
    },
    {
      short: 'Recap',
      chapter: 'recap',
      title: 'Recap',
      body: [
        'A load balancer is simple to add and easy to get subtly wrong. The choices:',
        `<table class="compare"><thead><tr><th>question</th><th>common answer</th></tr></thead><tbody>
          <tr><td>which server?</td><td>least connections / two random choices; round robin if work is uniform</td></tr>
          <tr><td>different sizes?</td><td>weights</td></tr>
          <tr><td>failures?</td><td>health checks that remove and re-add servers</td></tr>
          <tr><td>route by path or host?</td><td>layer 7 balancer</td></tr>
          <tr><td>sessions?</td><td>avoid stickiness: make servers stateless</td></tr>
          <tr><td>balancer fails?</td><td>active/standby pair, DNS, or a managed fleet</td></tr></tbody></table>`,
        'Check yourself: health checks pass, yet users on one server see errors. What might the check be missing? (It may test only that the process is up, not that it can reach the database or other dependencies.)',
      ],
      scene: pool({ health: true }),
    },
  ],
};
