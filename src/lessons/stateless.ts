import type { Entity, Flow, Lesson, Link, Scene } from '../types.ts';
import { cache, card, db, lb, link, server, spread, users } from './helpers.ts';

const SHOPPERS = users(0, 0, { label: 'shoppers' });

interface TwoOpts {
  look?: Partial<Record<'s1' | 's2' | 's3', Partial<Entity>>>;
  flows?: Flow[];
  store?: boolean;
  shoppers?: Entity;
  extra?: Record<string, Entity>;
  more?: boolean;
}

function two(o: TwoOpts = {}): Scene {
  const rows: [string, number][] = o.more
    ? [
        ['s1', -17],
        ['s2', 0],
        ['s3', 17],
      ]
    : [
        ['s1', -8],
        ['s2', 8],
      ];
  const entities: Record<string, Entity> = { users: o.shoppers ?? SHOPPERS, lb: lb(11, 0, { label: 'load balancer' }), ...o.extra };
  const links: Record<string, Link> = { ul: link('users', 'lb') };
  rows.forEach(([id, v], i) => {
    const look = o.look?.[id as 's1'] ?? {};
    entities[id] = { ...server(23, v, { label: `web ${i + 1}` }), ...look };
    links[id] = link('lb', id, look.down ? { dashed: true } : {});
    if (o.store) links[`${id}-store`] = link(id, 'store');
  });
  if (o.store) entities.store = cache(36, 0, { label: 'session store', sub: 'Redis, replicated' });
  const alive = rows.filter(([id]) => !o.look?.[id as 's1']?.down).map(([id]) => id);
  const flows =
    o.flows ??
    spread(
      alive.map((id) => (o.store ? ['ul', id, `${id}-store`] : ['ul', id])),
      2.6,
      { bounce: true },
    );
  return { entities, links, flows };
}

export const stateless: Lesson = {
  id: 'stateless',
  title: 'Stateless Services',
  summary: 'Why servers that remember nothing between requests are the key to scaling out, and where the state goes instead.',
  minutes: 11,
  level: 'beginner',
  metrics: [
    { id: 'state', label: 'session lives in' },
    { id: 'failover', label: 'server dies →' },
    { id: 'scale', label: 'add a server' },
  ],
  legend: ['req', 'res', 'write', ['fail', 'lost session']],
  goals: [
    { text: 'Spot state hiding in a web server', step: 1 },
    { text: 'See why sticky sessions only half work', step: 3 },
    { text: 'Move sessions into a shared store', step: 5 },
    { text: 'Carry state in a signed token instead', step: 6 },
    { text: 'Know where state still has to live', step: 8 },
  ],
  steps: [
    {
      short: 'The cart',
      chapter: 'setup',
      title: 'Where does the cart live?',
      body: [
        'A small online shop runs on one web server. When you add a kettle to your cart, the server stores the cart in its own memory, keyed by a session cookie in your browser. It is simple and fast.',
        'That memory is <b>state</b>: information the server must remember between your requests. As long as there is exactly one server, nobody notices.',
      ],
      metrics: { state: 'web server RAM', failover: '?', scale: '?' },
      scene: {
        entities: { users: SHOPPERS, s1: server(16, 0, { label: 'web server', badge: { text: 'carts in RAM', tone: 'info' } }) },
        links: { us: link('users', 's1') },
        flows: [{ route: ['us'], rate: 2.4, bounce: true }],
      },
    },
    {
      short: 'Second server',
      chapter: 'problem',
      title: 'Case: the second server doesn’t know you',
      body: [
        'Black Friday is coming, so the shop adds a second server behind a load balancer. Your first request — “add kettle” — lands on web 1. Your next request — “show cart” — lands on web 2, which has never heard of you. Your cart is empty.',
        'Nothing crashed. The servers are simply not interchangeable, and a load balancer assumes they are.',
      ],
      callout: { kind: 'warning', text: 'If a server keeps per-user data in memory or on local disk, you cannot freely add, remove or replace it.' },
      metrics: { state: 'each server’s RAM', failover: '?', scale: { v: 'breaks carts', tone: 'bad' } },
      scene: two({
        look: { s1: { badge: { text: 'has your cart', tone: 'info' } }, s2: { badge: { text: 'who are you?', tone: 'bad' } } },
        flows: [
          { route: ['ul', 's1'], rate: 1.3, bounce: true },
          { route: ['ul', 's2'], rate: 1.3, fail: 0.7, bounce: true },
        ],
      }),
    },
    {
      short: 'Sticky',
      chapter: 'technique',
      title: 'Sticky sessions: a patch',
      body: [
        'A quick fix: tell the load balancer to always send you to the server that holds your session (a <b>sticky</b> or affinity cookie). Carts stop vanishing.',
        'But the balancer can no longer spread load freely: heavy shoppers stay pinned to one server, and a newly added server only gets brand-new visitors, so it barely helps during a spike.',
      ],
      metrics: { state: 'each server’s RAM', scale: { v: 'slow to help', tone: 'warn' } },
      scene: two({
        look: { s1: { badge: { text: 'your server', tone: 'info' } } },
        flows: [
          { route: ['ul', 's1'], rate: 2.2, bounce: true },
          { route: ['ul', 's2'], rate: 0.6, bounce: true },
        ],
      }),
    },
    {
      short: 'Restart',
      chapter: 'problem',
      title: 'Case: a server restarts',
      body: [
        'During the sale, web 1 runs out of memory and restarts. Every cart it was holding is gone. The balancer sends those shoppers to web 2, which knows nothing about them — they start again or leave.',
        'Deploys have the same effect: each server you restart to ship new code wipes its users’ sessions. Stickiness hid the state problem; it didn’t remove it.',
      ],
      metrics: { failover: { v: 'its carts are lost', tone: 'bad' } },
      scene: two({ look: { s1: { down: true } }, flows: [{ route: ['ul', 's2'], rate: 2.4, bounce: true, fail: 0.5 }] }),
    },
    {
      short: 'Move it out',
      chapter: 'solution',
      title: 'Move the state out',
      body: [
        'The fix is to keep sessions somewhere every server can reach: a <b>session store</b> such as Redis, replicated so it survives a node failure. Each request carries the session ID; whichever server receives it loads the cart, updates it, and saves it back.',
        'The web servers are now <b>stateless</b>: they hold nothing that outlives a request. Any server can handle any request, so the balancer can use plain least-connections again and no stickiness is needed.',
      ],
      callout: { kind: 'insight', text: 'Stateless doesn’t mean the system has no state. It means the state lives in a place designed to keep it.' },
      metrics: { state: { v: 'session store', tone: 'good' }, failover: { v: 'nothing lost', tone: 'good' }, scale: { v: 'just add one', tone: 'good' } },
      scene: two({ store: true }),
    },
    {
      short: 'Tokens',
      chapter: 'technique',
      title: 'Or carry it in a token',
      body: [
        'Another option is to store small state in the client: a <b>signed token</b> (for example a JWT or an encrypted cookie) holding the user ID, roles and expiry. Any server can verify the signature and trust the contents without asking anyone.',
        'Trade-offs: tokens travel with every request, so keep them small; and a token can’t easily be taken back before it expires, so revocation needs short lifetimes or a deny-list. Carts are usually too big and change too often — they stay server-side.',
      ],
      metrics: { state: 'token + store' },
      scene: two({
        store: true,
        shoppers: users(0, 0, { label: 'shoppers', badge: { text: 'signed token', tone: 'good' } }),
        extra: { card: card(23, -24, 'Token payload', ['user   4821', 'roles  [customer]', 'exp    12:40', '# signed — tamper-evident']) },
      }),
    },
    {
      short: 'Boring scaling',
      chapter: 'insight',
      title: 'Stateless makes scaling boring',
      body: [
        'With nothing to lose, servers become disposable. An autoscaler can add three servers when the sale starts and remove them at midnight. Deploys roll through the fleet one server at a time. A crashed server is replaced, not repaired.',
        'That boredom is the goal. Every interesting, hard-to-scale part of the system is now concentrated in a few places built for it: the session store and the database.',
      ],
      metrics: { scale: { v: 'autoscale freely', tone: 'good' } },
      scene: two({ store: true, more: true, look: { s3: { badge: { text: 'added at 09:00', tone: 'good' } } } }),
    },
    {
      short: 'Still state',
      chapter: 'tradeoff',
      title: 'The state still lives somewhere',
      body: [
        'Moving state out moves the responsibility, too. The session store must be replicated and monitored; if it goes down, every server is affected at once. The database holds orders and must be backed up and scaled on its own terms.',
        'Watch for state hiding in other corners: uploaded files written to a server’s local disk (put them in object storage), in-memory caches that must agree with each other, scheduled jobs that should run on exactly one machine.',
      ],
      scene: (() => {
        const base = two({ store: true, more: true });
        return {
          ...base,
          entities: {
            ...base.entities,
            db: db(36, 16, { label: 'orders db' }),
            card: card(38, -18, 'Hidden state checklist', ['sessions      → session store', 'uploads       → object storage', 'local caches  → shared cache', 'cron jobs     → one scheduler']),
          },
          links: { ...base.links, 's1-db': link('s1', 'db'), 's2-db': link('s2', 'db'), 's3-db': link('s3', 'db') },
          flows: [...(base.flows ?? []), { route: ['ul', 's2', 's2-db'], kind: 'write', rate: 0.5, bounce: true, returnKind: 'res' }],
        };
      })(),
    },
    {
      short: 'Recap',
      chapter: 'recap',
      title: 'Recap',
      body: [
        'Where you put state decides how easily you can scale:',
        `<table class="compare"><thead><tr><th>state in…</th><th>scale out</th><th>server dies</th></tr></thead><tbody>
          <tr><td>server memory</td><td class="bad">breaks sessions</td><td class="bad">sessions lost</td></tr>
          <tr><td>memory + sticky</td><td>slow to help</td><td class="bad">its sessions lost</td></tr>
          <tr><td>shared store</td><td class="good">add servers freely</td><td class="good">nothing lost</td></tr>
          <tr><td>signed token</td><td class="good">no lookup needed</td><td class="good">nothing lost</td></tr></tbody></table>`,
        'Check yourself: a server writes profile pictures to <code>/var/uploads</code>. What goes wrong when you add a second server, and what is the fix? (Half the requests can’t find the files; store uploads in shared object storage.)',
      ],
      scene: two({ store: true, more: true }),
    },
  ],
};
