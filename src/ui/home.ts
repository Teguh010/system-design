import { Stage } from '../engine/stage.ts';
import { lb, link, server, spread, users } from '../lessons/helpers.ts';
import { lessons } from '../lessons/index.ts';
import type { Scene } from '../types.ts';
import { esc, q } from './dom.ts';
import { lastStep, visited } from './store.ts';

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
    const modules = [...new Set(lessons.map((l) => l.module))];
    host.innerHTML = `
      <div class="home">
        <section class="hero">
          <div class="hero-text">
            <p class="eyebrow">An interactive system design notebook</p>
            <h1>System design you can <em>watch</em>.</h1>
            <p class="lede">Every lesson is a diagram you step through. Requests flow, servers fall over, caches soak up the load — and each step explains why the next box exists.</p>
            <p class="keys"><kbd>←</kbd> <kbd>→</kbd> step · <kbd>Space</kbd> pause · <kbd>R</kbd> replay · <kbd>F</kbd> fit · drag to pan</p>
          </div>
          <div class="hero-art" aria-hidden="true"></div>
        </section>
        ${modules
          .map(
            (m) => `
          <section class="module">
            <h2>${esc(m)}</h2>
            <div class="cards">${lessons
              .filter((l) => l.module === m)
              .map((l) => {
                const seen = visited(l.id).size;
                const pct = Math.round((seen / l.steps.length) * 100);
                const finished = seen >= l.steps.length;
                const cta = seen === 0 ? 'Start' : finished ? 'Review' : 'Continue';
                return `
                <a class="lesson-card" href="#/${l.id}/${finished ? 1 : (lastStep(l.id) ?? 1)}">
                  <div class="lc-meta"><span>${l.level}</span><span>${l.minutes} min</span><span>${l.steps.length} steps</span></div>
                  <h3>${esc(l.title)}</h3>
                  <p>${esc(l.summary)}</p>
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
    document.title = 'Scale Lab — system design you can watch';
  }

  destroy() {
    this.stage.destroy();
  }
}
