import type { Locale } from '../i18n/index.ts';
import { getPathname } from '../i18n/navigation.ts';

export function lessonStepPath(locale: Locale, lessonId: string, step: number): string {
  return `${getPathname({ locale, href: `/lessons/${lessonId}/${step}` }).replace(/\/$/, '')}/`;
}