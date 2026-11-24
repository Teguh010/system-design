export type EntityKind = 'user' | 'server' | 'db' | 'cache' | 'lb' | 'queue' | 'worker' | 'service' | 'cdn' | 'card';

export type Tone = 'good' | 'bad' | 'warn' | 'info';

export interface Badge {
  text: string;
  tone?: Tone;
}

/** Something drawn on the stage. Coordinates are in isometric grid units. */
export interface Entity {
  kind: EntityKind;
  x: number;
  y: number;
  z?: number;
  label?: string;
  sub?: string;
  badge?: Badge;
  down?: boolean;
  ghost?: boolean;
  /** Number of figures drawn for `user` entities (1–3). */
  count?: number;
  /** Card title and monospace lines. Prefix a line with `! `, `✓ ` or `# ` to colour it. */
  title?: string;
  lines?: string[];
}

export interface Link {
  from: string;
  to: string;
  dashed?: boolean;
  /** Bend as a fraction of the link length; sign picks the side. */
  curve?: number;
  label?: string;
}

export type PacketKind = 'req' | 'res' | 'slow' | 'write' | 'fail' | 'poison' | 'ping';

export interface Flow {
  /** Link ids travelled in order. Prefix an id with `~` to travel it backwards. */
  route: string[];
  kind?: PacketKind;
  /** Packets per second. */
  rate: number;
  /** Travel back along the route after arriving. */
  bounce?: boolean;
  returnKind?: PacketKind;
  /** Probability (0–1) that a packet fails on arrival. */
  fail?: number;
  /** Pixels per second. */
  speed?: number;
}

export interface Scene {
  entities: Record<string, Entity>;
  links?: Record<string, Link>;
  flows?: Flow[];
}

export type Chapter = 'setup' | 'problem' | 'technique' | 'solution' | 'tradeoff' | 'insight' | 'recap';

export type MetricValue = string | { v: string; tone: Tone };

export interface Step {
  short: string;
  chapter: Chapter;
  title: string;
  /** Paragraphs of trusted HTML. */
  body: string[];
  callout?: { kind: 'insight' | 'tip' | 'warning'; text: string };
  /** Values not given here carry over from earlier steps. */
  metrics?: Record<string, MetricValue>;
  scene: Scene;
}

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  metrics: { id: string; label: string }[];
  legend: (PacketKind | [PacketKind, string])[];
  goals: { text: string; step: number }[];
  steps: Step[];
}

/**
 * A translation of a lesson. Prose is matched by position (step i, paragraph j);
 * short diagram strings (labels, card lines, metric values, legend) by their English text.
 * Anything missing falls back to English.
 */
export interface LessonOverlay {
  title?: string;
  summary?: string;
  metrics?: string[];
  goals?: string[];
  labels?: Record<string, string>;
  steps?: ({ short?: string; title?: string; body?: string[]; callout?: string } | null)[];
}
