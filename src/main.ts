import { findLesson } from './lessons/index.ts';
import './style.css';
import { HomeView } from './ui/home.ts';
import { LessonView } from './ui/lesson.ts';
import { currentTheme, setTheme } from './ui/store.ts';

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="top">
    <a class="brand" href="#/">
      <svg viewBox="0 0 28 28" width="22" height="22" aria-hidden="true">
        <polygon points="14,3 25,8.5 14,14 3,8.5" class="logo-top" />
        <polygon points="3,8.5 14,14 14,25 3,19.5" class="logo-l" />
        <polygon points="25,8.5 14,14 14,25 25,19.5" class="logo-r" />
      </svg>
      Scale Lab
    </a>
    <button class="icon-btn theme" type="button" title="Toggle dark mode" aria-label="Toggle dark mode">◐</button>
  </header>
  <main id="view"></main>`;

const main = document.getElementById('view')!;
let view: HomeView | LessonView | null = null;

function route() {
  const [, id, n] = location.hash.replace(/^#/, '').split('/');
  const lesson = id ? findLesson(id) : undefined;
  if (!lesson) {
    if (location.hash && location.hash !== '#/') history.replaceState(null, '', '#/');
    if (view instanceof HomeView) return;
    view?.destroy();
    view = new HomeView(main);
    window.scrollTo(0, 0);
    return;
  }
  if (!(view instanceof LessonView) || view.lesson.id !== lesson.id) {
    view?.destroy();
    view = new LessonView(main, lesson);
  }
  const step = Number.parseInt(n ?? '1', 10);
  view.go(Number.isFinite(step) ? step - 1 : 0);
}

document.querySelector('.theme')!.addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
addEventListener('hashchange', route);
route();
