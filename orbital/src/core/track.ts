import { clamp } from './math';

/**
 * Trilho cinematográfico: um contêiner alto (`.track`) com um palco fixo (`.stage`, sticky).
 * O progresso 0..1 é função pura da posição de rolagem NATIVA: nada é interceptado,
 * e subir e descer reproduz exatamente os mesmos quadros.
 */
export interface Track {
  readonly id: string;
  readonly el: HTMLElement;
  readonly stage: HTMLElement;
  /** início e fim do trajeto em scrollY */
  start: number;
  end: number;
  p: number;
  onProgress(fn: (p: number) => void): () => void;
  /** posição de rolagem que corresponde a um progresso */
  scrollYFor(p: number): number;
  measure(): void;
}

const tracks: Track[] = [];
let scheduled = false;

export function createTrack(id: string): Track {
  const el = document.getElementById(id);
  const stage = el?.querySelector<HTMLElement>('.stage');
  if (!el || !stage) throw new Error(`track ${id} não encontrado`);
  const listeners = new Set<(p: number) => void>();
  const t: Track = {
    id, el, stage, start: 0, end: 1, p: -1,
    onProgress(fn) { listeners.add(fn); fn(Math.max(0, t.p)); return () => listeners.delete(fn); },
    scrollYFor(p) { return t.start + clamp(p) * (t.end - t.start); },
    measure() {
      const top = el.getBoundingClientRect().top + window.scrollY;
      t.start = top;
      t.end = Math.max(top + 1, top + el.offsetHeight - stage.offsetHeight);
      update(t, true);
    },
  };
  function update(track: Track, force = false) {
    const p = clamp((window.scrollY - track.start) / (track.end - track.start));
    if (!force && p === track.p) return;
    track.p = p;
    track.el.style.setProperty('--p', p.toFixed(5));
    listeners.forEach((l) => l(p));
  }
  (t as Track & { _update: () => void })._update = () => update(t);
  tracks.push(t);
  return t;
}

function onScroll() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    for (const t of tracks) (t as Track & { _update: () => void })._update();
  });
}
export function measureAll(): void { for (const t of tracks) t.measure(); }

let installed = false;
export function installTracks(): void {
  if (installed) return;
  installed = true;
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', measureAll);
  const ro = new ResizeObserver(() => measureAll());
  ro.observe(document.body);
  measureAll();
}

/** Qual trilho está "em cena" (o palco ocupa a viewport). */
export function activeTrack(): Track | null {
  const y = window.scrollY;
  return tracks.find((t) => y >= t.start - 1 && y <= t.end + t.stage.offsetHeight) ?? null;
}
