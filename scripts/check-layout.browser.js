// Paste into the browser console on /en/ or /id/. Run separately for each language.
// The temporary visible iframe walks every lesson step at a desktop viewport size.
// Use a test origin: visiting steps temporarily updates that origin's saved progress.
(async () => {
  const locale = location.pathname.split('/')[1];
  if (!['en', 'id'].includes(locale)) throw new Error('Open /en/ or /id/ first');
  document.querySelectorAll('nav button[aria-expanded="false"]').forEach((button) => button.click());
  await new Promise((resolve) => setTimeout(resolve, 200));
  const ids = [...new Set([...document.querySelectorAll('a.cn-lesson')]
    .map((a) => new URL(a.href).pathname.match(/^\/(?:en|id)\/lessons\/([^/]+)\//)?.[1])
    .filter(Boolean))];
  if (!ids.length) throw new Error('No lesson links found; wait for the page to load');

  const frame = document.createElement('iframe');
  const savedProgress = ['stl:visited', 'stl:last'].map((key) => [key, localStorage.getItem(key)]);
  Object.assign(frame.style, { position: 'fixed', inset: '0', width: '1200px', height: '800px', zIndex: '99999', background: 'white' });
  document.body.append(frame);
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const area = (a, b) =>
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const report = [];
  let stepCount = 0;
  const open = async (id, step) => {
    await new Promise((resolve, reject) => {
      frame.onload = resolve;
      frame.onerror = reject;
      frame.src = `/${locale}/lessons/${id}/${step}/`;
    });
    for (let i = 0; i < 100 && !frame.contentDocument.querySelector('.timeline li'); i++) await delay(100);
    if (!frame.contentDocument.querySelector('.timeline li')) throw new Error(`Lesson did not load: ${id}/${step}`);
    await delay(1200);
    return frame.contentDocument;
  };

  try {
    for (const id of ids) {
      let doc = await open(id, 1);
      const steps = doc.querySelectorAll('.timeline li').length;
      for (let i = 1; i <= steps; i++) {
        if (i > 1) doc = await open(id, i);
        stepCount++;
        const parts = [...doc.querySelectorAll('.layer-ents > g')]
          .filter((g) => Number(g.style.opacity) > 0.9)
          .map((g) => ({
            name: g.querySelector('.pill text, .card-title')?.textContent ?? g.getAttribute('class'),
            boxes: [...g.querySelectorAll('.pill, .badge, .meter, .card-bg, .face, .sub')].map((e) => e.getBoundingClientRect()),
          }))
          .concat([...doc.querySelectorAll('.layer-labels .link-pill')]
            .map((p) => ({ name: `“${p.textContent}”`, boxes: [p.getBoundingClientRect()] })));
        for (let a = 0; a < parts.length; a++)
          for (let b = a + 1; b < parts.length; b++) {
            let worst = 0;
            for (const x of parts[a].boxes) for (const y of parts[b].boxes) worst = Math.max(worst, area(x, y));
            if (worst > 30) report.push(`${id}/${i}: ${parts[a].name} × ${parts[b].name} (${Math.round(worst)} px²)`);
          }
      }
    }
    console.log(report.length ? report.join('\n') : `Layout OK — ${ids.length} lessons, ${stepCount} steps checked`);
  } finally {
    frame.remove();
    for (const [key, value] of savedProgress) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
  }
})();
