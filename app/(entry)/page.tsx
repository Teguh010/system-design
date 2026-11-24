import { allLessons } from '../../src/course';
import { routing } from '../../src/i18n/routing';

const lessonSteps = Object.fromEntries(
  allLessons.flatMap(({ id, lesson }) => lesson ? [[id, lesson.steps.length]] : []),
);

const redirectScript = `
  (() => {
    const supported = ${JSON.stringify(routing.locales)};
    const isSupported = (locale) => supported.includes(locale);
    let lang = new URLSearchParams(location.search).get('lang');
    if (!isSupported(lang)) {
      try { lang = JSON.parse(localStorage.getItem('stl:lang') || 'null'); } catch {}
    }
    if (!isSupported(lang)) {
      const languages = navigator.languages || [navigator.language];
      lang = languages.map(s => {
        const base = s.toLowerCase().split('-')[0];
        return base === 'in' ? 'id' : base;
      }).find(isSupported) || ${JSON.stringify(routing.defaultLocale)};
    }
    const steps = ${JSON.stringify(lessonSteps)};
    const match = location.hash.match(/^#\\/([^/]+)(?:\\/(\\d+))?\\/?$/);
    const id = match && match[1];
    const count = id && Object.prototype.hasOwnProperty.call(steps, id) ? steps[id] : 0;
    const step = count ? Math.max(1, Math.min(count, Number(match[2]) || 1)) : 1;
    location.replace(count ? '/' + lang + '/lessons/' + id + '/' + step + '/' : '/' + lang + '/');
  })();
`;

export default function EntryPage() {
  return <>
    <script dangerouslySetInnerHTML={{ __html: redirectScript }} />
    <main><a href="/en/">English</a> · <a href="/id/">Bahasa Indonesia</a></main>
  </>;
}
