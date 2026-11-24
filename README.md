# Scale Lab

Interactive system design lessons: isometric SVG diagrams you step through, with live traffic, failures and metrics.
Inspired by [Designed to Scale](https://designed-to-scale.vercel.app/). The UI uses Next.js and React;
the animation engine remains framework-independent TypeScript and SVG, without Canvas/WebGL.

> **Continuing the work?** Read [PLAN.md](PLAN.md) first: progress checklist, roadmap, and the authoring rules every lesson follows.

Requires Node.js 22.18 or newer.

```sh
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run build      # static production export into out/
npm run preview    # serve out/ locally with Python 3
npm run check:i18n # every lesson translation matches its English source
npm run test:i18n  # UI translation and pluralization regression tests
npm run check:export # verify localized lesson HTML after build
```

The export can be hosted on a static web server; no backend is required. Future server-side features
will require a suitable deployment and a change to the export configuration.

Progress and preferences use the same localStorage keys as before, but browser storage is scoped to the
origin, including the port. To reuse data from `http://localhost:5173`, stop the old Vite server and run
`npm run dev -- --port 5173`; `http://localhost:3000` has separate storage. Use the same hostname too.

**Keys:** `←` `→` step · `Space` pause traffic · `R` replay step · `F` fit view · drag to pan · scroll / double-click to zoom.

## How it works

The engine is written once; lessons are plain data.

```
app/               Next.js App Router, localized pages and legacy-link entry point
components/        React interface and SVG stage integration
src/
  course.ts        9 modules / 40 lessons; unwritten lessons show as "coming soon"
  engine/
    iso.ts         2:1 isometric projection, convex hull, ray/polygon clipping
    shapes.ts      server, db, cache, lb, queue, worker, cdn, user, card → SVG + outline
    stage.ts       scene diffing & tweening, depth sort, links, packets, camera, zoom/pan
    svg.ts         element helper, canvas-based text measuring
  i18n/            next-intl routing, configuration and typed UI messages
  lessons/
    helpers.ts     authoring helpers: at(u, v), server(), db(), link(), spread()…
    localize.ts    applies a lesson translation, loaded on demand
    *.ts           one file per lesson (English source)
    i18n/<locale>/<lesson-id>.ts   translations
  ui/store.ts      compatible localStorage progress and theme helpers
```

Each step describes a **scene** — what exists, how it's connected and what traffic flows:

```ts
scene: {
  entities: { users: users(0, 0), app: server(14, 0, { label: 'app server' }), db: db(28, 0) },
  links:    { ua: link('users', 'app'), ad: link('app', 'db') },
  flows:    [{ route: ['ua', 'ad'], rate: 2.4, bounce: true }],
}
```

On step change the stage diffs the new scene against the current one: entities with the same id glide to their
new position, new ones drop in, missing ones fade out, and the camera eases to fit (it stays put if everything
already fits). Metrics not set on a step carry over from earlier steps.

- `at(u, v)` places things in screen-friendly axes (`u` → right, `v` → down) instead of the diagonal iso axes.
  Keep stacked servers at least 17 `v` apart when they carry badges, so labels and badges don't collide.
- `size` scales a shape (not its labels), e.g. `server(15, 0, { size: 1.6 })` for a bigger machine.
- Flow routes are link ids in order; prefix with `~` to travel a link backwards. `bounce` sends a response back,
  `fail` is the chance a packet dies on arrival, `kind` picks the packet colour.

## Languages

English and Bahasa Indonesia use `/en/` and `/id/` URLs. At `/`, `?lang=` takes precedence, then the
saved choice, then the browser language, then English. Legacy `#/<lesson>/<step>` links at `/` are
redirected in the browser, preserving their lesson and step.

- **UI strings** use `next-intl` and ICU messages in `src/i18n/en.ts` and `id.ts`. The Indonesian
  dictionary is typed against the English keys. Components use `useTranslations`, including `t.rich`
  for formatting, and `getPathname` for locale-prefixed URLs.
- **Lessons** are written in English. A translation (`src/lessons/i18n/id/<lesson-id>.ts`, type `LessonOverlay`)
  matches prose by position (step *i*, paragraph *j*) and short diagram strings — labels, card lines, metric values,
  legend — by their exact English text. Anything missing falls back to English.
- Module and lesson titles for the sidebar are in `src/course.ts` as `{ en, id }` pairs.

Locale configuration is in `src/i18n/routing.ts`. Static export cannot run next-intl middleware, so
the entry page continues to choose a language in the browser; it preserves the existing `stl:lang`
preference. Server-side next-intl calls should pass an explicit locale or use `setRequestLocale`
after validating the route.

To add a language, extend the routing configuration and language selector, add its UI dictionary to
`src/i18n/request.ts`, and update course titles and lesson overlay loaders. Verify prerendered pages
and client navigation.

## Adding a lesson

1. Create `src/lessons/<id>.ts` exporting a `Lesson` (see `src/types.ts`).
2. In `src/course.ts`, replace the matching `soon(...)` entry with `ready(lesson, '<Indonesian title>')`.
3. Add `src/lessons/i18n/id/<id>.ts`, register its loader in `src/lessons/localize.ts`,
   then run `npm run check:i18n`.
4. Open `/en/lessons/<id>/1/` and `/id/lessons/<id>/1/`.
