// Verificação automatizada da PoC Orbital (Playwright + Chromium local). Pré-requisito: `npm run build`.
// Cobre os viewports de referência E os de MacBook com a barra do navegador (pouca altura útil), retrato,
// PT/EN, movimento reduzido e a flag de cenas. A suíte passar é condição necessária, não suficiente:
// a revisão visual dos quadros (scripts/shots.mjs, scripts/capture-video.mjs) continua obrigatória.
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
  { name: 'desktop-1440x900', width: 1440, height: 900, dpr: 1, mobile: false, shots: true },
  { name: 'mac-1440x692', width: 1440, height: 692, dpr: 2, mobile: false, shots: true },
  { name: 'mac-1512x727', width: 1512, height: 727, dpr: 2, mobile: false },
  { name: 'mac-zoom110-1309x629', width: 1309, height: 629, dpr: 2, mobile: false },
  { name: 'wide-1728x870', width: 1728, height: 870, dpr: 1, mobile: false },
  { name: 'laptop-1280x720', width: 1280, height: 720, dpr: 1, mobile: false },
  { name: 'phone-390x844', width: 390, height: 844, dpr: 2, mobile: true, shots: true },
  { name: 'tablet-768x1024', width: 768, height: 1024, dpr: 2, mobile: true },
  { name: 'phone-360x740', width: 360, height: 740, dpr: 2, mobile: true },
];
const HEADER = 72;
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
/** posição da janela do D no quadro (frações 0..1), letras no quadro */
const frameState = (page) => page.evaluate(() => {
  const svg = document.getElementById('name'); const vb = svg.viewBox.baseVal; const c = document.getElementById('c-rect');
  const cx = c.x.baseVal.value + c.width.baseVal.value / 2, cy = c.y.baseVal.value + c.height.baseVal.value / 2;
  const letters = [];
  for (const t of document.querySelectorAll('#name-text text')) for (let i = 0; i < t.getNumberOfChars(); i++) { const e = t.getExtentOfChar(i); if (t.textContent[i] !== ' ' && e.x < vb.x + vb.width && e.x + e.width > vb.x && e.y < vb.y + vb.height && e.y + e.height > vb.y) letters.push(t.textContent[i]); }
  return { p: +svg.dataset.p, z: +svg.dataset.z, fx: (cx - vb.x) / vb.width, fy: (cy - vb.y) / vb.height, left: (c.x.baseVal.value - vb.x) / vb.width, right: (c.x.baseVal.value + c.width.baseVal.value - vb.x) / vb.width, top: (c.y.baseVal.value - vb.y) / vb.height, bottom: (c.y.baseVal.value + c.height.baseVal.value - vb.y) / vb.height, letters: letters.join('') };
});

for (const V of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: V.width, height: V.height }, deviceScaleFactor: V.dpr, isMobile: V.mobile, hasTouch: V.mobile, locale: 'pt-BR' });
  const page = await ctx.newPage(); watch(page, V.name);
  await page.goto(BASE, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500);
  const T = await tracks(page);
  const portrait = V.width < 721;

  // 1) nome: enche a medida (largura) e cabe na faixa útil (altura), sem nada por cima
  const name = await page.evaluate((HEADER) => {
    const texts = [...document.querySelectorAll('#name-text text')].map((t) => { const n = t.getNumberOfChars(); const e0 = t.getExtentOfChar(0), e1 = t.getExtentOfChar(n - 1); const ls = parseFloat(t.style.letterSpacing || '0'); return { w: t.getComputedTextLength() - ls, stretch: t.style.fontStretch, ls: ls.toFixed(1), text: t.textContent, inkRight: e1.x + e1.width - ls, y: +t.getAttribute('y'), size: parseFloat(t.style.fontSize) }; });
    const c = document.createElement('canvas').getContext('2d'); c.font = '800 100px Archivo'; const cap = c.measureText('H').actualBoundingBoxAscent / 100;
    const inkTop = texts[0].y - cap * texts[0].size, inkBottom = texts[texts.length - 1].y;
    const hint = document.querySelector('.arrival-hint').getBoundingClientRect();
    const svg = document.getElementById('name');
    return { texts, inkTop, inkBottom, H: innerHeight, W: innerWidth, hint: { x: hint.x, y: hint.y, r: hint.right, b: hint.bottom }, limit: svg.dataset.limit, size: +svg.dataset.size, leftovers: ['.statement', '.cartela', '#arrival-cta', '#mode-toggle'].filter((s) => document.querySelector(s)).join(','), header: HEADER };
  }, HEADER);
  const gutter = portrait ? 20 : Math.max(32, V.width * 0.034);
  const avail = (V.width - gutter * 2) * (portrait ? 1 : 0.94);
  check(`${V.name} · nome enche a medida pelo eixo de largura`, name.texts.every((t) => t.w <= avail + 2) && Math.max(...name.texts.map((t) => t.w)) >= avail * 0.98, name.texts.map((t) => `${t.text}:${Math.round(t.w)}/${Math.round(avail)}@${t.stretch}${+t.ls ? `+${t.ls}px` : ''}`).join(' '));
  const tall = V.height > V.width;
  check(`${V.name} · ${tall ? 'três' : 'duas'} linhas (${tall ? 'tela em pé' : 'paisagem'})`, name.texts.length === (tall ? 3 : 2));
  const inkH = name.inkBottom - name.inkTop;
  check(`${V.name} · nome dentro da faixa útil (abaixo do cabeçalho, acima da margem) e monumental`, name.inkTop >= HEADER - 1 && name.inkBottom <= V.height - 36 && inkH >= V.height * (portrait ? 0.28 : tall ? 0.45 : 0.55), `tinta ${Math.round(name.inkTop)}→${Math.round(name.inkBottom)} de ${V.height} (${Math.round((inkH / V.height) * 100)} %) · corpo ${name.size}px limitado por ${name.limit}`);
  const hintOverName = !portrait && name.hint.x < gutter + Math.max(...name.texts.map((t) => t.inkRight)) && name.hint.b > name.inkTop && name.hint.y < name.inkBottom;
  check(`${V.name} · nada sobre o nome (sem frase, botão, cartela ou botão de modo; indicação de rolagem fora da medida)`, !hintOverName && name.leftovers === '', name.leftovers || `hint x=${Math.round(name.hint.x)} medida até ${Math.round(gutter + Math.max(...name.texts.map((t) => t.inkRight)))}`);

  // 2) progressão contínua e reversível
  await go(page, T.arrival.end * 0.5); const a = await nameState(page);
  await go(page, T.arrival.end * 0.9); const b = await nameState(page);
  await go(page, T.arrival.end * 0.5); const c = await nameState(page);
  check(`${V.name} · travessia reage ao scroll`, a.z < b.z && b.z > 0.5, `z(0.5)=${a.z} z(0.9)=${b.z}`);
  check(`${V.name} · reversível (mesmo quadro ao voltar)`, a.vb === c.vb, `${a.vb} ≡ ${c.vb}`);

  // 3) trajetória: a janela do D fica SEMPRE no quadro e caminha monotonicamente para o centro; no fim, só o D
  const samples = [];
  for (let k = 0; k <= 14; k++) { const p = 0.44 + (k / 14) * 0.56; await go(page, T.arrival.start + p * (T.arrival.end - T.arrival.start), 650); samples.push(await frameState(page)); }
  const inside = samples.every((s) => s.left >= -0.002 && s.right <= 1.002 && s.top >= -0.002 && s.bottom <= 1.002);
  const dist = samples.map((s) => Math.hypot(s.fx - 0.5, s.fy - 0.5));
  const monotone = dist.every((d, i) => i === 0 || d <= dist[i - 1] + 1e-3);
  const end = samples[samples.length - 1];
  check(`${V.name} · janela do D sempre no quadro durante a travessia`, inside, samples.map((s) => `${s.fx.toFixed(2)},${s.fy.toFixed(2)}`).join(' '));
  check(`${V.name} · câmera caminha monotonicamente para a contraforma (sem desvio por outras letras)`, monotone, dist.map((d) => d.toFixed(2)).join(' '));
  check(`${V.name} · quadro final centrado, só com o D (borda no quadro)`, Math.abs(end.fx - 0.5) < 0.005 && Math.abs(end.fy - 0.5) < 0.005 && end.letters === 'D' && end.right - end.left < 0.9, `fx=${end.fx.toFixed(3)} fy=${end.fy.toFixed(3)} letras=${end.letters} janela=${((end.right - end.left) * 100).toFixed(0)} % da largura`);

  // 4) costura: quadro final da travessia == primeiro do atlas (pixel a pixel)
  await go(page, T.arrival.end, 1000); const s1 = await page.screenshot();
  await go(page, T.arrival.end + 2, 1000); const s2 = await page.screenshot();
  writeFileSync('/tmp/_seam_a.png', s1); writeFileSync('/tmp/_seam_b.png', s2);
  let rmse = 1; try { execFileSync('compare', ['-metric', 'RMSE', '/tmp/_seam_a.png', '/tmp/_seam_b.png', 'null:']); rmse = 0; } catch (e) { const m = /\(([\d.e-]+)\)/.exec(String(e.stderr)); rmse = m ? Number(m[1]) : 1; }
  check(`${V.name} · corte invisível travessia → atlas`, rmse < 0.01, `RMSE ${rmse}`);
  if (V.shots) { writeFileSync(join(evidence, `${V.name}__seam-a.png`), s1); writeFileSync(join(evidence, `${V.name}__seam-b.png`), s2); }

  // 5) atlas: platôs levam cada mundo à frente; zonas seguras (coluna × frestas × quadro × núcleo)
  for (let i = 0; i < 4; i++) {
    const q = 0.17 + i * 0.245 + 0.08;
    await go(page, T.atlas.start + q * (T.atlas.end - T.atlas.start), 900);
    const st = await page.evaluate(() => {
      const bb = (el) => el.getBoundingClientRect();
      const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const front = document.querySelector('.surface[data-front="true"]');
      const col = bb(document.querySelector('.column')); const colVisible = getComputedStyle(document.querySelector('.column')).opacity !== '0';
      const core = bb(document.querySelector('.orbit-core'));
      const slivers = [...document.querySelectorAll('.surface')].filter((s) => s !== front && +s.style.opacity > 0.05).map((s) => ({ id: s.dataset.world, over: Math.round(inter(col, bb(s))) }));
      const idxBox = bb(document.getElementById('index'));
      return { colTop: Math.round(col.top), colBottom: Math.round(col.bottom), idxTop: Math.round(idxBox.top), front: front?.dataset.world, idx: [...document.querySelectorAll('.index-btn')].findIndex((b) => b.getAttribute('aria-current') === 'true'), title: document.getElementById('atlas-title').textContent, colVisible, colOverFront: front ? Math.round(inter(col, bb(front))) : -1, coreOver: Math.round(inter(core, col)) + (front ? Math.round(inter(core, bb(front))) : 0), slivers, frontTop: front ? Math.round(bb(front).top) : -1, href: front?.getAttribute('href'), target: front?.getAttribute('target') };
    });
    check(`${V.name} · mundo ${i + 1} à frente no seu platô`, st.idx === i && st.front, `front=${st.front} idx=${st.idx} título=${st.title}`);
    if (!portrait) check(`${V.name} · mundo ${i + 1}: coluna não cruza frestas, quadro, núcleo nem índice; tudo abaixo do cabeçalho`, st.colVisible && st.colOverFront === 0 && st.coreOver === 0 && st.slivers.every((s) => s.over === 0) && st.frontTop >= HEADER && st.colTop >= HEADER && st.colBottom <= st.idxTop - 4, JSON.stringify({ colOverFront: st.colOverFront, slivers: st.slivers, core: st.coreOver, frontTop: st.frontTop, col: [st.colTop, st.colBottom], idxTop: st.idxTop }));
    if (i === 0) check(`${V.name} · quadro em foco é o link do site real (nova aba)`, /^https?:\/\//.test(st.href || '') && st.target === '_blank', `${st.href} ${st.target}`);
    if (V.shots) await page.screenshot({ path: join(evidence, `${V.name}__atlas-${i + 1}.png`) });
  }

  // 6) teclado: setas giram; Enter no quadro em foco abre o site numa nova aba (link nativo)
  await go(page, T.atlas.start + 0.25 * (T.atlas.end - T.atlas.start), 900);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1500);
  const afterKey = await page.evaluate(() => [...document.querySelectorAll('.index-btn')].findIndex((b) => b.getAttribute('aria-current') === 'true'));
  check(`${V.name} · seta → leva ao mundo 02`, afterKey === 1, `idx=${afterKey}`);
  await page.focus('.surface[data-front="true"]');
  const popup = ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null);
  await page.keyboard.press('Enter');
  const np = await popup;
  const popupUrl = np ? np.url() : '';
  if (np) await np.close();
  check(`${V.name} · Enter no quadro em foco abre o site do mundo 02 em nova aba`, /jony/.test(popupUrl), popupUrl || 'nenhuma aba aberta');
  const enterHidden = await page.evaluate(() => getComputedStyle(document.getElementById('enter')).display === 'none' && document.getElementById('world').hidden);
  check(`${V.name} · sem etapa modal: "Entrar no mundo" oculto, diálogo fechado`, enterHidden);

  // 7) link direto por hash leva ao platô do mundo (histórico/retorno nativos)
  const p2 = await ctx.newPage(); watch(p2, V.name + ' hash');
  await p2.goto(BASE + '#mundo-rlg', { waitUntil: 'load' }); await p2.waitForTimeout(1400);
  const deep = await p2.evaluate(() => ({ front: document.querySelector('.surface[data-front="true"]')?.dataset.world, idx: [...document.querySelectorAll('.index-btn')].findIndex((b) => b.getAttribute('aria-current') === 'true'), dialog: document.getElementById('world').hidden }));
  check(`${V.name} · #mundo-rlg leva direto ao platô 03`, deep.front === 'rlg' && deep.idx === 2 && deep.dialog, JSON.stringify(deep));
  await p2.close();
  await ctx.close();
}

// 8) idiomas
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  const page = await ctx.newPage(); watch(page, 'en');
  await page.goto(BASE, { waitUntil: 'load' }); await page.waitForTimeout(400);
  check('EN · detecção por navegador', await page.evaluate(() => document.documentElement.lang === 'en' && document.querySelector('[data-i18n="arrivalHint"]').textContent === 'Scroll to cross' && document.getElementById('visit').textContent.includes('Visit site')));
  await page.click('[data-lang="pt"]'); await page.waitForTimeout(200);
  check('PT · troca persiste', await page.evaluate(() => document.documentElement.lang === 'pt-BR' && localStorage.getItem('zdb-orbital-lang') === 'pt'));
  check('barra de rolagem oculta, rolagem nativa preservada', await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth === 'none' && document.documentElement.scrollHeight > innerHeight * 5 && !document.getElementById('mode-toggle')));
  await ctx.close();
}

// 9) movimento reduzido → modo estático automático; conteúdo e navegação continuam
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'pt-BR' });
  const page = await ctx.newPage(); watch(page, 'reduced');
  await page.goto(BASE, { waitUntil: 'load' }); await page.waitForTimeout(600);
  const st = await page.evaluate(() => ({ mode: document.documentElement.dataset.mode, stageSticky: getComputedStyle(document.querySelector('#atlas .stage')).position, surfaces: document.querySelectorAll('.surface').length, links: [...document.querySelectorAll('.surface')].every((s) => /^https?:/.test(s.href)) }));
  check('reduced-motion · modo estático automático, palcos no fluxo, 4 superfícies-link', st.mode === 'static' && st.stageSticky === 'static' && st.surfaces === 4 && st.links, JSON.stringify(st));
  await page.screenshot({ path: join(evidence, 'desktop-1440x900__static-top.png') });
  await page.evaluate(() => document.getElementById('atlas').scrollIntoView()); await page.waitForTimeout(300);
  await page.screenshot({ path: join(evidence, 'desktop-1440x900__static-atlas.png') });
  await ctx.close();
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, reducedMotion: 'reduce', locale: 'pt-BR' });
  const pm = await ctx2.newPage(); watch(pm, 'reduced-mobile');
  await pm.goto(BASE, { waitUntil: 'load' }); await pm.waitForTimeout(600);
  await pm.screenshot({ path: join(evidence, 'phone-390x844__static-top.png') });
  await pm.evaluate(() => document.getElementById('atlas').scrollIntoView()); await pm.waitForTimeout(300);
  await pm.screenshot({ path: join(evidence, 'phone-390x844__static-atlas.png') });
  await ctx2.close();
  const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const pu = await ctx3.newPage(); watch(pu, 'mode=static');
  await pu.goto(BASE + '?mode=static', { waitUntil: 'load' }); await pu.waitForTimeout(400);
  check('?mode=static · modo estático por URL (sem botão no cabeçalho)', await pu.evaluate(() => document.documentElement.dataset.mode === 'static'));
  await ctx3.close();
}

// 10) flag de cenas (?scenes=1): o mecanismo da cena expandida continua íntegro para os case studies
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const page = await ctx.newPage(); watch(page, 'scenes');
  await page.goto(BASE + '?scenes=1', { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500);
  const T = await tracks(page);
  await go(page, T.atlas.start + 0.25 * (T.atlas.end - T.atlas.start), 900);
  check('scenes · "Entrar no mundo" visível e quadro em foco aponta para a cena', await page.evaluate(() => getComputedStyle(document.getElementById('enter')).display !== 'none' && /^#mundo-/.test(document.querySelector('.surface[data-front="true"]').getAttribute('href'))));
  await page.focus('#enter'); await page.keyboard.press('Enter'); await page.waitForTimeout(1300);
  const dlg = await page.evaluate(() => ({ open: !document.getElementById('world').hidden, inert: document.getElementById('main').hasAttribute('inert'), focusIn: document.getElementById('world').contains(document.activeElement), hash: location.hash }));
  check('scenes · Enter abre a cena (diálogo modal, foco dentro, hash)', dlg.open && dlg.inert && dlg.focusIn && /^#mundo-/.test(dlg.hash), JSON.stringify(dlg));
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  check('scenes · Esc fecha e devolve o foco', await page.evaluate(() => document.getElementById('world').hidden && !document.getElementById('main').hasAttribute('inert')));
  const p2 = await ctx.newPage(); watch(p2, 'scenes hash');
  await p2.goto(BASE + '?scenes=1#mundo-rlg', { waitUntil: 'load' }); await p2.waitForTimeout(1200);
  check('scenes · #mundo-rlg abre a cena direto', await p2.evaluate(() => !document.getElementById('world').hidden && document.getElementById('world-title').textContent === 'RLG Connect'));
  await p2.close(); await ctx.close();
}

check('console: nenhum erro/pageerror/requisição falha', issues.length === 0, issues.slice(0, 5).join(' | '));
await browser.close(); server.kill();
const ok = results.filter((r) => r.ok).length;
writeFileSync(join(evidence, 'report.json'), JSON.stringify({ when: new Date().toISOString(), ok, total: results.length, results, issues }, null, 2));
console.log(`\n${ok}/${results.length} verificações OK`);
process.exit(ok === results.length ? 0 : 1);
