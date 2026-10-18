import { createTrack, type Track } from '../core/track';
import { createDamped } from '../core/raf';
import { currentMode, immediateMotion, isPortraitLayout, onMode, prefersReducedMotion, prefersSaveData } from '../core/capabilities';
import { clamp, coverRectMin, easeOutExpo, lerp, remap, smoothstep, type Box } from '../core/math';
import { worlds, pad, type World } from '../content/worlds';
import { getLang, onLang, pick, t } from '../core/i18n';
import { angleOf, focusAt, nearestFocus, plateauCenter, setTrackOffset, settleRange } from './orbit';
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
  const track = createTrack('atlas');
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
    a.href = `#mundo-${w.id}`;
    a.dataset.world = w.id;
    a.style.setProperty('--tint', w.tint);
    a.innerHTML = `<span class="surface-media"><img alt="" loading="eager" decoding="async"><video muted loop playsinline preload="none" aria-hidden="true"></video></span>` +
      `<span class="surface-tag"><b>${pad(w.index)}</b><span>${w.name}</span></span><span class="surface-edge"><b>${pad(w.index)}</b></span>`;
    a.setAttribute('aria-label', `${pad(w.index)} · ${w.name}`);
    surfacesEl.appendChild(a);
    return a;
  });
  const imgs = surfaces.map((s) => s.querySelector('img')!);
  const videos = surfaces.map((s) => s.querySelector('video')!);

  // ----- quadro herdado da travessia (a borda do D), por cima das superfícies -----
  const frameSvg = document.createElementNS(NS, 'svg');
  frameSvg.setAttribute('class', 'frame'); frameSvg.setAttribute('aria-hidden', 'true');
  stage.insertBefore(frameSvg, column);
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

  function buildFrame() {
    frame = getFrame();
    frameSvg.replaceChildren();
    if (!frame) return;
    const { viewBox: vb, hole } = frame;
    frameSvg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    frameSvg.innerHTML = `<defs><mask id="af-hole"><rect x="${vb.x - vb.w}" y="${vb.y - vb.h}" width="${vb.w * 3}" height="${vb.h * 3}" fill="#fff"/><rect x="${hole.x}" y="${hole.y}" width="${hole.w}" height="${hole.h}" fill="#000"/></mask></defs>` +
      `<g id="af-back" mask="url(#af-hole)">${frame.svgInner.replace(/<g id="af-name-text">[\s\S]*<\/g>\s*$/, '')}</g>` +
      (frame.svgInner.match(/<g id="af-name-text">[\s\S]*<\/g>\s*$/)?.[0] ?? '');
  }

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
    // núcleo: no ponto da órbita à esquerda-baixo do quadro (fora do cartão), ou acima da coluna no retrato
    const ca = portrait ? 90 : 200;
    const [kx, ky] = [o.cx + o.rx * Math.cos((ca * Math.PI) / 180), o.cy + o.ry * Math.sin((ca * Math.PI) / 180)];
    coreDot.setAttribute('cx', String(kx)); coreDot.setAttribute('cy', String(ky));
    core.setAttribute('x', String(kx + (portrait ? 0 : -12))); core.setAttribute('y', String(ky + (portrait ? 18 : 4))); core.setAttribute('text-anchor', portrait ? 'middle' : 'end');
    numeral.style.fontSize = `${Math.round(portrait ? H * 0.36 : H * 0.72)}px`;
    buildFrame();
    lastKey = '';
    render(q.value, true);
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
  window.addEventListener('scroll', () => { if (track.p === 0) { lastKey = ''; render(q.value, true); } }, { passive: true });
  let lastKey = '';
  let currentFocus = -1;

  function placeMedia(i: number, box: Box, focal: [number, number]) {
    const m = mediaOf(worlds[i]!);
    const r = coverRectMin(m.w, m.h, { x: 0, y: 0, w: box.w, h: box.h }, focal, L.imageW);
    const css = `left:${r.x.toFixed(1)}px;top:${r.y.toFixed(1)}px;width:${r.w.toFixed(1)}px;height:${r.h.toFixed(1)}px;`;
    imgs[i]!.style.cssText = css; videos[i]!.style.cssText = css;
  }

  function render(p: number, force = false) {
    const key = p.toFixed(4);
    if (!force && key === lastKey) return;
    lastKey = key;
    const [s0, s1] = settleRange();
    const rev = smoothstep(s0, s1, p); // revelação do sistema, 0..1
    const f = focusAt(p);
    const near = Math.round(f);
    const motion = currentMode() === 'motion';
    const before = window.scrollY < track.start - 0.5 && motion;
    stage.style.opacity = before ? '0' : '1';
    stage.style.pointerEvents = before ? 'none' : '';

    const win = frame ? frame.window : L.front;
    let frontBox: Box = L.front;
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
          box = { x: lerp(win.x, box.x, rev), y: lerp(win.y, box.y, rev), w: lerp(win.w, box.w, rev), h: lerp(win.h, box.h, rev) };
          radius = 6 * rev; frontBox = box;
        } else {
          // os outros emergem de trás da janela até as frestas, um a um
          const e = easeOutExpo(remap(rev, 0.14 + 0.09 * (i - 1), 0.8 + 0.05 * (i - 1)));
          const c: Box = { x: frontBox.x + frontBox.w * 0.4, y: frontBox.y + frontBox.h * 0.3, w: frontBox.w * 0.2, h: frontBox.h * 0.4 };
          box = { x: lerp(c.x, box.x, e), y: lerp(c.y, box.y, e), w: lerp(c.w, box.w, e), h: lerp(c.h, box.h, e) };
          op *= e;
        }
      }
      s.style.transform = `translate(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px)`;
      s.style.width = `${box.w.toFixed(1)}px`; s.style.height = `${box.h.toFixed(1)}px`;
      s.style.borderRadius = `${radius.toFixed(1)}px`;
      s.style.opacity = op.toFixed(3);
      s.style.zIndex = String(10 + Math.round(d * 10) + (i === 0 && rev < 1 ? 5 : 0));
      s.style.setProperty('--depth', d.toFixed(3));
      s.style.setProperty('--ap', ap.toFixed(3));
      s.style.filter = ap > 0.98 ? 'none' : `brightness(${lerp(0.5, 1, ap).toFixed(3)}) saturate(${lerp(0.75, 1, ap).toFixed(3)})`;
      s.dataset.front = String(Math.abs(i - f) < 0.5);
      s.dataset.strip = String(ap < 0.35);
      s.tabIndex = Math.abs(i - f) < 0.5 ? 0 : -1;
      placeMedia(i, box, focal);
    }
    syncVideo(rev >= 0.6 && Math.abs(f - near) < 0.3 ? near : -1);

    // a borda do D continua avançando (a câmera não para): passa pelas bordas e se dissolve
    if (frame) {
      const vb = frame.viewBox;
      const push = lerp(1, 0.36, easeOutExpo(rev));
      const vw = vb.w * push, vh = vb.h * push;
      const cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
      frameSvg.setAttribute('viewBox', `${cx - vw / 2} ${cy - vh / 2} ${vw} ${vh}`);
      frameSvg.style.opacity = (1 - smoothstep(0.04, 0.42, rev)).toFixed(3);
      frameSvg.style.display = rev >= 1 || !motion ? 'none' : '';
    }

    // órbita, núcleo, numeral, coluna
    const sys = smoothstep(0.18, 0.95, rev);
    line.style.strokeDashoffset = `${railLen * (1 - sys)}`;
    tp.setAttribute('startOffset', `${((f * 25 + 62) % 100).toFixed(2)}%`);
    const late = smoothstep(0.5, 0.95, rev);
    railText.style.opacity = late.toFixed(3);
    core.style.opacity = late.toFixed(3); coreDot.style.opacity = late.toFixed(3);
    column.style.opacity = late.toFixed(3);
    column.style.transform = `translateY(${((1 - late) * 24).toFixed(1)}px)`;
    const tr = Math.abs(f - near); // 0 no platô, 0.5 no meio da transição
    const cut = 1 - smoothstep(0.16, 0.5, tr);
    column.style.setProperty('--cut', cut.toFixed(3));
    numeral.style.opacity = (late * 0.9).toFixed(3);
    numeral.style.setProperty('--cut', cut.toFixed(3));
    numeral.style.transform = `translateX(${(-(f - near) * 40).toFixed(1)}px)`;
    if (near !== currentFocus) { currentFocus = near; fillColumn(worlds[near]!); }
    indexEl.style.opacity = late.toFixed(3);
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
  onLang(() => { if (currentFocus >= 0) fillColumn(worlds[currentFocus]!); keys.textContent = t('atlasKeys'); });

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
      e.preventDefault();
      if (focused() === i || currentMode() === 'static') onEnter(worlds[i]!, s); else goTo(i);
    });
  });
  enterBtn.addEventListener('click', () => onEnter(worlds[focused()]!, surfaces[focused()]!));
  document.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement)?.closest('input, textarea, [role="dialog"]')) return;
    const inAtlas = window.scrollY >= track.start - H * 0.5 && window.scrollY <= track.end + H * 0.5;
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

  return { track, goTo, focused, surfaceEl: (i) => surfaces[i]!, relayout, frontRect: () => surfaces[focused()]?.getBoundingClientRect() ?? null };
}
