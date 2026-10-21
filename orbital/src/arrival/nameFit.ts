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
  // Contraforma medida no raster do próprio glifo (não por proporção fixa): varre a linha média e a coluna
  // central do D e encontra o vão entre a haste e o bojo. Em escala reduzida para custar pouco.
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
  return { size, limitedBy, texts: visible, portal, others, block, ink, counter, gaps };
}
