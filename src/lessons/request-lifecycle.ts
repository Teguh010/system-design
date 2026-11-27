import type { Entity, Flow, Lesson, Link, Scene } from '../types.ts';
import { card, client, db, link, server, service } from './helpers.ts';

const BROWSER = client(0, 0, { label: 'kamu', sub: 'browser' });
const FAR = client(0, 19, { label: 'pembaca di benua lain', sub: '300 ms RTT · seluler' });
const RESOLVER = service(11, -19, { label: 'DNS resolver', icon: 'globe' });
const AUTH = service(28, -25, { label: 'authoritative DNS', sub: 'news.example', icon: 'globe' });
const WEB = server(23, 0, { label: 'web server', sub: 'news.example', icon: 'server', count: 3 });
const DB = db(42, 0, { label: 'database', icon: 'database', fill: 0.45 });

const dnsLink = link('browser', 'resolver', { dashed: true, label: 'tersimpan · 5 mnt' });

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
 * Semua aktor tetap di panggung: kamu, resolver (yang sudah di-cache), web server, dan database.
 * Tiap step hanya mengubah label, meter, kartu trace runtime, dan lalu lintas.
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
  title: 'Bagaimana sebuah request bekerja?',
  summary: 'Ikuti satu klik dari browser kamu ke server sampai balik lagi, lihat apa yang terjadi di balik layar, dan cari tahu kenapa sebagian pembaca menunggu berdetik-detik.',
  minutes: 12,
  level: 'beginner',
  metrics: [
    { id: 'dns', label: 'DNS' },
    { id: 'connect', label: 'koneksi' },
    { id: 'server', label: 'request + server' },
    { id: 'download', label: 'download' },
    { id: 'total', label: 'halaman siap' },
  ],
  legend: ['req', 'res', ['ping', 'cari IP / handshake'], ['lambat', 'lambat']],
  goals: [
    { text: 'Mengubah nama domain menjadi alamat lewat DNS', step: 2 },
    { text: 'Menghitung round trip sebelum data mulai bergerak', step: 3 },
    { text: 'Membaca isi sebuah HTTP request', step: 4 },
    { text: 'Menjumlahkan ke mana waktu muat halaman habis', step: 7 },
    { text: 'Membedakan dua sumber utama kelambatan: kerja dan jarak', step: 8 },
  ],
  steps: [
    {
      short: 'Terasa lambat',
      chapter: 'problem',
      title: 'Kenapa news.example kok terasa lambat?',
      body: [
        'Pembaca melapor bahwa <code>news.example</code> loading-nya lama banget. Padahal, waktu kamu buka artikel yang sama dari laptopmu, halamannya cuma butuh sekitar 0,4 detik buat tampil.',
        'Nah, kok bisa beda sejauh itu?',
        'Biar kita tahu penyebabnya, coba ikuti perjalanan satu klik dari browser kamu, menuju server, sampai akhirnya balik lagi ke browser. Lewat visualisasi di atas, kita bakal lihat satu per satu apa saja yang terjadi di balik layar, sekaligus berapa lama waktu yang dibutuhkan di setiap tahapnya.',
      ],
      callout: { kind: 'insight', text: 'Satu kali buka halaman itu rangkaian operan antar-mesin. Tiap langkah butuh waktu, dan semuanya dijumlahkan di akhir.' },
      metrics: { dns: '?', connect: '?', server: '?', download: '?', total: { v: '0,4 dtk … 2 dtk+', tone: 'warn' } },
      beats: [
        {
          label: 'Di laptopmu',
          duration: 2200,
          entities: {
            browser: { focus: true, badge: { text: '~0,4 dtk', tone: 'good' } },
            web: { ghost: true },
            trace: {
              lines: ['> di laptopmu:    ~0,4 dtk', '# sebagian lain:   2,0 dtk+', '# ikuti 1 klik langkah demi langkah'],
            },
          },
          flows: [{ route: ['bw'], rate: 1.4, bounce: true, once: 1 }],
        },
        {
          label: 'Pembaca lain',
          duration: 2400,
          entities: {
            browser: { focus: false },
            web: { ghost: false, badge: { text: '2,0 dtk+', tone: 'bad' } },
            trace: {
              lines: ['✓ di laptopmu:    ~0,4 dtk', '> sebagian lain:   2,0 dtk+', '# ikuti 1 klik langkah demi langkah'],
            },
          },
          flows: [{ route: ['bw'], kind: 'lambat', rate: 0.45, bounce: true }],
        },
        {
          label: 'Langkah demi langkah',
          entities: {
            browser: { focus: true, badge: { text: 'klik artikel', tone: 'info' } },
            web: { ghost: true },
            trace: {
              lines: ['✓ di laptopmu:    ~0,4 dtk', '! sebagian lain:   2,0 dtk+', '> ikuti 1 klik langkah demi langkah'],
            },
          },
          flows: [{ route: ['bw'], rate: 0.6, bounce: true }],
        },
      ],
      scene: {
        entities: {
          browser: { ...BROWSER, focus: true },
          web: server(23, 0, { label: 'news.example', sub: 'entah di mana', ghost: true, count: 3 }),
          trace: card(23, -18, 'Ke mana waktunya habis?', [
            '✓ di laptopmu:    ~0,4 dtk',
            '! sebagian lain:   2,0 dtk+',
            '> ikuti 1 klik langkah demi langkah',
          ]),
        },
        links: { bw: link('browser', 'web', { dashed: true, arrow: true, label: 'klik → artikel' }) },
        flows: [{ route: ['bw'], rate: 0.6, bounce: true }],
      },
    },
    {
      short: 'Cari alamat',
      chapter: 'technique',
      title: 'Pertama, cari tahu dulu alamat aslinya: DNS',
      body: [
        'Komputer nggak bisa menghubungi situs cuma bermodal nama kayak <code>news.example</code> — mereka butuh alamat angka (alamat IP). Jadi begitu kamu klik, browser langsung ngecek ingatannya sendiri, lalu cek memori laptopmu. Kalau belum ada juga, ia bertanya ke <b>DNS resolver</b> (biasanya milik ISP-mu), yang melacak alamat aslinya: <code>203.0.113.7</code>.',
        'Proses tanya-jawab dari nol ini biasanya makan beberapa kali bolak-balik, sekitar <b>40 ms</b> di sini. Untungnya, jawabannya datang bareng timer bernama <b>TTL</b> (“simpan 5 menit ya”), jadi klik berikutnya nggak perlu nanya lagi.',
      ],
      callout: { kind: 'tip', text: 'TTL pendek bikin kamu gampang mindahin trafik saat darurat; TTL panjang bikin pencarian alamat berulang jadi gratis.' },
      changes: ['+ browser belum tahu IP-nya, jadi bertanya ke DNS resolver'],
      metrics: { dns: '40 ms' },
      beats: [
        {
          label: 'Cache browser',
          duration: 2000,
          entities: {
            browser: { focus: true, badge: { text: 'cek memori', tone: 'info' } },
            resolver: { ghost: true, badge: { text: 'menunggu', tone: 'info' } },
            auth: { ghost: true },
            trace: {
              title: 'Cari DNS · langkah 1',
              lines: ['> 1. cache browser: mengecek…', '# 2. cache OS:      menunggu', '# 3. tanya DNS resolver', '# 4. simpan 5 mnt (TTL)'],
            },
          },
          links: { br: { dashed: true, label: 'menunggu' }, ra: { dashed: true, label: 'menunggu' } },
          flows: [],
          metrics: { dns: '?' },
        },
        {
          label: 'Cache OS',
          duration: 2000,
          entities: {
            browser: { focus: true, badge: { text: 'belum ada IP', tone: 'warn' } },
            resolver: { ghost: true, badge: { text: 'menunggu', tone: 'info' } },
            auth: { ghost: true },
            trace: {
              title: 'Cari DNS · langkah 2',
              lines: ['! 1. cache browser: kosong', '> 2. cache OS:      kosong', '# 3. tanya DNS resolver', '# 4. simpan 5 mnt (TTL)'],
            },
          },
          links: { br: { dashed: true, label: 'menunggu' }, ra: { dashed: true, label: 'menunggu' } },
          flows: [],
        },
        {
          label: 'Tanya DNS',
          duration: 2800,
          entities: {
            browser: { badge: { text: 'bertanya ke DNS', tone: 'info' } },
            resolver: { focus: true, badge: { text: 'belum disimpan', tone: 'warn' } },
            auth: { focus: true },
            trace: {
              title: 'Cari DNS · langkah 3',
              lines: ['# 1. cache browser: kosong', '# 2. cache OS:      kosong', '> 3. tanya DNS → 203.0.113.7', '# 4. simpan 5 mnt (TTL)'],
            },
          },
          flows: [{ route: ['br', 'ra'], kind: 'ping', rate: 1.4, bounce: true, returnKind: 'ping', once: 1 }],
        },
        {
          label: 'Simpan TTL',
          entities: {
            browser: { focus: true, badge: { text: '203.0.113.7', tone: 'good' } },
            resolver: { badge: { text: 'tersimpan · 5 mnt', tone: 'good' } },
            trace: {
              lines: ['# 1. cache browser: kosong', '# 2. cache OS:      kosong', '✓ 3. tanya DNS → 203.0.113.7', '> 4. simpan 5 mnt (TTL)'],
            },
          },
          links: { br: { dashed: true, label: 'tersimpan · 5 mnt' } },
          metrics: { dns: '40 ms' },
        },
      ],
      scene: {
        entities: {
          browser: { ...BROWSER, badge: { text: 'belum ada IP', tone: 'warn' } },
          resolver: { ...RESOLVER, sub: 'ISP / publik', badge: { text: 'belum disimpan', tone: 'warn' } },
          auth: AUTH,
          web: server(23, 0, { label: 'news.example', sub: '203.0.113.7', ghost: true, count: 3 }),
          trace: card(24, 21, 'Cari IP di DNS · 40 ms', [
            '# 1. cache browser: kosong',
            '# 2. cache OS:      kosong',
            '> 3. tanya DNS → 203.0.113.7',
            '✓ 4. simpan 5 mnt (TTL)',
          ]),
        },
        links: {
          br: link('browser', 'resolver', { arrow: true, label: 'news.example?' }),
          ra: link('resolver', 'auth', { arrow: true, label: 'cari IP asli' }),
          bw: link('browser', 'web', { dashed: true, label: 'butuh IP dulu' }),
        },
        flows: [{ route: ['br', 'ra'], kind: 'ping', rate: 0.7, bounce: true, returnKind: 'ping' }],
      },
    },
    {
      short: 'Koneksi',
      chapter: 'technique',
      title: 'Salaman dulu dan kunci jalurnya',
      body: [
        'Alamat IP sudah di tangan, tapi artikelnya belum bisa langsung dikirim. Kedua mesin harus salaman dua kali dulu. Pertama lewat <b>TCP</b> (satu kali bolak-balik) buat mastiin keduanya siap ngobrol. Habis itu <b>TLS</b> (satu kali bolak-balik lagi) buat ngecek identitas server dan mengunci jalur pakai enkripsi.',
        'Kalau jarak ke server 30 ms per <b>round trip</b> (RTT), dua kali salaman itu langsung makan <b>60 ms</b> cuma buat nunggu. Di sini internet kencang pun nggak nolong: pesan “halo” yang kecil itu tetap harus menyeberangi jarak dua kali.',
      ],
      callout: { kind: 'insight', text: 'Round-trip time (RTT) adalah satuan jeda di jaringan. Hitung berapa kali harus bolak-balik, lalu kalikan.' },
      changes: ['+ IP tersimpan di resolver selama 5 menit', '+ handshake TCP + TLS: 2 round trip × 30 ms'],
      metrics: { connect: '60 ms' },
      beats: [
        {
          label: 'TCP · RTT ke-1',
          duration: 2400,
          entities: {
            web: { focus: true, badge: { text: 'TCP · RTT ke-1', tone: 'info' } },
            trace: {
              title: 'Handshake · 1/2 RTT',
              lines: ['> 1. TCP (1 RTT): sepakat bicara', '# 2. TLS (1 RTT): cek ID + kunci', '# jalur terenkripsi belum siap', '# 0 byte artikel terkirim'],
            },
          },
          links: { bw: { label: 'TCP · 1 RTT' } },
          flows: [{ route: ['bw'], kind: 'ping', rate: 1.4, bounce: true, returnKind: 'ping', once: 1 }],
          metrics: { connect: '30 ms' },
        },
        {
          label: 'TLS · RTT ke-2',
          duration: 2400,
          entities: {
            web: { focus: true, badge: { text: 'TLS · RTT ke-2', tone: 'info' } },
            trace: {
              title: 'Handshake · 2/2 RTT',
              lines: ['✓ 1. TCP (1 RTT): sepakat bicara', '> 2. TLS (1 RTT): cek ID + kunci', '# mengenkripsi koneksi…', '# 0 byte artikel terkirim'],
            },
          },
          links: { bw: { label: 'TLS · +1 RTT' } },
          flows: [{ route: ['bw'], kind: 'ping', rate: 1.4, bounce: true, returnKind: 'ping', once: 1 }],
          metrics: { connect: '60 ms' },
        },
        {
          label: 'Jalur siap',
          entities: {
            web: { badge: { text: 'TLS · terbuka', tone: 'good' } },
            trace: {
              lines: ['✓ 1. TCP (1 RTT): sepakat bicara', '✓ 2. TLS (1 RTT): cek ID + kunci', '> jalur terenkripsi siap (60 ms)', '# 0 byte artikel terkirim'],
            },
          },
        },
      ],
      scene: trip({
        db: false,
        resolver: { badge: { text: 'tersimpan · 5 mnt', tone: 'good' } },
        web: { sub: '203.0.113.7', badge: { text: 'TLS · terbuka', tone: 'good' } },
        request: { label: 'TCP + TLS · 2 RTT' },
        extra: {
          trace: card(24, 21, 'Handshake · 2 RTT = 60 ms', [
            '✓ 1. TCP (1 RTT): sepakat bicara',
            '> 2. TLS (1 RTT): cek ID + kunci',
            '✓ jalur terenkripsi siap (60 ms)',
            '# 0 byte artikel terkirim',
          ]),
        },
        flows: [{ route: ['bw'], kind: 'ping', rate: 1.2, bounce: true, returnKind: 'ping' }],
      }),
    },
    {
      short: 'Request',
      chapter: 'technique',
      title: 'Akhirnya kirim request-nya',
      body: [
        'Begitu jalurnya terbuka dan aman, barulah browser mengirim <b>HTTP request</b>. Bentuknya cuma beberapa ratus byte teks biasa yang bilang apa yang diminta (<code>GET</code> artikel ini), nama situsnya, bahasamu, dan cookie buat ngenalin sesimu.',
        'Karena jalurnya sudah nyambung dari tadi, pesan ini cuma butuh setengah round trip buat sampai: <b>15 ms</b>. Server membacanya, ngecek cookie kamu, lalu mulai nyiapin halamannya.',
      ],
      changes: ['+ request GET meluncur lewat koneksi yang sudah terbuka (15 ms sekali jalan)'],
      metrics: { server: '30 ms + kerja' },
      scene: trip({
        db: false,
        browser: { badge: { text: 'jalur terbuka', tone: 'info' } },
        web: { badge: { text: 'baca request', tone: 'info' } },
        request: { label: 'GET /storm-warning' },
        extra: {
          trace: card(24, 21, 'HTTP request · ~400 B', [
            '> GET /2026/11/storm-warning',
            '  Host: news.example',
            '  Bahasa: id · Cookie: 7f3a…',
            '✓ tiba dalam 15 ms (0,5 RTT)',
          ]),
        },
        flows: [{ route: ['bw'], rate: 1.2, bounce: true }],
      }),
    },
    {
      short: 'Ambil data',
      chapter: 'technique',
      title: 'Ambil data dan rakit halamannya',
      body: [
        'Isi artikel, nama penulis, dan komentar nggak disimpan di web server — semuanya ada di <b>database</b>. Di dalam satu data center yang sama, jarak antar-mesin cuma setengah milidetik. Server mengirim tiga query singkat buat ngambil bahan-bahannya, lalu merakit HTML.',
        'Lihat kartu proses di bawah: semua kerja server itu cuma habis <b>25 ms</b>, dan CPU-nya santai banget di 20%. Saat sistem sehat, satu klik jauh lebih lama di jalan daripada pas dikerjakan di server.',
      ],
      changes: ['+ 3 query cepat di dalam data center, ~25 ms kerja server'],
      chaos: {
        db: {
          text: 'Web server masih menjawab, tapi nggak bisa nyusun artikel tanpa datanya. Pembaca langsung dapat halaman error. Klik lagi buat memperbaikinya.',
          metrics: { server: { v: '500 error', tone: 'bad' }, total: { v: 'halaman error', tone: 'bad' } },
        },
        web: {
          text: 'DNS masih menunjuk ke <code>203.0.113.7</code>, tapi nggak ada yang menjawab di sana. Pembaca menatap layar loading sampai timeout. Kalau cuma satu server, satu mesin tumbang bikin seluruh situs mati — Modul 02 membahas solusinya.',
          metrics: { connect: { v: 'timeout', tone: 'bad' }, total: { v: 'situs mati', tone: 'bad' } },
        },
        resolver: {
          text: 'Belum ada yang rusak — untuk sementara. Browser sudah menyimpan alamatnya selama 5 menit. Cuma pengunjung baru (atau semua orang pas 5 menitnya habis) yang macet.',
        },
      },
      metrics: { server: '55 ms' },
      beats: [
        {
          label: 'Cek session',
          duration: 2000,
          entities: {
            web: { ...CPU(0.08), focus: true },
            db: { badge: { text: 'menunggu', tone: 'info' } },
            trace: {
              title: 'Kerja server · 1 ms',
              lines: ['> 1. cek session       1 ms', '# 2. baca artikel      5 ms', '# 3. baca penulis      4 ms', '# 4. baca komentar     6 ms', '# 5. susun HTML        9 ms'],
            },
          },
          links: { wd: { dashed: true, label: 'siap' } },
          flows: [{ route: ['bw'], rate: 1.2, once: 1 }],
          metrics: { server: '31 ms' },
        },
        {
          label: 'Baca artikel',
          duration: 2200,
          entities: {
            web: { ...CPU(0.1), focus: true },
            db: { focus: true, badge: { text: '1 query · 5 ms', tone: 'good' } },
            trace: {
              title: 'Kerja server · 6 ms',
              lines: ['✓ 1. cek session       1 ms', '> 2. baca artikel      5 ms', '# 3. baca penulis      4 ms', '# 4. baca komentar     6 ms', '# 5. susun HTML        9 ms'],
            },
          },
          links: { wd: { label: 'baca artikel · 5 ms' } },
          flows: [{ route: ['wd'], rate: 2.2, bounce: true, once: 1 }],
          metrics: { server: '36 ms' },
        },
        {
          label: 'Baca penulis',
          duration: 2200,
          entities: {
            web: { ...CPU(0.12), focus: true },
            db: { focus: true, badge: { text: '2 query · 9 ms', tone: 'good' } },
            trace: {
              title: 'Kerja server · 10 ms',
              lines: ['✓ 1. cek session       1 ms', '✓ 2. baca artikel      5 ms', '> 3. baca penulis      4 ms', '# 4. baca komentar     6 ms', '# 5. susun HTML        9 ms'],
            },
          },
          flows: [{ route: ['wd'], rate: 2.2, bounce: true, once: 1 }],
          metrics: { server: '40 ms' },
        },
        {
          label: 'Baca komentar',
          duration: 2200,
          entities: {
            web: { ...CPU(0.15), focus: true },
            db: { focus: true, badge: { text: '3 query · 15 ms', tone: 'good' } },
            trace: {
              title: 'Kerja server · 16 ms',
              lines: ['✓ 1. cek session       1 ms', '✓ 2. baca artikel      5 ms', '✓ 3. baca penulis      4 ms', '> 4. baca komentar     6 ms', '# 5. susun HTML        9 ms'],
            },
          },
          links: { wd: { label: 'baca komentar' } },
          flows: [{ route: ['wd'], rate: 2.2, bounce: true, once: 1 }],
          metrics: { server: '46 ms' },
        },
        {
          label: 'Susun HTML',
          entities: {
            web: { ...CPU(0.2), focus: true },
            db: { badge: { text: '3 query · 15 ms', tone: 'good' } },
            trace: {
              title: 'Kerja server · 25 ms',
              lines: ['✓ 1. cek session       1 ms', '✓ 2. baca artikel      5 ms', '✓ 3. baca penulis      4 ms', '✓ 4. baca komentar     6 ms', '> 5. susun HTML        9 ms'],
            },
          },
          metrics: { server: '55 ms' },
        },
      ],
      scene: trip({
        web: CPU(0.2),
        db: { badge: { text: '3 query · 15 ms', tone: 'good' } },
        request: { label: 'GET /storm-warning' },
        query: { label: '3 query · 0,5 ms' },
        extra: {
          trace: card(24, 22, 'Kerja server · 25 ms', [
            '✓ 1. cek session       1 ms',
            '✓ 2. baca artikel      5 ms',
            '✓ 3. baca penulis      4 ms',
            '✓ 4. baca komentar     6 ms',
            '> 5. susun HTML        9 ms',
          ]),
        },
        flows: [{ route: ['bw', 'wd'], rate: 1.6, bounce: true }],
      }),
    },
    {
      short: 'Response',
      chapter: 'solution',
      title: 'Byte pertama mulai pulang ke layar',
      body: [
        'Sejak kamu menekan Enter, stopwatch sudah berjalan, padahal belum ada satu byte HTML pun yang sampai.',
        'Pertama, ada <b>DNS</b>, jabat tangan <b>TCP</b>, dan <b>TLS</b>. Ketiganya memakan waktu sekitar <b>100 ms</b>. Setelah itu browser mengirim request, dan server memprosesnya di data center. Ini menambah sekitar <b>40 ms</b> lagi. Jadi, <b>140 ms</b> sudah terpakai sebelum server mulai mengirim jawabannya.',
        'Lalu byte pertama dari HTML itu dikirim dan menempuh perjalanan pulang ke browser, sekitar <b>15 ms</b>. Saat byte itu tiba, total waktunya <b>155 ms</b>. Angka inilah yang disebut <b>TTFB</b>, singkatan dari <b>time to first byte</b>: semua waktu tunggu tadi, ditambah perjalanan pulang untuk satu byte pertama.',
        'Tapi browser tidak menunggu HTML-nya selesai diunduh. Begitu byte-byte pertama masuk, ia langsung mulai membaca dan menggambar halaman. Nah, di dalam HTML itu ada rujukan ke 40 file lain. Itulah yang akan kita bahas selanjutnya.',
      ],
      callout: { kind: 'tip', text: 'TTFB itu patokan seberapa cepat backend dan koneksimu. Semua yang terjadi setelahnya adalah urusan mengunduh file tambahan dan menggambar layar.' },
      changes: ['+ byte pertama HTML mendarat di browser pada ~155 ms', '~ query database sudah selesai; HTML mengalir balik satu arah'],
      metrics: { download: '15 ms', total: '170 ms' },
      beats: [
        {
          label: 'DNS + TCP + TLS',
          duration: 2200,
          entities: {
            browser: { focus: true, badge: { text: 'jalur terbuka', tone: 'info' } },
            resolver: { badge: { text: 'tersimpan · 5 mnt', tone: 'good' } },
            web: { focus: true, badge: { text: 'TLS · terbuka', tone: 'good' } },
            trace: {
              title: 'TTFB · 155 ms',
              lines: ['> DNS + TCP + TLS    100 ms', '# request + server    40 ms', '# byte pertama balik  15 ms', '# baca HTML (+15 ms sisa)', '# butuh 40 file lagi di dalam'],
            },
          },
          links: { bw: { label: 'TCP + TLS · 2 RTT' } },
          flows: [{ route: ['bw'], kind: 'ping', rate: 1.2, bounce: true, returnKind: 'ping', once: 2 }],
          metrics: { total: '100 ms' },
        },
        {
          label: 'Request + server',
          duration: 2200,
          entities: {
            web: { ...CPU(0.2), focus: true, badge: { text: 'merakit HTML', tone: 'info' } },
            db: { focus: true, badge: { text: '3 query · 15 ms', tone: 'good' } },
            trace: {
              lines: ['✓ DNS + TCP + TLS    100 ms', '> request + server    40 ms', '# byte pertama balik  15 ms', '# baca HTML (+15 ms sisa)', '# butuh 40 file lagi di dalam'],
            },
          },
          links: { wd: { label: '3 query · 0,5 ms' }, bw: { label: 'GET /storm-warning' } },
          flows: [{ route: ['bw', 'wd'], rate: 1.5, bounce: true, once: 1 }],
          metrics: { server: '55 ms', total: '140 ms' },
        },
        {
          label: 'Byte pertama (TTFB)',
          duration: 2400,
          entities: {
            browser: { focus: true, badge: { text: 'TTFB 155 ms', tone: 'good' } },
            web: { ...CPU(0.1), badge: { text: 'kirim HTML', tone: 'good' } },
            db: { badge: { text: 'selesai', tone: 'good' } },
            trace: {
              lines: ['✓ DNS + TCP + TLS    100 ms', '✓ request + server    40 ms', '> byte pertama balik  15 ms', '# baca HTML (+15 ms sisa)', '# butuh 40 file lagi di dalam'],
            },
          },
          links: { bw: { label: 'HTML · byte ke-1 @ 155 ms', labelTone: 'good' }, wd: { dashed: true, label: 'diam' } },
          flows: [{ route: ['~bw'], kind: 'res', rate: 1.5, speed: 170, once: 1 }],
          metrics: { download: '1 ms', total: '156 ms' },
        },
        {
          label: 'Baca HTML',
          duration: 2000,
          entities: {
            browser: { focus: true, badge: { text: 'menggambar', tone: 'info' } },
            trace: {
              lines: ['✓ DNS + TCP + TLS    100 ms', '✓ request + server    40 ms', '✓ byte pertama balik  15 ms', '> baca HTML (+15 ms sisa)', '# butuh 40 file lagi di dalam'],
            },
          },
          flows: [{ route: ['~bw'], kind: 'res', rate: 1.8, speed: 170 }],
          metrics: { download: '15 ms', total: '170 ms' },
        },
        {
          label: '40 file lagi',
          entities: {
            browser: { badge: { text: 'TTFB 155 ms', tone: 'good' } },
            trace: {
              lines: ['✓ DNS + TCP + TLS    100 ms', '✓ request + server    40 ms', '✓ byte pertama balik  15 ms', '✓ baca HTML (+15 ms sisa)', '> butuh 40 file lagi di dalam'],
            },
          },
          metrics: { download: '15 ms', total: '170 ms' },
        },
      ],
      scene: trip({
        browser: { badge: { text: 'jalur terbuka', tone: 'info' }, focus: true },
        resolver: { badge: { text: 'tersimpan · 5 mnt', tone: 'good' } },
        web: { ...CPU(0.1), badge: { text: 'TLS · terbuka', tone: 'good' } },
        db: { badge: { text: 'selesai', tone: 'good' } },
        request: { label: 'TCP + TLS · 2 RTT' },
        query: { dashed: true, label: 'diam' },
        extra: {
          trace: card(24, 22, 'TTFB · 155 ms', [
            '> DNS + TCP + TLS    100 ms',
            '# request + server    40 ms',
            '# byte pertama balik  15 ms',
            '# baca HTML (+15 ms sisa)',
            '# butuh 40 file lagi di dalam',
          ]),
        },
        flows: [],
      }),
    },
    {
      short: 'File lain',
      chapter: 'technique',
      title: 'Satu halaman, empat puluh file tambahan',
      body: [
        'HTML yang barusan kamu baca belum seluruh halaman. Di dalamnya ada tautan ke stylesheet, script, font, dan gambar — total sekitar <b>40 file</b>.',
        'Kalau browser harus buka koneksi baru untuk tiap file, kamu bayar 40 round trip lagi. Sebaliknya, ia memakai ulang jalur yang sudah terbuka. Dengan <b>HTTP/2</b>, puluhan request jalan bersamaan di satu pipa — <b>0 ms</b> handshake baru.',
        'Beberapa file baru muncul setelah yang lain datang (misalnya gambar yang disembunyikan di CSS), jadi browser mengambil dalam beberapa gelombang: CSS dan JavaScript dulu bareng, lalu font dan gambar sisanya. Baris download ini menambah sekitar <b>245 ms</b>.',
        'Sekarang jumlahkan bilah di atas: 40 + 60 + 55 + 245 = <b>400 ms</b>. Itu angka seperempat detik yang sama dari langkah pertama — satu klik, halaman utuh di laptopmu.',
      ],
      callout: { kind: 'tip', text: 'Sebagian besar yang kamu lihat di layar datang setelah byte HTML pertama. HTTP/2 dan caching memangkas babak kedua ini.' },
      changes: ['+ 40 file tambahan lewat koneksi terbuka yang sama (HTTP/2)'],
      metrics: { download: '245 ms', total: { v: '400 ms', tone: 'good' } },
      beats: [
        {
          label: 'Pakai ulang jalur terbuka',
          duration: 2000,
          entities: {
            browser: { focus: true, badge: { text: 'pipa sama', tone: 'info' } },
            web: { ...CPU(0.2), badge: { text: '40 menunggu', tone: 'info' } },
            trace: {
              title: 'Download HTTP/2 · 170 ms',
              lines: [
                '> pakai ulang jalur terbuka (0 ms setup)',
                '# gelombang 1: CSS + JS bareng',
                '# gelombang 2: font + 38 gambar',
                '# total download        245 ms',
                '# halaman siap  40+60+55+245',
              ],
            },
          },
          links: { bw: { label: 'HTTP/2 · pakai ulang pipa', labelTone: 'good' }, wd: { dashed: true, label: 'diam' } },
          flows: [{ route: ['bw'], kind: 'ping', rate: 1.1, bounce: true, returnKind: 'ping', once: 1 }],
          metrics: { download: '15 ms', total: '170 ms' },
        },
        {
          label: 'Gelombang 1 · CSS + JS',
          duration: 2300,
          entities: {
            browser: { badge: { text: 'wave 1: CSS + JS', tone: 'info' } },
            web: { ...CPU(0.25), badge: { text: 'mengirim aset', tone: 'info' } },
            trace: {
              lines: [
                '✓ pakai ulang jalur terbuka (0 ms setup)',
                '> gelombang 1: CSS + JS bareng',
                '# gelombang 2: font + 38 gambar',
                '# total download        245 ms',
                '# halaman siap  40+60+55+245',
              ],
            },
          },
          flows: [{ route: ['bw'], rate: 2.4, bounce: true, speed: 200, once: 4 }],
          metrics: { download: '110 ms', total: '265 ms' },
        },
        {
          label: 'Gelombang 2 · 38 file',
          duration: 2300,
          entities: {
            browser: { badge: { text: 'gelombang 2: 38 file', tone: 'info' } },
            trace: {
              lines: [
                '✓ pakai ulang jalur terbuka (0 ms setup)',
                '✓ gelombang 1: CSS + JS bareng',
                '> gelombang 2: font + 38 gambar',
                '# total download        245 ms',
                '# halaman siap  40+60+55+245',
              ],
            },
          },
          flows: [{ route: ['bw'], rate: 2.8, bounce: true, speed: 200, once: 6 }],
          metrics: { download: '245 ms', total: { v: '400 ms', tone: 'good' } },
        },
        {
          label: 'Download · 245 ms',
          duration: 2200,
          entities: {
            web: { ...CPU(0.1), badge: { text: '40 file dikirim', tone: 'good' } },
            trace: {
              lines: [
                '✓ pakai ulang jalur terbuka (0 ms setup)',
                '✓ gelombang 1: CSS + JS bareng',
                '✓ gelombang 2: font + 38 gambar',
                '> total download        245 ms',
                '# halaman siap  40+60+55+245',
              ],
            },
          },
          links: { bw: { label: '40 file · HTTP/2', labelTone: 'good' } },
          flows: [{ route: ['~bw'], kind: 'res', rate: 1.5, speed: 180 }],
          metrics: { download: '245 ms', total: { v: '400 ms', tone: 'good' } },
        },
        {
          label: 'Halaman siap · 400 ms',
          duration: 2000,
          entities: {
            browser: { badge: { text: 'HTTP/2 · selesai', tone: 'good' } },
            trace: {
              title: 'Download HTTP/2 · 400 ms',
              lines: [
                '✓ pakai ulang jalur terbuka (0 ms setup)',
                '✓ gelombang 1: CSS + JS bareng',
                '✓ gelombang 2: font + 38 gambar',
                '✓ total download        245 ms',
                '> halaman siap  40+60+55+245',
              ],
            },
          },
          flows: [],
          metrics: { download: '245 ms', total: { v: '400 ms', tone: 'good' } },
        },
      ],
      scene: trip({
        browser: { badge: { text: 'membaca HTML', tone: 'info' }, focus: true },
        web: { ...CPU(0.2), badge: { text: '40 file mengantre', tone: 'info' } },
        db: { badge: { text: 'selesai', tone: 'good' } },
        request: { label: 'HTTP/2 · pipa terbuka' },
        query: { dashed: true, label: 'diam' },
        extra: {
          trace: card(24, 21, 'Download HTTP/2 · 170 ms', [
            '> pakai ulang jalur terbuka (0 ms setup)',
            '# gelombang 1: CSS + JS bareng',
            '# gelombang 2: font + 38 gambar',
            '# total download        245 ms',
            '# halaman siap  40+60+55+245',
          ]),
        },
        flows: [],
      }),
    },
    {
      short: 'Query lambat',
      chapter: 'problem',
      title: 'Petunjuk #1: Kenapa artikel ramai macet (N+1)',
      body: [
        'Situs yang sama, di laptopmu, tetap cepat: sekitar <b>400 ms</b>. Tapi di produksi, pembaca mengeluh. Keluhannya mengumpul di satu artikel saja: peringatan badai, dengan komentar yang sangat panjang.',
        'Coba bayangkan kamu menyuruh seseorang mengambil 40 buku di perpustakaan. Cara pertama: dia pergi sekali, lalu pulang membawa semuanya. Cara kedua: dia bolak-balik 40 kali, satu buku setiap perjalanan. Hasilnya sama, tapi cara kedua jauh lebih lama.',
        'Itulah yang terjadi di server kita. Pertama, server mengambil 40 komentar dengan satu query, sekitar <b>10 ms</b>. Sampai sini aman. Tapi setiap komentar butuh nama penulisnya, dan nama itu diambil dengan query terpisah. Jadi ada <b>40 query tambahan</b> ke database, masing-masing sekitar 10 ms. Totalnya <b>40 × 10 = 400 ms</b> tambahan.',
        'Akibatnya, halaman yang tadinya selesai dalam <b>400 ms</b> sekarang butuh sekitar <b>785 ms</b>. Hampir dua kali lebih lama untuk pembaca.',
        'Anehnya, kalau kamu lihat CPU web server, angkanya malah turun ke <b>15%</b>. Artinya server tidak kewalahan menghitung. Ia hanya diam menunggu jawaban database, satu query demi satu query.',
        'Pola ini punya nama: <b>N+1 query</b>. Satu query untuk daftar komentar, ditambah N query untuk tiap penulisnya.',
        'Solusinya: ambil komentar dan penulisnya sekaligus dalam <b>satu query gabungan</b>. Kerja database kembali jadi sekitar <b>15 ms</b> saja.',
        'Jadi sebelum membeli server yang lebih besar, ukur dulu. Masalahnya sering bukan di hardware. Dan di petunjuk berikutnya, kita lihat masalah yang berbeda: pembaca yang tinggal jauh dari server.',
      ],
      callout: { kind: 'warning', text: 'Ukur dulu sebelum upgrade server. CPU rendah + waktu server membengkak biasanya berarti kode menunggu terlalu banyak query.' },
      changes: ['+ tiap penulis komentar diambil terpisah: 40 query ekstra', '~ CPU turun ke 15% — menunggu, bukan bekerja'],
      metrics: { server: { v: '440 ms', tone: 'bad' }, total: { v: '785 ms', tone: 'bad' } },
      beats: [
        {
          label: 'Peringatan badai',
          duration: 2000,
          entities: {
            browser: { focus: true, badge: { text: 'artikel ramai', tone: 'info' } },
            web: { ...CPU(0.2), focus: true, badge: { text: 'rakit halaman', tone: 'good' } },
            db: { badge: { text: 'sehat', tone: 'good' } },
            trace: {
              title: 'Kerja server · 55 ms',
              lines: [
                '> 1× baca 40 komentar  10 ms',
                '# 40× baca penulis    400 ms',
                '# CPU turun ke 15% (nunggu!)',
                '# total halaman    ~400 ms',
                '# solusi: 1 query gabung → ~15 ms',
              ],
            },
          },
          links: { bw: { label: 'GET /storm-warning' }, wd: { dashed: true, label: 'diam' } },
          flows: [{ route: ['bw'], rate: 1.1, bounce: true, once: 1 }],
          metrics: { server: '55 ms', total: { v: '400 ms', tone: 'good' } },
        },
        {
          label: '1× komentar',
          duration: 2200,
          entities: {
            web: { ...CPU(0.2), badge: { text: 'query 1 / 41', tone: 'info' } },
            db: { focus: true, badge: { text: '1 query · 10 ms', tone: 'good' } },
            trace: {
              lines: [
                '> 1× baca 40 komentar  10 ms',
                '# 40× baca penulis    400 ms',
                '# CPU turun ke 15% (nunggu!)',
                '# total halaman    ~410 ms',
                '# solusi: 1 query gabung → ~15 ms',
              ],
            },
          },
          links: { wd: { label: 'baca komentar', labelTone: 'good' }, bw: { label: 'GET /storm-warning' } },
          flows: [{ route: ['wd'], rate: 1.5, bounce: true, once: 1 }],
          metrics: { server: '65 ms', total: '410 ms' },
        },
        {
          label: '40× loop penulis',
          duration: 2800,
          entities: {
            web: { ...CPU(0.18), focus: true, badge: { text: 'loop 40 penulis', tone: 'warn' } },
            db: { focus: true, badge: { text: '41 query · 410 ms', tone: 'bad' } },
            trace: {
              title: 'N+1 query · 410 ms',
              lines: [
                '✓ 1× baca 40 komentar  10 ms',
                '> 40× baca penulis    400 ms',
                '# CPU turun ke 15% (nunggu!)',
                '# total halaman    ~785 ms',
                '# solusi: 1 query gabung → ~15 ms',
              ],
            },
          },
          links: { wd: { label: 'baca penulis × 40', labelTone: 'bad' } },
          flows: [{ route: ['wd'], kind: 'lambat', rate: 1.4, bounce: true, speed: 90, once: 8 }],
          metrics: { server: { v: '440 ms', tone: 'bad' }, total: '410 ms' },
        },
        {
          label: 'Total halaman ~785 ms',
          duration: 2200,
          entities: {
            browser: { focus: true, badge: { text: '~785 ms · ~2×', tone: 'bad' } },
            web: { ...CPU(0.18), badge: { text: 'loop selesai', tone: 'warn' } },
            db: { badge: { text: '41 query · 410 ms', tone: 'bad' } },
            trace: {
              title: 'N+1 query · ~785 ms',
              lines: [
                '✓ 1× baca 40 komentar  10 ms',
                '! 40× baca penulis    400 ms',
                '# CPU turun ke 15% (nunggu!)',
                '> total halaman    ~785 ms',
                '# solusi: 1 query gabung → ~15 ms',
              ],
            },
          },
          links: { bw: { label: 'halaman masih loading…', labelTone: 'bad' } },
          flows: [{ route: ['bw'], kind: 'lambat', rate: 0.6, bounce: true, speed: 70, once: 2 }],
          metrics: { server: { v: '440 ms', tone: 'bad' }, total: { v: '785 ms', tone: 'bad' } },
        },
        {
          label: 'N+1 · CPU nganggur',
          duration: 2200,
          entities: {
            browser: { badge: { text: '~785 ms · ~2×', tone: 'bad' } },
            web: { ...CPU(0.15, 'info'), focus: true, badge: { text: 'menunggu DB', tone: 'warn' } },
            db: { badge: { text: '41 query · 410 ms', tone: 'bad' } },
            trace: {
              title: 'N+1 query · CPU 15%',
              lines: [
                '✓ 1× baca 40 komentar  10 ms',
                '! 40× baca penulis    400 ms',
                '> CPU turun ke 15% (nunggu!)',
                '✓ total halaman    ~785 ms',
                '# solusi: 1 query gabung → ~15 ms',
              ],
            },
          },
          links: { wd: { label: 'baca penulis × 40', labelTone: 'bad' } },
          flows: [
            { route: ['bw'], rate: 0.4, bounce: true, speed: 90 },
            { route: ['wd'], kind: 'lambat', rate: 1.2, bounce: true, speed: 90 },
          ],
          metrics: { server: { v: '440 ms', tone: 'bad' }, total: { v: '785 ms', tone: 'bad' } },
        },
        {
          label: 'Solusi · 1 query',
          duration: 2000,
          entities: {
            browser: { badge: { text: 'balik ~400 ms', tone: 'good' } },
            web: { ...CPU(0.2), badge: { text: 'gabung penulis', tone: 'good' } },
            db: { badge: { text: '1 query · ~15 ms', tone: 'good' } },
            trace: {
              title: 'N+1 query · solusi',
              lines: [
                '✓ 1× baca komentar + penulis',
                '! 40× baca penulis    400 ms',
                '✓ CPU turun ke 15% (nunggu!)',
                '✓ total halaman    ~400 ms',
                '> solusi: 1 query gabung → ~15 ms',
              ],
            },
          },
          links: { wd: { label: '1 query gabung', labelTone: 'good' } },
          flows: [{ route: ['wd'], rate: 1.2, bounce: true, once: 1 }],
          metrics: { server: '55 ms', total: { v: '400 ms', tone: 'good' } },
        },
      ],
      scene: trip({
        browser: { badge: { text: 'peringatan badai', tone: 'info' } },
        web: { ...CPU(0.2), badge: { text: 'jalur sehat', tone: 'good' } },
        db: { badge: { text: 'siap', tone: 'good' } },
        request: { label: 'GET /storm-warning' },
        query: { dashed: true, label: 'diam' },
        extra: {
          trace: card(24, 22, 'Kerja server · 55 ms', [
            '> 1× baca 40 komentar  10 ms',
            '# 40× baca penulis    400 ms',
            '# CPU turun ke 15% (nunggu!)',
            '# total halaman    ~400 ms',
            '# solusi: 1 query gabung → ~15 ms',
          ]),
        },
        flows: [],
      }),
    },
    {
      short: 'Jauh',
      chapter: 'problem',
      title: 'Petunjuk #2: Kenapa pembaca jauh nunggu dua detik',
      body: [
        'Sekarang keluhan terparah datang dari pembaca yang membuka situs kita lewat internet seluler dari benua lain.',
        'Bagi mereka, satu kali bolak-balik ke server (round trip) bukan 30 ms, tapi <b>300 ms</b>. Itu sepuluh kali lebih lama. Jumlah bolak-baliknya sama saja, tapi setiap bolak-balik jadi sepuluh kali lebih mahal.',
        'Bayangkan berkirim surat. Surat ke kota sebelah sampai besok pagi, tapi surat ke luar negeri butuh seminggu. Isi suratnya sama, hanya jaraknya yang berbeda. Setiap kali kita butuh balasan, kita menunggu jauh lebih lama.',
        'Yang menarik, servernya sendiri tidak bermasalah. Kerjanya tetap cepat, hanya <b>25 ms</b>, dan bug N+1 tadi sudah diperbaiki. Tapi lihat ke mana waktunya habis. Persiapan koneksi (DNS, TCP, dan TLS) saja memakan <b>600 ms</b>. Lalu mengunduh 40 file memakan sekitar 1 detik penuh, karena setiap file harus minta dan dijawab lewat jalur yang jauh itu.',
        'Totalnya sekitar <b>2 detik</b>. Dari situ, server hanya bekerja 25 ms. Hampir semua sisanya adalah waktu di perjalanan. Jadi server secepat apa pun tidak akan menolong, karena masalahnya ada pada jarak.',
      ],
      callout: { kind: 'insight', text: 'Kelambatan datang dari dua hal yang beda: kerja berat di server, dan jarak jauh di jaringan. Solusinya juga beda.' },
      changes: ['+ pembaca berjarak 300 ms masuk ke diagram', '~ N+1 beres: kerja server balik ke 25 ms', '~ tiap round trip sekarang 10× lebih mahal'],
      metrics: {
        dns: { v: '100 ms', tone: 'warn' },
        connect: { v: '600 ms', tone: 'bad' },
        server: { v: '325 ms', tone: 'warn' },
        download: { v: '1.000 ms', tone: 'bad' },
        total: { v: '~2,0 dtk', tone: 'bad' },
      },
      beats: [
        {
          label: 'Pembaca jauh',
          duration: 2200,
          entities: {
            browser: { focus: false, badge: { text: 'dekat · 400 ms', tone: 'good' } },
            far: { ...FAR, ghost: false, focus: true, badge: { text: '300 ms RTT', tone: 'warn' } },
            trace: {
              title: 'Jarak · 300 ms RTT',
              lines: [
                '> round trip ke server  300 ms',
                '# kerja server ····  25 ms',
                '# DNS + TCP + TLS ··· ···',
                '# request + balasan ··· ···',
                '# 40 file download ···· ···',
                '# total halaman ····· ···',
              ],
            },
          },
          links: { fw: { label: 'RTT 300 ms (10×)', labelTone: 'bad' }, bw: { label: 'RTT 30 ms', labelTone: 'good' } },
          flows: [{ route: ['fw'], kind: 'lambat', rate: 0.7, bounce: true, speed: 45, once: 2 }],
          metrics: { server: '25 ms', total: '?' },
        },
        {
          label: 'Koneksi · 600 ms',
          duration: 2400,
          entities: {
            far: { focus: true, badge: { text: 'handshake…', tone: 'warn' } },
            trace: {
              lines: [
                '✓ round trip ke server  300 ms',
                '# kerja server ····  25 ms',
                '> DNS + TCP + TLS         600 ms',
                '# request + balasan ··· ···',
                '# 40 file download ···· ···',
                '# total halaman ····· ···',
              ],
            },
          },
          flows: [{ route: ['fw'], kind: 'ping', rate: 0.9, bounce: true, returnKind: 'ping', speed: 45, once: 2 }],
          metrics: { dns: { v: '100 ms', tone: 'warn' }, connect: { v: '600 ms', tone: 'bad' }, total: '?' },
        },
        {
          label: 'Request + balasan',
          duration: 2200,
          entities: {
            far: { badge: { text: 'menunggu…', tone: 'bad' } },
            web: { ...CPU(0.2), badge: { text: 'kerja tetap 25 ms', tone: 'good' } },
            trace: {
              lines: [
                '✓ round trip ke server  300 ms',
                '# kerja server ····  25 ms',
                '✓ DNS + TCP + TLS         600 ms',
                '> request + balasan       300 ms',
                '# 40 file download ···· ···',
                '# total halaman ····· ···',
              ],
            },
          },
          flows: [{ route: ['fw'], rate: 0.6, bounce: true, speed: 45, once: 1 }],
          metrics: { server: { v: '325 ms', tone: 'warn' }, total: '900 ms' },
        },
        {
          label: '40 files · 1 s',
          duration: 2500,
          entities: {
            far: { badge: { text: 'mengunduh…', tone: 'bad' } },
            trace: {
              lines: [
                '✓ round trip ke server  300 ms',
                '# kerja server ····  25 ms',
                '✓ DNS + TCP + TLS         600 ms',
                '✓ request + balasan       300 ms',
                '> 40 file download      1.000 ms',
                '# total halaman ····· ···',
              ],
            },
          },
          flows: [{ route: ['fw'], kind: 'lambat', rate: 1.1, bounce: true, speed: 45, once: 6 }],
          metrics: { download: { v: '1.000 ms', tone: 'bad' }, total: '1,900 ms' },
        },
        {
          label: 'Total halaman ~2 dtk',
          duration: 2200,
          entities: {
            far: { badge: { text: 'total ~2,0 dtk', tone: 'bad' } },
            trace: {
              title: 'Pembaca jauh · ~2,0 dtk',
              lines: [
                '✓ round trip ke server  300 ms',
                '# kerja server ····  25 ms',
                '✓ DNS + TCP + TLS         600 ms',
                '✓ request + balasan       300 ms',
                '✓ 40 file download      1.000 ms',
                '> total halaman          ~2,0 dtk',
              ],
            },
          },
          flows: [],
          metrics: { total: { v: '~2,0 dtk', tone: 'bad' } },
        },
        {
          label: 'Kerja 25 ms',
          duration: 2000,
          entities: {
            far: { focus: true, badge: { text: 'total ~2,0 dtk', tone: 'bad' } },
            web: { ...CPU(0.2), focus: true, badge: { text: 'kerja tetap 25 ms', tone: 'good' } },
            trace: {
              title: 'Kerja sama, jarak 10× lipat',
              lines: [
                '✓ round trip ke server  300 ms',
                '> kerja server: tetap 25 ms (1%)',
                '✓ DNS + TCP + TLS         600 ms',
                '✓ request + balasan       300 ms',
                '✓ 40 file download      1.000 ms',
                '✓ total halaman          ~2,0 dtk',
              ],
            },
          },
          flows: [{ route: ['fw'], kind: 'lambat', rate: 0.4, bounce: true, speed: 45 }],
          metrics: {
            dns: { v: '100 ms', tone: 'warn' },
            connect: { v: '600 ms', tone: 'bad' },
            server: { v: '325 ms', tone: 'warn' },
            download: { v: '1.000 ms', tone: 'bad' },
            total: { v: '~2,0 dtk', tone: 'bad' },
          },
        },
      ],
      scene: trip({
        browser: { sub: 'dekat · 30 ms RTT', badge: { text: 'total 400 ms', tone: 'good' } },
        web: { ...CPU(0.2), badge: { text: 'kerja tetap 25 ms', tone: 'good' } },
        db: { badge: { text: 'sehat · 5 ms', tone: 'good' } },
        request: { label: 'RTT 30 ms' },
        query: { label: 'baca artikel · 5 ms' },
        far: { label: 'RTT 300 ms (10×)', labelTone: 'bad' },
        extra: {
          far: { ...FAR, ghost: true },
          trace: card(30, 24, 'Jarak · 300 ms RTT', [
            '> round trip ke server  300 ms',
            '# kerja server ····  25 ms',
            '# DNS + TCP + TLS ··· ···',
            '# request + balasan ··· ···',
            '# 40 file download ···· ···',
            '# total halaman ····· ···',
          ]),
        },
        flows: [{ route: ['bw', 'wd'], rate: 0.8, bounce: true }],
      }),
    },
    {
      short: 'Rangkuman',
      chapter: 'recap',
      title: 'Jadi, ke mana saja waktunya habis?',
      body: [
        'Semua di halaman ini padahal cuma <b>penjumlahan</b>: DNS + koneksi + server + download = satu total. Di diagram, lembar contekan dan bar metrik di atas adalah penutup video kamu — pause di sini pas rekam.',
        `<table class="compare"><thead><tr><th>langkah</th><th>biaya umum</th><th>lambat kalau…</th><th>lihat</th></tr></thead><tbody>
          <tr><td>DNS lookup</td><td>20–100 ms baru</td><td>belum ada yang di-cache</td><td>pelajaran ini</td></tr>
          <tr><td>TCP + TLS</td><td>2 round trip</td><td>pembacanya jauh</td><td>CDN</td></tr>
          <tr><td>request + server</td><td>1 round trip + kerja</td><td>query kebanyakan atau lambat</td><td>Caching, Indeks</td></tr>
          <tr><td>download</td><td>beberapa gelombang</td><td>file ditemukan satu per satu</td><td>Caching, CDN</td></tr></tbody></table>`,
        'Coba cek pemahamanmu: pembaca berjarak 200 ms mengeluh lambat, padahal kerja servermu cuma 20 ms. Mana yang lebih ngefek — database lebih cepat atau lebih sedikit round trip? (Lebih sedikit round trip: sekali bolak-balik saja sudah 10× lipat seluruh kerja server — coba buktiin di slider di bawah!)',
      ],
      callout: { kind: 'insight', text: 'Latency itu penjumlahan. Tulis semua komponennya, cari angka paling gede, lalu kecilkan yang itu dulu.' },
      metrics: {
        dns: '40 ms',
        connect: '60 ms',
        server: '55 ms',
        download: '245 ms',
        total: { v: '400 ms', tone: 'good' },
      },
      beats: [
        {
          label: 'Satu klik',
          entities: {
            browser: { focus: true },
            far: { focus: false, ghost: true },
            tips: { ghost: true },
            cheat: {
              title: 'Lembar contekanmu',
              lines: [
                '> 1 klik → 4 bagian → 1 total',
                '# DNS ·········  ···',
                '# koneksi ······  ···',
                '# server ·······  ···',
                '# download ·····  ···',
                '# KAMU vs JAUH → lanjut',
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
                '✓ 1 klik → 4 bagian → 1 total',
                '> DNS ·········  40 ms',
                '# koneksi ······  ···',
                '# server ·······  ···',
                '# download ·····  ···',
                '# KAMU vs JAUH → lanjut',
              ],
            },
          },
          metrics: { dns: '40 ms', connect: '?', server: '?', download: '?', total: '?' },
        },
        {
          label: 'Koneksi',
          entities: {
            cheat: {
              lines: [
                '✓ 1 klik → 4 bagian → 1 total',
                '✓ DNS ·········  40 ms',
                '> koneksi ······  60 ms',
                '# server ·······  ···',
                '# download ·····  ···',
                '# KAMU vs JAUH → lanjut',
              ],
            },
          },
          metrics: { connect: '60 ms' },
        },
        {
          label: 'Kerja server',
          entities: {
            cheat: {
              lines: [
                '✓ 1 klik → 4 bagian → 1 total',
                '✓ DNS ·········  40 ms',
                '✓ koneksi ······  60 ms',
                '> server ·······  55 ms',
                '# download ·····  ···',
                '# KAMU vs JAUH → lanjut',
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
                '✓ 1 klik → 4 bagian → 1 total',
                '✓ DNS ·········  40 ms',
                '✓ koneksi ······  60 ms',
                '✓ server ·······  55 ms',
                '> download ····· 245 ms',
                '# KAMU vs JAUH → lanjut',
              ],
            },
          },
          metrics: { download: '245 ms', total: '?' },
        },
        {
          label: 'Dekat 400 ms',
          entities: {
            browser: { focus: true, badge: { text: 'total 400 ms', tone: 'good' } },
            far: { ghost: true },
            cheat: {
              lines: [
                '✓ 1 klik → 4 bagian → 1 total',
                '✓ DNS ·········  40 ms',
                '✓ koneksi ······  60 ms',
                '✓ server ·······  55 ms',
                '✓ download ····· 245 ms',
                '> KAMU dekat ··· 400 ms',
                '# JAUH → lanjut',
              ],
            },
          },
          metrics: { total: { v: '400 ms', tone: 'good' } },
          flows: [{ route: ['bw'], rate: 0.8, bounce: true, once: 2 }],
        },
        {
          label: 'Jauh ~2 dtk',
          entities: {
            browser: { focus: false },
            far: { ...FAR, focus: true, ghost: false, badge: { text: 'total ~2,0 dtk', tone: 'bad' } },
            cheat: {
              lines: [
                '✓ 1 klik → 4 bagian → 1 total',
                '✓ DNS ·········  40 ms',
                '✓ koneksi ······  60 ms',
                '✓ server ·······  55 ms',
                '✓ download ····· 245 ms',
                '✓ KAMU dekat ··· 400 ms',
                '> JAUH ·· ~2.000 ms',
              ],
            },
          },
          flows: [{ route: ['fw'], kind: 'lambat', rate: 0.4, bounce: true, once: 2, speed: 45 }],
        },
        {
          label: 'Kecilkan dulu',
          entities: {
            browser: { focus: true },
            far: { focus: false, badge: { text: '~2,0 dtk', tone: 'bad' } },
            tips: {
              ghost: false,
              focus: true,
              lines: ['> DNS → cache kosong', '# koneksi → pembaca jauh', '# server → query N+1', '# download → banyak RTT'],
            },
            cheat: {
              lines: [
                '✓ 1 klik → 4 bagian → 1 total',
                '✓ DNS ·········  40 ms',
                '✓ koneksi ······  60 ms',
                '✓ server ·······  55 ms',
                '✓ download ····· 245 ms',
                '✓ KAMU dekat ··· 400 ms',
                '! JAUH ·· ~2.000 ms',
                '> kecilkan bagian terbesar',
              ],
            },
          },
        },
        {
          label: 'Yang diperbaiki',
          entities: {
            tips: {
              lines: [
                '✓ DNS → cache kosong',
                '> koneksi → pembaca jauh',
                '# server → query N+1',
                '# download → banyak RTT',
              ],
            },
          },
        },
        {
          label: 'Query N+1',
          entities: {
            tips: {
              lines: [
                '✓ DNS → cache kosong',
                '✓ koneksi → pembaca jauh',
                '> server → query N+1',
                '# download → banyak RTT',
              ],
            },
          },
        },
        {
          label: 'Banyak RTT',
          entities: {
            tips: {
              lines: [
                '✓ DNS → cache kosong',
                '✓ koneksi → pembaca jauh',
                '✓ server → query N+1',
                '> download → banyak RTT',
              ],
            },
          },
        },
      ],
      scene: trip({
        browser: { focus: true, sub: 'dekat · 30 ms RTT', badge: { text: 'total 400 ms', tone: 'good' } },
        resolver: { badge: { text: 'tersimpan · 5 mnt', tone: 'good' } },
        web: { ...CPU(0.2), badge: { text: 'Kerja 25 ms', tone: 'good' } },
        db: { badge: { text: 'sehat', tone: 'good' } },
        request: { label: '40+60+55+245' },
        query: { label: 'kerja vs jarak', labelTone: 'info' },
        far: { label: 'RTT 300 ms', labelTone: 'warn' },
        extra: {
          far: { ...FAR, badge: { text: '~2,0 dtk', tone: 'bad' } },
          cheat: card(58, -10, 'Lembar contekanmu', [
            '✓ 1 klik → 4 bagian → 1 total',
            '✓ DNS ·········  40 ms',
            '✓ koneksi ······  60 ms',
            '✓ server ·······  55 ms',
            '✓ download ····· 245 ms',
            '✓ KAMU dekat ··· 400 ms',
            '! JAUH ·· ~2.000 ms',
            '> kecilkan bagian terbesar',
          ]),
          tips: card(12, 22, 'Lambat kalau…', [
            '✓ DNS → cache kosong',
            '✓ koneksi → pembaca jauh',
            '✓ server → query N+1',
            '✓ download → banyak RTT',
          ]),
        },
        flows: [
          { route: ['bw', 'wd'], rate: 0.6, bounce: true },
          { route: ['fw'], kind: 'lambat', rate: 0.35, bounce: true, speed: 45 },
        ],
      }),
    },
  ],
};
