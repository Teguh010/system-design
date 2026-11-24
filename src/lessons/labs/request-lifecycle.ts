import type { Locale } from '../../i18n/index.ts';
import type { Flow, MetricValue, Scene, Tone } from '../../types.ts';
import type { Lab } from './index.ts';

export interface Breakdown {
  dns: number;
  connect: number;
  server: number;
  download: number;
  total: number;
}

/**
 * The lesson's own numbers as a formula of round-trip time and server work, so the slider agrees
 * with the static steps: RTT 30 / work 25 → 400 ms, work 410 → 785 ms, RTT 300 → ~2.0 s.
 * Illustrative: DNS and download are straight lines fitted through those steps.
 */
export function pageLoad(rtt: number, work: number): Breakdown {
  const dns = 40 + ((rtt - 30) * 2) / 9;
  const connect = 2 * rtt;
  const server = rtt + work;
  const download = 160 + 2.8 * rtt;
  return { dns, connect, server, download, total: dns + connect + server + download };
}

const round5 = (ms: number) => Math.round(ms / 5) * 5;

/** Hops are always shown in ms (as in the lesson); only the total switches to seconds. */
export function formatMs(ms: number, locale: Locale, total = false): string {
  const tag = locale === 'id' ? 'id-ID' : 'en-US';
  if (total && ms >= 1000) {
    const s = new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(ms / 1000);
    return locale === 'id' ? `~${s} dtk` : `~${s} s`;
  }
  return `${new Intl.NumberFormat(tag).format(round5(ms))} ms`;
}

const termTone = (ms: number): Tone | null => (ms >= 500 ? 'bad' : ms >= 200 ? 'warn' : null);
const totalTone = (ms: number): Tone => (ms < 500 ? 'good' : ms < 1000 ? 'warn' : 'bad');
const value = (v: string, tone: Tone | null): MetricValue => (tone ? { v, tone } : v);

const TERM_NAMES = {
  dns: { en: 'DNS', id: 'DNS' },
  connect: { en: 'connect', id: 'koneksi' },
  server: { en: 'request + server', id: 'request + server' },
  download: { en: 'download', id: 'download' },
} as const;

export const requestLifecycleLab: Lab = {
  step: 10,
  title: { en: 'Try it yourself', id: 'Coba sendiri' },
  intro: {
    en: 'One reader, two knobs. Set the round trip to 200 ms and server work to 20 ms to check your answer below, then see which knob moves the total more.',
    id: 'Satu pembaca, dua kenop. Atur round trip ke 200 ms dan kerja server ke 20 ms untuk memeriksa jawabanmu di bawah, lalu lihat kenop mana yang lebih menggeser total.',
  },
  controls: [
    { id: 'rtt', label: { en: 'round trip to the server', id: 'round trip ke server' }, min: 10, max: 400, step: 10, value: 30, unit: 'ms' },
    { id: 'work', label: { en: 'server work', id: 'kerja server' }, min: 5, max: 500, step: 5, value: 25, unit: 'ms' },
  ],
  compute(values, locale, base) {
    const rtt = values.rtt ?? 30;
    const work = values.work ?? 25;
    const b = pageLoad(rtt, work);
    const metrics: Record<string, MetricValue> = {
      dns: value(formatMs(b.dns, locale), termTone(b.dns)),
      connect: value(formatMs(b.connect, locale), termTone(b.connect)),
      server: value(formatMs(b.server, locale), termTone(b.server)),
      download: value(formatMs(b.download, locale), termTone(b.download)),
      total: { v: formatMs(b.total, locale, true), tone: totalTone(b.total) },
    };

    const terms = (['dns', 'connect', 'server', 'download'] as const).map((k) => [k, b[k]] as const);
    const [biggest, ms] = terms.reduce((a, c) => (c[1] > a[1] ? c : a));
    const name = TERM_NAMES[biggest][locale];
    const note = locale === 'id'
      ? `Komponen terbesar: ${name} (${formatMs(ms, locale)}). Kecilkan yang itu dulu.`
      : `Biggest term: ${name} (${formatMs(ms, locale)}). Shrink that one first.`;

    const { far: _far, ...entities } = base.entities;
    const { fw: _fw, ...links } = base.links ?? {};
    const slowNet = rtt >= 150;
    const slowWork = work >= 200;
    const flows: Flow[] = [
      { route: ['bw'], rate: 0.9, bounce: true, ...(slowNet && { kind: 'slow' as const }), speed: Math.max(35, 165 - rtt * 0.35) },
      { route: ['wd'], rate: 0.9, bounce: true, ...(slowWork && { kind: 'slow' as const }), speed: slowWork ? 80 : 165 },
    ];
    const scene: Scene = {
      entities,
      links: {
        ...links,
        ...(links.bw && { bw: { ...links.bw, label: `RTT ${rtt} ms`, ...(rtt >= 80 && { labelTone: slowNet ? 'bad' : 'warn' }) } }),
        ...(links.wd && {
          wd: { ...links.wd, label: `${locale === 'id' ? 'kerja server' : 'server work'} · ${work} ms`, ...(slowWork && { labelTone: 'bad' as const }) },
        }),
      },
      flows,
    };
    return { metrics, scene, note };
  },
};
