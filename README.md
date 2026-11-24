# Scale Lab

Interactive system design lessons: isometric SVG diagrams you step through, with live traffic, failures and metrics.
Inspired by [Designed to Scale](https://designed-to-scale.vercel.app/). No UI framework, no canvas/WebGL: TypeScript, Vite and plain SVG.

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
```

**Keys:** `←` `→` step · `Space` pause traffic · `R` replay step · `F` fit view · drag to pan · scroll / double-click to zoom.

## How it works

The engine is written once; lessons are plain data.

```
src/
  engine/
    iso.ts       2:1 isometric projection, convex hull, ray/polygon clipping
    shapes.ts    server, db, cache, lb, queue, worker, user, card → SVG + outline
    stage.ts     scene diffing & tweening, depth sort, links, packets, camera, zoom/pan
    svg.ts       element helper, canvas-based text measuring
  lessons/
    helpers.ts   authoring helpers: at(u, v), server(), db(), link(), spread()…
    url-shortener.ts
  ui/            router views (home, lesson player), localStorage progress
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
- Flow routes are link ids in order; prefix with `~` to travel a link backwards. `bounce` sends a response back,
  `fail` is the chance a packet dies on arrival, `kind` picks the packet colour.

## Adding a lesson

1. Create `src/lessons/<id>.ts` exporting a `Lesson` (see `src/types.ts`).
2. Register it in `src/lessons/index.ts`.
3. Open `#/<id>/1`.
