// Layout check — paste into the browser console on the dev server (http://localhost:5173).
// Walks every step of every written lesson in the current language and reports pairs of
// diagram elements (boxes, labels, badges, cards) that overlap by more than 30 px².
// Run it once per language (?lang=en and ?lang=id): translated labels are often wider.
(async () => {
  const frames = (ms) =>
    new Promise((resolve) => {
      const t0 = performance.now();
      const tick = () => (performance.now() - t0 < ms ? requestAnimationFrame(tick) : resolve());
      requestAnimationFrame(tick);
    });
  const area = (a, b) =>
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

  const ids = [...new Set([...document.querySelectorAll('a.cn-lesson')].map((a) => a.getAttribute('href').split('/')[1]))];
  const report = [];
  for (const id of ids) {
    location.hash = `#/${id}/1`;
    await frames(400);
    const steps = document.querySelectorAll('.timeline li').length;
    for (let i = 1; i <= steps; i++) {
      location.hash = `#/${id}/${i}`;
      await frames(950);
      const parts = [...document.querySelectorAll('.layer-ents > g')]
        .filter((g) => g.style.opacity === '1')
        .map((g) => ({
          name: g.querySelector('.pill text, .card-title')?.textContent ?? g.getAttribute('class'),
          boxes: [...g.querySelectorAll('.pill, .badge, .card-bg, .face, .sub')].map((e) => e.getBoundingClientRect()),
        }));
      for (let a = 0; a < parts.length; a++)
        for (let b = a + 1; b < parts.length; b++) {
          let worst = 0;
          for (const x of parts[a].boxes) for (const y of parts[b].boxes) worst = Math.max(worst, area(x, y));
          if (worst > 30) report.push(`${id}/${i}: ${parts[a].name} × ${parts[b].name} (${Math.round(worst)} px²)`);
        }
    }
  }
  console.log(report.length ? report.join('\n') : `Layout OK — ${ids.length} lessons checked`);
})();
