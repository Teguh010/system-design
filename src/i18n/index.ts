import en, { type UiKey } from './en.ts';
import id from './id.ts';

export type Locale = 'en' | 'id';
export type Localized = Record<Locale, string>;

export const LOCALES: { id: Locale; short: string; name: string }[] = [
  { id: 'en', short: 'EN', name: 'English' },
  { id: 'id', short: 'ID', name: 'Bahasa Indonesia' },
];

const DICTS: Record<Locale, Record<UiKey, string>> = { en, id };
const STORE_KEY = 'stl:lang';

const isLocale = (v: unknown): v is Locale => LOCALES.some((l) => l.id === v);

/** `?lang=` in the URL, then the saved choice, then the browser's languages, then English. */
function detect(): Locale {
  if (typeof window === 'undefined') return 'en';
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (isLocale(fromUrl)) return fromUrl;
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (isLocale(saved)) return saved;
  } catch {
    // ignore bad storage
  }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'in') return 'id';
    if (isLocale(base)) return base;
  }
  return 'en';
}

let current: Locale = detect();

export const getLocale = () => current;

export function setLocale(locale: Locale) {
  current = locale;
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(locale));
  } catch {
    // storage disabled: the choice lasts for this page only
  }
}

export function t(key: UiKey, vars: Record<string, string | number> = {}): string {
  const text = DICTS[current][key] ?? en[key];
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

/** Pick the current language from a `{ en, id }` pair. */
export const L = (s: Localized) => s[current] || s.en;
