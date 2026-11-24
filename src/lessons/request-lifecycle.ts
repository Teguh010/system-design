import type { Flow, Lesson, Link, Scene } from '../types.ts';
import { card, cdn, db, lb, link, server, service, spread, users } from './helpers.ts';

const BROWSER = users(0, 0, { label: 'browser', count: 1 });
const RESOLVER = service(12, -16, { label: 'DNS resolver' });
const AUTH = service(26, -20, { label: 'authoritative DNS', sub: 'news.example' });
const EDGE = lb(14, 0, { label: 'load balancer', sub: '203.0.113.7' });
const APP = server(26, -8, { label: 'app server' });
const APP2 = server(26, 8, { label: 'app server' });
const DB = db(38, 0, { label: 'database' });
const CDN = cdn(8, 18, { label: 'CDN', sub: 'static files, 5 ms away' });
const ADS = service(26, 24, { label: 'ads.partner', sub: 'third-party script' });

const backend: Record<string, Link> = {
  be: link('browser', 'edge'),
  ea: link('edge', 'app'),
  ea2: link('edge', 'app2'),
  ad: link('app', 'db'),
  ad2: link('app2', 'db'),
};

const pageLoad = (rate = 2.2): Flow[] =>
  spread(
    [
      ['be', 'ea', 'ad'],
      ['be', 'ea2', 'ad2'],
    ],
    rate,
    { bounce: true },
  );

function full(extra: Partial<Scene> & { browserBadge?: boolean } = {}): Scene {
  return {
    entities: {
      browser: extra.browserBadge ? { ...BROWSER, badge: { text: 'cache warm', tone: 'good' } } : BROWSER,
      edge: EDGE,
      app: APP,
      app2: APP2,
      db: DB,
      cdn: CDN,
      ...extra.entities,
    },
    links: { ...backend, bc: link('browser', 'cdn'), ...extra.links },
    flows: [...pageLoad(), { route: ['bc'], rate: 4, bounce: true }, ...(extra.flows ?? [])],
  };
}

export const requestLifecycle: Lesson = {
  id: 'request-lifecycle',
  title: 'How a Request Travels',
  summary: 'Follow one click from the browser to the database and back, and put a time on every hop.',
  minutes: 12,
  level: 'beginner',
  metrics: [
    { id: 'dns', label: 'DNS lookup' },
    { id: 'connect', label: 'connection' },
    { id: 'server', label: 'server time' },
    { id: 'total', label: 'page ready' },
  ],
  legend: ['req', 'res', ['ping', 'lookup / handshake'], ['slow', 'slow response'], 'fail'],
  goals: [
    { text: 'Turn a domain name into an address with DNS', step: 2 },
    { text: 'Count the round trips before the first byte', step: 3 },
    { text: 'See what happens inside the data centre', step: 4 },
    { text: 'Explain why static files and repeat visits are cheaper', step: 7 },
    { text: 'Spot the slowest hop on the critical path', step: 9 },
  ],
  steps: [
    {
      short: 'A click',
      chapter: 'setup',
      title: 'A click, then a page',
      body: [
        'You click a headline on <code>news.example</code> and, about half a second later, the article is on screen. That half second hides a surprising amount of work: a name lookup, two handshakes, a trip through several machines and a database query.',
        'This lesson follows one request end to end and puts a time on every hop. Once you can see where the time goes, you know where to look when a page is slow.',
      ],
      callout: { kind: 'insight', text: 'Almost every performance question starts with “which hop is slow?” You can only answer it if you know the hops.' },
      metrics: { dns: '?', connect: '?', server: '?', total: '~0.5 s' },
      scene: {
        entities: {
          browser: BROWSER,
          edge: service(14, 0, { label: 'news.example', sub: 'somewhere out there', ghost: true }),
          card: card(14, -16, 'One click', ['you click   news.example/today', 'page shows  ~0.5 s later', '# what happened in between?']),
        },
        links: { be: link('browser', 'edge', { dashed: true }) },
        flows: [{ route: ['be'], rate: 0.8, bounce: true }],
      },
    },
    {
      short: 'DNS',
      chapter: 'technique',
      title: 'Names to numbers: DNS',
      body: [
        'Networks route by IP address, not by name. The browser checks its own cache, then the operating system’s. On a miss it asks a <b>recursive resolver</b> — usually run by your ISP or a public service — which walks the DNS hierarchy (root, then <code>.example</code>, then the domain’s <b>authoritative</b> server) and returns an address such as <code>203.0.113.7</code>.',
        'A cold lookup costs a few round trips, often 20–100 ms. The answer comes with a <b>TTL</b>, so for a while every later lookup is answered from a cache in well under a millisecond.',
      ],
      callout: { kind: 'tip', text: 'Short TTLs let you move traffic quickly during an incident; long TTLs make lookups cheaper. Choose per record.' },
      metrics: { dns: '~40 ms' },
      scene: {
        entities: {
          browser: BROWSER,
          resolver: RESOLVER,
          auth: AUTH,
          edge: service(14, 0, { label: 'news.example', sub: '203.0.113.7', ghost: true }),
          card: card(44, -12, 'DNS answer', ['news.example  A  203.0.113.7', 'TTL           300 s', '# cached by resolver, OS, browser']),
        },
        links: { br: link('browser', 'resolver'), ra: link('resolver', 'auth'), be: link('browser', 'edge', { dashed: true }) },
        flows: [{ route: ['br', 'ra'], kind: 'ping', rate: 0.9, bounce: true, returnKind: 'ping' }],
      },
    },
    {
      short: 'Handshakes',
      chapter: 'technique',
      title: 'Handshakes before data',
      body: [
        'Before a single byte of the page moves, the two sides set up a connection. <b>TCP</b> agrees on sequence numbers in one round trip. <b>TLS</b> then proves the server really is <code>news.example</code> and agrees on encryption keys — one more round trip with TLS 1.3.',
        'If the server is 30 ms away, that is 60 ms of pure waiting. Bandwidth doesn’t help: handshakes are a few tiny messages, and each one pays the full round trip.',
      ],
      callout: { kind: 'insight', text: 'Round-trip time (RTT) is the unit of network latency. Count the round trips, then multiply.' },
      metrics: { connect: '~60 ms' },
      scene: {
        entities: {
          browser: BROWSER,
          edge: EDGE,
          card: card(14, -16, 'Before any data', ['TCP  SYN → SYN-ACK → ACK   1 RTT', 'TLS  certificate + keys     1 RTT', '# RTT 30 ms → 60 ms of waiting']),
        },
        links: { be: link('browser', 'edge') },
        flows: [{ route: ['be'], kind: 'ping', rate: 1.4, bounce: true, returnKind: 'ping' }],
      },
    },
    {
      short: 'Front door',
      chapter: 'technique',
      title: 'Through the front door',
      body: [
        'The address usually belongs to a <b>load balancer</b> or reverse proxy, not to the application itself. It terminates TLS, picks a healthy app server and forwards the HTTP request: <code>GET /today</code>, plus headers and cookies.',
        'Inside a data centre, hops are cheap — around half a millisecond each — so an extra proxy layer costs almost nothing compared with the trip from your browser.',
      ],
      scene: {
        entities: { browser: BROWSER, edge: EDGE, app: APP, app2: APP2 },
        links: { be: backend.be!, ea: backend.ea!, ea2: backend.ea2! },
        flows: spread(
          [
            ['be', 'ea'],
            ['be', 'ea2'],
          ],
          2,
          { bounce: true },
        ),
      },
    },
    {
      short: 'The work',
      chapter: 'technique',
      title: 'The app does the work',
      body: [
        'The app server parses the request, checks the session and asks the database for today’s articles. A well-indexed query takes a few milliseconds; rendering the HTML takes a few more.',
        'Notice how small these numbers are next to the network. A typical request spends more time travelling than being worked on.',
      ],
      metrics: { server: '~25 ms' },
      scene: {
        entities: { browser: BROWSER, edge: EDGE, app: APP, app2: APP2, db: DB },
        links: backend,
        flows: pageLoad(),
      },
    },
    {
      short: 'Way back',
      chapter: 'solution',
      title: 'Bytes on the way back',
      body: [
        'The HTML streams back the way it came. The moment its first byte arrives is called <b>time to first byte</b> (TTFB): roughly DNS + handshakes + one round trip for the request + server time. Here that is about 155 ms.',
        'The browser starts parsing immediately — and discovers it needs more: stylesheets, scripts, fonts and images.',
      ],
      callout: { kind: 'tip', text: 'TTFB is the number to watch for your backend. Most of what happens after it is front-end work and network.' },
      metrics: { total: 'TTFB ~155 ms' },
      scene: {
        entities: {
          browser: BROWSER,
          edge: EDGE,
          app: APP,
          app2: APP2,
          db: DB,
          card: card(12, -20, 'Time to first byte', ['DNS lookup      40 ms', 'TCP + TLS       60 ms', 'request trip    30 ms', 'server work     25 ms', '✓ TTFB         ~155 ms']),
        },
        links: backend,
        flows: pageLoad(2.6),
      },
    },
    {
      short: 'Many files',
      chapter: 'technique',
      title: 'One page, many files',
      body: [
        'A news page can easily need 60 more files. Fetching them one after another would multiply the round trips, so browsers open several connections and HTTP/2 multiplexes many requests over one.',
        'Static files don’t change per reader, so they are served from a <b>CDN</b>: a network of caches placed close to users. A CDN node 5 ms away turns each 30 ms fetch into a 5 ms one, and takes that load off your servers entirely.',
      ],
      metrics: { total: '~0.5 s' },
      scene: full(),
    },
    {
      short: 'Repeat visit',
      chapter: 'insight',
      title: 'Repeat visits are cheaper',
      body: [
        'Open a second article and most of the work disappears. The DNS answer is still cached, the connection is kept alive, and the browser cache already holds the stylesheet, fonts and logo. Only the new HTML and new images travel.',
        'That is why first-visit and repeat-visit performance are measured separately: they often differ by a factor of two or three.',
      ],
      metrics: {
        dns: { v: '0 ms (cached)', tone: 'good' },
        connect: { v: '0 ms (reused)', tone: 'good' },
        total: { v: '~0.2 s', tone: 'good' },
      },
      scene: full({ browserBadge: true }),
    },
    {
      short: 'Third party',
      chapter: 'problem',
      title: 'Case: the third-party script',
      body: [
        'The page also loads a script from an ad partner. Their server is having a bad day — two seconds per response — and the script is included in a way that blocks rendering. Your own servers are perfectly healthy, yet readers stare at a blank page.',
        'Anything on the <b>critical path</b> sets the pace for the whole page. Load third-party code asynchronously, give it a timeout, and make sure the page renders without it.',
      ],
      callout: { kind: 'warning', text: 'You inherit the latency and the outages of every dependency on your critical path.' },
      metrics: { total: { v: '~2.5 s', tone: 'bad' } },
      scene: full({
        entities: { ads: { ...ADS, badge: { text: '2 s', tone: 'bad' } } },
        links: { bx: link('browser', 'ads') },
        flows: [{ route: ['bx'], kind: 'slow', rate: 0.8, bounce: true, fail: 0.25, speed: 45 }],
      }),
    },
    {
      short: 'Recap',
      chapter: 'recap',
      title: 'The full trip',
      body: [
        'One click, many hops. Keep this table as a checklist the next time a page feels slow:',
        `<table class="compare"><thead><tr><th>hop</th><th>typical cost</th><th>how to shrink it</th></tr></thead><tbody>
          <tr><td>DNS lookup</td><td>20–100 ms cold</td><td>caching via TTL, a fast DNS provider</td></tr>
          <tr><td>TCP + TLS</td><td>2 round trips</td><td>keep-alive, TLS 1.3, servers nearer users</td></tr>
          <tr><td>proxy → app</td><td>&lt; 1 ms</td><td>usually nothing to do</td></tr>
          <tr><td>server work</td><td>5–50 ms</td><td>indexes, caching, less work per request</td></tr>
          <tr><td>static files</td><td>1 RTT each</td><td>CDN, browser cache, fewer files</td></tr>
          <tr><td>third parties</td><td>whatever they are</td><td>async loading, timeouts, fallbacks</td></tr></tbody></table>`,
        'Check yourself: why does a reader 200 ms away suffer more from handshakes than from a large image? (Handshakes are several round trips; a big file is mostly limited by bandwidth.)',
      ],
      callout: { kind: 'insight', text: 'Latency is a sum. Make the list of terms, find the biggest, and shrink that one first.' },
      scene: full({
        entities: { ads: { ...ADS, badge: { text: 'async + timeout', tone: 'good' } } },
        links: { bx: link('browser', 'ads', { dashed: true }) },
        flows: [{ route: ['bx'], kind: 'ping', rate: 0.3, bounce: true, returnKind: 'ping' }],
      }),
    },
  ],
};
