import { createTrack, type Track } from '../core/track';
import { createDamped } from '../core/raf';
import { currentMode, immediateMotion, isPortraitLayout, onMode, prefersReducedMotion, prefersSaveData } from '../core/capabilities';
import { clamp, coverRectMin, easeInOutSine, easeOutExpo, lerp, remap, smoothstep, type Box } from '../core/math';
import { SCENES } from '../config';
import { worlds, pad, type World } from '../content/worlds';
import { getLang, onLang, pick, t } from '../core/i18n';
import { angleOf, focusAt, nearestFocus, plateauCenter, plateauProgress, rhythm, setTrackOffset, settleRange, travelSvh } from './orbit';
import { apertureOf, boxAt, depthOf, stageLayout, type StageLayout } from './stageLayout';
import type { FinalFrame } from '../arrival/arrival';

const NS = 'http://www.w3.org/2000/svg', XL = 'http://www.w3.org/1999/xlink';

export interface Atlas {
  track: Track;
  /** retângulo da superfície em foco (para a cena expandir a partir dele) */
  frontRect(): DOMRect | null;
  goTo(i: number, smooth?: boolean): void;
  focused(): number;
  surfaceEl(i: number): HTMLElement;
  relayout(): void;
  /** saída para The Origin (0..1): as frestas somem, a curadoria recua para a esquerda, o sistema orbital se dissipa */
  setExit(e: number): void;
  /** posição (px do palco) do núcleo "Zadig de Bem" na órbita — de onde o capítulo seguinte o leva */
  corePoint(): { x: number; y: number; visible: boolean };
}

/**
 * Capítulo 02 — The Orbital Atlas.
 * O mundo em foco é uma CENA: ocupa o quadro principal com a navegação real do site em vídeo, a cor do
 * próprio site tinge o palco e o seu numeral monumental ocupa o fundo. Os outros mundos são FRESTAS nas
 * bordas da tela, na mesma escala (recortes estreitos de mundos vizinhos), não miniaturas. A órbita passa
 * por trás das frestas, maior que o quadro, com o trilho tipográfico dos quatro nomes.
 * Entre mundos: a fresta da direita abre até virar o quadro; o quadro fecha até virar a fresta de baixo.
 */
export function initAtlas(onEnter: (w: World, origin: HTMLElement) => void, getFrame: () => FinalFrame | null): Atlas {
  const track = createTrack('atlas', { tail: 2 }); // dois palcos de cauda: The Origin se sobrepõe e coreografa a saída
  track.el.style.setProperty('--atlas-travel', String(travelSvh())); // altura do trilho = trajeto + palco + cauda
  track.el.dataset.plateaus = JSON.stringify([0, 1, 2, 3].map((i) => plateauCenter(i)));
  const stage = track.stage;
  const svg = document.getElementById('orbit') as unknown as SVGSVGElement;
  const surfacesEl = document.getElementById('surfaces')!;
  const column = document.getElementById('column')!;
  const indexEl = document.getElementById('index')!;
  const numeral = document.getElementById('numeral')!;
  const numSpans = numeral.querySelectorAll('span');
  const enterBtn = document.getElementById('enter') as HTMLButtonElement;
  const visit = document.getElementById('visit') as HTMLAnchorElement;
  const colIndex = document.getElementById('column-index')!;
  const colTitle = document.getElementById('atlas-title')!;
  const colCat = document.getElementById('column-cat')!;
  const colThesis = document.getElementById('column-thesis')!;

  // ----- superfícies: poster + vídeo (o vídeo só carrega e toca no mundo em foco) -----
  const surfaces = worlds.map((w) => {
    const a = document.createElement('a');
    a.className = 'surface';
    if (SCENES) a.href = `#mundo-${w.id}`; else { a.href = w.url; a.target = '_blank'; a.rel = 'noreferrer'; }
    a.dataset.world = w.id;
    a.style.setProperty('--tint', w.tint);
    a.innerHTML = `<span class="surface-media"><img alt="" loading="eager" decoding="async"><video muted loop playsinline preload="none" aria-hidden="true"></video></span>` +
      `<span class="surface-visit"><b></b><i aria-hidden="true">↗</i></span><span class="surface-edge"><b>${pad(w.index)}</b></span>`;
    a.setAttribute('aria-label', `${pad(w.index)} · ${w.name}`);
    surfacesEl.appendChild(a);
    return a;
  });
  const imgs = surfaces.map((s) => s.querySelector('img')!);
  const visitTags = surfaces.map((s) => s.querySelector<HTMLElement>('.surface-visit b')!);
  const labelSurfaces = () => { for (let i = 0; i < worlds.length; i++) { const w = worlds[i]!; visitTags[i]!.textContent = SCENES ? t('atlasEnter') : t('atlasOpen'); surfaces[i]!.setAttribute('aria-label', SCENES ? `${pad(w.index)} · ${w.name}` : `${pad(w.index)} · ${w.name} — ${t('atlasOpen')} (${t('atlasOpenHint')})`); } };
  labelSurfaces();
  enterBtn.hidden = !SCENES;
  const videos = surfaces.map((s) => s.querySelector('video')!);

  // ----- herdado da travessia: só o retângulo da janela (nenhuma tipografia entra no Atlas) -----
  let frame: FinalFrame | null = null;

  // ----- órbita: linha, trilho tipográfico, núcleo -----
  const defs = document.createElementNS(NS, 'defs'); svg.appendChild(defs);
  const rail = document.createElementNS(NS, 'path'); rail.setAttribute('id', 'rail'); rail.setAttribute('fill', 'none'); defs.appendChild(rail);
  const line = document.createElementNS(NS, 'path'); line.setAttribute('class', 'orbit-line'); svg.appendChild(line);
  const railText = document.createElementNS(NS, 'text'); railText.setAttribute('class', 'orbit-rail'); railText.setAttribute('dy', '-7');
  const tp = document.createElementNS(NS, 'textPath'); tp.setAttributeNS(XL, 'href', '#rail'); tp.setAttribute('startOffset', '0%'); railText.appendChild(tp); svg.appendChild(railText);
  const coreDot = document.createElementNS(NS, 'circle'); coreDot.setAttribute('class', 'orbit-core-dot'); coreDot.setAttribute('r', '3'); svg.appendChild(coreDot);
  const core = document.createElementNS(NS, 'text'); core.setAttribute('class', 'orbit-core'); core.textContent = 'Zadig de Bem'; svg.appendChild(core);

  // ----- índice -----
  const idxBtns = worlds.map((w, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'index-btn'; b.innerHTML = `<b>${pad(w.index)}</b><span>${w.name}</span>`;
    b.setAttribute('aria-label', `${pad(w.index)} · ${w.name}`);
    b.addEventListener('click', () => goTo(i));
    indexEl.appendChild(b); return b;
  });
  const keys = document.createElement('span'); keys.className = 'index-keys meta'; keys.textContent = t('atlasKeys'); indexEl.appendChild(keys);

  let W = 0, H = 0, portrait = false;
  let L: StageLayout = stageLayout(1, 1, false);
  let railLen = 1;

  function buildFrame() { frame = getFrame(); }

  const mediaOf = (w: World) => (portrait ? w.media.mobile : w.media.desktop);

  function layout() {
    W = stage.clientWidth; H = stage.clientHeight; portrait = isPortraitLayout();
    L = stageLayout(W, H, portrait);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    for (let i = 0; i < worlds.length; i++) {
      const m = mediaOf(worlds[i]!);
      if (imgs[i]!.getAttribute('src') !== m.poster) { imgs[i]!.src = m.poster; imgs[i]!.decode().catch(() => {}); }
      if (videos[i]!.dataset.src !== m.video) { videos[i]!.dataset.src = m.video ?? ''; videos[i]!.replaceChildren(); videos[i]!.removeAttribute('src'); videos[i]!.dataset.loaded = ''; }
    }
    const o = L.orbit;
    const d = ellipse(o.cx, o.cy, o.rx, o.ry);
    rail.setAttribute('d', d); line.setAttribute('d', d);
    railLen = line.getTotalLength();
    line.style.strokeDasharray = `${railLen}`;
    const unit = worlds.map((w) => `${pad(w.index)}  ${w.name}`).join('   ·   ') + '   ·   ';
    tp.textContent = unit.repeat(4);
    placeCore();
    numeral.style.fontSize = `${Math.round(portrait ? H * 0.36 : H * 0.72)}px`;
    if (L.column) { column.style.setProperty('--col-x', `${L.column.x.toFixed(0)}px`); column.style.setProperty('--col-w', `${L.column.w.toFixed(0)}px`); }
    else { column.style.removeProperty('--col-x'); column.style.removeProperty('--col-w'); }
    buildFrame();
    lastKey = '';
    render(q.value, true);
  }
  /** Núcleo "Zadig de Bem" sobre a órbita, num ponto que não cruza a coluna de texto, o quadro, o cabeçalho nem a base. */
  function placeCore() {
    const o = L.orbit;
    const at = (deg: number): [number, number] => [o.cx + o.rx * Math.cos((deg * Math.PI) / 180), o.cy + o.ry * Math.sin((deg * Math.PI) / 180)];
    if (portrait) { const [kx, ky] = at(90); coreDot.setAttribute('cx', String(kx)); coreDot.setAttribute('cy', String(ky)); core.setAttribute('x', String(kx)); core.setAttribute('y', String(ky + 18)); core.setAttribute('text-anchor', 'middle'); core.style.visibility = ''; return; }
    const len = core.getComputedTextLength() || 96;
    // altura da coluna no pior caso (o título mais longo), para o núcleo não mudar de lugar entre mundos
    const cur = colTitle.textContent;
    const colH = Math.max(...worlds.map((w) => { colTitle.textContent = w.name; return column.offsetHeight; }));
    colTitle.textContent = cur;
    const colTop = column.offsetTop - colH / 2; // `translate: 0 -50%`
    const obstacles: Box[] = [L.front, ...(L.column ? [{ x: L.column.x, y: colTop, w: L.column.w, h: colH }] : []), { x: 0, y: 0, w: W, h: 72 + 40 }, { x: 0, y: H - 56, w: W, h: 56 }];
    // distância (px) entre duas caixas; negativa quando se cruzam
    const gap = (a: Box, b: Box) => Math.max(Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)), Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h)));
    let best: { kx: number; ky: number; anchor: 'end' | 'start'; clear: number } | null = null;
    // varre a órbita (lado esquerdo e inferior, longe das frestas) e escolhe o ponto com mais folga
    for (let deg = 100; deg <= 262; deg += 3) {
      const [kx, ky] = at(deg);
      for (const anchor of ['end', 'start'] as const) {
        const label: Box = anchor === 'end' ? { x: kx - 12 - len, y: ky - 7, w: len + 16, h: 14 } : { x: kx - 4, y: ky - 7, w: len + 16, h: 14 };
        if (label.x < 8 || label.x + label.w > W - 8) continue;
        const clear = Math.min(...obstacles.map((o) => gap(label, o)));
        if (!best || clear > best.clear) best = { kx, ky, anchor, clear };
      }
    }
    const ok = best && best.clear >= 6;
    const [dx, dy] = ok ? [best!.kx, best!.ky] : at(200);
    coreDot.setAttribute('cx', String(dx)); coreDot.setAttribute('cy', String(dy));
    core.style.visibility = ok ? '' : 'hidden';
    if (ok) { core.setAttribute('x', String(best!.kx + (best!.anchor === 'end' ? -12 : 12))); core.setAttribute('y', String(best!.ky + 4)); core.setAttribute('text-anchor', best!.anchor); }
  }
  const ellipse = (cx: number, cy: number, rx: number, ry: number) => { let d = ''; for (let i = 0; i <= 144; i++) { const a = (i / 144) * Math.PI * 2; d += `${i ? 'L' : 'M'}${(cx + rx * Math.cos(a)).toFixed(1)} ${(cy + ry * Math.sin(a)).toFixed(1)}`; } return d + 'Z'; };

  // ----- vídeo do mundo em foco -----
  let playing = -1;
  function syncVideo(front: number) {
    const allow = currentMode() === 'motion' && !prefersReducedMotion() && !prefersSaveData();
    if (!allow) front = -1;
    if (front === playing) return;
    if (playing >= 0) { videos[playing]!.pause(); surfaces[playing]!.dataset.video = 'false'; }
    playing = front;
    if (front < 0) return;
    const v = videos[front]!, m = mediaOf(worlds[front]!);
    if (!m.video) return;
    if (v.dataset.loaded !== '1') {
      v.replaceChildren();
      for (const [src, type] of [[m.video.replace(/\.mp4$/, '.webm'), 'video/webm'], [m.video, 'video/mp4']] as const) { const so = document.createElement('source'); so.src = src; so.type = type; v.appendChild(so); }
      v.load(); v.dataset.loaded = '1';
    }
    v.play().then(() => { surfaces[front]!.dataset.video = 'true'; }).catch(() => { surfaces[front]!.dataset.video = 'false'; });
  }

  // ----- progresso amortecido -----
  const q = createDamped(0, 12, immediateMotion);
  track.onProgress((p) => q.set(p));
  // antes do início do trilho o palco fica invisível (o Arrival está por baixo); esse estado depende do scrollY,
  // não só do progresso amortecido, então entra na chave de renderização e é reavaliado a cada rolagem
  window.addEventListener('scroll', () => { render(q.value); }, { passive: true });
  let lastKey = '';
  let currentFocus = -1;
  let exit = 0;

  function placeMedia(i: number, box: Box, focal: [number, number]) {
    const m = mediaOf(worlds[i]!);
    const r = coverRectMin(m.w, m.h, { x: 0, y: 0, w: box.w, h: box.h }, focal, L.imageW);
    const css = `left:${r.x.toFixed(1)}px;top:${r.y.toFixed(1)}px;width:${r.w.toFixed(1)}px;height:${r.h.toFixed(1)}px;`;
    imgs[i]!.style.cssText = css; videos[i]!.style.cssText = css;
  }

  function render(p: number, force = false) {
    const motion = currentMode() === 'motion';
    const before = window.scrollY < track.start - 0.5 && motion;
    const key = p.toFixed(4) + (before ? 'b' : '') + exit.toFixed(3);
    if (!force && key === lastKey) return;
    lastKey = key;
    const [s0, s1] = settleRange();
    const rev = smoothstep(s0, s1, p); // revelação do sistema, 0..1
    const rv = easeInOutSine(remap(rev, 0.12, 1)); // a janela recua até o quadro; os outros emergem
    const f = focusAt(p);
    const near = Math.round(f);
    stage.style.opacity = before ? '0' : '1';
    stage.style.pointerEvents = before ? 'none' : '';

    const win = frame ? frame.window : L.front;
    let frontBox: Box = L.front;
    // saída para The Origin: as frestas somem primeiro; a curadoria recua para a esquerda na MESMA escala até o quadro
    // virar um vislumbre na borda (a linguagem das frestas), que depois se apaga; o sistema orbital se dissipa
    const slide = easeInOutSine(remap(exit, 0.04, 0.34));
    const shift = -(L.front.x + L.front.w * 0.72) * slide;
    const dissolve = 1 - smoothstep(0.08, 0.36, exit);
    for (let i = 0; i < worlds.length; i++) {
      const s = surfaces[i]!;
      const off = angleOf({ cx: 0, cy: 0, rx: 1, ry: 1, tilt: 0, front: 0 }, i, f); // deslocamento angular (0 = frente)
      let box = boxAt(L, off);
      const d = depthOf(off), ap = apertureOf(off);
      const m = mediaOf(worlds[i]!);
      let focal: [number, number] = [lerp(m.detail[0], m.focal[0], ap), lerp(m.detail[1], m.focal[1], ap)];
      let op = smoothstep(0.06, 0.4, d), radius = ap > 0.98 ? 6 : lerp(2, 6, ap);
      if (motion && rev < 1) {
        if (i === 0) {
          // a janela do D recua até o quadro principal (recorte contínuo)
          box = { x: lerp(win.x, box.x, rv), y: lerp(win.y, box.y, rv), w: lerp(win.w, box.w, rv), h: lerp(win.h, box.h, rv) };
          radius = 6 * rv; frontBox = box;
          s.style.setProperty('--sh', rv.toFixed(3)); // sombra e fio da superfície entram com o recuo (costura exata com o Arrival)
        } else {
          // os outros emergem de trás da janela até as frestas, um a um
          const e = easeOutExpo(remap(rv, 0.1 + 0.09 * (i - 1), 0.78 + 0.05 * (i - 1)));
          const c: Box = { x: frontBox.x + frontBox.w * 0.4, y: frontBox.y + frontBox.h * 0.3, w: frontBox.w * 0.2, h: frontBox.h * 0.4 };
          box = { x: lerp(c.x, box.x, e), y: lerp(c.y, box.y, e), w: lerp(c.w, box.w, e), h: lerp(c.h, box.h, e) };
          op *= e;
        }
      }
      if (exit > 0) op *= i === near ? 1 - smoothstep(0.3, 0.42, exit) : 1 - smoothstep(0, 0.12, exit);
      s.style.transform = `translate(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px)`;
      s.style.width = `${box.w.toFixed(1)}px`; s.style.height = `${box.h.toFixed(1)}px`;
      s.style.borderRadius = `${radius.toFixed(1)}px`;
      s.style.opacity = op.toFixed(3);
      s.style.pointerEvents = op < 0.05 ? 'none' : '';
      s.style.zIndex = String(10 + Math.round(d * 10) + (i === 0 && rev < 1 ? 5 : 0));
      s.style.setProperty('--depth', d.toFixed(3));
      s.style.setProperty('--ap', ap.toFixed(3));
      s.style.filter = ap > 0.98 ? 'none' : `brightness(${lerp(0.5, 1, ap).toFixed(3)}) saturate(${lerp(0.75, 1, ap).toFixed(3)})`;
      s.dataset.front = String(Math.abs(i - f) < 0.5);
      s.dataset.strip = String(ap < 0.35);
      s.tabIndex = Math.abs(i - f) < 0.5 && exit < 0.4 ? 0 : -1;
      placeMedia(i, box, focal);
    }
    surfacesEl.style.transform = shift ? `translateX(${shift.toFixed(1)}px)` : '';
    syncVideo(rev >= 0.6 && Math.abs(f - near) < 0.3 && exit < 0.3 ? near : -1);

    // a luz do mundo tinge o palco à medida que o sistema se revela (no instante da costura o fundo é o mesmo do Arrival)
    stage.style.setProperty('--tint-on', (smoothstep(0.02, 0.4, rev) * (1 - smoothstep(0.06, 0.4, exit))).toFixed(3));

    // órbita, núcleo, numeral, coluna
    const sys = smoothstep(0.18, 0.95, rev) * dissolve;
    line.style.strokeDashoffset = `${railLen * (1 - sys)}`;
    tp.setAttribute('startOffset', `${((f * 25 + 62) % 100).toFixed(2)}%`);
    const late = smoothstep(0.5, 0.95, rev);
    railText.style.opacity = (late * (1 - smoothstep(0.04, 0.2, exit))).toFixed(3);
    // o núcleo permanece: o rótulo se apaga, o ponto passa a ser desenhado pelo capítulo seguinte (mesmas coordenadas)
    core.style.opacity = (late * (1 - smoothstep(0.1, 0.22, exit))).toFixed(3); coreDot.style.opacity = exit > 0.001 ? '0' : late.toFixed(3);
    // a coluna recua JUNTO com o quadro (mesma escala, mesmo deslocamento) e só se apaga ao sair da tela
    column.style.opacity = (late * (1 - smoothstep(0.16, 0.32, exit))).toFixed(3);
    column.style.transform = `translate(${shift.toFixed(1)}px, ${((1 - late) * 24).toFixed(1)}px)`;
    // dentro do platô a mídia em foco deriva alguns px com a rolagem (resposta contínua ao gesto; a composição não muda)
    const drift = rhythm().drift ? Math.round((plateauProgress(p, near) - 0.5) * -rhythm().drift) : 0; // px inteiros: nítido em repouso
    stage.style.setProperty('--drift', `${drift}px`);
    const tr = Math.abs(f - near); // 0 no platô, 0.5 no meio da transição
    const cut = 1 - smoothstep(0.16, 0.5, tr);
    column.style.setProperty('--cut', cut.toFixed(3));
    numeral.style.opacity = (late * 0.9 * (1 - smoothstep(0.12, 0.34, exit))).toFixed(3);
    numeral.style.setProperty('--cut', cut.toFixed(3));
    numeral.style.transform = `translateX(${(-(f - near) * 40 + shift * 0.35).toFixed(1)}px)`;
    if (near !== currentFocus) { currentFocus = near; fillColumn(worlds[near]!); }
    indexEl.style.opacity = (late * (1 - smoothstep(0.02, 0.14, exit))).toFixed(3);
  }
  q.subscribe((v) => render(v));

  function fillColumn(w: World) {
    colIndex.textContent = `${pad(w.index)} / ${pad(worlds.length)}`;
    colTitle.textContent = w.name;
    colCat.textContent = pick(w.category);
    colThesis.textContent = pick(w.thesis);
    visit.href = w.url;
    stage.style.setProperty('--tint', w.tint);
    numSpans[0]!.textContent = pad(w.index);
    numSpans[1]!.textContent = w.name;
    idxBtns.forEach((b, i) => b.setAttribute('aria-current', String(i === w.index - 1)));
    surfaces.forEach((s, i) => s.setAttribute('aria-current', String(i === w.index - 1)));
  }
  onLang(() => { if (currentFocus >= 0) fillColumn(worlds[currentFocus]!); keys.textContent = t('atlasKeys'); labelSurfaces(); if (W) placeCore(); });

  // ----- navegação direta: rolagem NATIVA até o platô do mundo -----
  function goTo(i: number, smooth = true) {
    const idx = clamp(i, 0, worlds.length - 1);
    if (currentMode() === 'static') { surfaces[idx]!.focus(); return; }
    const y = track.scrollYFor(plateauCenter(idx));
    window.scrollTo({ top: y, behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' });
  }
  const focused = () => (currentMode() === 'static' ? Math.max(0, currentFocus) : nearestFocus(track.p));

  surfaces.forEach((s, i) => {
    s.addEventListener('click', (e) => {
      const isFront = focused() === i || currentMode() === 'static';
      if (isFront && !SCENES) return; // link real: abre o site em nova aba (comportamento nativo, teclado incluído)
      e.preventDefault();
      if (isFront) onEnter(worlds[i]!, s); else goTo(i);
    });
  });
  enterBtn.addEventListener('click', () => onEnter(worlds[focused()]!, surfaces[focused()]!));
  document.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement)?.closest('input, textarea, [role="dialog"]')) return;
    const inAtlas = window.scrollY >= track.start - H * 0.5 && window.scrollY <= track.end; // depois do fim, The Origin: rolagem nativa
    if (!inAtlas) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goTo(focused() + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goTo(focused() - 1); }
    else if (/^[1-4]$/.test(e.key)) { e.preventDefault(); goTo(Number(e.key) - 1); }
  });

  // paralaxe sutil de ponteiro (só ponteiro fino, só em movimento)
  if (matchMedia('(pointer: fine)').matches) {
    let raf = 0;
    stage.addEventListener('pointermove', (e) => {
      if (currentMode() === 'static' || raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const mx = (e.clientX / W - 0.5) * 2, my = (e.clientY / H - 0.5) * 2;
        stage.style.setProperty('--mx', mx.toFixed(3)); stage.style.setProperty('--my', my.toFixed(3));
      });
    });
  }
  // pausa o vídeo quando o palco sai de cena (economia)
  const io = new IntersectionObserver((en) => { for (const e of en) if (!e.isIntersecting) syncVideo(-1); else { lastKey = ''; render(q.value, true); } }, { threshold: 0.05 });
  io.observe(stage);

  let raf = 0;
  const relayout = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { track.measure(); layout(); }); };
  window.addEventListener('resize', relayout);
  onMode((m) => { if (m === 'static') { q.jump(1); currentFocus = -1; fillColumn(worlds[0]!); syncVideo(-1); } relayout(); });
  track.measure();
  setTrackOffset(0);
  layout();
  fillColumn(worlds[0]!);
  document.documentElement.lang = getLang() === 'pt' ? 'pt-BR' : 'en';

  function setExit(e: number) { const v = clamp(e); if (v === exit) return; exit = v; lastKey = ''; render(q.value, true); }
  const corePoint = () => ({ x: +coreDot.getAttribute('cx')!, y: +coreDot.getAttribute('cy')!, visible: !portrait && core.style.visibility !== 'hidden' });
  return { track, goTo, focused, surfaceEl: (i) => surfaces[i]!, relayout, frontRect: () => surfaces[focused()]?.getBoundingClientRect() ?? null, setExit, corePoint };
}
