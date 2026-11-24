import type { Locale } from '../i18n/index.ts';

export type GlossaryEntry = {
  id: string;
  match: string[];
  definition: Record<Locale, string>;
  lessonId?: string;
  step?: number;
};

export const glossaryEntries: GlossaryEntry[] = [
  {
    id: 'rtt',
    match: ['round-trip time', 'round trips', 'round trip', 'round-trip', 'RTT'],
    definition: {
      en: 'Time for a signal to go to the server and back once — the unit of network delay.',
      id: 'Waktu sinyal pergi ke server dan kembali sekali — satuan delay jaringan.',
    },
    lessonId: 'request-lifecycle',
    step: 3,
  },
  {
    id: 'dns',
    match: ['DNS', 'DNS lookup', 'DNS lookups'],
    definition: {
      en: 'Turns a hostname into an IP address before any HTTP traffic can start.',
      id: 'Mengubah hostname jadi alamat IP sebelum trafik HTTP bisa mulai.',
    },
    lessonId: 'request-lifecycle',
    step: 2,
  },
  {
    id: 'ttl',
    match: ['TTL'],
    definition: {
      en: 'How long a DNS or cache answer may be reused before it must be refreshed.',
      id: 'Berapa lama jawaban DNS atau cache boleh dipakai lagi sebelum di-refresh.',
    },
    lessonId: 'request-lifecycle',
    step: 2,
  },
  {
    id: 'tcp',
    match: ['TCP'],
    definition: {
      en: 'Reliable transport; the browser opens it before sending HTTP, costing at least one round trip.',
      id: 'Transport andal; browser membukanya sebelum HTTP, minimal satu round trip.',
    },
    lessonId: 'request-lifecycle',
    step: 3,
  },
  {
    id: 'tls',
    match: ['TLS'],
    definition: {
      en: 'Encrypts the connection and proves the server’s identity — another round trip with TLS 1.3.',
      id: 'Mengenkripsi koneksi dan membuktikan identitas server — satu round trip lagi dengan TLS 1.3.',
    },
    lessonId: 'request-lifecycle',
    step: 3,
  },
  {
    id: 'ttfb',
    match: ['time to first byte', 'TTFB'],
    definition: {
      en: 'When the first response byte arrives: DNS + handshakes + request trip + server work.',
      id: 'Saat byte respons pertama tiba: DNS + handshake + perjalanan request + kerja server.',
    },
    lessonId: 'request-lifecycle',
    step: 6,
  },
  {
    id: 'http',
    match: ['HTTP request', 'HTTP'],
    definition: {
      en: 'Text commands (method, path, headers) sent over an open TCP/TLS connection.',
      id: 'Perintah teks (method, path, header) dikirim lewat koneksi TCP/TLS yang sudah terbuka.',
    },
    lessonId: 'request-lifecycle',
    step: 4,
  },
  {
    id: 'n-plus-one',
    match: ['N+1 query', 'N+1'],
    definition: {
      en: 'One query becomes many (often one per row) because the app loads related data in a loop.',
      id: 'Satu query memecah jadi banyak (sering satu per baris) karena app memuat data terkait di loop.',
    },
    lessonId: 'request-lifecycle',
    step: 8,
  },
  {
    id: 'p99',
    match: ['percentiles', 'percentile', 'p99', 'p95', 'p50'],
    definition: {
      en: 'A latency cutoff: p99 is slower than 99% of requests — tails matter, not just the average.',
      id: 'Batas latency: p99 lebih lambat dari 99% request — ekor distribusi penting, bukan hanya rata-rata.',
    },
    lessonId: 'latency-throughput',
    step: 7,
  },
  {
    id: 'throughput',
    match: ['throughput'],
    definition: {
      en: 'How much work the system finishes per second (requests, jobs, bytes).',
      id: 'Berapa banyak pekerjaan sistem selesaikan per detik (request, job, byte).',
    },
    lessonId: 'latency-throughput',
    step: 3,
  },
  {
    id: 'latency',
    match: ['latency'],
    definition: {
      en: 'How long one operation takes to finish — often mixed up with throughput.',
      id: 'Berapa lama satu operasi selesai — sering dicampur dengan throughput.',
    },
    lessonId: 'latency-throughput',
    step: 1,
  },
  {
    id: 'queue',
    match: ['queue', 'queues'],
    definition: {
      en: 'Buffers work when arrivals outpace capacity; wait time grows with backlog.',
      id: 'Menampung kerja saat kedatangan melebihi kapasitas; waktu tunggu naik seiring antrean.',
    },
    lessonId: 'latency-throughput',
    step: 5,
  },
  {
    id: 'worker',
    match: ['workers', 'worker'],
    definition: {
      en: 'Consumers that pull jobs from a queue and do the work in parallel.',
      id: 'Konsumen yang mengambil job dari antrean dan mengerjakannya secara paralel.',
    },
    lessonId: 'latency-throughput',
    step: 6,
  },
  {
    id: 'load-balancer',
    match: ['load balancing', 'load balancer'],
    definition: {
      en: 'A front door that spreads traffic across many servers instead of one hot machine.',
      id: 'Pintu depan yang membagi trafik ke banyak server, bukan satu mesin yang panas.',
    },
    lessonId: 'load-balancing',
    step: 2,
  },
  {
    id: 'cache-hit',
    match: ['cache miss', 'cache hit', 'hit rate'],
    definition: {
      en: 'A hit serves data from fast cache; a miss falls through to the slower source.',
      id: 'Hit mengambil dari cache cepat; miss jatuh ke sumber yang lebih lambat.',
    },
    lessonId: 'caching',
    step: 4,
  },
  {
    id: 'cache',
    match: ['caching', 'cached', 'cache'],
    definition: {
      en: 'Keeps a copy of expensive answers in fast storage to skip repeat work.',
      id: 'Menyimpan salinan jawaban mahal di penyimpanan cepat agar tidak mengulang kerja.',
    },
    lessonId: 'caching',
    step: 2,
  },
  {
    id: 'cdn',
    match: ['CDN'],
    definition: {
      en: 'Edge caches placed near users so static bytes travel a shorter distance.',
      id: 'Cache di edge dekat user supaya byte statis menempuh jarak lebih pendek.',
    },
    lessonId: 'cdn',
    step: 2,
  },
  {
    id: 'origin',
    match: ['origin server', 'origin'],
    definition: {
      en: 'The authoritative copy of content; the CDN fetches from here on a miss.',
      id: 'Salinan otoritatif konten; CDN mengambil dari sini saat miss.',
    },
    lessonId: 'cdn',
    step: 3,
  },
  {
    id: 'stateless',
    match: ['stateless'],
    definition: {
      en: 'Servers that keep no user session in memory — any instance can handle the next request.',
      id: 'Server tidak menyimpan sesi user di memori — instance mana pun bisa layani request berikutnya.',
    },
    lessonId: 'stateless',
    step: 3,
  },
  {
    id: 'sticky-session',
    match: ['sticky sessions', 'sticky session'],
    definition: {
      en: 'Routes a user to the same server so in-memory state still works — fights true scale-out.',
      id: 'Mengarahkan user ke server yang sama agar state di memori tetap jalan — menghambat scale-out.',
    },
    lessonId: 'stateless',
    step: 5,
  },
  {
    id: 'vertical-scaling',
    match: ['vertical scaling', 'scale up'],
    definition: {
      en: 'Make one machine bigger (CPU/RAM) instead of adding more machines.',
      id: 'Membesarkan satu mesin (CPU/RAM), bukan menambah jumlah mesin.',
    },
    lessonId: 'vertical-horizontal',
    step: 3,
  },
  {
    id: 'horizontal-scaling',
    match: ['horizontal scaling', 'scale out'],
    definition: {
      en: 'Add more machines and split work — needs load balancing and shared state choices.',
      id: 'Menambah mesin dan membagi kerja — butuh load balancing dan keputusan state bersama.',
    },
    lessonId: 'vertical-horizontal',
    step: 5,
  },
  {
    id: 'shard',
    match: ['sharding', 'shard'],
    definition: {
      en: 'Splits data across many databases so no single node holds everything.',
      id: 'Membagi data ke banyak database agar tidak ada satu node yang menampung semua.',
    },
    lessonId: 'url-shortener',
    step: 6,
  },
  {
    id: 'replica',
    match: ['replicas', 'replica', 'read replica'],
    definition: {
      en: 'A copy of the database that serves reads while the leader handles writes.',
      id: 'Salinan database untuk baca sementara leader menangani tulis.',
    },
    lessonId: 'url-shortener',
    step: 7,
  },
];

export const glossaryById = new Map(glossaryEntries.map((e) => [e.id, e]));