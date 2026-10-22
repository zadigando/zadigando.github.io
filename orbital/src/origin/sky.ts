import { clamp, hex, lerp, logLerp, mix, remap, type Box, type RGB } from '../core/math';
export { logLerp };
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

// ===== Study 02 — a viagem pelo corpo: polilinha real, estações e câmera (puro) =====
export interface Camera { cx: number; cy: number; z: number }
const easeInOutQuart = (t: number): number => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);

/** Comprimentos acumulados de uma polilinha (pontos em px). */
export function arcLengths(path: ReadonlyArray<[number, number]>): number[] {
  const acc = [0];
  for (let i = 1; i < path.length; i++) acc.push(acc[i - 1]! + Math.hypot(path[i]![0] - path[i - 1]![0], path[i]![1] - path[i - 1]![1]));
  return acc;
}
/** Ponto da polilinha à distância `s` do início (limitado às pontas). */
export function pointAtArc(path: ReadonlyArray<[number, number]>, acc: readonly number[], s: number): [number, number] {
  const total = acc[acc.length - 1]!;
  const d = clamp(s, 0, total);
  let i = 1; while (i < acc.length - 1 && acc[i]! < d) i++;
  const a = path[i - 1]!, b = path[i]!, seg = acc[i]! - acc[i - 1]!;
  const t = seg > 0 ? (d - acc[i - 1]!) / seg : 0;
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

/** Ritmo da viagem: n marcos depois do primeiro, cada um com trajeto `T` e platô `P` (frações de 0..1); o resto é o recuo final. */
export interface Rhythm { n: number; T: number; P: number }
export const RHYTHM: Rhythm = { n: 5, T: 42 / 480, P: 40 / 480 };
export const travelStart = (k: number, r: Rhythm = RHYTHM): number => (k - 1) * (r.T + r.P);
export const plateauCenter = (k: number, r: Rhythm = RHYTHM): number => (k === 0 ? 0 : travelStart(k, r) + r.T + r.P / 2);
export const journeyEnd = (r: Rhythm = RHYTHM): number => r.n * (r.T + r.P);
/** foco contínuo 0..n: inteiro nos platôs, easeInOutQuart nos trajetos (o mesmo ritmo do Atlas) */
export function journeyFocus(j: number, r: Rhythm = RHYTHM): number {
  let f = 0;
  for (let k = 1; k <= r.n; k++) f += easeInOutQuart(remap(j, travelStart(k, r), travelStart(k, r) + r.T));
  return f;
}
/** recuo final 0..1 depois do último platô */
export const pullBack = (j: number, r: Rhythm = RHYTHM): number => remap(j, journeyEnd(r), 1);

/** Centro da câmera (coordenadas da carta) que põe `star` na fração `frame` do palco com zoom `z`. */
export function cameraFor(star: [number, number], frame: [number, number], z: number, W: number, H: number): Camera {
  return { cx: star[0] - ((frame[0] - 0.5) * W) / z, cy: star[1] - ((frame[1] - 0.5) * H) / z, z };
}
/** Transformação SVG do grupo da carta para uma câmera (o palco é W×H). Fator < 1 = camada mais distante (paralaxe). */
export function cameraTransform(c: Camera, W: number, H: number, depth = 1): string {
  const cx = lerp(W / 2, c.cx, depth), cy = lerp(H / 2, c.cy, depth), z = 1 + (c.z - 1) * lerp(1, depth, 0.6);
  return `translate(${(W / 2 - cx * z).toFixed(2)} ${(H / 2 - cy * z).toFixed(2)}) scale(${z.toFixed(4)})`;
}
/** Posição no palco de um ponto da carta sob a câmera. */
export const toStage = (c: Camera, p: [number, number], W: number, H: number): [number, number] => [W / 2 + (p[0] - c.cx) * c.z, H / 2 + (p[1] - c.cy) * c.z];

