import { createTrack, type Track } from '../core/track';
import { createDamped } from '../core/raf';
import { currentMode, immediateMotion, isPortraitLayout, onMode, prefersReducedMotion } from '../core/capabilities';
import { clamp, easeInOutCubic, easeInOutSine, lerp, remap, smoothstep, type Box } from '../core/math';
import { onLang, pick, t } from '../core/i18n';
import { ANTARES, FIGURE, LINES, STARS } from '../content/scorpius';
import { BODY_PATH, milestones } from '../content/milestones';
import { arcLengths, binOpacity, cameraFor, cameraTransform, fitFigure, journeyEnd, journeyFocus, limitAt, logLerp, plateauCenter, pointAtArc, projectAll, pullBack, RHYTHM, segmentDepths, starAlpha, starColor, starRadius, toScreen, toStage, type Camera, type Chart } from './sky';
import { stageLayout } from '../atlas/stageLayout';
import type { Atlas } from '../atlas/atlas';

const NS = 'http://www.w3.org/2000/svg';
/** fração do trilho que pertence ao Estudo 01 (420 svh de 900): os seus limiares continuam os mesmos em px de rolagem */
const S1 = 420 / 900;

export interface Origin {
  track: Track;
  relayout(): void;
  /** posição de rolagem do platô do marco k (0 = 2020) */
  positionFor(k: number): number;
  goTo(k: number, smooth?: boolean): void;
}

/**
 * Capítulo 03 — The Origin.
 * Estudo 01 (e = progresso 0..1 nos primeiros 420 svh): do último mundo do Atlas à constelação real de Escorpião.
 *   e 0,00–0,12  as frestas somem; o sistema orbital começa a se dissipar
 *   e 0,04–0,34  a curadoria recua para a esquerda na mesma escala, abrindo espaço à direita
 *   e 0,18–0,46  o núcleo luminoso viaja da órbita até o lugar de Antares (a ponte entre as duas linguagens)
 *   e 0,30–0,42  o vislumbre do quadro se apaga na borda esquerda: só o núcleo e o escuro
 *   e 0,40–0,72  o campo estelar surge por magnitude (as brilhantes primeiro, como a vista se adaptando ao escuro)
 *   e 0,56–0,80  a figura de Escorpião se traça a partir do coração, nas duas direções
 *   e 0,78–0,88  nomes (Antares, Shaula, Dschubba)
 *   e 0,82–0,96  o primeiro marco: 2020, como descoberta editorial na coluna (o mesmo lugar da coluna do Atlas)
 * Estudo 02 (j = progresso 0..1 nos 480 svh seguintes): a viagem pelo CORPO do escorpião, do coração ao ferrão.
 *   A câmera (translate + scale de um único grupo da carta) caminha sobre a polilinha real α τ ε μ ζ η θ ι κ λ;
 *   em cada estação, um marco: a estrela no terço oposto à coluna, anel e nome; entre estações, trajeto com o
 *   ritmo do Atlas (easeInOutQuart). Estrelas e nomes mantêm o tamanho em px de tela (raio e fonte ÷ zoom).
 *   O campo de estrelas fracas é uma camada mais distante (paralaxe). No fim, recuo até a figura inteira: só as
 *   estrelas dos marcos ficam acesas, sem textos nem linhas. Tudo é função pura do scroll.
 */
export function initOrigin(atlas: Atlas): Origin {
  const track = createTrack('origin');
  const stage = track.stage;
  const svg = document.getElementById('sky') as unknown as SVGSVGElement;
  const column = document.getElementById('origin-column')!;
  const colIndex = column.querySelector<HTMLElement>('.column-index')!;
  const colTitle = document.getElementById('origin-title')!;
  const colCat = column.querySelector<HTMLElement>('.column-cat')!;
  const colThesis = column.querySelector<HTMLElement>('.column-thesis')!;
  const numeral = document.getElementById('origin-numeral')!;
  const numSpan = numeral.querySelector('span')!;
  const indexEl = document.getElementById('origin-index')!;
  const listEl = document.getElementById('origin-list')!;

  // ----- céu em duas camadas: o campo (mais distante, paralaxe) e a carta (figura, marcos, nomes, núcleo) -----
  const field = document.createElementNS(NS, 'g'); field.setAttribute('class', 'sky-field'); svg.appendChild(field);
  const chartG = document.createElementNS(NS, 'g'); chartG.setAttribute('class', 'sky-chart'); svg.appendChild(chartG);
  const figStars = document.createElementNS(NS, 'g'); figStars.setAttribute('class', 'sky-figstars');
  const figureSet = new Set(FIGURE.map((f) => f.i)); for (const m of milestones) for (const i of m.stars) figureSet.add(i);
  const BIN = 0.5;
  const bins: Array<{ m: number; g: SVGGElement }> = [];
  const binOf = (m: number, parent: SVGGElement) => {
    let b = bins.find((x) => x.m === m && x.g.parentNode === parent);
    if (!b) { const g = document.createElementNS(NS, 'g'); g.dataset.m = String(m); g.style.opacity = '0'; parent.appendChild(g); b = { m, g }; bins.push(b); }
    return b.g;
  };
  const dots: SVGCircleElement[] = [];
  const r0: number[] = [];
  STARS.forEach((s, i) => {
    const m = Math.ceil(s[2] / BIN) * BIN;
    const c = document.createElementNS(NS, 'circle');
    r0[i] = starRadius(s[2]);
    c.setAttribute('r', r0[i]!.toFixed(2)); c.setAttribute('fill', starColor(s[3])); c.setAttribute('fill-opacity', starAlpha(s[2]).toFixed(2));
    if (i === ANTARES) c.style.display = 'none'; // Antares é o núcleo
    binOf(m, figureSet.has(i) ? figStars : field).appendChild(c); dots[i] = c;
  });
  const figure = document.createElementNS(NS, 'g'); figure.setAttribute('class', 'sky-figure'); chartG.appendChild(figure);
  chartG.appendChild(figStars);
  const segs = LINES.map(() => { const l = document.createElementNS(NS, 'line'); l.setAttribute('vector-effect', 'non-scaling-stroke'); figure.appendChild(l); return l; });
  const depths = segmentDepths();
  const maxDepth = Math.max(...depths) + 1;
  // anéis dos marcos (uma estrela ou duas)
  const rings = document.createElementNS(NS, 'g'); rings.setAttribute('class', 'sky-rings'); chartG.appendChild(rings);
  const ringEls = milestones.map((m) => m.stars.map((i) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('vector-effect', 'non-scaling-stroke'); c.dataset.star = String(i); rings.appendChild(c); return c; }));
  // nomes: os do Estudo 01 (Antares, Shaula, Dschubba) e os das estrelas dos marcos
  const labels = document.createElementNS(NS, 'g'); labels.setAttribute('class', 'sky-labels'); chartG.appendChild(labels);
  const mkLabel = (name: string, bayer: string, i: number) => {
    const tx = document.createElementNS(NS, 'text');
    const greek = document.createElementNS(NS, 'tspan'); greek.setAttribute('class', 'sky-bayer'); greek.textContent = bayer; // a letra de Bayer fica minúscula
    tx.append(`${name} · `, greek, ' Sco'); labels.appendChild(tx); return { tx, greek, i };
  };
  const baseLabels = ['Antares', 'Shaula', 'Dschubba'].map((name) => { const f = FIGURE.find((x) => x.name === name)!; return mkLabel(name, f.bayer, f.i); });
  // um nome por marco (as duplas μ¹/μ² e λ/υ são próximas demais para dois rótulos), ancorado na primeira estrela
  const markLabels = milestones.map((m, k) => (k === 0 ? [] : [mkLabel(m.star, m.bayer, m.stars[0]!)]));
  const leader = document.createElementNS(NS, 'line'); leader.setAttribute('class', 'sky-leader'); svg.appendChild(leader);
  const glow = document.createElementNS(NS, 'circle'); glow.setAttribute('class', 'sky-core-glow'); chartG.appendChild(glow);
  const core = document.createElementNS(NS, 'circle'); core.setAttribute('class', 'sky-core'); chartG.appendChild(core);

  // ----- índice de anos (navegação direta) e lista estática -----
  const idxBtns = milestones.map((m, k) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'index-btn'; b.innerHTML = `<b>${m.id}</b>`; b.setAttribute('aria-label', `${m.years} · ${pick(m.title)}`); b.addEventListener('click', () => goTo(k)); indexEl.appendChild(b); return b; });
  function fillList() {
    listEl.replaceChildren(...milestones.map((m) => { const li = document.createElement('li'); li.innerHTML = `<p class="meta column-index"><b>${m.years}</b><span class="column-star">· ${m.star}</span></p><h3 class="column-title">${pick(m.title)}</h3><p class="column-cat">${pick(m.subtitle)}</p><p class="column-thesis">${pick(m.thesis)}</p>`; return li; }));
    idxBtns.forEach((b, k) => b.setAttribute('aria-label', `${milestones[k]!.years} · ${pick(milestones[k]!.title)}`));
  }

  let W = 0, H = 0, portrait = false;
  let chart: Chart = { scale: 1, ox: 0, oy: 0, rot: 0 };
  let pts: Array<[number, number]> = [];
  let antares: [number, number] = [0, 0];
  let segLen: number[] = [];
  let colBox: Box = { x: 0, y: 0, w: 0, h: 0 };
  let colX = 0, colW = 0;
  let body: Array<[number, number]> = [], bodyAcc: number[] = [];
  let stations: Array<{ star: [number, number]; cam: Camera; arc: number }> = [];
  let currentMark = -1;

  function stationStar(k: number): [number, number] {
    const m = milestones[k]!; const ps = m.stars.map((i) => pts[i]!);
    return [ps.reduce((a, p) => a + p[0], 0) / ps.length, ps.reduce((a, p) => a + p[1], 0) / ps.length];
  }
  function measureColumn() {
    const cb = column.getBoundingClientRect(), sb = stage.getBoundingClientRect();
    colBox = { x: cb.left - sb.left, y: cb.top - sb.top, w: cb.width, h: cb.height };
  }

  function layout() {
    portrait = isPortraitLayout();
    const motion = currentMode() === 'motion';
    W = stage.clientWidth;
    H = motion ? stage.clientHeight : Math.round(W * (portrait ? 1.2 : 0.6));
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.height = motion ? '' : `${H}px`;
    const L = stageLayout(W, H, portrait);
    // a coluna do marco ocupa o MESMO lugar da coluna do Atlas — continuidade da grade editorial entre os dois universos
    if (L.column) { colX = L.column.x; colW = L.column.w; column.style.setProperty('--col-x', `${colX.toFixed(0)}px`); column.style.setProperty('--col-w', `${colW.toFixed(0)}px`); }
    else { column.style.removeProperty('--col-x'); column.style.removeProperty('--col-w'); }
    if (currentMark !== 0) fillColumn(0);
    column.dataset.side = 'left';
    measureColumn();
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
      return Math.hypot(x2 - x1, y2 - y1);
    });
    ringEls.forEach((rs, k) => rs.forEach((c, n) => { const [x, y] = pts[milestones[k]!.stars[n]!]!; c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', y.toFixed(1)); }));
    // o corpo do escorpião e as estações da câmera
    body = BODY_PATH.map((i) => pts[i]!); bodyAcc = arcLengths(body);
    stations = milestones.map((m, k) => {
      const star = stationStar(k);
      const cam: Camera = k === 0 ? { cx: W / 2, cy: H / 2, z: 1 } : cameraFor(star, portrait ? m.framePortrait : m.frame, portrait ? m.zoomPortrait : m.zoom, W, H);
      // posição da estação ao longo do corpo: a distância acumulada até a estrela do marco que está na polilinha
      const onPath = m.stars.find((i) => BODY_PATH.includes(i)) ?? m.stars[0]!;
      const arc = bodyAcc[BODY_PATH.indexOf(onPath)] ?? 0;
      return { star, cam, arc };
    });
    numeral.style.fontSize = `${Math.round(portrait ? H * 0.36 : H * 0.72)}px`;
    lastKey = '';
    render(q.value, true);
  }

  function fillColumn(k: number) {
    const m = milestones[k]!;
    currentMark = k;
    colIndex.innerHTML = k === 0 ? `<b>${m.years}</b><span>${t('originMark')}</span><span class="column-star">· ${m.star}</span>` : `<b>${m.years}</b><span class="column-star">· ${m.star}</span>`;
    colTitle.textContent = pick(m.title); colCat.textContent = pick(m.subtitle); colThesis.textContent = pick(m.thesis);
    numSpan.textContent = m.id;
    idxBtns.forEach((b, i) => b.setAttribute('aria-current', String(i === k)));
  }

  // ----- progresso amortecido (mesmo amortecimento do Atlas: a saída e a chegada respiram juntas) -----
  const q = createDamped(0, 12, immediateMotion);
  track.onProgress((p) => q.set(p));
  window.addEventListener('scroll', () => { render(q.value); }, { passive: true });
  let lastKey = '';
  let lastZ = -1;

  function render(p: number, force = false) {
    if (!pts.length) return; // antes do primeiro layout
    const motion = currentMode() === 'motion';
    if (!motion) p = 1;
    const e = clamp(p / S1); // Estudo 01
    const j = remap(p, S1, 1); // Estudo 02
    const before = motion && window.scrollY < track.start - 0.5;
    const key = p.toFixed(5) + (before ? 'b' : '');
    if (!force && key === lastKey) return;
    lastKey = key;
    stage.style.opacity = before ? '0' : '1';
    stage.style.pointerEvents = before ? 'none' : '';
    atlas.setExit(motion ? e : 1);

    // ===== Estudo 01 =====
    // 1) o núcleo: parte do ponto da órbita e chega ao lugar de Antares, crescendo até o tamanho da estrela
    const from = atlas.corePoint();
    const travel = easeInOutCubic(remap(e, 0.18, 0.46));
    const cx = lerp(from.x, antares[0], travel), cy = lerp(from.y, antares[1], travel);
    const appear = from.visible ? 1 : smoothstep(0, 0.12, e); // no retrato o núcleo não é visível no Atlas: emerge
    core.setAttribute('cx', cx.toFixed(1)); core.setAttribute('cy', cy.toFixed(1));
    core.style.opacity = appear.toFixed(3);
    glow.setAttribute('cx', cx.toFixed(1)); glow.setAttribute('cy', cy.toFixed(1));
    const glowOp = appear * lerp(0.35, 0.8, smoothstep(0.18, 0.5, e)) * (1 - 0.35 * smoothstep(0.56, 0.86, e));
    // 2) o campo estelar: magnitude-limite crescendo (as brilhantes primeiro)
    const lim = limitAt(smoothstep(0.4, 0.72, e));
    for (const b of bins) b.g.style.opacity = binOpacity(b.m, lim).toFixed(3);
    // 3) a figura, do coração para as pontas
    const draw = smoothstep(0.56, 0.8, e);
    segs.forEach((l, k) => { const d = depths[k]!; const s = remap(draw, d / maxDepth, (d + 1) / maxDepth); if (s >= 1) { l.style.strokeDasharray = 'none'; l.style.strokeDashoffset = '0'; } else { l.style.strokeDasharray = `${segLen[k]!.toFixed(1)}`; l.style.strokeDashoffset = `${(segLen[k]! * (1 - s)).toFixed(1)}`; } l.style.opacity = s > 0 ? '1' : '0'; });
    // 4) nomes do Estudo 01 · 5) o marco de 2020
    const named = smoothstep(0.78, 0.88, e);
    const mark0 = smoothstep(0.84, 0.96, e);
    const lead0 = smoothstep(0.82, 0.92, e);
    const num0 = smoothstep(0.82, 0.95, e);

    // ===== Estudo 02 — a viagem =====
    const f = journeyFocus(j); // 0..5
    const near = Math.round(f);
    const fin = easeInOutSine(pullBack(j)); // recuo final
    const started = smoothstep(0, 0.02, j);
    // câmera: caminha pelo corpo entre a estação k e k+1, com o deslocamento de enquadramento interpolado; zoom em escala log
    const k0 = Math.min(Math.floor(f), RHYTHM.n - 1), u = f - k0;
    const A = stations[k0]!, B = stations[Math.min(k0 + 1, RHYTHM.n)]!;
    let cam: Camera;
    if (stations.length && j > 0) {
      const pt = pointAtArc(body, bodyAcc, lerp(A.arc, B.arc, u));
      const offA: [number, number] = [A.cam.cx - A.star[0], A.cam.cy - A.star[1]], offB: [number, number] = [B.cam.cx - B.star[0], B.cam.cy - B.star[1]];
      const z = logLerp(A.cam.z, B.cam.z, u);
      cam = { cx: pt[0] + lerp(offA[0], offB[0], u), cy: pt[1] + lerp(offA[1], offB[1], u), z };
      if (fin > 0) cam = { cx: lerp(cam.cx, W / 2, fin), cy: lerp(cam.cy, H / 2, fin), z: logLerp(cam.z, 1, fin) };
    } else cam = { cx: W / 2, cy: H / 2, z: 1 };
    chartG.setAttribute('transform', cameraTransform(cam, W, H, 1));
    field.setAttribute('transform', cameraTransform(cam, W, H, 0.78));
    // tamanhos em px de tela constantes: raio das estrelas ÷ zoom (só quando o zoom muda)
    const zKey = +cam.z.toFixed(3);
    if (zKey !== lastZ) {
      lastZ = zKey;
      const zf = 1 + (cam.z - 1) * lerp(1, 0.78, 0.6);
      dots.forEach((c, i) => c.setAttribute('r', (r0[i]! / (figureSet.has(i) ? cam.z : zf)).toFixed(3)));
      for (const rs of ringEls) for (const c of rs) c.setAttribute('r', (9 / cam.z).toFixed(3));
      const fs = (10.5 / cam.z).toFixed(3), fb = (12 / cam.z).toFixed(3);
      for (const l of [...baseLabels, ...markLabels.flat()]) { l.tx.style.fontSize = `${fs}px`; l.greek.style.fontSize = `${fb}px`; }
    }
    core.setAttribute('r', (lerp(3, starRadius(STARS[ANTARES]![2]) + 0.6, travel) / cam.z).toFixed(3));
    glow.setAttribute('r', (lerp(18, 46, smoothstep(0.18, 0.55, e)) / Math.sqrt(cam.z)).toFixed(1));
    glow.style.opacity = glowOp.toFixed(3);
    // nomes: a 12 px da estrela (em px de tela), do lado que aponta para fora da coluna
    const placeLabel = (l: { tx: SVGTextElement; i: number }, left: boolean) => { const [x, y] = pts[l.i]!; l.tx.setAttribute('x', (x + (left ? -12 : 12) / cam.z).toFixed(1)); l.tx.setAttribute('y', (y + 4 / cam.z).toFixed(1)); l.tx.setAttribute('text-anchor', left ? 'end' : 'start'); };
    const midX = W * 0.42 + W * 0.26;
    for (const l of baseLabels) { placeLabel(l, l.i !== ANTARES && pts[l.i]![0] > midX); l.tx.style.opacity = (named * (1 - started)).toFixed(3); }
    // marcos: ativação de cada um (1 no platô, cai no trajeto), nomes e anéis
    // um rótulo cabe na tela? (caixa em coordenadas da carta → px do palco)
    const fits = (tx: SVGTextElement) => { const b = tx.getBBox(); const x0 = W / 2 + (b.x - cam.cx) * cam.z, x1 = x0 + b.width * cam.z; return x0 >= 6 && x1 <= W - 6; };
    milestones.forEach((m, k) => {
      const act = k === 0 ? 0 : clamp(1 - Math.abs(f - k) * 2) * (1 - fin);
      const left = portrait ? m.framePortrait[0] > 0.5 : m.side === 'right'; // o nome do lado oposto à coluna (paisagem) ou para dentro da tela (retrato)
      for (const l of markLabels[k]!) {
        l.tx.style.opacity = act.toFixed(3);
        if (act <= 0) continue;
        // nunca cortado: se não cabe do lado preferido, vira; se não cabe de nenhum, perde a parte "· λ υ Sco"
        l.greek.style.display = ''; (l.greek.nextSibling as Text).textContent = ' Sco'; (l.greek.previousSibling as Text).textContent = `${m.star} · `;
        placeLabel(l, left);
        if (!fits(l.tx)) { placeLabel(l, !left); if (!fits(l.tx)) { l.greek.style.display = 'none'; (l.greek.nextSibling as Text).textContent = ''; (l.greek.previousSibling as Text).textContent = m.star; placeLabel(l, left); if (!fits(l.tx)) placeLabel(l, !left); } }
      }
      const lit = k === 0 ? 0 : Math.max(act, fin * 0.9 * (1 - 0.5 * smoothstep(0.85, 1, fin))); // no recuo as estrelas dos marcos ficam acesas (sem anel)
      for (const c of ringEls[k]!) c.style.opacity = (act * (1 - fin)).toFixed(3);
      for (const i of m.stars) if (i !== ANTARES) dots[i]!.setAttribute('fill', lit > 0 ? starColor(lerp(STARS[i]![3], 1.9, lit)) : starColor(STARS[i]![3]));
    });
    // coluna: o marco mais próximo; corte seco no meio do trajeto (como no Atlas); no 2020 a entrada do Estudo 01
    if (near !== currentMark && (j > 0 || currentMark !== 0)) { fillColumn(near); column.dataset.side = milestones[near]!.side; measureColumn(); }
    const tr = Math.abs(f - near);
    const cut = 1 - smoothstep(0.14, 0.5, tr);
    const colOp = near === 0 ? mark0 * (1 - smoothstep(0.02, 0.3, f)) : cut * (1 - fin);
    column.style.setProperty('--cut', '1');
    column.style.opacity = colOp.toFixed(3);
    column.style.transform = near === 0 ? `translateY(${((1 - mark0) * 18).toFixed(1)}px)` : `translateY(${((1 - cut) * 14).toFixed(1)}px)`;
    numeral.style.opacity = ((near === 0 ? num0 : cut) * 0.9 * (1 - fin)).toFixed(3);
    numeral.style.transform = near === 0 ? `translateX(${((1 - easeInOutSine(num0)) * 28).toFixed(1)}px)` : `translateX(${(-(f - near) * 40).toFixed(1)}px)`;
    // linha de chamada (só paisagem, só em movimento): da estrela do marco, em coordenadas do palco, ao lado da coluna
    if (!portrait && motion && stations.length) {
      const st = stations[near]!;
      const [sx, sy] = toStage(cam, near === 0 ? antares : st.star, W, H);
      const right = milestones[near]!.side === 'right';
      const ex = right ? colBox.x - 26 : colBox.x + colBox.w + 26, ey = Math.min(Math.max(sy, colBox.y + 12), colBox.y + colBox.h - 12);
      const len = Math.hypot(ex - sx, ey - sy);
      leader.setAttribute('x1', sx.toFixed(1)); leader.setAttribute('y1', sy.toFixed(1)); leader.setAttribute('x2', ex.toFixed(1)); leader.setAttribute('y2', ey.toFixed(1));
      const lead = near === 0 ? lead0 * (1 - smoothstep(0.02, 0.2, f)) : cut * (1 - fin);
      leader.style.strokeDasharray = `${len.toFixed(1)}`; leader.style.strokeDashoffset = `${(len * (1 - lead)).toFixed(1)}`; leader.style.opacity = lead > 0.002 ? '1' : '0'; // (fim do trilho em px fracionário: lead ≈ 0 é nada)
    } else leader.style.opacity = '0';
    indexEl.style.opacity = (started * (1 - fin)).toFixed(3);
    stage.dataset.e = e.toFixed(3); stage.dataset.j = j.toFixed(3); stage.dataset.z = cam.z.toFixed(3); stage.dataset.focus = f.toFixed(3);
  }
  q.subscribe((v) => render(v));

  // ----- navegação direta: rolagem NATIVA até o platô do marco -----
  const positionFor = (k: number) => track.scrollYFor(k === 0 ? S1 * 0.97 : S1 + plateauCenter(k) * (1 - S1));
  function goTo(k: number, smooth = true) {
    const idx = clamp(k, 0, milestones.length - 1);
    if (currentMode() === 'static') return;
    window.scrollTo({ top: positionFor(idx), behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' });
  }
  document.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement)?.closest('input, textarea, [role="dialog"]') || currentMode() === 'static') return;
    const y = window.scrollY;
    const zone = y >= positionFor(0) - 2 && y <= track.scrollYFor(S1 + journeyEnd() * (1 - S1)) + 2; // de 2020 ao último platô
    if (!zone) return;
    const k = Math.round(journeyFocus(remap(track.p, S1, 1)));
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goTo(k + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goTo(k - 1); }
    else if (/^[1-6]$/.test(e.key)) { e.preventDefault(); goTo(Number(e.key) - 1); }
  });

  let raf = 0;
  const relayout = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { track.measure(); layout(); }); };
  window.addEventListener('resize', relayout);
  onLang(() => { fillList(); if (W) { fillColumn(currentMark < 0 ? 0 : currentMark); relayout(); } });
  onMode((m) => { if (m === 'static') q.jump(1); relayout(); });
  stage.dataset.s1 = S1.toFixed(4);
  stage.dataset.stations = JSON.stringify(milestones.map((_, k) => (k === 0 ? S1 * 0.97 : S1 + plateauCenter(k) * (1 - S1))));
  stage.dataset.journeyEnd = (S1 + journeyEnd() * (1 - S1)).toFixed(4);
  fillList();
  track.measure();
  layout();

  return { track, relayout, positionFor, goTo };
}
