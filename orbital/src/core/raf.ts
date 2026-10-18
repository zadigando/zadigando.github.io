import { damp } from './math';

/**
 * Valor amortecido com renderização sob demanda: o laço de quadros só roda enquanto houver
 * distância até o alvo. Em movimento reduzido, o valor salta direto (sem amortecimento).
 */
export function createDamped(initial: number, lambda: number, immediate: () => boolean) {
  let current = initial;
  let target = initial;
  let raf = 0;
  let last = 0;
  const subs = new Set<(v: number) => void>();
  const emit = () => subs.forEach((s) => s(current));
  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
    last = now;
    current = damp(current, target, lambda, dt);
    if (Math.abs(target - current) < 0.0002) { current = target; raf = 0; emit(); return; }
    emit();
    raf = requestAnimationFrame(tick);
  };
  return {
    get value() { return current; },
    set(next: number) {
      target = next;
      if (immediate()) { current = target; if (raf) { cancelAnimationFrame(raf); raf = 0; } emit(); return; }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    },
    jump(next: number) { target = current = next; if (raf) { cancelAnimationFrame(raf); raf = 0; } emit(); },
    subscribe(fn: (v: number) => void) { subs.add(fn); fn(current); return () => subs.delete(fn); },
  };
}
