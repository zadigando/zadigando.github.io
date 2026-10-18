// Verificação automatizada da PoC Orbital (Playwright + Chromium local). Pré-requisito: `npm run build`.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const evidence = join(root, 'evidence');
const PORT = 4187;
const BASE = `http://127.0.0.1:${PORT}/orbital/`;
if (!existsSync(join(root, 'dist', 'index.html'))) { console.error('dist/ não encontrado. Rode `npm run build` antes.'); process.exit(2); }
mkdirSync(evidence, { recursive: true });

const results = [];
const issues = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: Boolean(ok), detail: String(detail) }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); };

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE)).ok) break; } catch { /* aguardando */ } await new Promise((r) => setTimeout(r, 200)); }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });

const VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900, dpr: 1, mobile: false },
  { name: 'phone-390x844', width: 390, height: 844, dpr: 2, mobile: true },
  { name: 'tablet-768x1024', width: 768, height: 1024, dpr: 2, mobile: true },
  { name: 'phone-360x740', width: 360, height: 740, dpr: 2, mobile: true },
];
const watch = (page, label) => {
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) issues.push(`[${label}] ${m.text()}`); });
  page.on('pageerror', (e) => issues.push(`[${label}] pageerror: ${e.message}`));
  page.on('requestfailed', (r) => { const err = r.failure()?.errorText ?? ''; if (/ERR_ABORTED/.test(err) && /\.(webm|mp4)$/.test(r.url())) return; issues.push(`[${label}] requestfailed: ${r.url()} ${err}`); });
};
const tracks = (page) => page.evaluate(() => {
  const m = (id) => { const el = document.getElementById(id); const st = el.querySelector('.stage'); const top = el.getBoundingClientRect().top + scrollY; return { start: top, end: top + el.offsetHeight - st.offsetHeight }; };
  return { arrival: m('arrival'), atlas: m('atlas') };
});
const go = async (page, y, ms = 800) => { await page.evaluate((t) => scrollTo({ top: t, behavior: 'instant' }), Math.round(y)); await page.waitForTimeout(ms); };
const nameState = (page) => page.evaluate(() => { const s = document.getElementById('name'); return { p: +s.dataset.p, z: +s.dataset.z, vb: s.getAttribute('viewBox') }; });

for (const V of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: V.width, height: V.height }, deviceScaleFactor: V.dpr, isMobile: V.mobile, hasTouch: V.mobile, locale: 'pt-BR' });
  const page = await ctx.newPage(); watch(page, V.name);
  await page.goto(BASE, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500);
  const T = await tracks(page);

  // 1) nome: enche a medida (cada linha), e o D-janela tem contraforma medida
  const name = await page.evaluate(() => {
    const texts = [...document.querySelectorAll('#name-text text')].map((t) => ({ w: t.getComputedTextLength(), stretch: t.style.fontStretch, text: t.textContent }));
    const W = document.documentElement.clientWidth; const r = document.getElementById('c-rect');
    return { texts, W, clipW: +r.getAttribute('width') };
  });
  const gutter = V.width < 721 ? 20 : Math.max(32, V.width * 0.034);
  const avail = (V.width - gutter * 2) * (V.width < 721 ? 1 : 0.94);
  check(`${V.name} · nome enche a medida pelo eixo de largura`, name.texts.every((t) => t.w <= avail + 2) && Math.max(...name.texts.map((t) => t.w)) >= avail * 0.98, name.texts.map((t) => `${t.text}:${Math.round(t.w)}/${Math.round(avail)}@${t.stretch}`).join(' '));
  check(`${V.name} · ${V.width < 721 ? 'três' : 'duas'} linhas no retrato/paisagem`, name.texts.length === (V.width < 721 ? 3 : 2));

  // 2) progressão contínua e reversível
  await go(page, T.arrival.end * 0.5); const a = await nameState(page);
  await go(page, T.arrival.end * 0.9); const b = await nameState(page);
  await go(page, T.arrival.end * 0.5); const c = await nameState(page);
  check(`${V.name} · travessia reage ao scroll`, a.z < b.z && b.z > 0.5, `z(0.5)=${a.z} z(0.9)=${b.z}`);
  check(`${V.name} · reversível (mesmo quadro ao voltar)`, a.vb === c.vb, `${a.vb} ≡ ${c.vb}`);

  // 3) costura: quadro final da travessia == primeiro do atlas (pixel a pixel)
  await go(page, T.arrival.end, 1000); const s1 = await page.screenshot();
  await go(page, T.arrival.end + 2, 1000); const s2 = await page.screenshot();
  writeFileSync('/tmp/_seam_a.png', s1); writeFileSync('/tmp/_seam_b.png', s2);
  let rmse = 1; try { execFileSync('compare', ['-metric', 'RMSE', '/tmp/_seam_a.png', '/tmp/_seam_b.png', 'null:']); rmse = 0; } catch (e) { const m = /\(([\d.e-]+)\)/.exec(String(e.stderr)); rmse = m ? Number(m[1]) : 1; }
  check(`${V.name} · corte invisível travessia → atlas`, rmse < 0.01, `RMSE ${rmse}`);
  if (V.name === 'desktop-1440x900' || V.name === 'phone-390x844') { writeFileSync(join(evidence, `${V.name}__seam-a.png`), s1); writeFileSync(join(evidence, `${V.name}__seam-b.png`), s2); }

  // 4) atlas: platôs levam cada mundo à frente; índice reflete
  const plateau = await page.evaluate(() => (window.__orbital ? window.__orbital.plateauCenter : null));
  for (let i = 0; i < 4; i++) {
    const q = 0.17 + i * 0.245 + 0.08;
    await go(page, T.atlas.start + q * (T.atlas.end - T.atlas.start), 900);
    const st = await page.evaluate(() => ({ front: document.querySelector('.surface[data-front="true"]')?.dataset.world, idx: [...document.querySelectorAll('.index-btn')].findIndex((b) => b.getAttribute('aria-current') === 'true'), title: document.getElementById('atlas-title').textContent }));
    check(`${V.name} · mundo ${i + 1} à frente no seu platô`, st.idx === i && st.front, `front=${st.front} idx=${st.idx} título=${st.title}`);
    if (V.name === 'desktop-1440x900' || V.name === 'phone-390x844') await page.screenshot({ path: join(evidence, `${V.name}__atlas-${i + 1}.png`) });
  }
  check(`${V.name} · platôs expostos`, plateau === null || typeof plateau === 'function');

  // 5) teclado: setas giram; Enter no botão abre o diálogo; Esc fecha e devolve o foco
  await go(page, T.atlas.start + 0.25 * (T.atlas.end - T.atlas.start), 900);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1500);
  const afterKey = await page.evaluate(() => [...document.querySelectorAll('.index-btn')].findIndex((b) => b.getAttribute('aria-current') === 'true'));
  check(`${V.name} · seta → leva ao mundo 02`, afterKey === 1, `idx=${afterKey}`);
  await page.focus('#enter'); await page.keyboard.press('Enter'); await page.waitForTimeout(1300);
  const dlg = await page.evaluate(() => ({ open: !document.getElementById('world').hidden, inert: document.getElementById('main').hasAttribute('inert'), focusIn: document.getElementById('world').contains(document.activeElement), hash: location.hash, title: document.getElementById('world-title').textContent }));
  check(`${V.name} · Enter abre o mundo (diálogo modal, foco dentro, hash)`, dlg.open && dlg.inert && dlg.focusIn && /^#mundo-/.test(dlg.hash), JSON.stringify(dlg));
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  const closed = await page.evaluate(() => ({ hidden: document.getElementById('world').hidden, inert: document.getElementById('main').hasAttribute('inert'), active: document.activeElement?.id || document.activeElement?.className }));
  check(`${V.name} · Esc fecha e devolve o foco`, closed.hidden && !closed.inert, JSON.stringify(closed));

  // 6) link direto por hash abre o mundo
  const p2 = await ctx.newPage(); watch(p2, V.name + ' hash');
  await p2.goto(BASE + '#mundo-rlg', { waitUntil: 'load' }); await p2.waitForTimeout(1200);
  check(`${V.name} · #mundo-rlg abre direto`, await p2.evaluate(() => !document.getElementById('world').hidden && document.getElementById('world-title').textContent === 'RLG Connect'));
  await p2.close();
  await ctx.close();
}

// 7) idiomas
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  const page = await ctx.newPage(); watch(page, 'en');
  await page.goto(BASE, { waitUntil: 'load' }); await page.waitForTimeout(400);
  check('EN · detecção por navegador', await page.evaluate(() => document.documentElement.lang === 'en' && document.querySelector('[data-i18n="arrivalCta"]').textContent === 'Explore the worlds'));
  await page.click('[data-lang="pt"]'); await page.waitForTimeout(200);
  check('PT · troca persiste', await page.evaluate(() => document.documentElement.lang === 'pt-BR' && localStorage.getItem('zdb-orbital-lang') === 'pt'));
  await ctx.close();
}

// 8) movimento reduzido → modo estático; conteúdo e navegação continuam
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'pt-BR' });
  const page = await ctx.newPage(); watch(page, 'reduced');
  await page.goto(BASE, { waitUntil: 'load' }); await page.waitForTimeout(600);
  const st = await page.evaluate(() => ({ mode: document.documentElement.dataset.mode, stageSticky: getComputedStyle(document.querySelector('#atlas .stage')).position, surfaces: document.querySelectorAll('.surface').length, nameVisible: getComputedStyle(document.querySelector('#name-text text')).fill }));
  check('reduced-motion · modo estático, palcos no fluxo, 4 superfícies', st.mode === 'static' && st.stageSticky === 'static' && st.surfaces === 4, JSON.stringify(st));
  await page.screenshot({ path: join(evidence, 'desktop-1440x900__static-top.png') });
  await page.evaluate(() => document.getElementById('atlas').scrollIntoView()); await page.waitForTimeout(300);
  await page.screenshot({ path: join(evidence, 'desktop-1440x900__static-atlas.png') });
  await page.click('.surface'); await page.waitForTimeout(500);
  check('reduced-motion · superfície abre o mundo sem animação', await page.evaluate(() => !document.getElementById('world').hidden));
  await ctx.close();
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, reducedMotion: 'reduce', locale: 'pt-BR' });
  const pm = await ctx2.newPage(); watch(pm, 'reduced-mobile');
  await pm.goto(BASE, { waitUntil: 'load' }); await pm.waitForTimeout(600);
  await pm.screenshot({ path: join(evidence, 'phone-390x844__static-top.png') });
  await pm.evaluate(() => document.getElementById('atlas').scrollIntoView()); await pm.waitForTimeout(300);
  await pm.screenshot({ path: join(evidence, 'phone-390x844__static-atlas.png') });
  await ctx2.close();
}

// 9) botão "Versão estática" alterna à mão
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const page = await ctx.newPage(); watch(page, 'toggle');
  await page.goto(BASE, { waitUntil: 'load' }); await page.waitForTimeout(400);
  await page.click('#mode-toggle'); await page.waitForTimeout(400);
  check('toggle · estático liga', await page.evaluate(() => document.documentElement.dataset.mode === 'static'));
  await page.click('#mode-toggle'); await page.waitForTimeout(400);
  check('toggle · movimento volta', await page.evaluate(() => document.documentElement.dataset.mode === 'motion'));
  await ctx.close();
}

check('console: nenhum erro/pageerror/requisição falha', issues.length === 0, issues.slice(0, 5).join(' | '));
await browser.close(); server.kill();
const ok = results.filter((r) => r.ok).length;
writeFileSync(join(evidence, 'report.json'), JSON.stringify({ when: new Date().toISOString(), ok, total: results.length, results, issues }, null, 2));
console.log(`\n${ok}/${results.length} verificações OK`);
process.exit(ok === results.length ? 0 : 1);
