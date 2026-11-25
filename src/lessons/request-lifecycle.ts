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
  summary: 'Follow one click from your browser to the database and back, see what happens behind the scenes, and find out why some readers wait seconds.',
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
      title: 'Why does news.example feel so slow?',
      body: [
        'Readers keep reporting that <code>news.example</code> takes forever to load. Yet when you open the exact same article on your laptop, the page pops up in about 0.4 seconds.',
        'So how can the same page feel that different?',
        'To find out, let’s follow a single click from your browser, over to the server, and all the way back. Using the diagram above, we’ll watch what happens behind the scenes step by step — and clock how long each part takes.',
      ],
      callout: { kind: 'insight', text: 'Opening a page is a chain of handoffs between machines. Every step costs time, and those numbers add up.' },
      metrics: { dns: '?', connect: '?', server: '?', download: '?', total: { v: '0.4 s … 2 s+', tone: 'warn' } },
      beats: [
        {
          label: 'On your laptop',
          duration: 2200,
          entities: {
            browser: { focus: true, badge: { text: '~0.4 s', tone: 'good' } },
            web: { ghost: true },
            trace: {
              lines: ['> on your laptop:  ~0.4 s', '# some readers:     2.0 s+', '# follow 1 click step by step'],
            },
          },
          flows: [{ route: ['bw'], rate: 1.4, bounce: true, once: 1 }],
        },
        {
          label: 'Some readers',
          duration: 2400,
          entities: {
            browser: { focus: false },
            web: { ghost: false, badge: { text: '2.0 s+', tone: 'bad' } },
            trace: {
              lines: ['✓ on your laptop:  ~0.4 s', '> some readers:     2.0 s+', '# follow 1 click step by step'],
            },
          },
          flows: [{ route: ['bw'], kind: 'slow', rate: 0.45, bounce: true }],
        },
        {
          label: 'Step by step',
          entities: {
            browser: { focus: true, badge: { text: 'click article', tone: 'info' } },
            web: { ghost: true },
            trace: {
              lines: ['✓ on your laptop:  ~0.4 s', '! some readers:     2.0 s+', '> follow 1 click step by step'],
            },
          },
          flows: [{ route: ['bw'], rate: 0.6, bounce: true }],
        },
      ],
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
      title: 'First, look up the real address: DNS',
      body: [
        'Machines can’t reach a site by name alone like <code>news.example</code> — they need a number (an IP address). So the moment you click, your browser checks its own memory, then your laptop’s. If neither knows it, it asks a <b>DNS resolver</b> (usually run by your ISP), which tracks down the real number: <code>203.0.113.7</code>.',
        'A fresh lookup like this takes a few quick trips, about <b>40 ms</b> here. Thankfully, the answer comes with a timer called a <b>TTL</b> (“save this for 5 minutes”), so your next clicks skip this step completely.',
      ],
      callout: { kind: 'tip', text: 'Short TTLs let you shift traffic quickly in an outage; long TTLs make repeat lookups basically free.' },
      changes: ['+ browser doesn’t know the IP yet, so it asks a DNS resolver'],
      metrics: { dns: '40 ms' },
      beats: [
        {
          label: 'Browser cache',
          duration: 2000,
          entities: {
            browser: { focus: true, badge: { text: 'checking memory', tone: 'info' } },
            resolver: { ghost: true, badge: { text: 'waiting', tone: 'info' } },
            auth: { ghost: true },
            trace: {
              title: 'DNS lookup · step 1',
              lines: ['> 1. browser cache: checking…', '# 2. OS cache:      waiting', '# 3. ask DNS resolver', '# 4. save for 5 min (TTL)'],
            },
          },
          links: { br: { dashed: true, label: 'waiting' }, ra: { dashed: true, label: 'waiting' } },
          flows: [],
          metrics: { dns: '?' },
        },
        {
          label: 'OS cache',
          duration: 2000,
          entities: {
            browser: { focus: true, badge: { text: 'no IP yet', tone: 'warn' } },
            resolver: { ghost: true, badge: { text: 'waiting', tone: 'info' } },
            auth: { ghost: true },
            trace: {
              title: 'DNS lookup · step 2',
              lines: ['! 1. browser cache: miss', '> 2. OS cache:      miss', '# 3. ask DNS resolver', '# 4. save for 5 min (TTL)'],
            },
          },
          links: { br: { dashed: true, label: 'waiting' }, ra: { dashed: true, label: 'waiting' } },
          flows: [],
        },
        {
          label: 'Ask DNS',
          duration: 2800,
          entities: {
            browser: { badge: { text: 'asking DNS', tone: 'info' } },
            resolver: { focus: true, badge: { text: 'not cached', tone: 'warn' } },
            auth: { focus: true },
            trace: {
              title: 'DNS lookup · step 3',
              lines: ['# 1. browser cache: miss', '# 2. OS cache:      miss', '> 3. ask DNS → 203.0.113.7', '# 4. save for 5 min (TTL)'],
            },
          },
          flows: [{ route: ['br', 'ra'], kind: 'ping', rate: 1.4, bounce: true, returnKind: 'ping', once: 1 }],
        },
        {
          label: 'Save TTL',
          entities: {
            browser: { focus: true, badge: { text: '203.0.113.7', tone: 'good' } },
            resolver: { badge: { text: 'saved · 5 min', tone: 'good' } },
            trace: {
              lines: ['# 1. browser cache: miss', '# 2. OS cache:      miss', '✓ 3. ask DNS → 203.0.113.7', '> 4. save for 5 min (TTL)'],
            },
          },
          links: { br: { dashed: true, label: 'saved · 5 min' } },
          metrics: { dns: '40 ms' },
        },
      ],
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
      title: 'Shake hands and lock the line',
      body: [
        'We have the IP address now, but the article still can’t move yet. Both machines have to shake hands twice first. <b>TCP</b> takes one round trip to open a reliable line, then <b>TLS</b> takes another round trip to verify the server’s ID and encrypt the line.',
        'At 30 ms per <b>round trip</b> (RTT), those two handshakes burn <b>60 ms</b> of pure waiting. Even super-fast internet doesn’t shrink this part: tiny “hello” messages still have to travel that distance twice.',
      ],
      callout: { kind: 'insight', text: 'Round-trip time (RTT) is the unit of network delay. Count the round trips, then multiply.' },
      changes: ['+ IP cached at the resolver for 5 minutes', '+ TCP + TLS handshakes: 2 round trips × 30 ms'],
      metrics: { connect: '60 ms' },
      beats: [
        {
          label: 'TCP · 1st RTT',
          duration: 2400,
          entities: {
            web: { focus: true, badge: { text: 'TCP · 1st RTT', tone: 'info' } },
            trace: {
              title: 'Handshake · 1/2 RTT',
              lines: ['> 1. TCP (1 RTT): agree to talk', '# 2. TLS (1 RTT): prove ID + lock', '# encrypted line pending', '# 0 bytes of article sent yet'],
            },
          },
          links: { bw: { label: 'TCP · 1 RTT' } },
          flows: [{ route: ['bw'], kind: 'ping', rate: 1.4, bounce: true, returnKind: 'ping', once: 1 }],
          metrics: { connect: '30 ms' },
        },
        {
          label: 'TLS · 2nd RTT',
          duration: 2400,
          entities: {
            web: { focus: true, badge: { text: 'TLS · 2nd RTT', tone: 'info' } },
            trace: {
              title: 'Handshake · 2/2 RTT',
              lines: ['✓ 1. TCP (1 RTT): agree to talk', '> 2. TLS (1 RTT): prove ID + lock', '# encrypting connection…', '# 0 bytes of article sent yet'],
            },
          },
          links: { bw: { label: 'TLS · +1 RTT' } },
          flows: [{ route: ['bw'], kind: 'ping', rate: 1.4, bounce: true, returnKind: 'ping', once: 1 }],
          metrics: { connect: '60 ms' },
        },
        {
          label: 'Line ready',
          entities: {
            web: { badge: { text: 'TLS · open', tone: 'good' } },
            trace: {
              lines: ['✓ 1. TCP (1 RTT): agree to talk', '✓ 2. TLS (1 RTT): prove ID + lock', '> encrypted line ready (60 ms)', '# 0 bytes of article sent yet'],
            },
          },
        },
      ],
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
      title: 'Now send the actual request',
      body: [
        'With the line open and locked, your browser finally sends an <b>HTTP request</b>. It’s just a few hundred bytes of plain text saying what it wants (<code>GET</code> this article), which site it’s for, your language, and a cookie that identifies your session.',
        'Because the connection is already open, this message only needs half a round trip to arrive: <b>15 ms</b>. The server reads it, checks your cookie, and gets to work.',
      ],
      changes: ['+ GET request travels over the open connection (15 ms one way)'],
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
      title: 'Grab the data and build the page',
      body: [
        'The article text, author, and comments don’t live on the web server — they’re stored in a <b>database</b>. Inside the same data centre, machines sit right next to each other, so a round trip is just half a millisecond. Three quick queries pull what’s needed, and the server renders the HTML.',
        'Look at the trace card below: all that server work takes only <b>25 ms</b>, with CPU cruising at 20%. When things are healthy, a click spends way more time travelling than being processed.',
      ],
      changes: ['+ 3 quick queries inside the data centre, ~25 ms of work'],
      chaos: {
        db: {
          text: 'The web server still answers, but it can’t build the article without its data. Readers get an error page instead. Click again to repair it.',
          metrics: { server: { v: '500 error', tone: 'bad' }, total: { v: 'error page', tone: 'bad' } },
        },
        web: {
          text: 'DNS still points to <code>203.0.113.7</code>, but nobody’s answering there. Readers stare at a loading spinner until it times out. With just one server, one crash takes the whole site down — Module 02 fixes that.',
          metrics: { connect: { v: 'timeout', tone: 'bad' }, total: { v: 'site down', tone: 'bad' } },
        },
        resolver: {
          text: 'Nothing breaks — yet. Your browser already saved the address for 5 minutes. Only brand-new visitors (or everyone once the 5 minutes run out) get stuck.',
        },
      },
      metrics: { server: '55 ms' },
      beats: [
        {
          label: 'Check session',
          duration: 2000,
          entities: {
            web: { ...CPU(0.08), focus: true },
            db: { badge: { text: 'waiting', tone: 'info' } },
            trace: {
              title: 'Server work · 1 ms',
              lines: ['> 1. check session     1 ms', '# 2. read article      5 ms', '# 3. read author       4 ms', '# 4. read comments     6 ms', '# 5. build HTML        9 ms'],
            },
          },
          links: { wd: { dashed: true, label: 'ready' } },
          flows: [{ route: ['bw'], rate: 1.2, once: 1 }],
          metrics: { server: '31 ms' },
        },
        {
          label: 'Read article',
          duration: 2200,
          entities: {
            web: { ...CPU(0.1), focus: true },
            db: { focus: true, badge: { text: '1 query · 5 ms', tone: 'good' } },
            trace: {
              title: 'Server work · 6 ms',
              lines: ['✓ 1. check session     1 ms', '> 2. read article      5 ms', '# 3. read author       4 ms', '# 4. read comments     6 ms', '# 5. build HTML        9 ms'],
            },
          },
          links: { wd: { label: 'read article · 5 ms' } },
          flows: [{ route: ['wd'], rate: 2.2, bounce: true, once: 1 }],
          metrics: { server: '36 ms' },
        },
        {
          label: 'Read author',
          duration: 2200,
          entities: {
            web: { ...CPU(0.12), focus: true },
            db: { focus: true, badge: { text: '2 queries · 9 ms', tone: 'good' } },
            trace: {
              title: 'Server work · 10 ms',
              lines: ['✓ 1. check session     1 ms', '✓ 2. read article      5 ms', '> 3. read author       4 ms', '# 4. read comments     6 ms', '# 5. build HTML        9 ms'],
            },
          },
          flows: [{ route: ['wd'], rate: 2.2, bounce: true, once: 1 }],
          metrics: { server: '40 ms' },
        },
        {
          label: 'Read comments',
          duration: 2200,
          entities: {
            web: { ...CPU(0.15), focus: true },
            db: { focus: true, badge: { text: '3 queries · 15 ms', tone: 'good' } },
            trace: {
              title: 'Server work · 16 ms',
              lines: ['✓ 1. check session     1 ms', '✓ 2. read article      5 ms', '✓ 3. read author       4 ms', '> 4. read comments     6 ms', '# 5. build HTML        9 ms'],
            },
          },
          links: { wd: { label: 'read comments' } },
          flows: [{ route: ['wd'], rate: 2.2, bounce: true, once: 1 }],
          metrics: { server: '46 ms' },
        },
        {
          label: 'Build HTML',
          entities: {
            web: { ...CPU(0.2), focus: true },
            db: { badge: { text: '3 queries · 15 ms', tone: 'good' } },
            trace: {
              title: 'Server work · 25 ms',
              lines: ['✓ 1. check session     1 ms', '✓ 2. read article      5 ms', '✓ 3. read author       4 ms', '✓ 4. read comments     6 ms', '> 5. build HTML        9 ms'],
            },
          },
          metrics: { server: '55 ms' },
        },
      ],
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
      title: 'The first byte lands back on screen',
      body: [
        'The finished HTML streams straight back to your browser. The exact moment its very first byte arrives — here at <b>155 ms</b> — is what engineers call <b>time to first byte</b> (TTFB): DNS + handshakes + request + server work + the trip back.',
        'The rest of the HTML follows in 15 ms. Your browser starts painting right away — and as it reads down the HTML, it spots forty more files it still needs.',
      ],
      callout: { kind: 'tip', text: 'TTFB is the metric to watch for your backend and connection together. Everything after it is downloading extra files and drawing.' },
      changes: ['+ first byte of HTML reaches the browser at ~155 ms', '~ database queries are done; HTML streams back one way'],
      metrics: { download: '15 ms', total: '170 ms' },
      beats: [
        {
          label: 'First byte (TTFB)',
          duration: 2400,
          entities: {
            browser: { focus: true, badge: { text: 'TTFB 155 ms', tone: 'good' } },
            trace: {
              lines: ['✓ DNS + TCP + TLS    100 ms', '✓ request + server    40 ms', '> first byte back     15 ms', '# read HTML (+15 ms stream)', '# needs 40 more files inside'],
            },
          },
          flows: [{ route: ['~bw'], kind: 'res', rate: 1.5, speed: 170, once: 1 }],
          metrics: { download: '1 ms', total: '156 ms' },
        },
        {
          label: 'Read HTML',
          entities: {
            browser: { badge: { text: 'TTFB 155 ms', tone: 'good' } },
          },
          metrics: { download: '15 ms', total: '170 ms' },
        },
      ],
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
        'That HTML points to stylesheets, scripts, fonts, and images — roughly forty files. Grabbing them one by one would cost forty round trips, so with <b>HTTP/2</b> the browser fetches dozens in parallel over the same open connection.',
        'Some files are only discovered after others arrive, so they land in a few waves: about <b>245 ms</b>. Add up the bar at the top: 40 + 60 + 55 + 245 = <b>400 ms</b>. That’s the snappy 0.4 seconds you saw on your laptop!',
      ],
      changes: ['+ 40 extra files pulled over the same open connection'],
      metrics: { download: '245 ms', total: { v: '400 ms', tone: 'good' } },
      beats: [
        {
          label: 'Wave 1 · CSS + JS',
          duration: 2300,
          entities: {
            browser: { focus: true, badge: { text: 'wave 1: CSS + JS', tone: 'info' } },
            trace: {
              title: 'HTTP/2 download · wave 1',
              lines: ['✓ reuses open line (0 ms setup)', '> wave 1: CSS + JS together', '# wave 2: fonts + 38 images', '# total: 40+60+55+245 = 400 ms'],
            },
          },
          flows: [{ route: ['bw'], rate: 2.4, bounce: true, speed: 200, once: 4 }],
          metrics: { download: '110 ms', total: '265 ms' },
        },
        {
          label: 'Wave 2 · 38 files',
          duration: 2300,
          entities: {
            browser: { badge: { text: 'wave 2: 38 files', tone: 'info' } },
            trace: {
              title: 'HTTP/2 download · wave 2',
              lines: ['✓ reuses open line (0 ms setup)', '✓ wave 1: CSS + JS together', '> wave 2: fonts + 38 images', '# total: 40+60+55+245 = 400 ms'],
            },
          },
          metrics: { download: '245 ms', total: { v: '400 ms', tone: 'good' } },
        },
        {
          label: 'All loaded',
          entities: {
            browser: { badge: { text: 'HTTP/2 · 1 pipe', tone: 'info' } },
          },
        },
      ],
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
      title: 'Clue #1: Why popular articles stall (N+1)',
      body: [
        'Now let’s check the first batch of complaints, which come from popular articles with lots of comments. The code fetches the comment list (1 query), then fetches each commenter’s name in a separate query — <b>40 extra trips</b> to the database. At ~10 ms each, that adds <b>410 ms</b>.',
        'Here’s the weird clue on the server’s CPU meter: it actually <i>drops</i> to 15%, because the server is just sitting there waiting. This classic bug is called an <b>N+1 query</b>. Combining them into a single query brings server time right back down.',
      ],
      callout: { kind: 'warning', text: 'Measure before buying bigger hardware. Low CPU plus slow server time usually means you’re waiting on too many queries.' },
      changes: ['+ comments fetch each author separately: 40 extra queries', '~ CPU drops to 15% — waiting, not working'],
      metrics: { server: { v: '440 ms', tone: 'bad' }, total: { v: '785 ms', tone: 'bad' } },
      beats: [
        {
          label: '1× comments',
          duration: 2200,
          entities: {
            web: { ...CPU(0.2), badge: { text: 'query 1 / 41', tone: 'info' } },
            db: { focus: true, badge: { text: '1 query · 10 ms', tone: 'good' } },
            trace: {
              lines: ['> 1× read 40 comments  10 ms', '# 40× read author     400 ms', '# CPU drops to 15% (waiting!)', '# fix: 1 combined query → ~15 ms'],
            },
          },
          links: { wd: { label: 'read comments', labelTone: 'good' } },
          flows: [{ route: ['wd'], rate: 1.5, bounce: true, once: 1 }],
          metrics: { server: '65 ms', total: '410 ms' },
        },
        {
          label: '40× author loop',
          duration: 2800,
          entities: {
            db: { focus: true, badge: { text: '41 queries · 410 ms', tone: 'bad' } },
            trace: {
              lines: ['✓ 1× read 40 comments  10 ms', '> 40× read author     400 ms', '# CPU drops to 15% (waiting!)', '# fix: 1 combined query → ~15 ms'],
            },
          },
          metrics: { server: { v: '440 ms', tone: 'bad' }, total: { v: '785 ms', tone: 'bad' } },
        },
        {
          label: 'CPU idle wait',
          entities: {
            web: { ...CPU(0.15, 'info'), focus: true, badge: { text: 'waiting on DB', tone: 'warn' } },
          },
        },
      ],
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
      title: 'Clue #2: Why far-away readers wait two seconds',
      body: [
        'The worst complaints come from a reader on mobile data on another continent. Their round trip to your server isn’t 30 ms — it’s <b>300 ms</b>, ten times farther. That makes every single round trip on the list 10× more expensive.',
        'Your server is still just as fast (25 ms of work), and the N+1 bug is fixed. Yet handshakes alone burn 600 ms, and those forty files take a full second. Out of ~2.0 seconds, <b>99% is pure distance</b>.',
      ],
      callout: { kind: 'insight', text: 'Slowness comes from two completely different places: work on the server and distance on the wire. Each one needs its own fix.' },
      changes: ['+ a reader 300 ms away joins the stage', '~ N+1 fixed: server work is back to 25 ms', '~ every round trip now costs 10× more'],
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
      title: 'So where did all the time go?',
      body: [
        'Everything on this page boils down to <b>addition</b>: DNS + connect + server + download = one total. On the diagram, the cheat sheet and the bar up top are your frame-by-frame ending — pause here when you record.',
        `<table class="compare"><thead><tr><th>step</th><th>typical cost</th><th>slow when…</th><th>see</th></tr></thead><tbody>
          <tr><td>DNS lookup</td><td>20–100 ms cold</td><td>nothing is cached</td><td>this lesson</td></tr>
          <tr><td>TCP + TLS</td><td>2 round trips</td><td>the reader is far away</td><td>CDNs</td></tr>
          <tr><td>request + server</td><td>1 round trip + work</td><td>too many or slow queries</td><td>Caching, Indexes</td></tr>
          <tr><td>download</td><td>a few waves</td><td>files discovered one by one</td><td>Caching, CDNs</td></tr></tbody></table>`,
        'Test yourself: a reader 200 ms away complains, and your server work takes 20 ms. What helps more — a faster database or fewer round trips? (Fewer round trips: just one costs ten times your entire server work — try it in the sliders below!)',
      ],
      callout: { kind: 'insight', text: 'Latency is just addition. List the pieces, spot the biggest number, and shrink that one first.' },
      metrics: {
        dns: '40 ms',
        connect: '60 ms',
        server: '55 ms',
        download: '245 ms',
        total: { v: '400 ms', tone: 'good' },
      },
      beats: [
        {
          label: 'One click',
          entities: {
            browser: { focus: true },
            far: { focus: false, ghost: true },
            tips: { ghost: true },
            cheat: {
              title: 'Your cheat sheet',
              lines: [
                '> 1 click → 4 chunks → 1 total',
                '# DNS ·········  ···',
                '# connect ······  ···',
                '# server ·······  ···',
                '# download ·····  ···',
                '# YOU vs FAR → next',
              ],
            },
          },
          flows: [],
        },
        {
          label: 'DNS',
          entities: {
            cheat: {
              lines: [
                '✓ 1 click → 4 chunks → 1 total',
                '> DNS ·········  40 ms',
                '# connect ······  ···',
                '# server ·······  ···',
                '# download ·····  ···',
                '# YOU vs FAR → next',
              ],
            },
          },
          metrics: { dns: '40 ms', connect: '?', server: '?', download: '?', total: '?' },
        },
        {
          label: 'Connect',
          entities: {
            cheat: {
              lines: [
                '✓ 1 click → 4 chunks → 1 total',
                '✓ DNS ·········  40 ms',
                '> connect ······  60 ms',
                '# server ·······  ···',
                '# download ·····  ···',
                '# YOU vs FAR → next',
              ],
            },
          },
          metrics: { connect: '60 ms' },
        },
        {
          label: 'Server work',
          entities: {
            cheat: {
              lines: [
                '✓ 1 click → 4 chunks → 1 total',
                '✓ DNS ·········  40 ms',
                '✓ connect ······  60 ms',
                '> server ·······  55 ms',
                '# download ·····  ···',
                '# YOU vs FAR → next',
              ],
            },
          },
          metrics: { server: '55 ms' },
        },
        {
          label: 'Download',
          entities: {
            cheat: {
              lines: [
                '✓ 1 click → 4 chunks → 1 total',
                '✓ DNS ·········  40 ms',
                '✓ connect ······  60 ms',
                '✓ server ·······  55 ms',
                '> download ····· 245 ms',
                '# YOU vs FAR → next',
              ],
            },
          },
          metrics: { download: '245 ms', total: '?' },
        },
        {
          label: 'Nearby 400 ms',
          entities: {
            browser: { focus: true, badge: { text: '400 ms total', tone: 'good' } },
            far: { ghost: true },
            cheat: {
              lines: [
                '✓ 1 click → 4 chunks → 1 total',
                '✓ DNS ·········  40 ms',
                '✓ connect ······  60 ms',
                '✓ server ·······  55 ms',
                '✓ download ····· 245 ms',
                '> YOU nearby ··· 400 ms',
                '# FAR away → next',
              ],
            },
          },
          metrics: { total: { v: '400 ms', tone: 'good' } },
          flows: [{ route: ['bw'], rate: 0.8, bounce: true, once: 2 }],
        },
        {
          label: 'Far ~2 s',
          entities: {
            browser: { focus: false },
            far: { ...FAR, focus: true, ghost: false, badge: { text: '~2.0 s total', tone: 'bad' } },
            cheat: {
              lines: [
                '✓ 1 click → 4 chunks → 1 total',
                '✓ DNS ·········  40 ms',
                '✓ connect ······  60 ms',
                '✓ server ·······  55 ms',
                '✓ download ····· 245 ms',
                '✓ YOU nearby ··· 400 ms',
                '> FAR away ·· ~2,000 ms',
              ],
            },
          },
          flows: [{ route: ['fw'], kind: 'slow', rate: 0.4, bounce: true, once: 2, speed: 45 }],
        },
        {
          label: 'Shrink first',
          entities: {
            browser: { focus: true },
            far: { focus: false, badge: { text: '~2.0 s', tone: 'bad' } },
            tips: {
              ghost: false,
              focus: true,
              lines: ['> DNS → cache miss', '# connect → far reader', '# server → N+1 queries', '# download → many RTTs'],
            },
            cheat: {
              lines: [
                '✓ 1 click → 4 chunks → 1 total',
                '✓ DNS ·········  40 ms',
                '✓ connect ······  60 ms',
                '✓ server ·······  55 ms',
                '✓ download ····· 245 ms',
                '✓ YOU nearby ··· 400 ms',
                '! FAR away ·· ~2,000 ms',
                '> shrink the biggest chunk',
              ],
            },
          },
        },
        {
          label: 'What to fix',
          entities: {
            tips: {
              lines: [
                '✓ DNS → cache miss',
                '> connect → far reader',
                '# server → N+1 queries',
                '# download → many RTTs',
              ],
            },
          },
        },
        {
          label: 'N+1 queries',
          entities: {
            tips: {
              lines: [
                '✓ DNS → cache miss',
                '✓ connect → far reader',
                '> server → N+1 queries',
                '# download → many RTTs',
              ],
            },
          },
        },
        {
          label: 'Many RTTs',
          entities: {
            tips: {
              lines: [
                '✓ DNS → cache miss',
                '✓ connect → far reader',
                '✓ server → N+1 queries',
                '> download → many RTTs',
              ],
            },
          },
        },
      ],
      scene: trip({
        browser: { focus: true, sub: 'nearby · 30 ms RTT', badge: { text: '400 ms total', tone: 'good' } },
        resolver: { badge: { text: 'saved · 5 min', tone: 'good' } },
        web: { ...CPU(0.2), badge: { text: '25 ms work', tone: 'good' } },
        db: { badge: { text: 'healthy', tone: 'good' } },
        request: { label: '40+60+55+245' },
        query: { label: 'work vs distance', labelTone: 'info' },
        far: { label: 'RTT 300 ms', labelTone: 'warn' },
        extra: {
          far: { ...FAR, badge: { text: '~2.0 s', tone: 'bad' } },
          cheat: card(58, -10, 'Your cheat sheet', [
            '✓ 1 click → 4 chunks → 1 total',
            '✓ DNS ·········  40 ms',
            '✓ connect ······  60 ms',
            '✓ server ·······  55 ms',
            '✓ download ····· 245 ms',
            '✓ YOU nearby ··· 400 ms',
            '! FAR away ·· ~2,000 ms',
            '> shrink the biggest chunk',
          ]),
          tips: card(12, 22, 'Slow when…', [
            '✓ DNS → cache miss',
            '✓ connect → far reader',
            '✓ server → N+1 queries',
            '✓ download → many RTTs',
          ]),
        },
        flows: [
          { route: ['bw', 'wd'], rate: 0.6, bounce: true },
          { route: ['fw'], kind: 'slow', rate: 0.35, bounce: true, speed: 45 },
        ],
      }),
    },
  ],
};
