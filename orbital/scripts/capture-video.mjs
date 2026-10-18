// Vídeo QUADRO A QUADRO da experiência (sobre o build em dist/): cada quadro = rolagem nativa até uma
// posição → espera o amortecimento convergir → screenshot. Mostra composição e continuidade reais;
// o ritmo é o da montagem (não mede fluidez de GPU).
// uso: node scripts/capture-video.mjs <saída.mp4> [desktop|mobile] [fps]
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, 'evidence', 'video', 'orbital.mp4');
const fmt = process.argv[3] || 'desktop';
const FPS = Number(process.argv[4] || 24);
const F = { desktop: { width: 1440, height: 900, dpr: 1, mobile: false }, mobile: { width: 390, height: 844, dpr: 2, mobile: true } }[fmt];
const frames = out.replace(/\.mp4$/, '') + '-frames';
rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true }); mkdirSync(dirname(out), { recursive: true });

const PORT = 4186;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/orbital/`)).ok) break; } catch { /* aguardando */ } await new Promise((r) => setTimeout(r, 200)); }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: F.width, height: F.height }, deviceScaleFactor: F.dpr, isMobile: F.mobile, hasTouch: F.mobile, locale: 'pt-BR' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://127.0.0.1:${PORT}/orbital/`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(600);
const T = await page.evaluate(() => {
  const m = (id) => { const el = document.getElementById(id); const st = el.querySelector('.stage'); const top = el.getBoundingClientRect().top + scrollY; return { start: top, end: top + el.offsetHeight - st.offsetHeight }; };
  return { arrival: m('arrival'), atlas: m('atlas') };
});
// Roteiro (segundos): parada no topo → travessia (ida) → assentamento e os 4 mundos → parada → volta rápida ao topo
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const ease = (t) => 0.5 * t + 0.5 * easeIO(t);
const segs = [
  { dur: 1.2, from: 0, to: 0 },
  { dur: 9, from: 0, to: T.arrival.end, e: ease },
  { dur: 0.8, from: T.arrival.end, to: T.arrival.end },
  { dur: 14, from: T.atlas.start, to: T.atlas.end, e: (t) => t },
  { dur: 1.5, from: T.atlas.end, to: T.atlas.end },
  { dur: 4, from: T.atlas.end, to: 0, e: easeIO },
  { dur: 1, from: 0, to: 0 },
];
const plan = [];
for (const s of segs) { const n = Math.round(s.dur * FPS); for (let i = 0; i < n; i++) { const t = n > 1 ? i / (n - 1) : 1; plan.push(s.from + (s.to - s.from) * (s.e ? s.e(t) : t)); } }
const t0 = Date.now();
for (let i = 0; i < plan.length; i++) {
  await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), Math.round(plan[i]));
  // espera o amortecimento (lambda 12–14) chegar perto do alvo: 1/24 s de "tempo real" por quadro
  await page.waitForTimeout(i > 0 && Math.abs(plan[i] - plan[i - 1]) < 1 ? 30 : 110);
  await page.screenshot({ path: `${frames}/f_${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 90 });
  if (i % 48 === 0) console.log(`${i}/${plan.length} quadros — ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
writeFileSync(`${frames}/meta.json`, JSON.stringify({ fps: FPS, total: plan.length, tracks: T, errors }, null, 2));
await browser.close(); server.kill();
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', `${frames}/f_%05d.jpg`, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
console.log('ok', out, plan.length, 'quadros; erros de console:', errors.length);
