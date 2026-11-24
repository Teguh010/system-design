import { findInCourse } from './course.ts';
import { getLocale, LOCALES, setLocale, t, type Locale } from './i18n/index.ts';
import { localize } from './lessons/localize.ts';
import './style.css';
import { q } from './ui/dom.ts';
import { HomeView } from './ui/home.ts';
import { LessonView } from './ui/lesson.ts';
import { renderSidebar } from './ui/sidebar.ts';
import { currentTheme, setTheme } from './ui/store.ts';

const app = document.getElementById('app')!;
let view: HomeView | LessonView | null = null;
let currentLessonId: string | null = null;
let routeToken = 0;

function renderShell() {
  app.innerHTML = `
    <header class="top">
      <button class="icon-btn menu" type="button" aria-label="${t('nav.menu')}" aria-expanded="false">☰</button>
      <a class="brand" href="#/">
        <svg viewBox="0 0 28 28" width="22" height="22" aria-hidden="true">
          <polygon points="14,3 25,8.5 14,14 3,8.5" class="logo-top" />
          <polygon points="3,8.5 14,14 14,25 3,19.5" class="logo-l" />
          <polygon points="25,8.5 14,14 14,25 25,19.5" class="logo-r" />
        </svg>
        Scale Lab
      </a>
      <div class="top-right">
        <div class="lang" role="group" aria-label="${t('lang.label')}">
          ${LOCALES.map(
            (l) => `<button type="button" data-lang="${l.id}" title="${l.name}" aria-pressed="${l.id === getLocale()}">${l.short}</button>`,
          ).join('')}
        </div>
        <button class="icon-btn theme" type="button" title="${t('theme.toggle')}" aria-label="${t('theme.toggle')}">◐</button>
      </div>
    </header>
    <div class="shell">
      <nav class="course-nav" aria-label="${t('nav.course')}"></nav>
      <div class="nav-scrim"></div>
      <main id="view"></main>
    </div>`;

  q(app, '.theme').addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
  q(app, '.menu').addEventListener('click', () => toggleNav());
  q(app, '.nav-scrim').addEventListener('click', () => toggleNav(false));
  app.querySelectorAll<HTMLButtonElement>('.lang button').forEach((b) =>
    b.addEventListener('click', () => {
      const locale = b.dataset.lang as Locale;
      if (locale === getLocale()) return;
      setLocale(locale);
      view?.destroy();
      view = null;
      renderShell();
      void route();
    }),
  );
}

function toggleNav(open?: boolean) {
  const isOpen = open ?? !document.body.classList.contains('nav-open');
  document.body.classList.toggle('nav-open', isOpen);
  q(app, '.menu').setAttribute('aria-expanded', String(isOpen));
}

const refreshSidebar = () => renderSidebar(q(app, '.course-nav'), currentLessonId);

async function route() {
  const token = ++routeToken;
  const [, id, n] = location.hash.replace(/^#/, '').split('/');
  const found = id ? findInCourse(id) : undefined;
  const main = q<HTMLElement>(app, '#view');
  toggleNav(false);

  if (!found?.entry.lesson) {
    if (location.hash && location.hash !== '#/') history.replaceState(null, '', '#/');
    currentLessonId = null;
    if (!(view instanceof HomeView)) {
      view?.destroy();
      view = new HomeView(main);
      main.scrollTo(0, 0);
    }
    refreshSidebar();
    return;
  }

  const lesson = await localize(found.entry.lesson, getLocale());
  if (token !== routeToken) return;
  currentLessonId = lesson.id;
  if (!(view instanceof LessonView) || view.lesson.id !== lesson.id) {
    view?.destroy();
    view = new LessonView(main, lesson, found, refreshSidebar);
  }
  const step = Number.parseInt(n ?? '1', 10);
  view.go(Number.isFinite(step) ? step - 1 : 0);
}

renderShell();
addEventListener('hashchange', () => void route());
void route();
