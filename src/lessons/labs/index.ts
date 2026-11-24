import type { Locale, Localized } from '../../i18n/index.ts';
import type { MetricValue, Scene } from '../../types.ts';
import { requestLifecycleLab } from './request-lifecycle.ts';

export interface LabControl {
  id: string;
  label: Localized;
  min: number;
  max: number;
  step: number;
  value: number;
  unit: string;
}

export interface LabResult {
  metrics: Record<string, MetricValue>;
  /** The step's (already localized) scene, adjusted to the current values. */
  scene: Scene;
  /** One short sentence, plain text. */
  note: string;
}

/**
 * A step the reader can tune with sliders. Labs are code, so they live outside the lesson data,
 * which must stay serializable to be passed from server to client.
 */
export interface Lab {
  /** 1-based step number. */
  step: number;
  title: Localized;
  intro: Localized;
  controls: LabControl[];
  compute(values: Record<string, number>, locale: Locale, base: Scene): LabResult;
}

const labs: Record<string, Lab[]> = {
  'request-lifecycle': [requestLifecycleLab],
};

export const labFor = (lessonId: string, step: number) => labs[lessonId]?.find((l) => l.step === step);
