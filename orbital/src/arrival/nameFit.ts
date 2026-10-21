/**
 * Composição do nome em SVG: cada linha enche a medida pelo EIXO DE LARGURA da fonte variável
 * (sem distorcer glifos). O corpo é limitado pela largura E pela altura útil (faixa entre o cabeçalho
 * e a margem inferior): quando a altura manda, o eixo de largura (até o máximo da fonte) e um ajuste
 * discreto de tracking enchem a medida. Mede a caixa de tinta do D que vira janela com o canvas.
 */
export interface FitOptions {
  lines: string[];
  width: number;
  gutter: number;
  /** fração da largura útil que o nome ocupa */
  fill: number;
  /** faixa vertical disponível (unidades SVG): o bloco de tinta é colocado nela */
  band: { top: number; bottom: number };
  /** fração da folga vertical que fica ACIMA do bloco (0,5 = centro geométrico) */
  bias: number;
  lineHeight: number;
  minStretch: number;
  maxStretch: number;
  /** tracking adicional máximo (em) usado só quando o eixo de largura satura */
  maxTracking: number;
  weight: number;
  family: string;
  /** linha e caractere do D que vira janela */
  window: { line: number; char: number };
}
export interface Rect { x: number; y: number; w: number; h: number }
export interface Fit {
  size: number;
  /** qual limite definiu o corpo */
  limitedBy: 'width' | 'height';
  /** todos os <text> visíveis (o D do portal é um elemento próprio) */
  texts: SVGTextElement[];
  /** o glifo-janela (portal), isolado para ficar em cena sozinho durante a travessia */
  portal: SVGTextElement;
  /** os demais glifos, que saem de cena antes de poderem cruzar o quadro */
  others: SVGTextElement[];
  /** caixa de tinta do bloco inteiro (unidades SVG) */
  block: Rect;
  /** caixa de tinta do glifo-janela */
  ink: Rect;
  /** contraforma (abertura) do D */
  counter: Rect;
  /** vão medido linha a linha (unidades SVG): y, x0 (fim da haste), x1 (início do bojo) */
  gaps: Array<{ y: number; x0: number; x1: number }>;
}

const NS = 'http://www.w3.org/2000/svg';
/** `fontStretch` do canvas aceita porcentagens (Chrome 110+, Safari 17.4+); o tipo da lib só lista palavras-chave. */
const canStretch = 'fontStretch' in CanvasRenderingContext2D.prototype;
const setStretch = (c: CanvasRenderingContext2D, v: string): void => { (c as unknown as Record<string, string>).fontStretch = v; };

/** Altura de versal da fonte (fração do corpo), medida no canvas; 0,72 se a medição não existir. */
function capRatio(weight: number, family: string): number {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = `${weight} 100px ${family}`;
  const a = ctx.measureText('H').actualBoundingBoxAscent;
  return a > 50 && a < 100 ? a / 100 : 0.72;
}

export function fitName(svg: SVGSVGElement, group: SVGGElement, o: FitOptions): Fit {
  group.replaceChildren();
  const probe = document.createElementNS(NS, 'text');
  probe.setAttribute('x', '-99999');
  svg.appendChild(probe);
  const widthOf = (s: string, size: number, stretch: number, tracking = 0) => {
    probe.textContent = s; probe.style.fontSize = `${size}px`; probe.style.fontStretch = `${stretch}%`;
    probe.style.letterSpacing = tracking ? `${tracking}px` : '';
    return probe.getComputedTextLength();
  };
  const avail = (o.width - o.gutter * 2) * o.fill;
  const widest = Math.max(...o.lines.map((l) => widthOf(l, 100, 100)));
  const sizeW = (100 * avail) / widest;
  // altura: (n−1) entrelinhas + uma versal têm de caber na faixa
  const cap = capRatio(o.weight, o.family);
  const n = o.lines.length;
  const bandH = o.band.bottom - o.band.top;
  const sizeH = bandH / ((n - 1) * o.lineHeight + cap);
  const size = Math.min(sizeW, sizeH);
  const limitedBy: Fit['limitedBy'] = sizeH < sizeW ? 'height' : 'width';
  const lh = size * o.lineHeight;
  const inkH = (n - 1) * lh + cap * size;
  // centro óptico: um pouco acima do centro geométrico da faixa (mais no retrato, onde sobra altura)
  const firstBaseline = o.band.top + (bandH - inkH) * o.bias + cap * size;

  const texts: SVGTextElement[] = [];
  o.lines.forEach((line, i) => {
    // 1) eixo de largura até encher a medida
    let lo = o.minStretch, hi = o.maxStretch, st = 100;
    for (let k = 0; k < 16; k++) {
      const mid = (lo + hi) / 2;
      if (widthOf(line, size, mid) > avail) hi = mid; else { st = mid; lo = mid; }
    }
    // 2) se o eixo saturou perto da medida (≥ 85 %), um tracking discreto (limitado) aproxima a linha do alinhamento;
    //    linhas curtas por desenho (p. ex. "DE" no retrato) ficam como estão. O espaçamento final (invisível) não conta.
    let tracking = 0;
    const w0 = widthOf(line, size, st);
    if (w0 < avail - 0.5 && w0 >= avail * 0.85 && line.length > 1) {
      let tlo = 0, thi = o.maxTracking * size;
      for (let k = 0; k < 14; k++) {
        const mid = (tlo + thi) / 2;
        if (widthOf(line, size, st, mid) - mid > avail) thi = mid; else { tracking = mid; tlo = mid; }
      }
    }
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', String(o.gutter));
    t.setAttribute('y', String(firstBaseline + lh * i));
    t.style.fontSize = `${size}px`;
    t.style.fontStretch = `${st}%`;
    if (tracking) t.style.letterSpacing = `${tracking.toFixed(2)}px`;
    t.textContent = line;
    group.appendChild(t);
    texts.push(t);
  });
  probe.remove();
  const block: Rect = { x: o.gutter, y: firstBaseline - cap * size, w: avail, h: inkH };

  const target = texts[o.window.line]!;
  const ch = target.textContent!.charAt(o.window.char);
  const start = target.getStartPositionOfChar(o.window.char);
  // O glifo-janela vira um <text> próprio, na posição exata que tinha na linha; o resto da linha começa onde o
  // caractere seguinte começava (o kerning do par fica preservado pela medição). Render idêntico, elementos separados.
  const line = target.textContent!;
  const portal = target.cloneNode(false) as SVGTextElement;
  portal.textContent = ch; portal.setAttribute('x', String(start.x));
  const rest = target.cloneNode(false) as SVGTextElement;
  rest.textContent = line.slice(o.window.char + 1);
  if (rest.textContent) rest.setAttribute('x', String(target.getStartPositionOfChar(o.window.char + 1).x));
  target.replaceWith(portal); if (rest.textContent) portal.after(rest);
  const visible = texts.flatMap((t) => (t === target ? (rest.textContent ? [portal, rest] : [portal]) : [t]));
  const others = visible.filter((t) => t !== portal);
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  const font = `${o.weight} ${size}px ${o.family}`;
  ctx.font = font;
  if (canStretch) setStretch(ctx, target.style.fontStretch);
  // sem fontStretch no canvas (navegadores antigos): aproxima o eixo de largura por escala horizontal
  const kx = canStretch ? 1 : target.getExtentOfChar(o.window.char).width / Math.max(1, ctx.measureText(ch).width);
  const m = ctx.measureText(ch);
  const ink: Rect = {
    x: start.x - m.actualBoundingBoxLeft * kx,
    y: start.y - m.actualBoundingBoxAscent,
    w: (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) * kx,
    h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
  };
  // Contraforma medida no raster do próprio glifo (não por proporção fixa): varre linha a linha e encontra o vão
  // entre a haste e o bojo. Em escala reduzida para custar pouco. (Primeira aproximação, síncrona, via canvas;
  // `refineCounter` refaz a medição a partir da renderização SVG real.)
  const S = 256 / Math.max(ink.w, ink.h);
  const cw = Math.ceil(ink.w * S) + 4, chh = Math.ceil(ink.h * S) + 4;
  const c2 = document.createElement('canvas'); c2.width = cw; c2.height = chh;
  const g = c2.getContext('2d', { willReadFrequently: true })!;
  g.font = `${o.weight} ${size * S}px ${o.family}`;
  if (canStretch) setStretch(g, target.style.fontStretch);
  g.fillStyle = '#fff';
  g.save(); g.scale(kx, 1);
  g.fillText(ch, (m.actualBoundingBoxLeft * S * kx + 2) / kx, m.actualBoundingBoxAscent * S + 2);
  g.restore();
  const measured = counterFromRaster(g.getImageData(0, 0, cw, chh).data, cw, chh, (rx, ry) => [ink.x + (rx - 2) / S, ink.y + (ry - 2) / S]) ?? { ink, counter: { x: ink.x + ink.w * 0.21, y: ink.y + ink.h * 0.145, w: ink.w * 0.58, h: ink.h * 0.71 }, gaps: [] };
  return { size, limitedBy, texts: visible, portal, others, block, ink: measured.ink, counter: measured.counter, gaps: measured.gaps };
}

/** Caixa de tinta, vãos linha a linha e contraforma a partir de um raster (alfa > 128), já convertidos a unidades SVG. */
function counterFromRaster(px: Uint8ClampedArray, cw: number, chh: number, toUnits: (rx: number, ry: number) => [number, number]): { ink: Rect; counter: Rect; gaps: Fit['gaps'] } | null {
  const on = (x: number, y: number) => px[(y * cw + x) * 4 + 3]! > 128;
  let x0 = cw, x1 = -1, y0 = chh, y1 = -1;
  for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) if (on(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const [ix, iy] = toUnits(x0, y0), [jx, jy] = toUnits(x1 + 1, y1 + 1);
  const ink: Rect = { x: ix, y: iy, w: jx - ix, h: jy - iy };
  const gapRow = (y: number): [number, number] | null => {
    let x = x0; while (x <= x1 && !on(x, y)) x++; while (x <= x1 && on(x, y)) x++; const a = x; while (x <= x1 && !on(x, y)) x++;
    return x <= x1 && x > a ? [a, x] : null;
  };
  const gaps: Fit['gaps'] = [];
  for (let yy = y0; yy <= y1; yy += 2) {
    const r = gapRow(yy);
    if (r) { const [gx0, gy] = toUnits(r[0], yy); const [gx1] = toUnits(r[1], yy); gaps.push({ y: gy, x0: gx0, x1: gx1 }); }
  }
  const mid = gaps.filter((g) => g.y > ink.y + ink.h * 0.3 && g.y < ink.y + ink.h * 0.7);
  if (!mid.length || gaps.length < 4) return null;
  const cx0 = Math.max(...mid.map((g) => g.x0)), cx1 = Math.min(...mid.map((g) => g.x1));
  const [, rowH] = toUnits(0, 2); const [, row0] = toUnits(0, 0);
  const counter: Rect = { x: cx0, y: gaps[0]!.y, w: cx1 - cx0, h: gaps[gaps.length - 1]!.y + (rowH - row0) - gaps[0]!.y };
  return { ink, counter, gaps };
}

let rasterFace: Promise<FontFace> | null = null;
/** A webfont carregada de novo, pelos bytes, como FontFace própria ('ZdbRaster'): o canvas usa exatamente esta fonte. */
function rasterFont(url: string): Promise<FontFace> {
  rasterFace ??= fetch(url).then((r) => r.arrayBuffer()).then(async (buf) => {
    const face = new FontFace('ZdbRaster', buf, { weight: '100 900', stretch: '62% 125%' });
    await face.load(); document.fonts.add(face); return face;
  });
  return rasterFace;
}

/** Proporções do D da Archivo ExtraBold (medidas no raster) em relação à caixa de avanço do glifo real — último recurso. */
/** (em relação ao CORPO, não ao avanço: o eixo de largura muda o avanço mas quase não muda a tinta do D) */
const D_RATIOS = { inkX: 0.017, inkW: 0.655, inkTop: 0.672, counterX: 0.364, counterW: 0.37, counterY: 0.09, counterH: 0.826 };

export type CounterSource = 'canvas' | 'fontface' | 'ratio';
export async function refineCounter(f: Fit, o: FitOptions, fontUrl: string): Promise<{ fit: Fit; source: CounterSource; advanceDelta: number } | null> {
  try {
    const portal = f.portal, ch = portal.textContent!, size = f.size;
    const ext = portal.getExtentOfChar(0);
    const baseline = +portal.getAttribute('y')!;
    const ls = parseFloat(getComputedStyle(portal).letterSpacing) || 0;
    const liveAdvance = ext.width - ls; // avanço do glifo real, sem o espaçamento
    await rasterFont(fontUrl);
    const S = 256 / Math.max(ext.width, ext.height);
    const pad = Math.ceil(0.12 * size * S);
    const cw = Math.ceil(ext.width * S) + pad * 2, chh = Math.ceil(ext.height * S) + pad * 2;
    const c = document.createElement('canvas'); c.width = cw; c.height = chh;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.font = `${o.weight} ${(size * S).toFixed(2)}px ZdbRaster`;
    if (canStretch) setStretch(g, portal.style.fontStretch || '100%');
    // o avanço no canvas tem de bater com o do glifo real: se não bate, o canvas não está usando a mesma fonte/eixo
    const adv = g.measureText(ch).width / S;
    const advanceDelta = Math.abs(adv - liveAdvance) / liveAdvance;
    if (advanceDelta <= 0.03) {
      g.fillStyle = '#fff'; g.fillText(ch, pad, (baseline - ext.y) * S + pad); // x = pad ⇒ origem do glifo; y = baseline no raster
      const r = counterFromRaster(g.getImageData(0, 0, cw, chh).data, cw, chh, (rx, ry) => [ext.x + (rx - pad) / S, ext.y + (ry - pad) / S]);
      if (r && r.ink.w > ext.width * 0.5 && r.ink.w < ext.width * 1.3) return { fit: { ...f, ink: r.ink, counter: r.counter, gaps: r.gaps }, source: 'fontface', advanceDelta };
    }
    // último recurso: proporções conhecidas do D, ancoradas na caixa de avanço do glifo REAL (nunca numa fonte substituta)
    const R = D_RATIOS;
    const ink: Rect = { x: ext.x + R.inkX * size, y: baseline - R.inkTop * size, w: R.inkW * size, h: R.inkTop * size };
    const counter: Rect = { x: ink.x + R.counterX * ink.w, y: ink.y + R.counterY * ink.h, w: R.counterW * ink.w, h: R.counterH * ink.h };
    const gaps: Fit['gaps'] = []; for (let k = 0; k <= 20; k++) gaps.push({ y: counter.y + (counter.h * k) / 20, x0: counter.x, x1: counter.x + counter.w });
    return { fit: { ...f, ink, counter, gaps }, source: 'ratio', advanceDelta };
  } catch { return null; }
}