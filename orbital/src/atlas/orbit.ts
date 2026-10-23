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

/**
 * RITMO do Atlas em svh (altura útil da tela): o assentamento (revelação Arrival → Atlas), o platô de cada mundo,
 * a transição entre mundos (a órbita gira 90°) e o último platô (MM Editorial, até The Origin assumir).
 * `ease`: curva do foco na transição. `drift`: deriva mínima da mídia em foco dentro do platô (resposta contínua ao gesto).
 * Presets do estudo de ritmo (`?atlas=current|a|b`): o atual é o baseline aprovado; A ≈ −24 %, B ≈ −35 % de rolagem.
 */
export interface AtlasRhythm { settle: number; plateau: number; transition: number; last: number; ease: 'quart' | 'cubic' | 'sine'; drift: number }
export const RHYTHMS: Record<string, AtlasRhythm> = {
  current: { settle: 105.4, plateau: 99.2, transition: 52.7, last: 58.9, ease: 'quart', drift: 0 }, // = 0,17 · 0,16 · 0,085 de 620 svh
  a: { settle: 96, plateau: 52, transition: 56, last: 52, ease: 'sine', drift: 10 },
  b: { settle: 90, plateau: 42, transition: 49, last: 42, ease: 'sine', drift: 10 },
};
let R: AtlasRhythm = RHYTHMS.current!;
export function setRhythm(name: string): AtlasRhythm { R = RHYTHMS[name] ?? RHYTHMS.current!; return R; }
export const rhythm = (): AtlasRhythm => R;
/** trajeto total em svh (sem a cauda nem o palco) */
export const travelSvh = (): number => R.settle + 3 * (R.plateau + R.transition) + R.last;
const frac = (svh: number) => svh / travelSvh();
export const settleRange = (): [number, number] => [offset, offset + frac(R.settle)];
export const plateauFrac = (): number => frac(R.plateau);
export const transitionFrac = (): number => frac(R.transition);
export function plateauStart(i: number): number { return offset + frac(R.settle) + i * (frac(R.plateau) + frac(R.transition)); }
export function plateauCenter(i: number): number { return Math.min(1, plateauStart(i) + Math.min(frac(R.plateau), i === 3 ? frac(R.last) : frac(R.plateau)) / 2); }
/** posição 0..1 dentro do platô do mundo i (0 = entrou, 1 = vai sair); fora do platô, limitado */
export function plateauProgress(q: number, i: number): number { const a = plateauStart(i); return remap(q, a, a + (i === 3 ? frac(R.last) : frac(R.plateau))); }
const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;
const EASES = { quart: easeInOutQuart, cubic: easeInOutCubic, sine: easeInOutSine };
/** foco contínuo 0..3 em função do progresso do trilho */
export function focusAt(q: number): number {
  let f = 0;
  const ease = EASES[R.ease];
  for (let i = 0; i < 3; i++) {
    const a = plateauStart(i) + frac(R.plateau), b = a + frac(R.transition);
    f += ease(remap(q, a, b));
  }
  return f;
}
export const nearestFocus = (q: number): number => Math.round(focusAt(q));
/** ângulo do mundo i para um foco contínuo f */
export const angleOf = (o: Orbit, i: number, f: number): number => o.front + (i - f) * 90;
/** escala por profundidade (frente = 1) */
export const scaleAt = (d: number, min: number): number => lerp(min, 1, d * d);
