import { describe, expect, it } from 'vitest';
import { ANTARES, FIGURE, LINES, SCORPIUS_CENTER, STARS } from '../src/content/scorpius';
import { binOpacity, fitFigure, limitAt, project, projectAll, segmentDepths, starColor, starRadius, toScreen } from '../src/origin/sky';

describe('carta de Escorpião (posições reais, projeção pura)', () => {
  it('o centro da carta projeta na origem; norte para cima, leste para a esquerda', () => {
    const [cx, cy] = project(SCORPIUS_CENTER[0], SCORPIUS_CENTER[1]);
    expect(cx).toBeCloseTo(0, 9); expect(cy).toBeCloseTo(0, 9);
    const [, yN] = project(SCORPIUS_CENTER[0], SCORPIUS_CENTER[1] + 5); // mais ao norte → y menor (para cima na tela)
    expect(yN).toBeLessThan(0);
    const [xE] = project(SCORPIUS_CENTER[0] + 5, SCORPIUS_CENTER[1]); // AR maior = leste → x menor (esquerda, como no céu)
    expect(xE).toBeLessThan(0);
  });
  it('a rotação de 90° leva o norte para a direita', () => {
    const [x, y] = project(SCORPIUS_CENTER[0], SCORPIUS_CENTER[1] + 5, SCORPIUS_CENTER, 90);
    expect(x).toBeGreaterThan(4); expect(Math.abs(y)).toBeLessThan(0.05);
  });
  it('Antares é a estrela mais brilhante da figura e tem a cor quente (B−V alto)', () => {
    const a = STARS[ANTARES]!;
    expect(a[2]).toBeCloseTo(1.06, 2);
    for (const f of FIGURE) expect(STARS[f.i]![2]).toBeGreaterThanOrEqual(a[2]);
    expect(starColor(a[3])).toBe('rgb(255 184 112)');
    expect(starRadius(a[2])).toBeGreaterThan(starRadius(6));
  });
  it('todas as 17 estrelas da figura e todos os traços apontam para estrelas existentes', () => {
    expect(FIGURE).toHaveLength(17);
    for (const f of FIGURE) expect(STARS[f.i]).toBeDefined();
    for (const [a, b] of LINES) { expect(STARS[a]).toBeDefined(); expect(STARS[b]).toBeDefined(); }
    expect(LINES).toHaveLength(16);
  });
  it('a figura cabe na caixa pedida, com a margem, em qualquer rotação', () => {
    for (const rot of [0, -16, -38, 90]) {
      const pts = projectAll(rot); const box = { x: 100, y: 50, w: 700, h: 500 };
      const c = fitFigure(pts, FIGURE.map((f) => f.i), box, 24, rot);
      for (const f of FIGURE) { const [x, y] = toScreen(c, pts[f.i]!); expect(x).toBeGreaterThanOrEqual(box.x + 24 - 1e-6); expect(x).toBeLessThanOrEqual(box.x + box.w - 24 + 1e-6); expect(y).toBeGreaterThanOrEqual(box.y + 24 - 1e-6); expect(y).toBeLessThanOrEqual(box.y + box.h - 24 + 1e-6); }
    }
  });
  it('a figura se revela a partir de Antares: os traços do coração têm profundidade 0 e o ferrão é o mais distante', () => {
    const d = segmentDepths();
    const touchesAntares = LINES.map(([a, b]) => a === ANTARES || b === ANTARES);
    d.forEach((depth, k) => { if (touchesAntares[k]) expect(depth).toBe(0); else expect(depth).toBeGreaterThan(0); });
    const upsilon = FIGURE.find((f) => f.bayer === 'υ')!.i, lambda = FIGURE.find((f) => f.bayer === 'λ')!.i;
    const sting = LINES.findIndex(([a, b]) => (a === lambda && b === upsilon) || (a === upsilon && b === lambda));
    expect(d[sting]).toBe(Math.max(...d));
  });
  it('a revelação por magnitude: as brilhantes primeiro, as fracas por último', () => {
    expect(limitAt(0)).toBeLessThan(1.06); expect(limitAt(1)).toBeGreaterThan(6);
    expect(binOpacity(1.5, limitAt(0.3))).toBeGreaterThan(binOpacity(5.5, limitAt(0.3)));
    expect(binOpacity(6, limitAt(1))).toBe(1);
  });
});
