export type EntityKind =
  | 'user' | 'client' | 'server' | 'db' | 'cache' | 'lb' | 'queue' | 'worker' | 'service' | 'cdn' | 'card' | 'tree' | 'stack';

/** Small line icons drawn flat on an entity's top face. */
export type IconName = 'globe' | 'server' | 'database' | 'bolt';

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
  /** A small gauge above the shape, e.g. `{ label: 'CPU', value: 0.3 }`. */
  meter?: { label: string; value: number; tone?: Tone };
  icon?: IconName;
  /** Scale of the shape (not its labels), e.g. 1.6 for a bigger machine. */
  size?: number;
  /**
   * Number of figures for `user` (1–3), layers for `tree` / `stack`, or rack units for `server`
   * (1–5; without it a server is one tall tower). Units added between steps drop onto the stack.
   */
  count?: number;
  /** How full a `db` is, 0–1. The level animates between steps and turns amber, then red, as it fills. */
  fill?: number;
  /**
   * Draws a soft neon glow under the shape: what the narration is about. When no entity in a scene
   * sets it, the entities added or changed by the step glow instead.
   */
  focus?: boolean;
  /** Card title and monospace lines. Prefix a line with `! `, `✓ `, `# ` or `> ` to colour/highlight it. */
  title?: string;
  lines?: string[];
}

export interface Link {
  from: string;
  to: string;
  dashed?: boolean;
  /** Bend as a fraction of the link length; sign picks the side. */
  curve?: number;
  /** Pill drawn on the middle of the link. */
  label?: string;
  labelTone?: Tone;
  /**
   * Arrowheads. `true` picks automatically: both ends when any flow travels the link in both
   * directions (a `bounce`, or a `~` reversed hop), otherwise only the `to` end.
   */
  arrow?: boolean | 'end' | 'both';
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

/** What happens when the reader breaks one entity on this step. */
export interface ChaosEffect {
  /** Trusted HTML. */
  text: string;
  /** Metric values that replace the step's while the entity is broken. */
  metrics?: Record<string, MetricValue>;
}

export interface Step {
  short: string;
  chapter: Chapter;
  title: string;
  /** Paragraphs of trusted HTML. */
  body: string[];
  callout?: { kind: 'insight' | 'tip' | 'warning'; text: string };
  /** Values not given here carry over from earlier steps. */
  metrics?: Record<string, MetricValue>;
  /**
   * Extra lines for the "What changed" list, each starting with `+ `, `~ ` or `- `.
   * Metric changes are listed automatically.
   */
  changes?: string[];
  /** Entities the reader may break on this step, keyed by entity id. */
  chaos?: Record<string, ChaosEffect>;
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
  steps?: ({
    short?: string;
    title?: string;
    body?: string[];
    callout?: string;
    changes?: string[];
    /** Chaos texts keyed by entity id. */
    chaos?: Record<string, string>;
  } | null)[];
}
