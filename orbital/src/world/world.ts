import { worlds, worldById, pad, type World } from '../content/worlds';
import { onLang, pick, t } from '../core/i18n';
import { isPortraitLayout, prefersReducedMotion, currentMode } from '../core/capabilities';

/**
 * Mundo expandido: a superfície em foco cresce (FLIP) até o quadro do diálogo, onde a navegação real
 * do site entra em vídeo. Diálogo acessível: foco preso, Esc fecha, `inert` no resto, hash navegável.
 */
export interface WorldView { open(w: World, origin?: HTMLElement | null): void; close(): void; isOpen(): boolean }

export function initWorld(onNavigate: (i: number) => void): WorldView {
  const root = document.getElementById('world')!;
  const body = root.querySelector<HTMLElement>('.world-body')!;
  const media = document.getElementById('world-media')!;
  const video = document.getElementById('world-video') as HTMLVideoElement;
  const poster = document.getElementById('world-poster') as HTMLImageElement;
  const notice = document.getElementById('world-notice')!;
  const eyebrow = document.getElementById('world-eyebrow')!;
  const title = document.getElementById('world-title')!;
  const cat = document.getElementById('world-cat')!;
  const thesis = document.getElementById('world-thesis')!;
  const status = document.getElementById('world-status')!;
  const visit = document.getElementById('world-visit') as HTMLAnchorElement;
  const next = document.getElementById('world-next') as HTMLButtonElement;
  const closeBtn = document.getElementById('world-close') as HTMLButtonElement;
  const main = document.getElementById('main')!;
  const hdr = document.getElementById('hdr')!;
  let current: World | null = null;
  let lastOrigin: HTMLElement | null = null;
  let ghost: HTMLElement | null = null;

  function fill(w: World) {
    const portrait = isPortraitLayout();
    const m = portrait ? w.media.mobile : w.media.desktop;
    root.style.setProperty('--tint', w.tint);
    root.dataset.world = w.id;
    eyebrow.textContent = `${t('worldOf')} ${pad(w.index)} / ${pad(worlds.length)} — ${pick(w.category)}`;
    title.textContent = w.name;
    cat.textContent = pick(w.category);
    thesis.textContent = pick(w.thesis);
    status.textContent = t('worldStatusLive');
    notice.textContent = w.status === 'restricted' ? t('worldRestricted') : t('worldReference');
    visit.href = w.url;
    const n = worlds[w.index % worlds.length]!;
    next.querySelector('span')!.textContent = `${pad(n.index)} ${n.name} →`; next.setAttribute('aria-label', `${t('worldNext')} · ${pad(n.index)} ${n.name}`);
    poster.src = m.poster;
    poster.alt = `${w.name} — ${t('worldMediaLabel')}`;
    video.setAttribute('aria-label', `${w.name} — ${t('worldMediaLabel')}`);
    if (m.video && !prefersReducedMotion()) {
      if (video.dataset.src !== m.video) {
        video.dataset.src = m.video;
        video.replaceChildren();
        const sources: Array<[string, string]> = [[m.video.replace(/\.mp4$/, '.webm'), 'video/webm'], [m.video, 'video/mp4']];
        for (const [src, type] of sources) {
          const so = document.createElement('source'); so.src = src; so.type = type; video.appendChild(so);
        }
        video.load();
      }
      video.poster = m.poster;
      video.hidden = false;
      video.currentTime = 0;
      video.play().catch(() => { video.hidden = true; });
    } else {
      video.pause(); video.hidden = true;
    }
  }

  function open(w: World, origin?: HTMLElement | null) {
    const wasOpen = current !== null;
    current = w; lastOrigin = origin ?? lastOrigin;
    fill(w);
    root.hidden = false;
    main.setAttribute('inert', ''); hdr.setAttribute('inert', '');
    document.documentElement.dataset.world = 'open';
    if (location.hash !== `#mundo-${w.id}`) history.pushState({ world: w.id }, '', `#mundo-${w.id}`);
    // FLIP: um fantasma da superfície voa até o quadro de mídia; depois o diálogo revela o conteúdo
    const animate = !wasOpen && origin && !prefersReducedMotion() && currentMode() === 'motion';
    body.classList.toggle('is-animating', Boolean(animate));
    requestAnimationFrame(() => {
      const to = media.getBoundingClientRect();
      if (animate && origin) {
        const from = origin.getBoundingClientRect();
        ghost?.remove();
        ghost = document.createElement('div');
        ghost.className = 'world-ghost';
        ghost.style.backgroundImage = `url("${(isPortraitLayout() ? w.media.mobile : w.media.desktop).poster}")`; ghost.style.backgroundPosition = '50% 0%';
        ghost.style.cssText += `left:${to.left}px;top:${to.top}px;width:${to.width}px;height:${to.height}px;`;
        document.body.appendChild(ghost);
        const sx = from.width / to.width, sy = from.height / to.height;
        const dx = from.left - to.left, dy = from.top - to.top;
        const anim = ghost.animate(
          [{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: '6px' }, { transform: 'translate(0, 0) scale(1, 1)', borderRadius: '8px' }],
          { duration: 820, easing: 'cubic-bezier(0.7, 0, 0.2, 1)', fill: 'forwards' },
        );
        body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 480, delay: 460, easing: 'ease-out', fill: 'both' });
        anim.finished.then(() => { body.classList.remove('is-animating'); ghost?.remove(); ghost = null; });
      } else {
        body.classList.remove('is-animating');
        body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: prefersReducedMotion() ? 0 : 300, fill: 'both' });
      }
      title.setAttribute('tabindex', '-1');
      title.focus({ preventScroll: true });
      body.scrollTop = 0;
    });
  }

  function close() {
    if (!current) return;
    const w = current; current = null;
    video.pause();
    const done = () => {
      root.hidden = true; delete document.documentElement.dataset.world;
      main.removeAttribute('inert'); hdr.removeAttribute('inert');
      if (location.hash === `#mundo-${w.id}`) history.replaceState(null, '', location.pathname + location.search + '#atlas');
      (lastOrigin ?? document.getElementById('enter'))?.focus({ preventScroll: true });
    };
    if (prefersReducedMotion() || currentMode() !== 'motion') { done(); return; }
    body.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-in', fill: 'both' }).finished.then(done);
  }

  closeBtn.addEventListener('click', close);
  root.querySelector('.world-scrim')!.addEventListener('click', close);
  function go(i: number, dir: 1 | -1) {
    onNavigate(i);
    if (prefersReducedMotion() || currentMode() !== 'motion') { open(worlds[i]!, null); return; }
    // wipe: a cena atual desliza para fora, a próxima entra pelo lado oposto (corte com direção)
    const text = root.querySelector<HTMLElement>('.world-text')!;
    const out = media.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${-dir * 6}%)`, opacity: 0.2 }], { duration: 360, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' });
    text.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
    out.finished.then(() => {
      open(worlds[i]!, null);
      media.animate([{ transform: `translateX(${dir * 6}%)`, opacity: 0.2 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' });
      text.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 420, delay: 120, easing: 'ease-out', fill: 'forwards' });
    });
  }
  next.addEventListener('click', () => { if (!current) return; go(current.index % worlds.length, 1); });
  document.addEventListener('keydown', (e) => {
    if (!current) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowRight') go(current.index % worlds.length, 1);
    if (e.key === 'ArrowLeft') go((current.index + worlds.length - 2) % worlds.length, -1);
    if (e.key === 'Tab') {
      // foco preso dentro do diálogo
      const f = Array.from(root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), video, [tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0]!, last = f[f.length - 1]!;
      if (e.shiftKey && (document.activeElement === first || document.activeElement === title)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  window.addEventListener('popstate', () => {
    const m = /^#mundo-([a-z]+)$/.exec(location.hash);
    const w = m ? worldById(m[1]!) : undefined;
    if (w) open(w, null); else if (current) { current = null; video.pause(); root.hidden = true; delete document.documentElement.dataset.world; main.removeAttribute('inert'); hdr.removeAttribute('inert'); }
  });
  onLang(() => { if (current) fill(current); });

  // abertura direta por hash
  const m = /^#mundo-([a-z]+)$/.exec(location.hash);
  const w0 = m ? worldById(m[1]!) : undefined;
  if (w0) { onNavigate(w0.index - 1); setTimeout(() => open(w0, null), 50); }

  return { open, close, isOpen: () => current !== null };
}
