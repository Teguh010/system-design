import type { Localized } from './i18n/index.ts';
import { caching } from './lessons/caching.ts';
import { cdns } from './lessons/cdn.ts';
import { latencyThroughput } from './lessons/latency-throughput.ts';
import { loadBalancing } from './lessons/load-balancing.ts';
import { napkinMath } from './lessons/napkin-math.ts';
import { replication } from './lessons/replication.ts';
import { sharding } from './lessons/sharding.ts';
import { requestLifecycle } from './lessons/request-lifecycle.ts';
import { indexes } from './lessons/indexes.ts';
import { storageEngines } from './lessons/storage-engines.ts';
import { sqlNosql } from './lessons/sql-nosql.ts';
import { stateless } from './lessons/stateless.ts';
import { urlShortener } from './lessons/url-shortener.ts';
import { verticalHorizontal } from './lessons/vertical-horizontal.ts';
import type { Lesson } from './types.ts';

export interface CourseLesson {
  id: string;
  title: Localized;
  /** Missing until the lesson is written; shown as “coming soon”. */
  lesson?: Lesson;
}

export interface CourseModule {
  id: string;
  title: Localized;
  color: string;
  lessons: CourseLesson[];
}

const soon = (id: string, en: string, idn = en): CourseLesson => ({ id, title: { en, id: idn } });
const ready = (lesson: Lesson, idn: string): CourseLesson => ({ id: lesson.id, title: { en: lesson.title, id: idn }, lesson });

export const course: CourseModule[] = [
  {
    id: 'foundations',
    title: { en: 'Foundations', id: 'Dasar-dasar' },
    color: '#d9b77a',
    lessons: [
      ready(requestLifecycle, 'Perjalanan Sebuah Request'),
      ready(latencyThroughput, 'Latency & Throughput'),
      ready(napkinMath, 'Hitungan Kasar (Napkin Math)'),
    ],
  },
  {
    id: 'scaling',
    title: { en: 'Scaling', id: 'Scaling' },
    color: '#7fb77e',
    lessons: [
      ready(verticalHorizontal, 'Scaling Vertikal vs Horizontal'),
      ready(loadBalancing, 'Load Balancing'),
      ready(stateless, 'Layanan Stateless'),
      ready(caching, 'Caching'),
      ready(cdns, 'CDN'),
    ],
  },
  {
    id: 'data',
    title: { en: 'Data & Storage', id: 'Data & Penyimpanan' },
    color: '#8f7fd1',
    lessons: [
      ready(sqlNosql, 'SQL vs NoSQL'),
      ready(indexes, 'Indeks (Indexes)'),
      ready(storageEngines, 'Mesin Penyimpanan'),
      ready(replication, 'Replikasi'),
      ready(sharding, 'Sharding'),
      soon('consistent-hashing', 'Consistent Hashing'),
      soon('unique-ids', 'Unique IDs at Scale', 'ID Unik dalam Skala Besar'),
      soon('cap', 'CAP & Consistency', 'CAP & Konsistensi'),
      soon('consensus', 'Consensus & Leaders', 'Konsensus & Leader'),
      soon('transactions', 'Transactions & Isolation', 'Transaksi & Isolasi'),
      soon('files', 'Files & Media', 'File & Media'),
    ],
  },
  {
    id: 'communication',
    title: { en: 'Communication', id: 'Komunikasi' },
    color: '#e08e5a',
    lessons: [
      soon('apis', 'REST, RPC & GraphQL'),
      soon('queues', 'Message Queues'),
      soon('pubsub', 'Pub/Sub & Events', 'Pub/Sub & Event'),
      soon('realtime', 'Real-time Updates', 'Pembaruan Real-time'),
    ],
  },
  {
    id: 'reliability',
    title: { en: 'Reliability', id: 'Keandalan' },
    color: '#5b8fd9',
    lessons: [
      soon('redundancy', 'Redundancy & Failover', 'Redundansi & Failover'),
      soon('rate-limiting', 'Rate Limiting'),
      soon('timeouts-retries', 'Timeouts & Retries', 'Timeout & Retry'),
      soon('observability', 'Observability'),
    ],
  },
  {
    id: 'architecture',
    title: { en: 'Architecture', id: 'Arsitektur' },
    color: '#4fa89b',
    lessons: [
      soon('microservices', 'Monolith vs Microservices'),
      soon('service-discovery', 'Service Discovery'),
      soon('sagas', 'Sagas & Distributed Transactions', 'Saga & Transaksi Terdistribusi'),
      soon('batch-stream', 'Batch vs Stream'),
    ],
  },
  {
    id: 'security',
    title: { en: 'Security', id: 'Keamanan' },
    color: '#d4607a',
    lessons: [
      soon('authn', 'Authentication', 'Autentikasi'),
      soon('authz', 'Authorization', 'Otorisasi'),
      soon('encryption', 'Encryption & Keys', 'Enkripsi & Kunci'),
    ],
  },
  {
    id: 'shipping',
    title: { en: 'Shipping', id: 'Rilis' },
    color: '#9aa04a',
    lessons: [soon('testing', 'Testing'), soon('deploys', 'CI/CD & Deploys', 'CI/CD & Deploy')],
  },
  {
    id: 'whole-systems',
    title: { en: 'Whole Systems', id: 'Sistem Utuh' },
    color: '#6c7a96',
    lessons: [
      soon('hld-lld', 'HLD & LLD'),
      ready(urlShortener, 'Merancang URL Shortener'),
      soon('news-feed', 'Design a News Feed', 'Merancang News Feed'),
      soon('chat', 'Design a Chat System', 'Merancang Sistem Chat'),
    ],
  },
];

export const allLessons = course.flatMap((m) => m.lessons);

export function findInCourse(lessonId: string) {
  for (const [mi, module] of course.entries()) {
    const li = module.lessons.findIndex((l) => l.id === lessonId);
    if (li >= 0) return { module, moduleIndex: mi, entry: module.lessons[li]!, lessonIndex: li };
  }
  return undefined;
}
