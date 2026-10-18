export type Mode = 'motion' | 'static';

const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const mqCoarse = window.matchMedia('(pointer: coarse)');
const mqPortrait = window.matchMedia('(max-width: 720px)');

export const prefersReducedMotion = (): boolean => mqReduced.matches;
export const isCoarsePointer = (): boolean => mqCoarse.matches;
export const isPortraitLayout = (): boolean => mqPortrait.matches;
export const prefersSaveData = (): boolean => Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

export function readModeOverride(): Mode | null {
  const v = new URLSearchParams(location.search).get('mode');
  return v === 'static' || v === 'motion' ? v : null;
}

let override: Mode | null = readModeOverride();
const subs = new Set<(m: Mode) => void>();

export function currentMode(): Mode {
  if (override) return override;
  return prefersReducedMotion() || prefersSaveData() ? 'static' : 'motion';
}
export function setModeOverride(m: Mode | null): void { override = m; apply(); }
export function onMode(fn: (m: Mode) => void): () => void { subs.add(fn); fn(currentMode()); return () => subs.delete(fn); }

function apply() {
  const m = currentMode();
  document.documentElement.dataset.mode = m;
  subs.forEach((s) => s(m));
}
mqReduced.addEventListener('change', apply);
export function installCapabilities(): void {
  document.documentElement.dataset.pointer = isCoarsePointer() ? 'coarse' : 'fine';
  apply();
}
/** Movimento "imediato" (sem amortecimento, sem transições longas). */
export const immediateMotion = (): boolean => currentMode() === 'static' || prefersReducedMotion();
