// Quadros da PoC em progressos exatos de cada trilho (sobre o build em dist/).
// uso: node scripts/shots.mjs <saída> [desktop|mobile|all] [query]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, 'evidence', 'shots');
const which = process.argv[3] || 'all';
const query = process.argv[4] || '';
mkdirSync(out, { recursive: true });
const PORT = 4180;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/orbital/`)).ok) break; } catch { /* aguardando */ } await new Promise((r) => setTimeout(r, 200)); }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const formats = { desktop: { width: 1440, height: 900, dpr: 1, mobile: false }, mobile: { width: 390, height: 844, dpr: 2, mobile: true } };
const POINTS = { arrival: [0, 0.12, 0.3, 0.45, 0.6, 0.75, 0.88, 1], atlas: [0, 0.06, 0.1, 0.17, 0.25, 0.37, 0.41, 0.5, 0.74, 0.98] };

for (const [fmt, F] of Object.entries(formats)) {
  if (which !== 'all' && which !== fmt) continue;
  const ctx = await browser.newContext({ viewport: { width: F.width, height: F.height }, deviceScaleFactor: F.dpr, isMobile: F.mobile, hasTouch: F.mobile, locale: 'pt-BR' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => errs.push('requestfailed: ' + r.url()));
  await page.goto(`http://127.0.0.1:${PORT}/orbital/${query}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const tracks = await page.evaluate(() => {
    const m = (id) => { const el = document.getElementById(id); const st = el.querySelector('.stage'); const top = el.getBoundingClientRect().top + scrollY; return { start: top, end: top + el.offsetHeight - st.offsetHeight }; };
    return { arrival: m('arrival'), atlas: m('atlas') };
  });
  for (const [track, pts] of Object.entries(POINTS)) {
    for (const p of pts) {
      const y = tracks[track].start + p * (tracks[track].end - tracks[track].start);
      await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), Math.round(y));
      await page.waitForTimeout(700); // amortecimento converge (lambda 12–14 → ~0,4 s)
      await page.screenshot({ path: `${out}/${fmt}_${track}_p${String(Math.round(p * 100)).padStart(3, '0')}.png` });
    }
  }
  const fv = await page.evaluate(() => { const s = document.querySelector('.surface[data-front="true"]'); const v = s?.querySelector('video'); return { world: s?.dataset.world, video: s?.dataset.video, playing: v ? !v.paused && v.readyState >= 2 : null, src: v?.currentSrc?.split('/').pop() }; }); console.log('front', JSON.stringify(fv));
  // mundo expandido
  await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), Math.round(tracks.atlas.start + 0.25 * (tracks.atlas.end - tracks.atlas.start)));
  await page.waitForTimeout(600);
  await page.click('#enter');
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${out}/${fmt}_world_open.png` });
  const dlg = await page.evaluate(() => { const b = document.querySelector('.world-body'); const m = document.getElementById('world-media').getBoundingClientRect(); return { scrollTop: b.scrollTop, mediaTop: m.top, mediaH: m.height, bodyH: b.scrollHeight, viewH: innerHeight }; }); console.log('dialog', JSON.stringify(dlg));
  const video = await page.evaluate(() => { const v = document.getElementById('world-video'); return { hidden: v.hidden, readyState: v.readyState, paused: v.paused, time: v.currentTime, src: v.currentSrc.split('/').pop() }; });
  console.log('video', JSON.stringify(video));
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${out}/${fmt}_world_open_late.png` });
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${fmt}_world_next.png` });
  const v2 = await page.evaluate(() => { const v = document.getElementById('world-video'); return { title: document.getElementById('world-title').textContent, playing: !v.paused && v.readyState >= 2, src: v.currentSrc.split('/').pop(), t: v.currentTime }; }); console.log('next', JSON.stringify(v2));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  console.log(JSON.stringify({ fmt, tracks, errors: errs.slice(0, 6) }));
  await ctx.close();
}
await browser.close();
server.kill();
