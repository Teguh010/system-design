import type { Entity, Flow, Link } from '../types.ts';

/**
 * Place things in screen-friendly axes: `u` runs left → right, `v` runs top → bottom.
 * (The isometric x/y axes run diagonally, which is awkward to author by hand.)
 */
export const at = (u: number, v: number, z = 0) => ({ x: (u + v) / 2, y: (u - v) / 2, z });

type Look = Omit<Entity, 'x' | 'y' | 'z' | 'kind'>;

const make =
  (kind: Entity['kind']) =>
  (u: number, v: number, look: Look = {}): Entity => ({ kind, ...at(u, v), ...look });

export const users = make('user');
export const server = make('server');
export const service = make('service');
export const db = make('db');
export const cache = make('cache');
export const lb = make('lb');
export const queue = make('queue');
export const worker = make('worker');
export const cdn = make('cdn');
export const client = make('client');

export const card = (u: number, v: number, title: string, lines: string[]): Entity => ({ kind: 'card', ...at(u, v), title, lines });

/** Tiered nodes for B-tree / index illustrations. */
export const tree = make('tree');

/** Stacked levels for LSM / SSTable illustrations. */
export const stack = make('stack');

export const link = (from: string, to: string, extra: Partial<Link> = {}): Link => ({ from, to, ...extra });

/** Split a total rate evenly across several alternative routes (e.g. one per server). */
export function spread(routes: string[][], rate: number, base: Omit<Flow, 'route' | 'rate'> = {}): Flow[] {
  return routes.map((route) => ({ ...base, route, rate: rate / routes.length }));
}
