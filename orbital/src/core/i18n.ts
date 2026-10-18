import { strings, type Lang, type StringKey } from '../content/strings';

const KEY = 'zdb-orbital-lang';
let lang: Lang = detect();
const subs = new Set<(l: Lang) => void>();

function detect(): Lang {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'pt' || q === 'en') return q;
  try { const s = localStorage.getItem(KEY); if (s === 'pt' || s === 'en') return s; } catch { /* sem storage */ }
  return (navigator.language || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

export const getLang = (): Lang => lang;
export const t = (key: StringKey): string => strings[lang][key];
export const pick = <T>(v: { pt: T; en: T }): T => v[lang];

export function setLang(next: Lang): void {
  lang = next;
  try { localStorage.setItem(KEY, next); } catch { /* ignorar */ }
  applyStatic();
  subs.forEach((s) => s(next));
}
export function onLang(fn: (l: Lang) => void): () => void { subs.add(fn); return () => subs.delete(fn); }

/** Aplica textos estáticos marcados no HTML: data-i18n="chave" e data-i18n-attr="aria-label:chave". */
export function applyStatic(root: ParentNode = document): void {
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
  document.title = t('title');
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n as StringKey); });
  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml as StringKey); });
  root.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach((el) => {
    for (const pair of (el.dataset.i18nAttr ?? '').split(';')) {
      const [attr, key] = pair.split(':');
      if (attr && key) el.setAttribute(attr.trim(), t(key.trim() as StringKey));
    }
  });
  document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
}
