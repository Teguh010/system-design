import type { routing } from './routing.ts';

export type Locale = (typeof routing.locales)[number];
export type Localized = Record<Locale, string>;

export const LOCALES: { id: Locale; short: string; name: string }[] = [
  { id: 'en', short: 'EN', name: 'English' },
  { id: 'id', short: 'ID', name: 'Bahasa Indonesia' },
];
