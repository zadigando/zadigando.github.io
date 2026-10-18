export const clamp = (v: number, min = 0, max = 1): number => Math.min(max, Math.max(min, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** 0..1 entre `a` e `b` (clamp fora do intervalo). */
export const remap = (v: number, a: number, b: number): number => (b === a ? (v >= b ? 1 : 0) : clamp((v - a) / (b - a)));
export const smoothstep = (e0: number, e1: number, x: number): number => { const t = remap(x, e0, e1); return t * t * (3 - 2 * t); };
export const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;
/** Interpolação em escala logarítmica: um zoom com velocidade perceptual constante. */
export const logLerp = (a: number, b: number, t: number): number => Math.exp(lerp(Math.log(a), Math.log(b), t));
/** Amortecimento exponencial independente do frame rate. */
export const damp = (current: number, target: number, lambda: number, dt: number): number => current + (target - current) * (1 - Math.exp(-lambda * dt));

export type RGB = [number, number, number];
export const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const mix = (a: RGB, b: RGB, t: number): string => `rgb(${Math.round(lerp(a[0], b[0], t))} ${Math.round(lerp(a[1], b[1], t))} ${Math.round(lerp(a[2], b[2], t))})`;

export interface Box { x: number; y: number; w: number; h: number }
/** Imagem (pw×ph) cobrindo a caixa, com o ponto focal (0..1) o mais perto possível do centro da caixa. */
export function coverRect(pw: number, ph: number, box: Box, focal: [number, number]): Box {
  const s = Math.max(box.w / pw, box.h / ph);
  const w = pw * s, h = ph * s;
  const x = clamp(box.x + box.w / 2 - focal[0] * w, box.x + box.w - w, box.x);
  const y = clamp(box.y + box.h / 2 - focal[1] * h, box.y + box.h - h, box.y);
  return { x, y, w, h };
}

/** object-position (em %) que reproduz `coverRect` para a mesma caixa (para <img> com object-fit: cover). */
export function objectPositionFor(pw: number, ph: number, box: Box, focal: [number, number]): string {
  const r = coverRect(pw, ph, box, focal);
  const px = r.w > box.w + 0.5 ? ((r.x - box.x) / (box.w - r.w)) * 100 : 50;
  const py = r.h > box.h + 0.5 ? ((r.y - box.y) / (box.h - r.h)) * 100 : 50;
  return `${px.toFixed(2)}% ${py.toFixed(2)}%`;
}

/** Como `coverRect`, mas nunca menor que `minW` de largura: frestas mostram um recorte do mundo NA MESMA ESCALA da frente. */
export function coverRectMin(pw: number, ph: number, box: Box, focal: [number, number], minW: number): Box {
  const s = Math.max(box.w / pw, box.h / ph, minW / pw);
  const w = pw * s, h = ph * s;
  const x = clamp(box.x + box.w / 2 - focal[0] * w, box.x + box.w - w, box.x);
  const y = clamp(box.y + box.h / 2 - focal[1] * h, box.y + box.h - h, box.y);
  return { x, y, w, h };
}
export const lerpBox = (a: Box, b: Box, t: number): Box => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) });
