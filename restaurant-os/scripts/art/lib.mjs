// Wspólne narzędzia do rysowania ilustracji produktów (SVG 64×64, płaski styl, obrys w ciemniejszym odcieniu).

/** Element SVG jako tekst. */
export function E(tag, attrs = {}, inner = '') {
  const a = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('');
  return inner === '' && tag !== 'g' ? `<${tag}${a}/>` : `<${tag}${a}>${inner}</${tag}>`;
}

export const g = (attrs, ...children) => E('g', attrs, children.flat().join(''));
export const at = (x, y, ...children) => g({ transform: `translate(${x} ${y})` }, ...children);
export const tr = (t, ...children) => g({ transform: t }, ...children);

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (rgb) =>
  '#' +
  rgb
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

/** f < 0 — ciemniej, f > 0 — jaśniej (−1…1). */
export function shade(hex, f) {
  const [r, gg, b] = hexToRgb(hex);
  return f < 0
    ? toHex([r * (1 + f), gg * (1 + f), b * (1 + f)])
    : toHex([r + (255 - r) * f, gg + (255 - gg) * f, b + (255 - b) * f]);
}

/** Wypełnienie + obrys w ciemniejszym odcieniu. */
export const fs = (fill, k = -0.32, w = 1.4) => ({
  fill,
  stroke: shade(fill, k),
  'stroke-width': w,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
});
export const line = (color, w = 1.4) => ({
  fill: 'none',
  stroke: color,
  'stroke-width': w,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
});

export const P = (d, attrs) => E('path', { d, ...attrs });
export const C = (cx, cy, r, attrs) => E('circle', { cx, cy, r, ...attrs });
export const EL = (cx, cy, rx, ry, attrs) => E('ellipse', { cx, cy, rx, ry, ...attrs });
export const R = (x, y, w, h, rx, attrs) => E('rect', { x, y, width: w, height: h, rx, ...attrs });

/** Biały odblask (połysk). */
export const gloss = (cx, cy, rx, ry, rot = -30, op = 0.45) =>
  EL(cx, cy, rx, ry, { fill: '#fff', opacity: op, transform: `rotate(${rot} ${cx} ${cy})` });

export const shadow = (rx = 22, cy = 58.5) => EL(32, cy, rx, 2.8, { fill: '#1f2937', opacity: 0.12 });

export function svg(body, { shadowRx = 22 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${shadowRx ? shadow(shadowRx) : ''}${body}</svg>`;
}

/** Pseudolosowe punkty (stałe dla danego ziarna) — tekstury: proszek, ziarna, kropki. */
export function scatter(seed, n, x0, y0, x1, y1) {
  let s = seed;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: n }, () => [x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), rnd()]);
}

// ------------------------------------------------------------------ szablony wspólne

/** Słoik ze szklanym korpusem, zawartością i pokrywką. texture: powder|flakes|leaves|seeds|balls|crystals|granules|cream */
export function jar({
  x = 14,
  y = 16,
  w = 30,
  h = 38,
  fill,
  texture = 'powder',
  lid = '#3d4b57',
  level = 0.72,
  seed = 7,
  accent,
}) {
  const top = y + h * (1 - level);
  const body = R(x, y + 4, w, h - 4, 6, { fill: '#eef5f8', stroke: '#9fb3bb', 'stroke-width': 1.4 });
  const content = R(x + 2, top, w - 4, y + h - top - 2, 4, { fill });
  const tex = [];
  const pts = scatter(seed, texture === 'powder' ? 14 : 18, x + 4, top + 2, x + w - 4, y + h - 4);
  for (const [px, py, r] of pts) {
    if (texture === 'powder')
      tex.push(C(px.toFixed(1), py.toFixed(1), 0.8, { fill: shade(fill, r > 0.5 ? 0.3 : -0.25) }));
    else if (texture === 'flakes' || texture === 'leaves')
      tex.push(
        EL(px.toFixed(1), py.toFixed(1), 1.8, 0.9, {
          fill: shade(fill, r > 0.5 ? 0.25 : -0.3),
          transform: `rotate(${Math.round(r * 180)} ${px.toFixed(1)} ${py.toFixed(1)})`,
        }),
      );
    else if (texture === 'seeds')
      tex.push(
        EL(px.toFixed(1), py.toFixed(1), 1.6, 0.7, {
          fill: shade(fill, -0.3),
          transform: `rotate(${Math.round(r * 180)} ${px.toFixed(1)} ${py.toFixed(1)})`,
        }),
      );
    else if (texture === 'balls') tex.push(C(px.toFixed(1), py.toFixed(1), 1.6, { ...fs(fill, -0.35, 0.6) }));
    else if (texture === 'crystals')
      tex.push(
        R((px - 0.8).toFixed(1), (py - 0.8).toFixed(1), 1.8, 1.8, 0.3, {
          fill: '#fff',
          stroke: '#c9d6dd',
          'stroke-width': 0.4,
        }),
      );
    else if (texture === 'granules')
      tex.push(C(px.toFixed(1), py.toFixed(1), 1.1, { fill: shade(fill, r > 0.5 ? 0.25 : -0.2) }));
  }
  if (accent)
    for (const [px, py] of scatter(seed + 3, 6, x + 5, top + 3, x + w - 5, y + h - 5))
      tex.push(C(px.toFixed(1), py.toFixed(1), 0.9, { fill: accent }));
  const lidEl = R(x + 1, y, w - 2, 7, 2.5, fs(lid, -0.3, 1.2));
  const glass = R(x + 4, y + 9, 3, h - 16, 1.5, { fill: '#fff', opacity: 0.6 });
  const label = R(x + 3, y + h * 0.42, w - 6, 9, 2, { fill: '#fff', opacity: 0.85 });
  return [
    body,
    content,
    ...tex,
    label,
    R(x + 5, y + h * 0.42 + 3.5, w - 10, 2, 1, { fill: shade(fill, -0.15), opacity: 0.8 }),
    glass,
    lidEl,
  ].join('');
}

/** Butelka: shape oil|squeeze|small|wide|dark. */
export function bottle({
  x = 22,
  y = 6,
  w = 20,
  h = 50,
  liquid,
  glass = '#e9f3f5',
  cap = '#3d4b57',
  shape = 'oil',
  label,
  level = 0.8,
}) {
  const neckW = shape === 'wide' ? w * 0.6 : w * 0.38;
  const nx = x + (w - neckW) / 2;
  const shoulder = y + (shape === 'squeeze' ? 8 : shape === 'small' ? 14 : 16);
  const body = `M${nx},${y + 4} L${nx},${shoulder - 6} C${nx},${shoulder - 2} ${x},${shoulder - 2} ${x},${shoulder + 4} L${x},${y + h - 4} Q${x},${y + h} ${x + 4},${y + h} L${x + w - 4},${y + h} Q${x + w},${y + h} ${x + w},${y + h - 4} L${x + w},${shoulder + 4} C${x + w},${shoulder - 2} ${nx + neckW},${shoulder - 2} ${nx + neckW},${shoulder - 6} L${nx + neckW},${y + 4} Z`;
  const parts = [];
  if (shape === 'squeeze') {
    parts.push(
      P(
        `M${x},${y + 12} Q${x},${y + 8} ${x + 4},${y + 8} L${x + w - 4},${y + 8} Q${x + w},${y + 8} ${x + w},${y + 12} L${x + w - 1},${y + h - 4} Q${x + w - 1},${y + h} ${x + w - 5},${y + h} L${x + 5},${y + h} Q${x + 1},${y + h} ${x + 1},${y + h - 4} Z`,
        fs(liquid, -0.3),
      ),
    );
    parts.push(P(`M${x + 4},${y + 8} L${x + 6},${y} L${x + w - 6},${y} L${x + w - 4},${y + 8} Z`, fs(cap, -0.3, 1.2)));
    parts.push(R(x + w / 2 - 1.5, y - 4, 3, 5, 1, fs(cap, -0.3, 1)));
  } else {
    parts.push(P(body, { fill: glass, stroke: '#9fb3bb', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }));
    const top = y + h - (y + h - shoulder) * level - (shape === 'small' ? 0 : 2);
    parts.push(
      P(
        `M${x + 2},${Math.max(top, shoulder + 1)} L${x + w - 2},${Math.max(top, shoulder + 1)} L${x + w - 2},${y + h - 4} Q${x + w - 2},${y + h - 2} ${x + w - 4},${y + h - 2} L${x + 4},${y + h - 2} Q${x + 2},${y + h - 2} ${x + 2},${y + h - 4} Z`,
        { fill: liquid },
      ),
    );
    parts.push(R(nx - 1, y - 2, neckW + 2, 7, 2, fs(cap, -0.3, 1.2)));
  }
  if (label)
    parts.push(
      R(x + 2.5, y + h * 0.55, w - 5, h * 0.24, 2, { fill: label, opacity: 0.95 }),
      R(x + 5, y + h * 0.55 + h * 0.1, w - 10, 2, 1, { fill: shade(label, -0.35), opacity: 0.7 }),
    );
  parts.push(R(x + 3, shoulder + 3, 2.5, h - (shoulder - y) - 10, 1.2, { fill: '#fff', opacity: 0.5 }));
  return parts.join('');
}

/** Miska z zupą (widok z boku, powierzchnia zupy jako elipsa) + dodatki. */
export function soupBowl(soup, garnish = '', { steam = true, band = '#5b8db8' } = {}) {
  return [
    steam
      ? P('M24,14 c-3,-4 3,-6 0,-10 M32,12 c-3,-4 3,-6 0,-10 M40,14 c-3,-4 3,-6 0,-10', {
          ...line('#b8c2cc', 1.6),
          opacity: 0.8,
        })
      : '',
    P('M7,30 C7,48 18,56 32,56 C46,56 57,48 57,30 Z', {
      fill: '#fff',
      stroke: '#b4c0cc',
      'stroke-width': 1.4,
      'stroke-linejoin': 'round',
    }),
    P('M10,40 C14,48 22,53 32,53 C42,53 50,48 54,40', line(band, 2.2)),
    EL(32, 30, 25, 8, { fill: '#fff', stroke: '#b4c0cc', 'stroke-width': 1.4 }),
    EL(32, 30.5, 22, 6.3, { fill: soup }),
    EL(26, 28.5, 8, 1.6, { fill: '#fff', opacity: 0.25 }),
    garnish,
  ].join('');
}

/** Drewniana deska pod mięso (widok z góry, lekko z ukosa). */
export const board = () =>
  [EL(32, 47, 28, 10, fs('#e6c99a', -0.25, 1.3)), EL(32, 45.5, 26, 8.5, { fill: '#efd9b2' })].join('');

/** Talerz/tacka pod produkty. */
export const plate = (cy = 47) =>
  [
    EL(32, cy, 28, 10, { fill: '#fff', stroke: '#c7d0d8', 'stroke-width': 1.3 }),
    EL(32, cy, 21, 7, { fill: '#f3f6f8' }),
  ].join('');

/** Kartonik (mleko, śmietanka). */
export function carton({ x = 18, y = 8, w = 26, h = 48, color = '#3b82c4', band = '#fff', accent }) {
  const r = x + w;
  return [
    P(`M${x},${y + 12} L${x + w / 2},${y + 3} L${r},${y + 12} Z`, fs(shade(color, 0.55), -0.4)),
    R(x + w / 2 - 6, y - 1, 12, 5, 1, fs(shade(color, 0.7), -0.4)),
    R(x, y + 12, w, h - 12, 2.5, fs('#ffffff', -0.25)),
    R(x, y + 12, w, 10, 0, { fill: color }),
    R(x, y + h - 10, w, 10, 0, { fill: color }),
    P(
      `M${x},${y + h - 2.5} Q${x},${y + h} ${x + 2.5},${y + h} L${r - 2.5},${y + h} Q${r},${y + h} ${r},${y + h - 2.5}`,
      line(shade(color, -0.3), 1.4),
    ),
    accent ?? '',
    R(x, y + 12, w, h - 12, 2.5, { fill: 'none', stroke: shade('#ffffff', -0.25), 'stroke-width': 1.4 }),
    R(x + 2.5, y + 24, 2.5, h - 36, 1.2, { fill: '#fff', opacity: 0.6 }),
    band ? '' : '',
  ].join('');
}

/** Kubeczek (jogurt, śmietana) z wieczkiem z folii. */
export function cup({ x = 16, y = 22, w = 32, h = 32, color = '#ffffff', lid = '#3b82c4', label = '#3b82c4' }) {
  const b = y + h;
  return [
    P(`M${x},${y + 4} L${x + 4},${b} L${x + w - 4},${b} L${x + w},${y + 4} Z`, fs(color, -0.22)),
    P(`M${x + 1.2},${y + 12} L${x + w - 1.2},${y + 12} L${x + w - 2.6},${y + 24} L${x + 2.6},${y + 24} Z`, {
      fill: label,
    }),
    EL(x + w / 2, y + 4, w / 2 + 1, 3.6, fs(lid, -0.3, 1.2)),
    EL(x + w / 2 - 4, y + 3.3, w / 4, 1.2, { fill: '#fff', opacity: 0.35 }),
  ].join('');
}

/** Pudełko/tacka z folią (pojemniki). */
export const tub = ({ x = 12, y = 30, w = 40, h = 22, color = '#ffffff', lid = '#e5eef4' }) =>
  [
    P(`M${x},${y} L${x + 3},${y + h} L${x + w - 3},${y + h} L${x + w},${y} Z`, fs(color, -0.25)),
    EL(x + w / 2, y, w / 2 + 1, 4, fs(lid, -0.25, 1.2)),
  ].join('');
