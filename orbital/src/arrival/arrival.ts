import { fitName, type Fit } from './nameFit';
import { createTrack, type Track } from '../core/track';
import { createDamped } from '../core/raf';
import { currentMode, immediateMotion, isPortraitLayout, onMode } from '../core/capabilities';
import { coverRect, easeInOutCubic, easeInOutSine, hex, logLerp, mix, remap, smoothstep, lerp, type Box } from '../core/math';
import { worlds } from '../content/worlds';
import { onLang, pick } from '../core/i18n';

const BONE = hex('#f1ece2');
const INK = hex('#0b0c10');
/** No fim da travessia a borda do D continua visível: a janela ocupa ~70% do quadro (não é tela cheia). */
const RIM = { landscape: 1.42, portrait: 1.5 };

/** Quadro final da travessia, para o Atlas assumir no mesmo instante e continuar o movimento. */
export interface FinalFrame {
  viewBox: { x: number; y: number; w: number; h: number };
  /** retângulo da janela (contraforma) em px de tela */
  window: Box;
  /** marcação SVG do quadro (fundo, luz, letras) no estado final, sem a imagem */
  svgInner: string;
  /** retângulo da janela em unidades do viewBox */
  hole: Box;
}

export interface Arrival { track: Track; finalFrame(): FinalFrame | null }

/**
 * Capítulo 01 — The Arrival · Contraluz.
 * Um único progresso (scroll nativo do trilho) conduz três momentos contínuos:
 *   chegada (nome em marfim) → a luz passa para trás (letras escuras, fio quente, a contraforma do D abre)
 *   → travessia (a viewBox mergulha na contraforma; o mundo 01 aparece pela janela, com a borda do D no quadro).
 * O Atlas continua o mesmo movimento para a frente: a borda passa pelas bordas da tela e a janela
 * revela-se uma entre quatro superfícies em órbita.
 */
export function initArrival(opts: { onComposed: () => void }): Arrival {
  const track = createTrack('arrival');
  const svg = document.getElementById('name') as unknown as SVGSVGElement;
  const group = document.getElementById('name-text') as unknown as SVGGElement;
  const glow = document.getElementById('glow') as unknown as SVGCircleElement;
  const gwarm = document.getElementById('g-warm') as unknown as SVGRadialGradientElement;
  const windowImg = document.getElementById('window') as unknown as SVGImageElement;
  const clipRect = document.getElementById('c-rect') as unknown as SVGRectElement;
  const ui = track.stage.querySelector<HTMLElement>('.arrival-ui')!;
  const cartela = track.stage.querySelector<HTMLElement>('.cartela')!;
  const hdr = document.getElementById('hdr')!;
  const first = worlds[0]!;

  let fit: Fit | null = null;
  let W = 0, H = 0, portrait = false;
  let finalBox = { cx: 0, cy: 0, w: 1, h: 1 };
  /** A janela: toda a largura do vão do D, mas só a faixa de altura com a proporção da tela (letterbox dentro da letra). */
  const windowBox = (): Box => { const c = fit!.counter; const h = Math.min(c.h, finalBox.h * 1.06); return { x: c.x, y: finalBox.cy - h / 2, w: c.w, h }; };
  const finalVB = () => {
    const vw = finalBox.w * (portrait ? RIM.portrait : RIM.landscape), vh = (vw * H) / W;
    return { x: finalBox.cx - vw / 2, y: finalBox.cy - vh / 2, w: vw, h: vh };
  };

  /** Maior caixa com a proporção da viewport, centrada na contraforma, que cabe no vão medido do D. */
  function computeFinalBox() {
    if (!fit) return;
    const { counter, gaps } = fit;
    const cx = counter.x + counter.w / 2, cy = counter.y + counter.h / 2;
    const fits = (hb: number) => {
      const wb = (hb * W) / H;
      const rows = gaps.filter((g) => g.y >= cy - hb / 2 && g.y <= cy + hb / 2);
      if (rows.length < 2) return false;
      return rows.every((g) => g.x0 <= cx - wb / 2 && g.x1 >= cx + wb / 2);
    };
    let lo = 1, hi = counter.h;
    for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
    const hb = lo * 0.985;
    finalBox = { cx, cy, w: (hb * W) / H, h: hb };
  }

  function compose() {
    W = track.stage.clientWidth; H = currentMode() === 'static' ? Math.round(W * (isPortraitLayout() ? 1.6 : 0.62)) : track.stage.clientHeight; portrait = isPortraitLayout();
    svg.style.height = '';
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    fit = fitName(svg, group, {
      lines: portrait ? ['ZADIG', 'DE', 'BEM'] : ['ZADIG', 'DE BEM'],
      width: W, height: H, gutter: portrait ? 20 : Math.max(32, W * 0.034),
      fill: portrait ? 1 : 0.94,
      top: portrait ? H * 0.16 : H * 0.165,
      lineHeight: portrait ? 0.88 : 0.86,
      minStretch: 62, maxStretch: 125, weight: 800, family: 'Archivo',
      window: { line: 1, char: 0 },
    });
    const { counter } = fit;
    const media = portrait ? first.media.mobile : first.media.desktop;
    windowImg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', media.poster);
    const ccx = counter.x + counter.w / 2, ccy = counter.y + counter.h / 2;
    glow.setAttribute('cx', String(ccx)); glow.setAttribute('cy', String(ccy));
    gwarm.setAttribute('cx', String(ccx)); gwarm.setAttribute('cy', String(ccy));
    const gr = Math.max(W, H) * 0.5; glow.setAttribute('r', String(gr)); gwarm.setAttribute('r', String(gr));
    computeFinalBox();
    lastKey = '';
    render(progress.value, true);
    renderStatic();
    opts.onComposed();
  }

  // amortecimento leve sobre o progresso do scroll (a pose continua função pura do progresso)
  const progress = createDamped(0, 14, immediateMotion);
  track.onProgress((p) => progress.set(p));

  let lastKey = '';
  function render(p: number, force = false) {
    if (!fit || currentMode() === 'static') return;
    const key = p.toFixed(4);
    if (!force && key === lastKey) return;
    lastKey = key;
    const { counter } = fit;
    const cx = counter.x + counter.w / 2, cy = counter.y + counter.h / 2;

    // 1) contraluz: a luz passa para trás do nome
    const light = smoothstep(0.08, 0.40, p);
    const fill = mix(BONE, INK, light);
    for (const t of fit.texts) {
      t.style.fill = fill;
      t.style.stroke = `rgba(255, 217, 163, ${(0.75 * light).toFixed(3)})`;
      t.style.strokeWidth = `${(0.9 + 0.6 * smoothstep(0.5, 1, p)).toFixed(2)}px`;
    }
    glow.setAttribute('opacity', (light * (1 - 0.45 * smoothstep(0.7, 1, p))).toFixed(3));

    // 2) a janela abre como uma fenda de luz, do centro da contraforma até a abertura inteira
    const open = easeInOutSine(remap(p, 0.16, 0.46));
    const wb = windowBox();
    const wh = wb.h * open, ww = wb.w * lerp(0.9, 1, open);
    const wcx = wb.x + wb.w / 2, wcy = wb.y + wb.h / 2;
    clipRect.setAttribute('x', String(wcx - ww / 2)); clipRect.setAttribute('y', String(wcy - wh / 2));
    clipRect.setAttribute('width', String(ww)); clipRect.setAttribute('height', String(Math.max(0, wh)));
    windowImg.setAttribute('opacity', open > 0.001 ? '1' : '0');

    // 3) travessia: a viewBox mergulha na contraforma (zoom em escala logarítmica = velocidade perceptual constante);
    //    termina com a borda do D ainda no quadro: a janela é uma passagem, não o destino
    const z = easeInOutCubic(remap(p, 0.44, 1));
    const fvb = finalVB();
    const vw = logLerp(W, fvb.w, z);
    const vh = (vw * H) / W;
    const vx = lerp(W / 2, finalBox.cx, z) - vw / 2, vy = lerp(H / 2, finalBox.cy, z) - vh / 2;
    svg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
    svg.dataset.p = p.toFixed(4); svg.dataset.z = z.toFixed(4);

    // o mundo dentro da janela: recorte "cover" com ponto focal, assentando de 1,18× para 1× (o mundo se acomoda)
    const media = portrait ? first.media.mobile : first.media.desktop;
    const k = lerp(1.18, 1, z);
    const r = coverRect(media.w, media.h, { x: wcx - (wb.w * k) / 2, y: wcy - (wb.h * k) / 2, w: wb.w * k, h: wb.h * k }, media.focal);
    windowImg.setAttribute('x', String(r.x)); windowImg.setAttribute('y', String(r.y));
    windowImg.setAttribute('width', String(r.w)); windowImg.setAttribute('height', String(r.h));

    // interface: some durante a travessia; a cartela do mundo entra no meio do mergulho
    const uiOut = 1 - smoothstep(0.42, 0.56, p);
    ui.style.opacity = uiOut.toFixed(3);
    ui.style.pointerEvents = uiOut < 0.2 ? 'none' : '';
    ui.style.transform = `translateY(${(1 - uiOut) * 14}px)`;
    hdr.dataset.hidden = String(p > 0.5 && p < 0.985);
    const cIn = smoothstep(0.6, 0.74, p) * (1 - smoothstep(0.93, 1, p));
    cartela.style.opacity = cIn.toFixed(3);
    cartela.style.transform = `translateY(${(1 - cIn) * 18}px)`;
  }
  progress.subscribe((v) => render(v));

  /** Estado final (p = 1) em marcação própria, independente do progresso atual. */
  function finalFrame(): FinalFrame | null {
    if (!fit || currentMode() === 'static') return null;
    const wb = windowBox();
    const vb = finalVB();
    const s = W / vb.w;
    const windowPx: Box = { x: (wb.x - vb.x) * s, y: (wb.y - vb.y) * s, w: wb.w * s, h: wb.h * s };
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.querySelector('#window')?.remove();
    clone.querySelector('title')?.remove();
    clone.querySelectorAll('text').forEach((t) => { t.style.fill = '#0b0c10'; t.style.stroke = 'rgba(255, 217, 163, 0.75)'; t.style.strokeWidth = '1.5px'; });
    clone.querySelector('#glow')?.setAttribute('opacity', '0.55');
    let inner = clone.innerHTML;
    for (const id of ['g-warm', 'g-sheen', 'c-window', 'c-rect', 'glow', 'name-text']) inner = inner.split(`"${id}"`).join(`"af-${id}"`).split(`#${id})`).join(`#af-${id})`);
    return { viewBox: vb, window: windowPx, svgInner: inner, hole: wb };
  }

  const cartelaName = document.getElementById('cartela-name')!;
  const cartelaCat = document.getElementById('cartela-cat')!;
  const fillCopy = () => { cartelaName.textContent = first.name; cartelaCat.textContent = pick(first.category); };
  fillCopy(); onLang(fillCopy);

  // recomposição: fontes prontas, redimensionamento, mudança de modo
  let raf = 0;
  const recompose = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { compose(); track.measure(); }); };
  document.fonts.load('800 100px Archivo').then(recompose, recompose);
  window.addEventListener('resize', recompose);
  onMode(() => { lastKey = ''; recompose(); });

  // modo estático: o nome em marfim com a janela aberta (composição fixa), sem trilho
  onMode((m) => { if (m === 'static') { progress.jump(0); renderStatic(); } });
  function renderStatic() {
    if (!fit || currentMode() !== 'static') return;
    const wb = windowBox();
    for (const t of fit.texts) { t.style.fill = '#f1ece2'; t.style.stroke = 'none'; }
    clipRect.setAttribute('x', String(wb.x)); clipRect.setAttribute('y', String(wb.y));
    clipRect.setAttribute('width', String(wb.w)); clipRect.setAttribute('height', String(wb.h));
    windowImg.setAttribute('opacity', '1');
    const media = portrait ? first.media.mobile : first.media.desktop;
    const r = coverRect(media.w, media.h, wb, media.focal);
    windowImg.setAttribute('x', String(r.x)); windowImg.setAttribute('y', String(r.y)); windowImg.setAttribute('width', String(r.w)); windowImg.setAttribute('height', String(r.h));
    glow.setAttribute('opacity', '0.5');
    // viewBox justa ao bloco de texto: o SVG ganha a altura do nome, sem cortes
    const bb = (group as unknown as SVGGraphicsElement).getBBox();
    const top = Math.max(0, bb.y - fit.size * 0.12), bottom = bb.y + bb.height + fit.size * 0.1;
    svg.setAttribute('viewBox', `0 ${top} ${W} ${bottom - top}`);
    svg.style.height = `${((bottom - top) / W) * svg.clientWidth}px`;
    ui.style.opacity = ''; ui.style.pointerEvents = ''; ui.style.transform = ''; cartela.style.opacity = '0'; hdr.dataset.hidden = 'false';
  }
  compose();
  return { track, finalFrame };
}
