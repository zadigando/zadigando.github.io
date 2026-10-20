import { installCapabilities, currentMode, prefersReducedMotion } from './core/capabilities';
import { applyStatic, setLang } from './core/i18n';
import { installTracks, measureAll } from './core/track';
import { initArrival } from './arrival/arrival';
import { initAtlas } from './atlas/atlas';
import { initWorld } from './world/world';
import { plateauCenter } from './atlas/orbit';
import { worldById } from './content/worlds';
import { SCENES } from './config';
import type { Lang } from './content/strings';

installCapabilities();
applyStatic();
document.documentElement.dataset.scenes = String(SCENES);

// idioma
document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang as Lang)));

// capítulos
// O modo (movimento ↔ estático) é automático: prefers-reduced-motion, saveData ou `?mode=static`.
let world: ReturnType<typeof initWorld> | null = null;
let arrival: ReturnType<typeof initArrival> | null = null;
const atlas = initAtlas((w, origin) => { if (world) world.open(w, origin); else window.open(w.url, '_blank', 'noreferrer'); }, () => arrival?.finalFrame() ?? null);
if (SCENES) world = initWorld((i) => atlas.goTo(i, false));
arrival = initArrival({ onComposed: () => atlas.relayout() });
installTracks();

// âncoras no palco fixo: cada hash vira uma posição de rolagem NATIVA (sem scroll-jacking)
function positionFor(hash: string): number | null {
  if (hash === '#arrival') return arrival!.track.start;
  if (hash === '#atlas') return atlas.track.scrollYFor(0.25);
  if (!SCENES) { const m = /^#mundo-([a-z]+)$/.exec(hash); const w = m ? worldById(m[1]!) : undefined; if (w) return atlas.track.scrollYFor(plateauCenter(w.index - 1)); }
  return null;
}
document.addEventListener('click', (e) => {
  const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
  const hash = a.getAttribute('href') ?? '';
  const y = currentMode() === 'motion' ? positionFor(hash) : null;
  if (y === null) return;
  e.preventDefault();
  if (location.hash !== hash) history.pushState(null, '', hash);
  window.scrollTo({ top: y, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  if (hash === '#atlas') (document.getElementById('atlas') as HTMLElement).focus({ preventScroll: true });
});
window.addEventListener('popstate', () => { const y = positionFor(location.hash); if (y !== null && currentMode() === 'motion') window.scrollTo({ top: y, behavior: 'auto' }); });
if (location.hash && positionFor(location.hash) !== null) requestAnimationFrame(() => window.scrollTo({ top: positionFor(location.hash)!, behavior: 'auto' }));

// capítulo corrente no cabeçalho
const navLinks = document.querySelectorAll<HTMLAnchorElement>('.hdr nav a[data-chapter]');
const syncNav = () => {
  const inAtlas = window.scrollY >= atlas.track.start - innerHeight * 0.5;
  navLinks.forEach((a) => a.setAttribute('aria-current', String(a.dataset.chapter === 'atlas' && inAtlas)));
};
window.addEventListener('scroll', syncNav, { passive: true }); syncNav();

// fontes prontas → medir de novo (o nome muda de tamanho)
document.fonts.ready.then(() => { document.documentElement.dataset.fonts = 'ready'; measureAll(); });
