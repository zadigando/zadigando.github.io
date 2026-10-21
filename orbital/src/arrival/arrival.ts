import { fitName, type Fit } from './nameFit';
import { createTrack, type Track } from '../core/track';
import { createDamped } from '../core/raf';
import { currentMode, immediateMotion, isPortraitLayout, onMode } from '../core/capabilities';
import { clamp, coverRect, easeInOutCubic, easeInOutSine, hex, logLerp, mix, remap, smoothstep, lerp, type Box } from '../core/math';
import { worlds } from '../content/worlds';

const BONE = hex('#f1ece2');
const INK = hex('#0b0c10');
const HEADER_H = 72;
/** No fim da travessia a borda do D continua visível: o quadro é um múltiplo da janela, nunca mais largo que o D. */
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
 *   → travessia (a câmera mergulha na contraforma; o mundo 01 aparece pela janela, com a borda do D no quadro).
 * A câmera mantém a janela sempre dentro do quadro: a posição da janela na tela vai monotonicamente do
 * lugar onde está no nome até o centro, enquanto o zoom (logarítmico) fecha. Antes de a câmera avançar, os
 * outros glifos saem de cena: durante o mergulho só o portal (o D) está no quadro.
 * O Atlas continua o mesmo movimento para a frente.
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
  const hdr = document.getElementById('hdr')!;
  const first = worlds[0]!;

  let fit: Fit | null = null;
  let W = 0, H = 0, portrait = false;
  let finalBox = { cx: 0, cy: 0, w: 1, h: 1 };
  /** A janela: toda a largura do vão do D, mas só a faixa de altura com a proporção da tela (letterbox dentro da letra). */
  const windowBox = (): Box => { const c = fit!.counter; const h = Math.min(c.h, finalBox.h * 1.06); return { x: c.x, y: finalBox.cy - h / 2, w: c.w, h }; };
  /** Largura do quadro final: borda do D visível dos dois lados (≥ 1,18× a janela) e nunca além da tinta do D (o E não entra). */
  const finalWidth = () => {
    const { counter, ink } = fit!;
    const want = finalBox.w * (portrait ? RIM.portrait : RIM.landscape);
    return clamp(want, Math.min(counter.w * 1.18, ink.w * 0.96), ink.w * 0.96);
  };
  const finalVB = () => {
    const vw = finalWidth(), vh = (vw * H) / W;
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
    // faixa útil: abaixo do cabeçalho, acima da margem inferior (onde fica a indicação de rolagem no retrato)
    const band = portrait
      ? { top: HEADER_H + H * 0.03, bottom: H - Math.max(72, H * 0.1) }
      : { top: HEADER_H + H * 0.045, bottom: H - Math.max(44, H * 0.07) };
    // telas mais altas que largas (telefone e tablet em pé) compõem em três linhas; as demais em duas
    const tall = portrait || H > W;
    fit = fitName(svg, group, {
      lines: tall ? ['ZADIG', 'DE', 'BEM'] : ['ZADIG', 'DE BEM'],
      width: W, gutter: portrait ? 20 : Math.max(32, W * 0.034),
      fill: portrait ? 1 : 0.94,
      band, bias: tall ? 0.4 : 0.47,
      lineHeight: tall ? 0.88 : 0.86,
      minStretch: 62, maxStretch: 125, maxTracking: 0.04, weight: 800, family: 'Archivo',
      window: { line: 1, char: 0 },
    });
    svg.dataset.limit = fit.limitedBy; svg.dataset.size = String(Math.round(fit.size));
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

    // 1) contraluz: a luz passa para trás do nome
    const light = smoothstep(0.08, 0.40, p);
    const fill = mix(BONE, INK, light);
    for (const t of fit.texts) {
      t.style.fill = fill;
      t.style.stroke = `rgba(255, 217, 163, ${(0.75 * light).toFixed(3)})`;
      t.style.strokeWidth = `${(0.9 + 0.6 * smoothstep(0.5, 1, p)).toFixed(2)}px`;
    }
    // 1b) foco no portal: antes de a câmera avançar, os outros glifos saem de cena (a luz se concentra no D).
    //     Terminam invisíveis em p = 0,56; o zoom só começa a cortar as pontas do nome em p ≈ 0,61.
    const focus = smoothstep(0.42, 0.56, p);
    for (const t of fit.others) t.style.opacity = (1 - focus).toFixed(3);
    fit.portal.style.opacity = '1';
    glow.setAttribute('opacity', (light * (1 - 0.45 * smoothstep(0.7, 1, p))).toFixed(3));

    // 2) a janela abre como uma fenda de luz, do centro da contraforma até a abertura inteira
    const open = easeInOutSine(remap(p, 0.16, 0.46));
    const wb = windowBox();
    const wh = wb.h * open, ww = wb.w * lerp(0.9, 1, open);
    const wcx = wb.x + wb.w / 2, wcy = wb.y + wb.h / 2;
    clipRect.setAttribute('x', String(wcx - ww / 2)); clipRect.setAttribute('y', String(wcy - wh / 2));
    clipRect.setAttribute('width', String(ww)); clipRect.setAttribute('height', String(Math.max(0, wh)));
    windowImg.setAttribute('opacity', open > 0.001 ? '1' : '0');

    // 3) travessia: zoom em escala logarítmica (velocidade perceptual constante) com a janela SEMPRE no quadro:
    //    a posição da janela na tela vai monotonicamente de onde ela está no nome até o centro.
    //    Termina com a borda do D ainda no quadro: a janela é uma passagem, não o destino.
    const z = easeInOutCubic(remap(p, 0.52, 1));
    const fvb = finalVB();
    const vw = logLerp(W, fvb.w, z);
    const vh = (vw * H) / W;
    const fx = lerp(finalBox.cx / W, 0.5, z), fy = lerp(finalBox.cy / H, 0.5, z);
    const vx = finalBox.cx - fx * vw, vy = finalBox.cy - fy * vh;
    svg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
    svg.dataset.p = p.toFixed(4); svg.dataset.z = z.toFixed(4);

    // o mundo dentro da janela: recorte "cover" com ponto focal, assentando de 1,18× para 1× (o mundo se acomoda)
    const media = portrait ? first.media.mobile : first.media.desktop;
    const k = lerp(1.18, 1, z);
    const r = coverRect(media.w, media.h, { x: wcx - (wb.w * k) / 2, y: wcy - (wb.h * k) / 2, w: wb.w * k, h: wb.h * k }, media.focal);
    windowImg.setAttribute('x', String(r.x)); windowImg.setAttribute('y', String(r.y));
    windowImg.setAttribute('width', String(r.w)); windowImg.setAttribute('height', String(r.h));

    // interface mínima (indicação de rolagem) some quando a travessia começa; o cabeçalho sai durante o mergulho
    const uiOut = 1 - smoothstep(0.3, 0.48, p);
    ui.style.opacity = uiOut.toFixed(3);
    hdr.dataset.hidden = String(p > 0.5 && p < 0.985);
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
    // no quadro final só o portal (o D) está em cena: o Atlas herda apenas ele
    const texts = Array.from(clone.querySelectorAll('text'));
    texts.forEach((t, i) => { if (fit!.texts[i] !== fit!.portal) { t.remove(); return; } t.style.opacity = '1'; t.style.fill = '#0b0c10'; t.style.stroke = 'rgba(255, 217, 163, 0.75)'; t.style.strokeWidth = '1.5px'; });
    clone.querySelector('#glow')?.setAttribute('opacity', '0.55');
    let inner = clone.innerHTML;
    for (const id of ['g-warm', 'g-sheen', 'c-window', 'c-rect', 'glow', 'name-text']) inner = inner.split(`"${id}"`).join(`"af-${id}"`).split(`#${id})`).join(`#af-${id})`);
    return { viewBox: vb, window: windowPx, svgInner: inner, hole: wb };
  }

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
    for (const t of fit.texts) { t.style.fill = '#f1ece2'; t.style.stroke = 'none'; t.style.opacity = '1'; }
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
    ui.style.opacity = ''; hdr.dataset.hidden = 'false';
  }
  compose();
  return { track, finalFrame };
}
