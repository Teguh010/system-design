import type { Entity, Flow, Lesson, Link, Scene } from '../types.ts';
import { card, client, db, link, server, service } from './helpers.ts';

const BROWSER = client(0, 0, { label: 'you', sub: 'browser' });
const FAR = client(0, 19, { label: 'reader far away', sub: '300 ms RTT · mobile' });
const RESOLVER = service(11, -19, { label: 'DNS resolver', icon: 'globe' });
const AUTH = service(28, -25, { label: 'authoritative DNS', sub: 'news.example', icon: 'globe' });
const WEB = server(23, 0, { label: 'web server', sub: 'news.example', icon: 'server', count: 3 });
const DB = db(42, 0, { label: 'database', icon: 'database', fill: 0.45 });

const dnsLink = link('browser', 'resolver', { dashed: true, label: 'saved · 5 min' });

interface TripOpts {
  browser?: Partial<Entity>;
  resolver?: Partial<Entity>;
  web?: Partial<Entity>;
  db?: Partial<Entity> | false;
  dns?: Partial<Link>;
  request?: Partial<Link>;
  query?: Partial<Link>;
  far?: Partial<Link> | false;
  extra?: Record<string, Entity>;
  flows: Flow[];
}

/**
 * The whole journey stays on stage: you, the (now cached) resolver, the web server and the database.
 * Steps only change labels, meters, runtime trace cards and traffic.
 */
function trip(o: TripOpts): Scene {
  const entities: Record<string, Entity> = {
    browser: { ...BROWSER, ...o.browser },
    resolver: { ...RESOLVER, ...o.resolver },
    web: { ...WEB, ...o.web },
  };
  const links: Record<string, Link> = {
    br: { ...dnsLink, ...o.dns },
    bw: link('browser', 'web', { arrow: true, ...o.request }),
  };
  if (o.db !== false) {
    entities.db = { ...DB, ...o.db };
    links.wd = link('web', 'db', { arrow: true, ...o.query });
  }
  if (o.far) {
    entities.far = FAR;
    links.fw = link('far', 'web', { arrow: true, ...o.far });
  }
  Object.assign(entities, o.extra);
  return { entities, links, flows: o.flows };
}

const CPU = (value: number, tone: 'good' | 'warn' | 'bad' | 'info' = 'good') => ({ meter: { label: 'CPU', value, tone } });

export const requestLifecycle: Lesson = {
  id: 'request-lifecycle',
  title: 'How a Request Travels',
  summary: 'Follow one click from your browser to the database and back, put a time on every step, and see why some readers wait seconds.',
  minutes: 12,
  level: 'beginner',
  metrics: [
    { id: 'dns', label: 'DNS' },
    { id: 'connect', label: 'connect' },
    { id: 'server', label: 'request + server' },
    { id: 'download', label: 'download' },
    { id: 'total', label: 'page ready' },
  ],
  legend: ['req', 'res', ['ping', 'lookup / handshake'], ['slow', 'slow']],
  goals: [
    { text: 'Turn a domain name into an address with DNS', step: 2 },
    { text: 'Count the round trips before any data moves', step: 3 },
    { text: 'Read what an HTTP request actually contains', step: 4 },
    { text: 'Add up where page-load time goes', step: 7 },
    { text: 'Tell the two big sources of slowness apart: work and distance', step: 8 },
  ],
  steps: [
    {
      short: 'Feels slow',
      chapter: 'problem',
      title: 'Why does news.example feel slow?',
      body: [
        'Readers write in saying <code>news.example</code> takes ages to load. Yet when you click an article at your desk, it opens in about 0.4 seconds.',
        'To see why two people get such different speeds, trace one click from your screen to the server and back. The bar above counts each stop along the way.',
      ],
      callout: { kind: 'insight', text: 'A page load is a chain of small handoffs. Fix the slowest link first, or nothing changes.' },
      metrics: { dns: '?', connect: '?', server: '?', download: '?', total: { v: '0.4 s … 2 s+', tone: 'warn' } },
      scene: {
        entities: {
          browser: { ...BROWSER, focus: true },
          web: server(23, 0, { label: 'news.example', sub: 'somewhere out there', ghost: true, count: 3 }),
          trace: card(23, -18, 'Where does the time go?', [
            '✓ on your laptop:  ~0.4 s',
            '! some readers:     2.0 s+',
            '> follow 1 click step by step',
          ]),
        },
        links: { bw: link('browser', 'web', { dashed: true, arrow: true, label: 'click → article' }) },
        flows: [{ route: ['bw'], rate: 0.6, bounce: true }],
      },
    },
    {
      short: 'Find address',
      chapter: 'technique',
      title: 'Turn a name into a number: DNS',
      body: [
        'Machines find each other by IP address, not by name. Your browser checks its own memory, then your computer’s. If neither has it, it asks a <b>DNS resolver</b> (usually run by your ISP), which tracks down the real number: <code>203.0.113.7</code>.',
        'A fresh lookup takes a few quick trips, about <b>40 ms</b> here. The answer comes with a <b>TTL</b> (“keep this for 5 minutes”), so the next clicks skip this step completely.',
      ],
      callout: { kind: 'tip', text: 'Short TTLs let you move traffic fast during an outage. Long TTLs keep lookups free for repeat visitors.' },
      changes: ['+ browser asks a DNS resolver for news.example'],
      metrics: { dns: '40 ms' },
      scene: {
        entities: {
          browser: { ...BROWSER, badge: { text: 'no IP yet', tone: 'warn' } },
          resolver: { ...RESOLVER, sub: 'ISP / public', badge: { text: 'not cached', tone: 'warn' } },
          auth: AUTH,
          web: server(23, 0, { label: 'news.example', sub: '203.0.113.7', ghost: true, count: 3 }),
          trace: card(24, 21, 'DNS lookup · 40 ms', [
            '# 1. browser cache: miss',
            '# 2. OS cache:      miss',
            '> 3. ask DNS → 203.0.113.7',
            '✓ 4. save for 5 min (TTL)',
          ]),
        },
        links: {
          br: link('browser', 'resolver', { arrow: true, label: 'news.example?' }),
          ra: link('resolver', 'auth', { arrow: true, label: 'find real IP' }),
          bw: link('browser', 'web', { dashed: true, label: 'needs IP first' }),
        },
        flows: [{ route: ['br', 'ra'], kind: 'ping', rate: 0.7, bounce: true, returnKind: 'ping' }],
      },
    },
    {
      short: 'Connect',
      chapter: 'technique',
      title: 'Agree to talk and lock the line',
      body: [
        'Before any data moves, the two machines shake hands twice. First, <b>TCP</b> opens a reliable connection in one round trip. Then <b>TLS</b> checks the server’s identity and locks the line with encryption — one more round trip.',
        'At 30 ms per <b>round trip</b> (RTT), two handshakes cost <b>60 ms</b> of pure waiting. Faster internet bandwidth doesn’t help here: tiny “hello” messages still have to cross the distance twice.',
      ],
      callout: { kind: 'insight', text: 'Round-trip time (RTT) is the unit of network delay. Count the round trips, then multiply.' },
      changes: ['+ IP saved at the resolver for 5 minutes', '+ TCP + TLS handshakes: 2 round trips × 30 ms'],
      metrics: { connect: '60 ms' },
      scene: trip({
        db: false,
        resolver: { badge: { text: 'saved · 5 min', tone: 'good' } },
        web: { sub: '203.0.113.7', badge: { text: 'TLS · open', tone: 'good' } },
        request: { label: 'TCP + TLS · 2 RTT' },
        extra: {
          trace: card(24, 21, 'Handshake · 2 RTT = 60 ms', [
            '✓ 1. TCP (1 RTT): agree to talk',
            '> 2. TLS (1 RTT): prove ID + lock',
            '✓ encrypted line ready (60 ms)',
            '# 0 bytes of article sent yet',
          ]),
        },
        flows: [{ route: ['bw'], kind: 'ping', rate: 1.2, bounce: true, returnKind: 'ping' }],
      }),
    },
    {
      short: 'Request',
      chapter: 'technique',
      title: 'Send the request',
      body: [
        'Now the line is open, so the browser sends an <b>HTTP request</b> — a few hundred bytes of plain text saying what it wants (<code>GET</code> this article), which site it is for, your language, and a cookie identifying your session.',
        'Because the connection is already open, this takes half a round trip to arrive: <b>15 ms</b>. The server reads it, checks your cookie, and starts building the page.',
      ],
      changes: ['+ GET request over the open connection (15 ms one way)'],
      metrics: { server: '30 ms + work' },
      scene: trip({
        db: false,
        browser: { badge: { text: 'line open', tone: 'info' } },
        web: { badge: { text: 'reads request', tone: 'info' } },
        request: { label: 'GET /storm-warning' },
        extra: {
          trace: card(24, 21, 'HTTP request · ~400 B', [
            '> GET /2026/11/storm-warning',
            '  Host: news.example',
            '  Lang: en · Cookie: 7f3a…',
            '✓ arrives in 15 ms (half RTT)',
          ]),
        },
        flows: [{ route: ['bw'], rate: 1.2, bounce: true }],
      }),
    },
    {
      short: 'Fetch data',
      chapter: 'technique',
      title: 'Fetch the data and build the page',
      body: [
        'The article text, author, and comments live in a <b>database</b>. Inside the data centre, machines sit close together — a round trip takes half a millisecond. Three quick queries fetch what is needed, and the server builds the HTML.',
        'All of that server work takes just <b>25 ms</b>, with the CPU barely busy at 20%. When things are healthy, a request spends far more time travelling than being worked on.',
      ],
      changes: ['+ 3 queries inside the data centre, ~25 ms of work'],
      chaos: {
        db: {
          text: 'The web server still answers, but it cannot build the article without its data. Readers get an error page instead. Click again to repair it.',
          metrics: { server: { v: '500 error', tone: 'bad' }, total: { v: 'error page', tone: 'bad' } },
        },
        web: {
          text: 'DNS still points at <code>203.0.113.7</code>, but nothing answers there. Readers wait until the connection times out. With one server, one failure takes the whole site down — Module 02 fixes that.',
          metrics: { connect: { v: 'timeout', tone: 'bad' }, total: { v: 'site down', tone: 'bad' } },
        },
        resolver: {
          text: 'Nothing breaks — yet. Your browser already saved the address for 5 minutes. Only new visitors (or everyone once the 5 minutes expire) get stuck.',
        },
      },
      metrics: { server: '55 ms' },
      scene: trip({
        web: CPU(0.2),
        db: { badge: { text: '3 queries · 15 ms', tone: 'good' } },
        request: { label: 'GET /storm-warning' },
        query: { label: '3 queries · 0.5 ms' },
        extra: {
          trace: card(24, 22, 'Server work · 25 ms', [
            '✓ 1. check session     1 ms',
            '✓ 2. read article      5 ms',
            '✓ 3. read author       4 ms',
            '✓ 4. read comments     6 ms',
            '> 5. build HTML        9 ms',
          ]),
        },
        flows: [{ route: ['bw', 'wd'], rate: 1.6, bounce: true }],
      }),
    },
    {
      short: 'Response',
      chapter: 'solution',
      title: 'The first byte comes back',
      body: [
        'The finished HTML flows back over the open line. The moment the first byte arrives — here at <b>155 ms</b> — is called <b>time to first byte</b> (TTFB): DNS + handshakes + request + server work + return trip.',
        'The rest of the HTML follows in 15 ms. Your browser starts drawing straight away — and while reading the HTML, discovers it needs forty more files.',
      ],
      callout: { kind: 'tip', text: 'TTFB measures your backend and connection speed together. Everything after it is downloading extra files and drawing.' },
      changes: ['+ first byte of HTML arrives at ~155 ms', '~ database queries are done; HTML streams back'],
      metrics: { download: '15 ms', total: '170 ms' },
      scene: trip({
        browser: { badge: { text: 'TTFB 155 ms', tone: 'good' } },
        web: { ...CPU(0.1), badge: { text: 'sending HTML', tone: 'good' } },
        db: { badge: { text: 'done', tone: 'good' } },
        request: { label: 'HTML · 1st byte @ 155 ms', labelTone: 'good' },
        query: { dashed: true, label: 'idle' },
        extra: {
          trace: card(24, 22, 'TTFB · 155 ms', [
            '✓ DNS + TCP + TLS    100 ms',
            '✓ request + server    40 ms',
            '✓ first byte back     15 ms',
            '> read HTML (+15 ms stream)',
            '# needs 40 more files inside',
          ]),
        },
        flows: [{ route: ['~bw'], kind: 'res', rate: 1.8, speed: 170 }],
      }),
    },
    {
      short: 'More files',
      chapter: 'technique',
      title: 'One page, forty more files',
      body: [
        'The HTML points to stylesheets, scripts, fonts, and photos — about forty files. Fetching them one by one would cost forty round trips, so with <b>HTTP/2</b> the browser requests many at once over the same open connection.',
        'Some files are only discovered after others arrive, so they land in a few waves: <b>245 ms</b>. Add the bar up: 40 + 60 + 55 + 245 = <b>400 ms</b> — the 0.4 seconds on your laptop.',
      ],
      changes: ['+ 40 extra files over the same open connection'],
      metrics: { download: '245 ms', total: { v: '400 ms', tone: 'good' } },
      scene: trip({
        browser: { badge: { text: 'HTTP/2 · 1 pipe', tone: 'info' } },
        web: { ...CPU(0.3), badge: { text: '40 files sent', tone: 'good' } },
        request: { label: '40 files · HTTP/2' },
        query: { label: 'read article · 5 ms' },
        extra: {
          trace: card(24, 21, 'HTTP/2 download · 245 ms', [
            '✓ reuses open line (0 ms setup)',
            '✓ wave 1: CSS + JS together',
            '✓ wave 2: fonts + 38 images',
            '> total: 40+60+55+245 = 400 ms',
          ]),
        },
        flows: [
          { route: ['bw', 'wd'], rate: 0.8, bounce: true },
          { route: ['bw'], rate: 3, bounce: true, speed: 200 },
        ],
      }),
    },
    {
      short: 'Slow query',
      chapter: 'problem',
      title: 'Why some pages stall: 41 queries instead of 1',
      body: [
        'One group of complaints comes from popular articles with many comments. The code fetches the comment list (1 query), then fetches each commenter’s name in a separate query — <b>40 extra trips</b> to the database. At ~10 ms each, that adds <b>410 ms</b>.',
        'Look at the server’s CPU: it actually <i>drops</i> to 15%, because it spends its time waiting. This is an <b>N+1 query</b>. Combining them into one query brings server time right back to normal.',
      ],
      callout: { kind: 'warning', text: 'Measure before buying hardware. Low CPU plus slow server time usually means waiting on too many queries.' },
      changes: ['+ comments fetch each author separately: 40 extra queries', '~ CPU drops to 15% — waiting, not working'],
      metrics: { server: { v: '440 ms', tone: 'bad' }, total: { v: '785 ms', tone: 'bad' } },
      scene: trip({
        web: { ...CPU(0.15, 'info'), badge: { text: 'waiting on DB', tone: 'warn' } },
        db: { badge: { text: '41 queries · 410 ms', tone: 'bad' } },
        request: { label: 'GET /storm-warning' },
        query: { label: 'read author × 40', labelTone: 'bad' },
        extra: {
          trace: card(24, 22, 'N+1 query · 410 ms', [
            '✓ 1× read 40 comments  10 ms',
            '! 40× read author     400 ms',
            '! CPU drops to 15% (waiting!)',
            '> fix: 1 combined query → ~15 ms',
          ]),
        },
        flows: [
          { route: ['bw'], rate: 0.5, bounce: true, speed: 90 },
          { route: ['wd'], kind: 'slow', rate: 1.6, bounce: true, speed: 90 },
        ],
      }),
    },
    {
      short: 'Far away',
      chapter: 'problem',
      title: 'Why distant readers wait two seconds',
      body: [
        'The worst complaints come from a reader on mobile on another continent. Their round trip is <b>300 ms</b> instead of 30 — ten times farther. Every round trip on the list now costs 10× as much.',
        'The server is just as fast as before (25 ms of work). Yet handshakes take 600 ms and the forty files take a full second. Out of ~2.0 seconds, <b>99% is pure distance</b>.',
      ],
      callout: { kind: 'insight', text: 'Slowness has two big sources: work on the server and distance on the network. Each needs a different fix.' },
      changes: ['+ a reader 300 ms away joins the stage', '~ N+1 fixed: server work is back to 25 ms', '~ every round trip costs 10× more'],
      metrics: {
        dns: { v: '100 ms', tone: 'warn' },
        connect: { v: '600 ms', tone: 'bad' },
        server: { v: '325 ms', tone: 'warn' },
        download: { v: '1,000 ms', tone: 'bad' },
        total: { v: '~2.0 s', tone: 'bad' },
      },
      scene: trip({
        browser: { sub: 'nearby · 30 ms RTT', badge: { text: '400 ms total', tone: 'good' } },
        web: { ...CPU(0.2), badge: { text: 'work still 25 ms', tone: 'good' } },
        db: { badge: { text: 'healthy · 5 ms', tone: 'good' } },
        request: { label: 'RTT 30 ms' },
        query: { label: 'read article · 5 ms' },
        far: { label: 'RTT 300 ms (10×)', labelTone: 'bad' },
        extra: {
          far: { ...FAR, badge: { text: '~2.0 s total', tone: 'bad' } },
          trace: card(30, 24, 'Same work, 10× distance', [
            '✓ server work: still 25 ms (1%)',
            '! DNS cold:             100 ms',
            '! TCP + TLS (2 RTT):    600 ms',
            '! request + reply:      300 ms',
            '! 40 files (~3.3 RTT): 1,000 ms',
            '> 99% of ~2.0 s is distance',
          ]),
        },
        flows: [
          { route: ['bw', 'wd'], rate: 0.8, bounce: true },
          { route: ['fw'], kind: 'slow', rate: 0.8, bounce: true, speed: 45 },
        ],
      }),
    },
    {
      short: 'Recap',
      chapter: 'recap',
      title: 'Where the time went',
      body: [
        'One click, a handful of conversations between machines, and a total that adds them up. Keep this checklist for the next time a page feels slow:',
        `<table class="compare"><thead><tr><th>step</th><th>typical cost</th><th>slow when…</th><th>see</th></tr></thead><tbody>
          <tr><td>DNS lookup</td><td>20–100 ms cold</td><td>nothing is cached</td><td>this lesson</td></tr>
          <tr><td>TCP + TLS</td><td>2 round trips</td><td>the reader is far away</td><td>CDNs</td></tr>
          <tr><td>request + server</td><td>1 round trip + work</td><td>too many or slow queries</td><td>Caching, Indexes</td></tr>
          <tr><td>download</td><td>a few waves</td><td>files discovered one by one</td><td>Caching, CDNs</td></tr></tbody></table>`,
        'Check yourself: a reader 200 ms away complains, and your server work takes 20 ms. Which helps more — a faster database or fewer round trips? (Fewer round trips: each one costs ten times your entire server time — try it below.)',
      ],
      callout: { kind: 'insight', text: 'Latency is addition. Write down the parts, find the biggest number, and shrink that one first.' },
      scene: trip({
        browser: { sub: 'nearby · 30 ms RTT', badge: { text: '400 ms', tone: 'good' } },
        web: CPU(0.2),
        request: { label: 'RTT 30 ms' },
        query: { label: 'read article · 5 ms' },
        far: { label: 'RTT 300 ms', labelTone: 'warn' },
        extra: {
          far: { ...FAR, badge: { text: '~2.0 s', tone: 'bad' } },
          trace: card(30, 23, 'Where time goes', [
            'total = DNS + TLS + (RTT+work) + dl',
            '✓ nearby (30 ms RTT):    400 ms',
            '! far (300 ms RTT):    ~2,000 ms',
            '> shrink the biggest term first',
          ]),
        },
        flows: [
          { route: ['bw', 'wd'], rate: 1, bounce: true },
          { route: ['fw'], kind: 'slow', rate: 0.5, bounce: true, speed: 45 },
        ],
      }),
    },
  ],
};
