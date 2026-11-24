import { allLessons, course } from '../course.ts';
import { L, t } from '../i18n/index.ts';
import { esc } from './dom.ts';
import { lastStep, visited } from './store.ts';

const open = new Set<string>();

export const pad2 = (n: number) => String(n).padStart(2, '0');

export function isComplete(lessonId: string) {
  const entry = allLessons.find((l) => l.id === lessonId);
  return !!entry?.lesson && visited(lessonId).size >= entry.lesson.steps.length;
}

/** Where a lesson link should land: the last step seen, or step 1 once finished. */
export function lessonHref(lessonId: string) {
  return `#/${lessonId}/${isComplete(lessonId) ? 1 : (lastStep(lessonId) ?? 1)}`;
}

export function renderSidebar(el: HTMLElement, currentId: string | null) {
  for (const m of course) if (m.lessons.some((l) => l.id === currentId)) open.add(m.id);
  const done = allLessons.filter((l) => isComplete(l.id)).length;

  el.innerHTML = `
    <div class="cn-head">
      <span class="cn-title"><svg viewBox="0 0 20 16" width="18" height="14" aria-hidden="true"><path d="M1 3a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2z"/></svg>${t('nav.course')}</span>
      <span class="cn-count">${t('nav.lessons', { n: allLessons.length })}</span>
    </div>
    <ol class="cn-modules">
      ${course
        .map((m, mi) => {
          const isOpen = open.has(m.id);
          const finished = m.lessons.filter((l) => isComplete(l.id)).length;
          return `
          <li class="cn-module${isOpen ? ' is-open' : ''}">
            <button class="cn-mod" type="button" data-module="${m.id}" aria-expanded="${isOpen}">
              <span class="chev" aria-hidden="true">›</span>
              <i class="folder" style="--m:${m.color}" aria-hidden="true"></i>
              <span class="cn-mod-name">${pad2(mi + 1)}. ${esc(L(m.title))}</span>
              <span class="cn-mod-count">${finished}/${m.lessons.length}</span>
            </button>
            <ol class="cn-lessons">
              ${m.lessons
                .map((l) =>
                  l.lesson
                    ? `<li><a href="${lessonHref(l.id)}" class="cn-lesson${l.id === currentId ? ' is-current' : ''}${isComplete(l.id) ? ' is-done' : ''}"${l.id === currentId ? ' aria-current="page"' : ''}>${esc(L(l.title))}</a></li>`
                    : `<li><span class="cn-lesson is-soon">${esc(L(l.title))}<em>${t('nav.soon')}</em></span></li>`,
                )
                .join('')}
            </ol>
          </li>`;
        })
        .join('')}
    </ol>
    <div class="cn-progress">
      <span>${t('nav.progress')}</span>
      <span class="cn-progress-n">${done} / ${allLessons.length}</span>
      <div class="bar"><i style="width:${(done / allLessons.length) * 100}%"></i></div>
    </div>`;

  el.querySelectorAll<HTMLButtonElement>('.cn-mod').forEach((btn) =>
    btn.addEventListener('click', () => {
      const id = btn.dataset.module!;
      if (open.has(id)) open.delete(id);
      else open.add(id);
      const li = btn.parentElement!;
      li.classList.toggle('is-open', open.has(id));
      btn.setAttribute('aria-expanded', String(open.has(id)));
    }),
  );
}
