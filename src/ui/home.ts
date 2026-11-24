import { course } from '../course.ts';
import { Stage } from '../engine/stage.ts';
import { L, t } from '../i18n/index.ts';
import { lb, link, server, spread, users } from '../lessons/helpers.ts';
import type { Scene } from '../types.ts';
import { esc, q } from './dom.ts';
import { isComplete, lessonHref, pad2 } from './sidebar.ts';
import { visited } from './store.ts';

const HERO: Scene = {
  entities: {
    users: users(0, 0),
    lb: lb(10, 0),
    a: server(20, -15),
    b: server(20, 0),
    c: server(20, 15, { down: true }),
  },
  links: { ul: link('users', 'lb'), la: link('lb', 'a'), lb: link('lb', 'b'), lc: link('lb', 'c', { dashed: true }) },
  flows: [
    ...spread(
      [
        ['ul', 'la'],
        ['ul', 'lb'],
      ],
      3,
      { bounce: true },
    ),
    { route: ['ul', 'lc'], kind: 'req', rate: 0.5, fail: 1 },
  ],
};

export class HomeView {
  private stage: Stage;

  constructor(host: HTMLElement) {
    host.innerHTML = `
      <div class="home">
        <section class="hero">
          <div class="hero-text">
            <p class="eyebrow">${t('home.eyebrow')}</p>
            <h1>${t('home.title')}</h1>
            <p class="lede">${t('home.lede')}</p>
            <p class="keys">${t('home.keys')}</p>
          </div>
          <div class="hero-art" aria-hidden="true"></div>
        </section>
        ${course
          .map(
            (m, mi) => `
          <section class="module">
            <h2><i class="folder" style="--m:${m.color}" aria-hidden="true"></i>${pad2(mi + 1)}. ${esc(L(m.title))}</h2>
            <div class="cards">${m.lessons
              .map((l, li) => {
                const meta = `<div class="lc-meta"><span>${t('lesson.of', { i: li + 1, n: m.lessons.length })}</span>${
                  l.lesson ? `<span>${t('lesson.min', { n: l.lesson.minutes })}</span><span>${t('lesson.steps', { n: l.lesson.steps.length })}</span>` : ''
                }</div>`;
                if (!l.lesson) return `<div class="lesson-card is-soon">${meta}<h3>${esc(L(l.title))}</h3><span class="cta">${t('home.soon')}</span></div>`;
                const seen = visited(l.id).size;
                const pct = Math.round((Math.min(seen, l.lesson.steps.length) / l.lesson.steps.length) * 100);
                const cta = seen === 0 ? t('home.start') : isComplete(l.id) ? t('home.review') : t('home.continue');
                return `
                <a class="lesson-card" href="${lessonHref(l.id)}">
                  ${meta}
                  <h3>${esc(L(l.title))}</h3>
                  <div class="lc-foot">
                    <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
                    <span class="cta">${cta} →</span>
                  </div>
                </a>`;
              })
              .join('')}
            </div>
          </section>`,
          )
          .join('')}
      </div>`;
    this.stage = new Stage(q(host, '.hero-art'));
    this.stage.setScene(HERO, { jumpCamera: true });
    document.title = 'Scale Lab';
  }

  destroy() {
    this.stage.destroy();
  }
}
