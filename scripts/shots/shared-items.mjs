// Shared-items wave evidence (docs/rework/depth/FOUNDATION.md §12): tooltip grades (Kindled / Fabled, ember marker,
// Inscription block) and the v2 tag labels in the Skills window, from the dev panels gallery (no server). Usage (Vite
// dev server running):
//   node scripts/shoot.mjs scripts/shots/shared-items.mjs --base=http://localhost:5241 --out=docs/rework/depth/shots --jpeg
export default async function (api) {
  await api.viewport(1920, 1080);
  for (const [name, q, ready] of [
    ['grades-tips', 's=tips&still=1', '.tt-grade'],
    ['skills-tags', 's=skills&still=1', '.pn-root .sk-body'],
  ]) {
    await api.goto(`${api.base}/gallery-panels.html?${q}`);
    await api.until(() => api.eval(`Boolean(document.querySelector(${JSON.stringify(ready)}))`), 20000, name);
    await api.settle(700);
    const info = await api.eval(`({ grades: [...document.querySelectorAll('.tt-grade')].map(e => e.textContent), embers: document.querySelectorAll('.af-ember').length,
      inscriptions: document.querySelectorAll('.tt-inscription').length, tags: [...document.querySelectorAll('.sk-tag-word')].map(e => e.textContent).slice(0, 12) })`);
    console.log(name, JSON.stringify(info), 'scrollers', JSON.stringify(await api.scrollers()));
    await api.shot(name);
  }
}
