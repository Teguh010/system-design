import { allLessons } from '../../src/course';

const lessonSteps = Object.fromEntries(
  allLessons.flatMap(({ id, lesson }) => lesson ? [[id, lesson.steps.length]] : []),
);

const redirectScript = `
  (() => {
    let lang = new URLSearchParams(location.search).get('lang');
    if (lang !== 'en' && lang !== 'id') {
      try { lang = JSON.parse(localStorage.getItem('stl:lang') || 'null'); } catch {}
    }
    if (lang !== 'en' && lang !== 'id') {
      const languages = navigator.languages || [navigator.language];
      lang = languages.map(s => s.toLowerCase().split('-')[0]).find(s => s === 'en' || s === 'id' || s === 'in') || 'en';
      if (lang === 'in') lang = 'id';
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
