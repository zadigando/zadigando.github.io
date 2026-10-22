import { createTrack, type Track } from '../core/track';
import { createDamped } from '../core/raf';
import { currentMode, immediateMotion, isPortraitLayout, onMode } from '../core/capabilities';
import { easeInOutCubic, easeInOutSine, lerp, remap, smoothstep, type Box } from '../core/math';
import { onLang } from '../core/i18n';
import { ANTARES, FIGURE, LINES, STARS } from '../content/scorpius';
import { binOpacity, fitFigure, limitAt, projectAll, segmentDepths, starAlpha, starColor, starRadius, toScreen, type Chart } from './sky';
import { stageLayout } from '../atlas/stageLayout';
import type { Atlas } from '../atlas/atlas';

const NS = 'http://www.w3.org/2000/svg';

export interface Origin { track: Track; relayout(): void }

/**
 * Capítulo 03 — The Origin · Estudo 01: do último mundo do Atlas à constelação real de Escorpião.
 * O progresso deste trilho (e, 0..1) coreografa a SAÍDA do Atlas (`atlas.setExit`) e a chegada ao céu:
 *   e 0,00–0,12  as frestas somem; o sistema orbital começa a se dissipar
 *   e 0,04–0,34  a curadoria recua para a esquerda na mesma escala, abrindo espaço à direita
 *   e 0,18–0,46  o núcleo luminoso viaja da órbita até o lugar de Antares (a ponte entre as duas linguagens)
 *   e 0,30–0,42  o vislumbre do quadro se apaga na borda esquerda: só o núcleo e o escuro
 *   e 0,40–0,72  o campo estelar surge por magnitude (as brilhantes primeiro, como a vista se adaptando ao escuro)
 *   e 0,56–0,80  a figura de Escorpião se traça a partir do coração, nas duas direções
 *   e 0,78–0,88  nomes (Antares, Shaula, Dschubba)
 *   e 0,82–0,96  o primeiro marco: 2020, como descoberta editorial na coluna (o mesmo lugar da coluna do Atlas)
 * Tudo é função pura do scroll: subir desfaz exatamente o que descer fez.
 */
export function initOrigin(atlas: Atlas): Origin {
  const track = createTrack('origin');
  const stage = track.stage;
  const svg = document.getElementById('sky') as unknown as SVGSVGElement;
  const column = document.getElementById('origin-column')!;
  const numeral = document.getElementById('origin-numeral')!;

  // ----- céu: estrelas por faixa de magnitude, traços da figura, nomes, núcleo, linha de chamada -----
  const field = document.createElementNS(NS, 'g'); field.setAttribute('class', 'sky-field'); svg.appendChild(field);
  const BIN = 0.5;
  const bins = new Map<number, SVGGElement>();
  const dots: SVGCircleElement[] = [];
  STARS.forEach((s, i) => {
    const m = Math.ceil(s[2] / BIN) * BIN;
    let g = bins.get(m);
    if (!g) { g = document.createElementNS(NS, 'g'); g.dataset.m = String(m); g.style.opacity = '0'; field.appendChild(g); bins.set(m, g); }
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('r', starRadius(s[2]).toFixed(2)); c.setAttribute('fill', starColor(s[3])); c.setAttribute('fill-opacity', starAlpha(s[2]).toFixed(2));
    if (i === ANTARES) c.style.display = 'none'; // Antares é o núcleo
    g.appendChild(c); dots[i] = c;
  });
  const figure = document.createElementNS(NS, 'g'); figure.setAttribute('class', 'sky-figure'); svg.appendChild(figure);
  const segs = LINES.map(() => { const l = document.createElementNS(NS, 'line'); figure.appendChild(l); return l; });
  const depths = segmentDepths();
  const maxDepth = Math.max(...depths) + 1;
  const labels = document.createElementNS(NS, 'g'); labels.setAttribute('class', 'sky-labels'); svg.appendChild(labels);
  const NAMED = ['Antares', 'Shaula', 'Dschubba'];
  const labelEls = NAMED.map((name) => {
    const f = FIGURE.find((x) => x.name === name)!; const tx = document.createElementNS(NS, 'text');
    const greek = document.createElementNS(NS, 'tspan'); greek.setAttribute('class', 'sky-bayer'); greek.textContent = f.bayer; // a letra de Bayer fica minúscula
    tx.append(`${name} · `, greek, ' Sco'); labels.appendChild(tx); return { tx, i: f.i };
  });
  const leader = document.createElementNS(NS, 'line'); leader.setAttribute('class', 'sky-leader'); svg.appendChild(leader);
  const glow = document.createElementNS(NS, 'circle'); glow.setAttribute('class', 'sky-core-glow'); svg.appendChild(glow);
  const core = document.createElementNS(NS, 'circle'); core.setAttribute('class', 'sky-core'); svg.appendChild(core);

  let W = 0, H = 0, portrait = false;
  let chart: Chart = { scale: 1, ox: 0, oy: 0, rot: 0 };
  let pts: Array<[number, number]> = [];
  let antares: [number, number] = [0, 0];
  let segLen: number[] = [];
  let leaderLen = 1;
  let colBox: Box = { x: 0, y: 0, w: 0, h: 0 };

  function layout() {
    portrait = isPortraitLayout();
    const motion = currentMode() === 'motion';
    W = stage.clientWidth;
    H = motion ? stage.clientHeight : Math.round(W * (portrait ? 1.2 : 0.6));
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.height = motion ? '' : `${H}px`;
    const L = stageLayout(W, H, portrait);
    // a coluna do marco ocupa o MESMO lugar da coluna do Atlas — continuidade da grade editorial entre os dois universos
    if (L.column) { column.style.setProperty('--col-x', `${L.column.x.toFixed(0)}px`); column.style.setProperty('--col-w', `${L.column.w.toFixed(0)}px`); }
    else { column.style.removeProperty('--col-x'); column.style.removeProperty('--col-w'); }
    const cb = column.getBoundingClientRect(), sb = stage.getBoundingClientRect();
    colBox = { x: cb.left - sb.left, y: cb.top - sb.top, w: cb.width, h: cb.height };
    // a carta: a figura ocupa o espaço aberto à direita (paisagem) ou o alto do palco, acima da coluna (retrato)
    const box: Box = portrait
      ? (motion ? { x: W * 0.1, y: H * 0.1, w: W * 0.8, h: Math.max(H * 0.3, Math.min(H * 0.5, colBox.y - 28 - H * 0.1)) } : { x: W * 0.1, y: H * 0.06, w: W * 0.8, h: H * 0.88 })
      : { x: W * 0.42, y: H * 0.13, w: W * 0.52, h: H * 0.76 };
    const rot = portrait ? -38 : -16; // orientação (hora/latitude de observação): figura em pé no retrato, diagonal na paisagem
    const raw = projectAll(rot);
    chart = fitFigure(raw, FIGURE.map((f) => f.i), box, portrait ? 26 : 32, rot);
    pts = raw.map((p) => toScreen(chart, p));
    antares = pts[ANTARES]!;
    pts.forEach(([x, y], i) => { dots[i]!.setAttribute('cx', x.toFixed(1)); dots[i]!.setAttribute('cy', y.toFixed(1)); });
    segLen = LINES.map(([a, b], k) => {
      const [x1, y1] = pts[a]!, [x2, y2] = pts[b]!; const l = segs[k]!;
      l.setAttribute('x1', x1.toFixed(1)); l.setAttribute('y1', y1.toFixed(1)); l.setAttribute('x2', x2.toFixed(1)); l.setAttribute('y2', y2.toFixed(1));
      const len = Math.hypot(x2 - x1, y2 - y1); l.style.strokeDasharray = `${len.toFixed(1)}`; return len;
    });
    // nomes: do lado da estrela que aponta para fora da figura (a linha de chamada de Antares chega pela esquerda)
    const mid = box.x + box.w / 2;
    for (const { tx, i } of labelEls) {
      const [x, y] = pts[i]!; const left = i !== ANTARES && x > mid;
      tx.setAttribute('x', (x + (left ? -12 : 12)).toFixed(1)); tx.setAttribute('y', (y + 4).toFixed(1)); tx.setAttribute('text-anchor', left ? 'end' : 'start');
    }
    numeral.style.fontSize = `${Math.round(portrait ? H * 0.36 : H * 0.72)}px`;
    // linha de chamada: de Antares ao lado da coluna (paisagem)
    // (no retrato a linha cruzaria a figura: a coluna cita Antares no próprio olho e a linha não é desenhada)
    const end: [number, number] = portrait ? antares : [colBox.x + colBox.w + 26, Math.min(Math.max(antares[1], colBox.y + 12), colBox.y + colBox.h - 12)];
    leader.setAttribute('x1', antares[0].toFixed(1)); leader.setAttribute('y1', antares[1].toFixed(1)); leader.setAttribute('x2', end[0].toFixed(1)); leader.setAttribute('y2', end[1].toFixed(1));
    leaderLen = Math.hypot(end[0] - antares[0], end[1] - antares[1]); leader.style.strokeDasharray = `${leaderLen.toFixed(1)}`;
    lastKey = '';
    render(q.value, true);
  }

  // ----- progresso amortecido (mesmo amortecimento do Atlas: a saída e a chegada respiram juntas) -----
  const q = createDamped(0, 12, immediateMotion);
  track.onProgress((p) => q.set(p));
  window.addEventListener('scroll', () => { render(q.value); }, { passive: true });
  let lastKey = '';

  function render(e: number, force = false) {
    const motion = currentMode() === 'motion';
    if (!motion) e = 1;
    const before = motion && window.scrollY < track.start - 0.5;
    const key = e.toFixed(4) + (before ? 'b' : '');
    if (!force && key === lastKey) return;
    lastKey = key;
    stage.style.opacity = before ? '0' : '1';
    stage.style.pointerEvents = before ? 'none' : '';
    atlas.setExit(motion ? e : 1);

    // 1) o núcleo: parte do ponto da órbita e chega ao lugar de Antares, crescendo até o tamanho da estrela
    const from = atlas.corePoint();
    const travel = easeInOutCubic(remap(e, 0.18, 0.46));
    const cx = lerp(from.x, antares[0], travel), cy = lerp(from.y, antares[1], travel);
    const r = lerp(3, starRadius(STARS[ANTARES]![2]) + 0.6, travel);
    const appear = from.visible ? 1 : smoothstep(0, 0.12, e); // no retrato o núcleo não é visível no Atlas: emerge
    core.setAttribute('cx', cx.toFixed(1)); core.setAttribute('cy', cy.toFixed(1)); core.setAttribute('r', r.toFixed(2));
    core.style.opacity = appear.toFixed(3);
    glow.setAttribute('cx', cx.toFixed(1)); glow.setAttribute('cy', cy.toFixed(1));
    glow.setAttribute('r', lerp(18, 46, smoothstep(0.18, 0.55, e)).toFixed(1));
    glow.style.opacity = (appear * lerp(0.35, 0.8, smoothstep(0.18, 0.5, e)) * (1 - 0.35 * smoothstep(0.56, 0.86, e))).toFixed(3);

    // 2) o campo estelar: magnitude-limite crescendo (as brilhantes primeiro)
    const lim = limitAt(smoothstep(0.4, 0.72, e));
    for (const [m, g] of bins) g.style.opacity = binOpacity(m, lim).toFixed(3);

    // 3) a figura, do coração para as pontas
    const draw = smoothstep(0.56, 0.8, e);
    segs.forEach((l, k) => { const d = depths[k]!; const s = remap(draw, d / maxDepth, (d + 1) / maxDepth); l.style.strokeDashoffset = `${(segLen[k]! * (1 - s)).toFixed(1)}`; l.style.opacity = s > 0 ? '1' : '0'; });

    // 4) nomes
    const named = smoothstep(0.78, 0.88, e);
    labels.style.opacity = named.toFixed(3);

    // 5) o marco de 2020
    const mark = smoothstep(0.84, 0.96, e);
    const lead = smoothstep(0.82, 0.92, e);
    leader.style.strokeDashoffset = `${(leaderLen * (1 - lead)).toFixed(1)}`; leader.style.opacity = lead > 0 && !portrait && motion ? '1' : '0'; // (no estático a coluna fica abaixo da carta)
    column.style.opacity = mark.toFixed(3);
    column.style.transform = `translateY(${((1 - mark) * 18).toFixed(1)}px)`;
    numeral.style.opacity = (smoothstep(0.82, 0.95, e) * 0.9).toFixed(3);
    numeral.style.transform = `translateX(${((1 - easeInOutSine(smoothstep(0.82, 0.96, e))) * 28).toFixed(1)}px)`;
    stage.dataset.e = e.toFixed(3);
  }
  q.subscribe((v) => render(v));

  let raf = 0;
  const relayout = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { track.measure(); layout(); }); };
  window.addEventListener('resize', relayout);
  onLang(() => { if (W) relayout(); });
  onMode((m) => { if (m === 'static') q.jump(1); relayout(); });
  track.measure();
  layout();

  return { track, relayout };
}
