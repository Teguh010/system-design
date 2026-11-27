import type { Entity, Link, MetricValue, Scene, SceneBeat, Step } from '../types.ts';

/**
 * Resolves the active scene and metrics for a step at `beatIndex`.
 * Entity/link patches stack beat 0 → `beatIndex` on `step.scene` (same as metrics) so later
 * micro-beats can change only badges without resetting the trace card. Flows come from the
 * active beat only, or from `step.scene` when that beat does not set `flows`.
 */
export function resolveBeat(
  step: Step,
  beatIndex: number,
): { scene: Scene; metrics: Record<string, MetricValue>; beat: SceneBeat | undefined } {
  const beats = step.beats;
  if (!beats?.length) {
    return { scene: step.scene, metrics: { ...step.metrics }, beat: undefined };
  }
  const idx = Math.max(0, Math.min(beats.length - 1, beatIndex));
  const beat = beats[idx]!;

  const entities: Record<string, Entity> = { ...step.scene.entities };
  for (const b of beats.slice(0, idx + 1)) {
    if (!b.entities) continue;
    for (const [id, patch] of Object.entries(b.entities)) {
      if (patch === null) {
        delete entities[id];
      } else {
        const base = entities[id];
        if (base) entities[id] = { ...base, ...patch };
        else if (patch.kind && patch.x !== undefined && patch.y !== undefined) entities[id] = patch as Entity;
      }
    }
  }

  const links: Record<string, Link> = { ...step.scene.links };
  for (const b of beats.slice(0, idx + 1)) {
    if (!b.links) continue;
    for (const [id, patch] of Object.entries(b.links)) {
      if (patch === null) {
        delete links[id];
      } else {
        const base = links[id];
        if (base) links[id] = { ...base, ...patch };
        else if (patch.from && patch.to) links[id] = patch as Link;
      }
    }
  }

  const metrics: Record<string, MetricValue> = Object.assign(
    {},
    step.metrics,
    ...beats.slice(0, idx + 1).map((b) => b.metrics),
  );

  const camera = beat.camera ?? step.scene.camera;
  const scene: Scene = {
    entities,
    ...(Object.keys(links).length > 0 && { links }),
    ...(beat.flows !== undefined ? { flows: beat.flows } : step.scene.flows ? { flows: step.scene.flows } : {}),
    ...(camera && { camera }),
  };

  return { scene, metrics, beat };
}
