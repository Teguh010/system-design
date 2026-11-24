const PREFIX = 'stl:';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full or disabled: progress just isn't remembered
  }
}

type Visited = Record<string, number[]>;

export function markVisited(lessonId: string, step: number) {
  const all = load<Visited>('visited', {});
  const set = new Set(all[lessonId] ?? []);
  if (set.has(step)) return;
  set.add(step);
  all[lessonId] = [...set].sort((a, b) => a - b);
  save('visited', all);
}

export const visited = (lessonId: string) => new Set(load<Visited>('visited', {})[lessonId] ?? []);

export const lastStep = (lessonId: string) => load<Record<string, number>>('last', {})[lessonId];

export function setLastStep(lessonId: string, step: number) {
  save('last', { ...load<Record<string, number>>('last', {}), [lessonId]: step });
}

export type Theme = 'light' | 'dark';

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  save('theme', theme);
}

export const currentTheme = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
