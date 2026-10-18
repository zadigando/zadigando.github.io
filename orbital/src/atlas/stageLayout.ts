import { lerpBox, type Box } from '../core/math';

/**
 * Composição do palco do Atlas por ABERTURAS, não por miniaturas.
 * O mundo em foco ocupa o quadro principal; os outros aparecem como frestas nas bordas da tela
 * (mesma escala, recorte estreito): glimpses de mundos vizinhos, não cartões encolhidos.
 * Os quatro lugares são funções do deslocamento angular em relação à frente: 0 frente · 90 fresta direita
 * · 180 atrás do quadro (o lado de lá, invisível) · 270 fresta esquerda. Entre lugares, a caixa interpola.
 */
export interface StageLayout {
  front: Box;
  slots: [Box, Box, Box, Box]; // 0, 90, 180, 270
  /** centro e raios da órbita desenhada (passa por trás das frestas, maior que o quadro) */
  orbit: { cx: number; cy: number; rx: number; ry: number };
  /** largura de referência da imagem (mesma escala em todas as aberturas) */
  imageW: number;
}

export function stageLayout(W: number, H: number, portrait: boolean): StageLayout {
  if (portrait) {
    const w = W - 64, h = Math.min(w * 1.25, H * 0.5);
    const front: Box = { x: 32, y: H * 0.105, w, h };
    const right: Box = { x: W * 0.945, y: front.y, w: W * 0.11, h: front.h };
    const behind: Box = { x: front.x + w * 0.09, y: front.y + h * 0.09, w: w * 0.82, h: h * 0.82 };
    const left: Box = { x: -W * 0.055, y: front.y, w: W * 0.11, h: front.h };
    return { front, slots: [front, right, behind, left], orbit: { cx: front.x + w / 2, cy: front.y + h * 0.6, rx: W * 0.56, ry: h * 0.55 }, imageW: w };
  }
  const w = Math.min(W * 0.56, 860), h = w * 0.625;
  const front: Box = { x: W * 0.37, y: H * 0.5 - h / 2, w, h };
  // frestas verticais nas duas bordas (próximo à direita, anterior à esquerda); o lado de lá fica atrás do quadro
  const right: Box = { x: W * 0.952, y: H * 0.14, w: W * 0.1, h: H * 0.72 };
  const behind: Box = { x: front.x + w * 0.09, y: front.y + h * 0.09, w: w * 0.82, h: h * 0.82 };
  const left: Box = { x: -W * 0.052, y: H * 0.14, w: W * 0.1, h: H * 0.72 };
  return { front, slots: [front, right, behind, left], orbit: { cx: front.x + w / 2, cy: H * 0.5, rx: W * 0.33, ry: H * 0.47 }, imageW: w };
}

/** Caixa de um mundo para um deslocamento angular contínuo (graus, qualquer valor). */
export function boxAt(L: StageLayout, offsetDeg: number): Box {
  const a = ((offsetDeg % 360) + 360) % 360;
  const i = Math.floor(a / 90), t = (a - i * 90) / 90;
  const from = L.slots[i]!, to = L.slots[(i + 1) % 4]!;
  return lerpBox(from, to, t);
}

/** Profundidade 0..1 (1 = frente) e "abertura" 0..1 (1 = quadro principal) para o deslocamento. */
export const depthOf = (offsetDeg: number): number => (1 + Math.cos((offsetDeg * Math.PI) / 180)) / 2;
export const apertureOf = (offsetDeg: number): number => { const dist = Math.abs((((offsetDeg % 360) + 540) % 360) - 180); return Math.max(0, 1 - dist / 90); };
