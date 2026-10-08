import { h } from '../dom.js';
import { artFor, artUrl } from '../lib/catalog.js';

/**
 * Ilustracja produktu: obrazek SVG z katalogu (img/p/<klucz>.svg) albo emoji, gdy produkt nie ma ilustracji.
 * Obrazek jest dekoracyjny (alt=""), bo nazwa produktu zawsze stoi obok.
 */
export function artEl(
  p: { name: string; icon?: string | null },
  categoryName?: string | null,
  cls = 'prod-art',
): HTMLElement {
  const a = artFor(p, categoryName);
  if (a.kind === 'img')
    return h('img', {
      class: cls,
      src: artUrl(a.key),
      alt: '',
      width: 64,
      height: 64,
      loading: 'lazy',
      decoding: 'async',
      draggable: 'false',
    });
  return h('span', { class: `${cls} art-emoji`, 'aria-hidden': 'true' }, a.char);
}

/** Ilustracja po kluczu (katalog, wybór w formularzu). */
export function artImg(key: string, cls = 'prod-art'): HTMLElement {
  return h('img', { class: cls, src: artUrl(key), alt: '', width: 64, height: 64, loading: 'lazy', decoding: 'async' });
}
