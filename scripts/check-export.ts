import { readFileSync } from 'node:fs';
import { allLessons } from '../src/course.ts';
import { routing } from '../src/i18n/routing.ts';
import { localize } from '../src/lessons/localize.ts';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;',
})[c]!);

let count = 0;
for (const locale of routing.locales) {
  for (const { id, lesson: source } of allLessons) {
    if (!source) continue;
    const lesson = await localize(source, locale);
    for (const [index, step] of lesson.steps.entries()) {
      const file = new URL(`../out/${locale}/lessons/${id}/${index + 1}/index.html`, import.meta.url);
      const html = readFileSync(file, 'utf8');
      if (!html.includes(`<html lang="${locale}"`) || !html.includes(`<h2>${escapeHtml(step.title)}</h2>`)) {
        throw new Error(`Missing localized lesson content in ${file.pathname}`);
      }
      count++;
    }
  }
}
console.log(`OK — ${count} localized lesson pages`);
