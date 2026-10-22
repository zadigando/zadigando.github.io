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

import { arcLengths, cameraFor, cameraTransform, journeyEnd, journeyFocus, plateauCenter, pointAtArc, pullBack, RHYTHM, toStage, travelStart } from '../src/origin/sky';
import { BODY_PATH, milestoneByYear, milestones } from '../src/content/milestones';

describe('a viagem pelo corpo (Estudo 02, puro)', () => {
  it('a polilinha do corpo liga estrelas existentes e o ponto por distância cai sobre ela', () => {
    for (const i of BODY_PATH) expect(STARS[i]).toBeDefined();
    const path: Array<[number, number]> = [[0, 0], [10, 0], [10, 10]];
    const acc = arcLengths(path);
    expect(acc).toEqual([0, 10, 20]);
    expect(pointAtArc(path, acc, 5)).toEqual([5, 0]);
    expect(pointAtArc(path, acc, 15)).toEqual([10, 5]);
    expect(pointAtArc(path, acc, 99)).toEqual([10, 10]);
  });
  it('o foco é contínuo, monotônico, inteiro nos platôs, e os platôs cabem antes do recuo final', () => {
    let last = -1;
    for (let j = 0; j <= 1.0001; j += 0.0005) { const f = journeyFocus(j); expect(f).toBeGreaterThanOrEqual(last - 1e-9); last = f; }
    for (let k = 1; k <= RHYTHM.n; k++) { expect(journeyFocus(plateauCenter(k))).toBeCloseTo(k, 6); expect(plateauCenter(k)).toBeGreaterThan(travelStart(k)); }
    expect(journeyEnd()).toBeLessThan(1); expect(journeyEnd()).toBeGreaterThan(0.8);
    expect(pullBack(journeyEnd())).toBe(0); expect(pullBack(1)).toBe(1);
  });
  it('a câmera põe a estrela na fração pedida do palco, e a camada distante se move menos (paralaxe)', () => {
    const W = 1440, H = 692; const star: [number, number] = [900, 300];
    const c = cameraFor(star, [0.66, 0.45], 2, W, H);
    const [sx, sy] = toStage(c, star, W, H);
    expect(sx).toBeCloseTo(0.66 * W, 6); expect(sy).toBeCloseTo(0.45 * H, 6);
    const near = cameraTransform(c, W, H, 1), far = cameraTransform(c, W, H, 0.78);
    const tx = (s: string) => Number(/translate\(([-\d.]+)/.exec(s)![1]);
    expect(Math.abs(tx(far))).toBeLessThan(Math.abs(tx(near)));
  });
  it('os marcos apontam para estrelas reais, 2020 é Antares e os anos resolvem o marco certo', () => {
    expect(milestones).toHaveLength(6);
    expect(milestones[0]!.stars).toEqual([ANTARES]);
    for (const m of milestones) for (const i of m.stars) expect(STARS[i]).toBeDefined();
    expect(milestoneByYear('2023')).toBe(2); expect(milestoneByYear('2026')).toBe(5); expect(milestoneByYear('1999')).toBe(-1);
    for (const m of milestones) expect(m.zoom).toBeLessThanOrEqual(2.4);
  });
});
