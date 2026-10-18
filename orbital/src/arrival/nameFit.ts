/**
 * Composição do nome em SVG: cada linha enche a medida pelo EIXO DE LARGURA da fonte variável
 * (sem distorcer glifos). Mede a caixa de tinta do D que vira janela com o canvas (actualBoundingBox).
 */
export interface FitOptions {
  lines: string[];
  width: number;
  height: number;
  gutter: number;
  /** fração da largura útil que o nome ocupa */
  fill: number;
  top: number;
  lineHeight: number;
  minStretch: number;
  maxStretch: number;
  weight: number;
  family: string;
  /** linha e caractere do D que vira janela */
  window: { line: number; char: number };
}
export interface Rect { x: number; y: number; w: number; h: number }
export interface Fit {
  size: number;
  texts: SVGTextElement[];
  /** caixa de tinta do glifo-janela */
  ink: Rect;
  /** contraforma (abertura) do D */
  counter: Rect;
  /** vão medido linha a linha (unidades SVG): y, x0 (fim da haste), x1 (início do bojo) */
  gaps: Array<{ y: number; x0: number; x1: number }>;
}

const NS = 'http://www.w3.org/2000/svg';

export function fitName(svg: SVGSVGElement, group: SVGGElement, o: FitOptions): Fit {
  group.replaceChildren();
  const probe = document.createElementNS(NS, 'text');
  probe.setAttribute('x', '-99999');
  svg.appendChild(probe);
  const widthOf = (s: string, size: number, stretch: number) => {
    probe.textContent = s; probe.style.fontSize = `${size}px`; probe.style.fontStretch = `${stretch}%`;
    return probe.getComputedTextLength();
  };
  const avail = (o.width - o.gutter * 2) * o.fill;
  const widest = Math.max(...o.lines.map((l) => widthOf(l, 100, 100)));
  const size = (100 * avail) / widest;
  const lh = size * o.lineHeight;
  const texts: SVGTextElement[] = [];
  o.lines.forEach((line, i) => {
    let lo = o.minStretch, hi = o.maxStretch, st = 100;
    for (let k = 0; k < 16; k++) {
      const mid = (lo + hi) / 2;
      if (widthOf(line, size, mid) > avail) hi = mid; else { st = mid; lo = mid; }
    }
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', String(o.gutter));
    t.setAttribute('y', String(o.top + lh * i + size * 0.74));
    t.style.fontSize = `${size}px`;
    t.style.fontStretch = `${st}%`;
    t.textContent = line;
    group.appendChild(t);
    texts.push(t);
  });
  probe.remove();

  const target = texts[o.window.line]!;
  const ch = target.textContent!.charAt(o.window.char);
  const start = target.getStartPositionOfChar(o.window.char);
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  const font = `${o.weight} ${size}px ${o.family}`;
  ctx.font = font;
  (ctx as unknown as { fontStretch: string }).fontStretch = target.style.fontStretch;
  const m = ctx.measureText(ch);
  const ink: Rect = {
    x: start.x - m.actualBoundingBoxLeft,
    y: start.y - m.actualBoundingBoxAscent,
    w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
    h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
  };
  // Contraforma medida no raster do próprio glifo (não por proporção fixa): varre a linha média e a coluna
  // central do D e encontra o vão entre a haste e o bojo. Em escala reduzida para custar pouco.
  const S = 256 / Math.max(ink.w, ink.h);
  const cw = Math.ceil(ink.w * S) + 4, chh = Math.ceil(ink.h * S) + 4;
  const c2 = document.createElement('canvas'); c2.width = cw; c2.height = chh;
  const g = c2.getContext('2d', { willReadFrequently: true })!;
  g.font = `${o.weight} ${size * S}px ${o.family}`;
  (g as unknown as { fontStretch: string }).fontStretch = target.style.fontStretch;
  g.fillStyle = '#fff';
  g.fillText(ch, m.actualBoundingBoxLeft * S + 2, m.actualBoundingBoxAscent * S + 2);
  const px = g.getImageData(0, 0, cw, chh).data;
  const on = (x: number, y: number) => px[(y * cw + x) * 4 + 3]! > 128;
  const gapRow = (y: number): [number, number] | null => {
    let x = 0; while (x < cw && !on(x, y)) x++; while (x < cw && on(x, y)) x++; const a = x; while (x < cw && !on(x, y)) x++;
    return x < cw && x > a ? [a, x] : null;
  };
  const gaps: Fit['gaps'] = [];
  for (let yy = 2; yy < chh - 2; yy += 2) {
    const r = gapRow(yy);
    if (r) gaps.push({ y: ink.y + (yy - 2) / S, x0: ink.x + (r[0] - 2) / S, x1: ink.x + (r[1] - 2) / S });
  }
  let counter: Rect;
  const mid = gaps.filter((g) => g.y > ink.y + ink.h * 0.3 && g.y < ink.y + ink.h * 0.7);
  if (mid.length) {
    const x0 = Math.max(...mid.map((g) => g.x0)), x1 = Math.min(...mid.map((g) => g.x1));
    const y0 = gaps[0]!.y, y1 = gaps[gaps.length - 1]!.y + 2 / S;
    counter = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  } else {
    counter = { x: ink.x + ink.w * 0.21, y: ink.y + ink.h * 0.145, w: ink.w * 0.58, h: ink.h * 0.71 };
  }
  return { size, texts, ink, counter, gaps };
}
