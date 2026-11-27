// Rend en PNG les pages listées par gen_reseaux.py (supports-html/reseaux/manifeste.json) dans charte/reseaux.
// Usage : node rendu_reseaux.js <dossier charte>   (Playwright + Chromium ; polices Google Fonts chargées en ligne)
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
(async () => {
  const charte = path.resolve(process.argv[2] || '..');
  const src = path.join(charte, 'sources', 'supports-html', 'reseaux');
  const out = path.join(charte, 'reseaux'); fs.mkdirSync(out, { recursive: true });
  const liste = JSON.parse(fs.readFileSync(path.join(src, 'manifeste.json'), 'utf8'));
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const nav = await chromium.launch({ proxy });
  for (const p of liste) {
    const ctx = await nav.newContext({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto('file://' + path.join(src, p.html), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const ok = await page.evaluate(() => document.fonts.check('600 20px "Cormorant Garamond"') && document.fonts.check('400 20px Inter'));
    // débordements : tout élément qui sort de la page
    const hors = await page.evaluate(([w, h]) => [...document.querySelectorAll('.page *')].filter(e => {
      const r = e.getBoundingClientRect(); return r.width && (r.right > w + 1 || r.bottom > h + 1 || r.left < -1 || r.top < -1);
    }).map(e => e.className || e.tagName), [p.w, p.h]);
    // zone visuelle trop petite pour son contenu (chevauchement du titre ou du pied)
    const serre = await page.evaluate(() => [...document.querySelectorAll('.zone')].some(z => {
      const r = z.getBoundingClientRect();
      return [...z.querySelectorAll('*')].some(e => { const q = e.getBoundingClientRect(); return q.height && (q.top < r.top - 1 || q.bottom > r.bottom + 1); });
    }));
    if (serre) hors.push('ZONE TROP PETITE');
    await page.screenshot({ path: path.join(out, p.png), clip: { x: 0, y: 0, width: p.w, height: p.h } });
    console.log(p.png, ok ? 'polices ok' : 'POLICES MANQUANTES', hors.length ? 'HORS CADRE: ' + hors.slice(0, 5) : '');
    await ctx.close();
  }
  await nav.close();
})();
