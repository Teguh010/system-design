import type { Entity, Flow, Lesson, Link, Scene } from '../types.ts';
import { card, client, db, link, server, service } from './helpers.ts';

const BROWSER = client(0, 0, { label: 'you', sub: 'browser' });
const FAR = client(0, 19, { label: 'reader far away', sub: 'mobile, other continent' });
const RESOLVER = service(11, -19, { label: 'DNS resolver', icon: 'globe' });
const AUTH = service(28, -25, { label: 'authoritative DNS', sub: 'news.example', icon: 'globe' });
const WEB = server(23, 0, { label: 'web server', sub: 'news.example', icon: 'server', count: 3 });
const DB = db(42, 0, { label: 'database', icon: 'database', fill: 0.45 });

const CACHED = RESOLVER;
const dnsLink = link('browser', 'resolver', { dashed: true, label: 'cached · 5 min' });

interface TripOpts {
  web?: Partial<Entity>;
  db?: Partial<Entity> | false;
  request?: Partial<Link>;
  query?: Partial<Link>;
  far?: Partial<Link> | false;
  extra?: Record<string, Entity>;
  flows: Flow[];
}

/**
 * The whole journey stays on stage: you, the (now cached) resolver, the web server and the database.
 * Steps only change labels, meters and traffic.
 */
function trip(o: TripOpts): Scene {
  const entities: Record<string, Entity> = { browser: BROWSER, resolver: CACHED, web: { ...WEB, ...o.web } };
  const links: Record<string, Link> = { br: dnsLink, bw: link('browser', 'web', { arrow: true, ...o.request }) };
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
  summary: 'Follow one click from the browser to the database and back, put a time on every hop, and find out why some readers wait seconds.',
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
      title: 'Readers say the site is slow',
      body: [
        'A news site, <code>news.example</code>, gets a stream of complaints: “articles take ages to open”. The team’s own tests look fine — about 0.4 seconds from click to page. Yet some readers clearly wait two seconds or more.',
        'To find out why, follow one request from the moment a reader clicks a headline until the article is on screen, and put a time on every hop. The bar above the diagram will add the hops up as we go.',
      ],
      callout: { kind: 'insight', text: 'You can only fix “slow” once you know which hop is slow. Start by listing the hops.' },
      metrics: { dns: '?', connect: '?', server: '?', download: '?', total: { v: '0.4 s … 2 s+', tone: 'warn' } },
      scene: {
        entities: {
          browser: { ...BROWSER, focus: true },
          web: server(23, 0, { label: 'news.example', sub: 'somewhere out there', ghost: true, count: 3 }),
          card: card(23, -17, 'Reader complaints', ['usually opens in ~0.4 s', '! some readers wait 2 s or more', '# where does the time go?']),
        },
        links: { bw: link('browser', 'web', { dashed: true, arrow: true, label: 'click' }) },
        flows: [{ route: ['bw'], rate: 0.6, bounce: true }],
      },
    },
    {
      short: 'Find address',
      chapter: 'technique',
      title: 'Find the address: DNS',
      body: [
        'Networks route by IP address, not by name. The browser checks its own cache, then the operating system’s. On a miss it asks a <b>recursive resolver</b> — usually run by your ISP or a public service — which walks the DNS hierarchy (root, then <code>.example</code>, then the domain’s <b>authoritative</b> server) and returns an address such as <code>203.0.113.7</code>.',
        'A cold lookup costs a few round trips, often 20–100 ms. The answer comes with a <b>TTL</b>, so for a while every later lookup is answered from a cache in well under a millisecond.',
      ],
      callout: { kind: 'tip', text: 'Short TTLs let you move traffic quickly during an incident; long TTLs make lookups cheaper. Choose per record.' },
      changes: ['+ browser asks a resolver for news.example'],
      metrics: { dns: '40 ms' },
      scene: {
        entities: {
          browser: BROWSER,
          resolver: RESOLVER,
          auth: AUTH,
          web: server(23, 0, { label: 'news.example', sub: '203.0.113.7', ghost: true, count: 3 }),
        },
        links: {
          br: link('browser', 'resolver', { arrow: true, label: 'news.example?' }),
          ra: link('resolver', 'auth', { arrow: true, label: 'not cached: ask' }),
          bw: link('browser', 'web', { dashed: true }),
        },
        flows: [{ route: ['br', 'ra'], kind: 'ping', rate: 0.7, bounce: true, returnKind: 'ping' }],
      },
    },
    {
      short: 'Connect',
      chapter: 'technique',
      title: 'Open a connection',
      body: [
        'Before a single byte of the article moves, the two sides set up a connection. <b>TCP</b> agrees on sequence numbers in one round trip. <b>TLS</b> then proves the server really is <code>news.example</code> and agrees on encryption keys — one more round trip with TLS 1.3.',
        'If the server is 30 ms away, that is 60 ms of pure waiting. Bandwidth doesn’t help: handshakes are a few tiny messages, and each one pays the full round trip. Notice the resolver stays put — its answer is cached now.',
      ],
      callout: { kind: 'insight', text: 'Round-trip time (RTT) is the unit of network latency. Count the round trips, then multiply.' },
      changes: ['+ DNS answer cached for 5 minutes', '+ TCP + TLS handshake: 2 round trips of 30 ms'],

      metrics: { connect: '60 ms' },
      scene: trip({
        db: false,
        web: { sub: '203.0.113.7' },
        request: { label: 'TCP + TLS · 2 RTT' },
        flows: [{ route: ['bw'], kind: 'ping', rate: 1.2, bounce: true, returnKind: 'ping' }],
      }),
    },
    {
      short: 'Request',
      chapter: 'technique',
      title: 'Send the request',
      body: [
        'Now the browser sends an <b>HTTP request</b>: a few hundred bytes of text naming a <b>method</b> (<code>GET</code>), a <b>path</b> (the article), and <b>headers</b> — the host name, the reader’s preferred language, and a cookie that identifies their session.',
        'It travels over the connection that is already open, so it costs half a round trip to arrive. The server reads it, checks the cookie, and works out what it has to produce.',
      ],
      changes: ['+ GET request over the open connection (15 ms one way)'],
      metrics: { server: '30 ms + work' },
      scene: trip({
        db: false,
        request: { label: 'GET /storm-warning' },
        extra: { card: card(40, -16, 'HTTP request', ['GET /2026/11/storm-warning', 'Host: news.example', 'Accept-Language: en', 'Cookie: session=7f3a…']) },
        flows: [{ route: ['bw'], rate: 1.2, bounce: true }],
      }),
    },
    {
      short: 'Fetch data',
      chapter: 'technique',
      title: 'The server asks the database',
      body: [
        'The article’s text, author and comments live in a database. The web server sends it a few queries over a connection inside the data centre, where a round trip takes about half a millisecond. A well-indexed query finishes in a few milliseconds; rendering the HTML takes a few more.',
        'Notice how small these numbers are next to the network: about 25 ms of work, with the CPU barely busy. A typical request spends more time travelling than being worked on — as long as the server does a sensible amount of work.',
      ],
      changes: ['+ 3 queries inside the data centre, ~25 ms of work'],
      chaos: {
        db: {
          text: 'The web server still answers, but it cannot build the article without its data. Readers get an error page — or wait for a timeout if the server keeps trying. One dependency down takes this page down.',
          metrics: { server: { v: '500 error', tone: 'bad' }, total: { v: 'error page', tone: 'bad' } },
        },
        web: {
          text: 'DNS still points at <code>203.0.113.7</code>, but nothing answers there. The browser waits for the connection until it gives up. With one server, one failure means the whole site is down — Module 02 puts several servers behind one address.',
          metrics: { connect: { v: 'timeout', tone: 'bad' }, total: { v: 'site down', tone: 'bad' } },
        },
        resolver: {
          text: 'Nothing happens — yet. The browser already has the address, cached for 5 minutes. When that TTL runs out, new visitors cannot find the site even though the server is healthy.',
        },
      },
      metrics: { server: '55 ms' },
      scene: trip({
        web: CPU(0.2),
        request: { label: 'GET /storm-warning' },
        query: { label: 'SELECT article · 5 ms' },
        flows: [{ route: ['bw', 'wd'], rate: 1.6, bounce: true }],
      }),
    },
    {
      short: 'Response',
      chapter: 'solution',
      title: 'The response comes back',
      body: [
        'The HTML streams back the way it came. The moment its first byte arrives is called <b>time to first byte</b> (TTFB): DNS + handshakes + the request trip + server work, here about 155 ms. The rest of the HTML follows within ~15 ms.',
        'The browser starts drawing straight away — and discovers, while reading the HTML, that it needs more.',
      ],
      callout: { kind: 'tip', text: 'TTFB is the number to watch for your backend. Most of what happens after it is front-end work and network.' },
      changes: ['+ HTML arrives: first byte after ~155 ms'],
      metrics: { download: '15 ms', total: '170 ms' },
      scene: trip({
        web: CPU(0.2),
        request: { label: 'HTML · first byte at 155 ms', labelTone: 'good' },
        query: { label: 'SELECT article · 5 ms' },
        flows: [{ route: ['bw', 'wd'], rate: 1.6, bounce: true }],
      }),
    },
    {
      short: 'More files',
      chapter: 'technique',
      title: 'One page, forty more files',
      body: [
        'The HTML references stylesheets, scripts, fonts and images — around forty files. Fetching them one after another would cost forty round trips, so the browser requests many at once; with HTTP/2 they all share the connection that is already open.',
        'They still take a few round trips — some files are only discovered once others arrive — plus the time to download the bytes. Add the bar up: 40 + 60 + 55 + 245 ≈ 400 ms. That is the 0.4 s the team measured.',
      ],
      changes: ['+ 40 more files over the same connection'],
      metrics: { download: '245 ms', total: { v: '400 ms', tone: 'good' } },
      scene: trip({
        web: CPU(0.3),
        request: { label: '40 files · HTTP/2' },
        query: { label: 'SELECT article · 5 ms' },
        flows: [
          { route: ['bw', 'wd'], rate: 0.8, bounce: true },
          { route: ['bw'], rate: 3, bounce: true, speed: 200 },
        ],
      }),
    },
    {
      short: 'Slow query',
      chapter: 'problem',
      title: 'Case: forty-one queries for one page',
      body: [
        'One group of complaints comes from popular articles. Their comment section loads the comments, then looks up each commenter in a separate query: 1 query for the list plus 40 for the authors. At ~10 ms each that is about 410 ms, and every reader of that article waits for it.',
        'Look at the server: its CPU is <i>quieter</i> than before, because it spends its time waiting. This is the classic <b>N+1 query</b> problem. One query that fetches comments and authors together brings server time back to normal. Same network, same handshakes — the fix is in the database access.',
      ],
      callout: { kind: 'warning', text: 'Measure before optimising. When the network is fine but the server column grows, count the queries before buying hardware.' },
      changes: ['+ comments load each author separately: 40 extra queries', '~ server CPU drops — it is waiting, not working'],

      metrics: { server: { v: '440 ms', tone: 'bad' }, total: { v: '785 ms', tone: 'bad' } },
      scene: trip({
        web: CPU(0.15),
        db: { badge: { text: '41 queries · 410 ms', tone: 'bad' } },
        request: { label: 'GET /storm-warning' },
        query: { label: 'SELECT author × 40', labelTone: 'bad' },
        flows: [
          { route: ['bw'], rate: 0.5, bounce: true, speed: 90 },
          { route: ['wd'], kind: 'slow', rate: 1.6, bounce: true, speed: 90 },
        ],
      }),
    },
    {
      short: 'Far away',
      chapter: 'problem',
      title: 'Case: a reader far away',
      body: [
        'The worst complaints come from a reader on a mobile network on another continent. Their round trip to the server is about 300 ms instead of 30. Every round trip on the list is now ten times more expensive: two for the handshakes, one for the request, several for the files discovered along the way.',
        'Time to first byte alone passes one second, and the page lands after two. The server is just as fast as before — the time is all distance. Fewer round trips and content placed closer to readers are the fixes, and the subject of later lessons.',
      ],
      callout: { kind: 'insight', text: 'Latency has two big sources: work on the server and distance on the network. They need different fixes.' },
      changes: ['+ a reader with a 300 ms round trip', '~ N+1 fixed: server work is back to normal', '~ every round trip costs 10× more'],

      metrics: {
        dns: { v: '100 ms', tone: 'warn' },
        connect: { v: '600 ms', tone: 'bad' },
        server: { v: '325 ms', tone: 'warn' },
        download: { v: '1,000 ms', tone: 'bad' },
        total: { v: '~2.0 s', tone: 'bad' },
      },
      scene: trip({
        web: CPU(0.2),
        request: { label: 'RTT 30 ms' },
        query: { label: 'SELECT article · 5 ms' },
        far: { label: 'RTT 300 ms', labelTone: 'bad' },
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
        'One click, a handful of hops, and a bar that adds them up. Keep this table as a checklist the next time a page feels slow:',
        `<table class="compare"><thead><tr><th>hop</th><th>typical cost</th><th>slow when…</th><th>see</th></tr></thead><tbody>
          <tr><td>DNS lookup</td><td>20–100 ms cold</td><td>nothing is cached</td><td>this lesson</td></tr>
          <tr><td>TCP + TLS</td><td>2 round trips</td><td>the reader is far away</td><td>CDNs</td></tr>
          <tr><td>request + server</td><td>1 round trip + work</td><td>too many or unindexed queries</td><td>Caching, Indexes</td></tr>
          <tr><td>download</td><td>a few round trips</td><td>files are discovered one by one</td><td>Caching, CDNs</td></tr></tbody></table>`,
        'Check yourself: a reader 200 ms away complains, and your server time is 20 ms. Which helps more — a faster database or fewer round trips? (Fewer round trips: each one costs ten times the whole server time.)',
      ],
      callout: { kind: 'insight', text: 'Latency is a sum. Write down the terms, find the biggest, and shrink that one first.' },
      scene: trip({
        web: CPU(0.2),
        request: { label: 'RTT 30 ms' },
        query: { label: 'SELECT article · 5 ms' },
        far: { label: 'RTT 300 ms', labelTone: 'warn' },
        flows: [
          { route: ['bw', 'wd'], rate: 1, bounce: true },
          { route: ['fw'], kind: 'slow', rate: 0.5, bounce: true, speed: 45 },
        ],
      }),
    },
  ],
};
