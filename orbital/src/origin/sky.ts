import { clamp, hex, lerp, mix, type Box, type RGB } from '../core/math';
import { ANTARES, LINES, SCORPIUS_CENTER, STARS } from '../content/scorpius';

/**
 * Carta celeste pura (sem DOM): projeção estereográfica das posições reais, orientação e ajuste da figura ao palco.
 * Convenção de carta: norte para cima, leste para a ESQUERDA (o céu visto de baixo, não um mapa). A rotação é a
 * única liberdade artística — equivale a escolher a hora e a latitude da observação; as posições relativas são reais.
 */
export interface Chart { scale: number; ox: number; oy: number; rot: number }

const RAD = Math.PI / 180;

/** Projeção estereográfica (graus → graus no plano tangente), centrada em `center` [AR, Dec] e rodada `rot` graus. */
export function project(raDeg: number, decDeg: number, center: [number, number] = SCORPIUS_CENTER, rot = 0): [number, number] {
  const ra = raDeg * RAD, dec = decDeg * RAD, r0 = center[0] * RAD, d0 = center[1] * RAD;
  const k = 2 / (1 + Math.sin(d0) * Math.sin(dec) + Math.cos(d0) * Math.cos(dec) * Math.cos(ra - r0));
  const xi = k * Math.cos(dec) * Math.sin(ra - r0);
  const eta = k * (Math.cos(d0) * Math.sin(dec) - Math.sin(d0) * Math.cos(dec) * Math.cos(ra - r0));
  // tela: x cresce para a direita (= oeste, ξ negativo), y cresce para baixo (= sul, η negativo)
  const x = -xi / RAD, y = -eta / RAD;
  const c = Math.cos(rot * RAD), s = Math.sin(rot * RAD);
  return [x * c - y * s, x * s + y * c];
}

/** Posições (graus no plano) de todas as estrelas para uma rotação. */
export function projectAll(rot: number): Array<[number, number]> {
  return STARS.map((s) => project(s[0], s[1], SCORPIUS_CENTER, rot));
}

/** Ajusta a caixa da FIGURA (índices `fig`) à caixa `box` do palco, preservando proporção, com margem `pad` (px). */
export function fitFigure(pts: ReadonlyArray<[number, number]>, fig: ReadonlyArray<number>, box: Box, pad = 24, rot = 0): Chart {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const i of fig) { const [x, y] = pts[i]!; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const w = Math.max(1e-6, x1 - x0), h = Math.max(1e-6, y1 - y0);
  const scale = Math.min((box.w - pad * 2) / w, (box.h - pad * 2) / h);
  const ox = box.x + box.w / 2 - ((x0 + x1) / 2) * scale;
  const oy = box.y + box.h / 2 - ((y0 + y1) / 2) * scale;
  return { scale, ox, oy, rot };
}

export const toScreen = (c: Chart, p: [number, number]): [number, number] => [c.ox + p[0] * c.scale, c.oy + p[1] * c.scale];

/** Raio (px) por magnitude: as brilhantes maiores, as fracas quase pontos. */
export const starRadius = (mag: number): number => clamp(3.4 - 0.55 * mag, 0.55, 3.4);
/** Alfa de base por magnitude (a revelação progressiva multiplica isto). */
export const starAlpha = (mag: number): number => clamp(1.05 - 0.13 * mag, 0.22, 1);

const BLUE: RGB = hex('#cfe0ff'), BONE: RGB = hex('#f1ece2'), WARM: RGB = hex('#ffb870');
/** Cor por índice B−V: azulada (< 0,2), osso (≈ 0,6), âmbar (> 1,2). Antares, B−V 1,86, cai na cor quente do portfólio. */
export function starColor(ci: number): string {
  if (ci < 0.6) return mix(BLUE, BONE, clamp((ci + 0.3) / 0.9));
  return mix(BONE, WARM, clamp((ci - 0.6) / 1.1));
}

/** Magnitude-limite da revelação em função de 0..1 (a vista adaptando-se ao escuro: as brilhantes primeiro). */
export const limitAt = (t: number): number => lerp(0.4, 6.9, t); // 6,9: a faixa mais fraca (≤ 6,0) chega à opacidade cheia
/** Opacidade de uma faixa de magnitude `m` para o limite `lim`. */
export const binOpacity = (m: number, lim: number): number => clamp((lim - m) / 0.9);

/** Distância (em segmentos) de cada traço da figura até Antares: a figura se revela a partir do coração. */
export function segmentDepths(lines: ReadonlyArray<[number, number]> = LINES, from = ANTARES): number[] {
  const dist = new Map<number, number>([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const a = queue.shift()!;
    for (const [p, q] of lines) {
      const other = p === a ? q : q === a ? p : null;
      if (other !== null && !dist.has(other)) { dist.set(other, dist.get(a)! + 1); queue.push(other); }
    }
  }
  return lines.map(([p, q]) => Math.min(dist.get(p) ?? 99, dist.get(q) ?? 99));
}
