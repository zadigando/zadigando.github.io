import { describe, expect, it } from 'vitest';
import { angleOf, depthAt, focusAt, nearestFocus, orbitFor, plateauCenter, plateauStart, pointAt, scaleAt, setTrackOffset } from '../src/atlas/orbit';
import { coverRect, objectPositionFor, logLerp, remap, smoothstep } from '../src/core/math';

describe('órbita', () => {
  const o = orbitFor(1440, 900, false);
  it('a frente tem profundidade 1 e o fundo 0', () => {
    expect(depthAt(o, o.front)).toBeCloseTo(1, 6);
    expect(depthAt(o, o.front + 180)).toBeCloseTo(0, 6);
    expect(depthAt(o, o.front + 90)).toBeCloseTo(0.5, 6);
  });
  it('foco é contínuo, monotônico e para nos inteiros nos platôs', () => {
    setTrackOffset(0);
    let last = -1;
    for (let q = 0; q <= 1.0001; q += 0.001) { const f = focusAt(q); expect(f).toBeGreaterThanOrEqual(last - 1e-9); last = f; }
    for (let i = 0; i < 4; i++) { expect(focusAt(plateauCenter(i))).toBeCloseTo(i, 6); expect(nearestFocus(plateauCenter(i))).toBe(i); }
    expect(focusAt(1)).toBeCloseTo(3, 6);
    expect(plateauStart(0)).toBeCloseTo(0.17, 6);
  });
  it('o mundo em foco fica no ângulo da frente; os outros a 90° de distância', () => {
    for (let i = 0; i < 4; i++) {
      expect(angleOf(o, i, i)).toBe(o.front);
      if (i < 3) expect(angleOf(o, i + 1, i) - o.front).toBeCloseTo(90, 6);
    }
  });
  it('pontos da elipse ficam dentro do palco no retrato e na paisagem', () => {
    for (const [W, H, p] of [[1440, 900, false], [390, 844, true]] as const) {
      const ob = orbitFor(W, H, p);
      for (let a = 0; a < 360; a += 15) { const [x, y] = pointAt(ob, a); expect(x).toBeGreaterThan(-W * 0.2); expect(x).toBeLessThan(W * 1.2); expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(H); }
    }
  });
  it('escala cresce com a profundidade', () => { expect(scaleAt(1, 0.36)).toBe(1); expect(scaleAt(0, 0.36)).toBe(0.36); expect(scaleAt(0.5, 0.36)).toBeLessThan(scaleAt(0.8, 0.36)); });
});

describe('matemática do recorte', () => {
  it('coverRect cobre a caixa e mantém o foco perto do centro', () => {
    const r = coverRect(1440, 900, { x: 0, y: 0, w: 200, h: 300 }, [0.72, 0.52]);
    expect(r.h).toBeCloseTo(300, 6); expect(r.w).toBeCloseTo(480, 6);
    expect(r.x).toBeLessThanOrEqual(0); expect(r.x + r.w).toBeGreaterThanOrEqual(200);
    expect(r.x + 0.72 * r.w).toBeCloseTo(100, 0);
  });
  it('objectPositionFor reproduz o recorte do coverRect', () => {
    const box = { x: 0, y: 0, w: 720, h: 450 };
    const r = coverRect(1440, 900, box, [0.72, 0.52]);
    expect(objectPositionFor(1440, 900, box, [0.72, 0.52])).toBe('50.00% 50.00%'); // mesma proporção: sem deslocamento
    const box2 = { x: 0, y: 0, w: 342, h: 427 };
    const r2 = coverRect(390, 844, box2, [0.5, 0.22]);
    const [px, py] = objectPositionFor(390, 844, box2, [0.5, 0.22]).split(' ').map(parseFloat);
    expect((box2.w - r2.w) * (px! / 100)).toBeCloseTo(r2.x, 1);
    expect((box2.h - r2.h) * (py! / 100)).toBeCloseTo(r2.y, 1);
    expect(r.w).toBeCloseTo(720, 6);
  });
  it('utilitários', () => {
    expect(remap(5, 0, 10)).toBe(0.5); expect(remap(-1, 0, 10)).toBe(0); expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(logLerp(1440, 90, 0.5)).toBeCloseTo(Math.sqrt(1440 * 90), 6);
  });
});
