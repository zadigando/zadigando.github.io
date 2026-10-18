import { lerp, remap } from '../core/math';
const easeInOutQuart = (t: number): number => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);

/** Geometria pura da órbita: funções do progresso e do tamanho do palco, testáveis sem DOM. */
export interface Orbit { cx: number; cy: number; rx: number; ry: number; tilt: number; front: number }

export function orbitFor(W: number, H: number, portrait: boolean): Orbit {
  return portrait
    ? { cx: W * 0.5, cy: H * 0.54, rx: W * 0.5, ry: H * 0.16, tilt: 0, front: 270 }
    : { cx: W * 0.64, cy: H * 0.47, rx: W * 0.235, ry: H * 0.23, tilt: 12, front: 90 };
}

export function pointAt(o: Orbit, deg: number, k = 1): [number, number] {
  const a = (deg * Math.PI) / 180, t = (o.tilt * Math.PI) / 180;
  const x = o.rx * k * Math.cos(a), y = o.ry * k * Math.sin(a);
  return [o.cx + x * Math.cos(t) - y * Math.sin(t), o.cy + x * Math.sin(t) + y * Math.cos(t)];
}

/** Profundidade 0 (fundo) .. 1 (frente) de um ângulo, dado o ângulo da frente. */
export function depthAt(o: Orbit, deg: number): number {
  const d = ((deg - o.front) * Math.PI) / 180;
  return (1 + Math.cos(d)) / 2;
}

export function ellipsePath(o: Orbit, k = 1, steps = 144): string {
  let d = '';
  for (let i = 0; i <= steps; i++) { const [x, y] = pointAt(o, (i * 360) / steps, k); d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }
  return d + 'Z';
}

/** Patamares do trilho do atlas: cada mundo tem um platô; entre platôs, a órbita gira 90°. */
/** Fração inicial do trilho em que o palco anterior ainda cobre este (sobreposição de uma tela). */
let offset = 0;
export function setTrackOffset(q0: number): void { offset = q0; }
export const SETTLE = 0.17;
export const settleRange = (): [number, number] => [offset, offset + SETTLE];
export const PLATEAU = 0.16, TRANSITION = 0.085;
export function plateauStart(i: number): number { return offset + SETTLE + i * (PLATEAU + TRANSITION); }
export function plateauCenter(i: number): number { return Math.min(1, plateauStart(i) + PLATEAU / 2); }
/** foco contínuo 0..3 em função do progresso do trilho */
export function focusAt(q: number): number {
  let f = 0;
  for (let i = 0; i < 3; i++) {
    const a = plateauStart(i) + PLATEAU, b = a + TRANSITION;
    f += easeInOutQuart(remap(q, a, b));
  }
  return f;
}
export const nearestFocus = (q: number): number => Math.round(focusAt(q));
/** ângulo do mundo i para um foco contínuo f */
export const angleOf = (o: Orbit, i: number, f: number): number => o.front + (i - f) * 90;
/** escala por profundidade (frente = 1) */
export const scaleAt = (d: number, min: number): number => lerp(min, 1, d * d);
