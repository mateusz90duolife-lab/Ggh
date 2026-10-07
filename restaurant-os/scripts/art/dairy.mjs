// Nabiał i jajka.
import { C, EL, P, R, at, carton, cup, fs, gloss, jar, line, scatter, shade, tr, tub } from './lib.mjs';

const CHEESE = '#f5c842';

/** Kropla/plama mleka na kartonie. */
const milkDrop = (x, y) =>
  P(
    `M${x},${y - 6} C${x + 4},${y - 1} ${x + 4},${y + 3} ${x},${y + 3} C${x - 4},${y + 3} ${x - 4},${y - 1} ${x},${y - 6} Z`,
    fs('#ffffff', -0.2, 1),
  );

export default {
  mleko: [
    carton({ x: 14, color: '#3b82c4', accent: milkDrop(27, 38) }),
    at(
      46,
      42,
      P('M-7,-12 L-6,14 L6,14 L7,-12 Z', { fill: '#eef6fb', stroke: '#9fb3bb', 'stroke-width': 1.3 }),
      P('M-6.6,-4 L-5.8,13 L5.8,13 L6.6,-4 Z', { fill: '#fff' }),
      R(-4.5, -2, 2, 13, 1, { fill: '#e6eef3' }),
    ),
  ].join(''),
  smietana:
    cup({ color: '#ffffff', lid: '#e9eef2', label: '#7fb4e0' }) +
    P('M26,36 c2,-2 4,2 6,0 c2,-2 4,2 6,0', line('#fff', 1.4)) +
    EL(32, 25.5, 12, 1.6, { fill: '#cfd8df', opacity: 0.7 }),
  smietanka: carton({ x: 20, y: 18, w: 24, h: 38, color: '#9c6fc4', accent: milkDrop(32, 42) }),
  maslo: [
    P('M8,40 L30,30 L56,38 L56,46 L34,56 L8,48 Z', fs('#f7dc6f', -0.3)),
    P('M8,40 L30,30 L56,38 L34,48 Z', { fill: '#fbe78d' }),
    P('M34,48 L34,56', line('#c9ab3a', 1.3)),
    P('M30,30 L42,34.5 L42,24 L20,20 L8,28 L8,40 Z', fs('#d9b84a', -0.3)),
    P('M12,30 L26,24 M14,35 L30,28', line('#f3dd8a', 1.6)),
    gloss(38, 40, 6, 1.6, -15, 0.5),
  ].join(''),
  'ser-zolty': [
    P('M8,42 L34,26 L56,36 L56,48 L30,58 L8,52 Z', fs(CHEESE, -0.3)),
    P('M8,42 L34,26 L56,36 L30,48 Z', { fill: '#f8d66a' }),
    P('M30,48 L30,58', line('#c79e1d', 1.3)),
    ...[
      [20, 50, 2.5],
      [40, 51, 2],
      [48, 46, 1.6],
      [34, 36, 2.4],
      [44, 38, 1.6],
    ].map(([x, y, r]) => EL(x, y, r, r * 0.7, { fill: '#d9ac2a' })),
  ].join(''),
  'ser-plastry': [
    ...[0, 1, 2, 3].map((k) =>
      tr(
        `translate(${30 + k * 3} ${30 + k * 5}) rotate(${-10 + k * 6})`,
        R(-17, -11, 30, 22, 2, fs(CHEESE, -0.28, 1.2)),
        ...scatter(k + 40, 4, -12, -7, 9, 7).map(([x, y, r]) =>
          C(x.toFixed(1), y.toFixed(1), 1 + r * 1.4, { fill: '#e2b52d' }),
        ),
      ),
    ),
  ].join(''),
  mozzarella: [
    P('M8,36 C8,50 18,56 32,56 C46,56 56,50 56,36 Z', { fill: '#fff', stroke: '#b4c0cc', 'stroke-width': 1.4 }),
    EL(32, 36, 24, 7, { fill: '#e8f3fa', stroke: '#b4c0cc', 'stroke-width': 1.4 }),
    ...[
      [24, 33, 8],
      [40, 33, 8],
      [32, 28, 8],
    ].map(([x, y, r]) => [C(x, y, r, fs('#fbfaf5', -0.18)), gloss(x - 3, y - 3, 2.6, 1.6)].join('')),
    P('M38,26 c3,-6 9,-6 10,-2 c-4,2 -7,3 -10,2 Z', fs('#3f9a3a', -0.3, 1)),
  ].join(''),
  parmezan: [
    P('M10,44 L44,20 L56,40 L22,58 Z', fs('#f3e3a6', -0.25)),
    P('M44,20 L56,40 L54,44 L42,24 Z', fs('#c99a3c', -0.3, 1.1)),
    P('M22,58 L56,40 L56,44 L22,61 Z', fs('#c99a3c', -0.3, 1.1)),
    ...scatter(51, 14, 18, 34, 46, 50).map(([x, y]) => C(x.toFixed(1), y.toFixed(1), 0.8, { fill: '#e2cc80' })),
  ].join(''),
  feta: [
    P('M10,40 C10,52 20,56 32,56 C44,56 54,52 54,40 Z', { fill: '#fff', stroke: '#b4c0cc', 'stroke-width': 1.4 }),
    EL(32, 40, 22, 6, { fill: '#5b8db8', opacity: 0.25, stroke: '#b4c0cc', 'stroke-width': 1.2 }),
    ...[
      [20, 30],
      [32, 26],
      [42, 31],
      [27, 36],
      [38, 37],
    ].map(([x, y]) =>
      [
        P(`M${x},${y} l6,-3 l6,3 l0,6 l-6,3 l-6,-3 Z`, fs('#fbfbf6', -0.2, 1.1)),
        P(`M${x},${y} l6,3 l6,-3 M${x + 6},${y + 3} v6`, line('#d9dccf', 1)),
      ].join(''),
    ),
  ].join(''),
  twarog: [
    P('M8,46 L32,56 L56,46 L32,38 Z', fs('#f5f1e6', -0.2)),
    P('M14,40 C14,30 22,26 32,26 C42,26 50,30 50,40 L50,44 Q42,50 32,50 Q22,50 14,44 Z', fs('#fdfcf7', -0.18)),
    ...scatter(61, 12, 18, 30, 46, 46).map(([x, y]) => C(x.toFixed(1), y.toFixed(1), 1.1, { fill: '#ebe6d6' })),
  ].join(''),
  jogurt: cup({ color: '#ffffff', lid: '#d9e7f2', label: '#4aa3df' }) + P('M27,40 l2,3 l4,-6', line('#fff', 1.8)),
  kefir: [
    `${R(20, 18, 24, 38, 7, { fill: '#ffffff', stroke: '#b4c0cc', 'stroke-width': 1.4 })}`,
    P('M24,18 L24,12 Q24,8 28,8 L36,8 Q40,8 40,12 L40,18', { fill: '#fff', stroke: '#b4c0cc', 'stroke-width': 1.4 }),
    R(25, 3, 14, 6, 2, fs('#2f9c6a', -0.3, 1.2)),
    R(20, 30, 24, 14, 0, { fill: '#2f9c6a' }),
    P('M24,37 c3,-3 6,3 8,0 c3,-3 6,3 8,0', line('#fff', 1.3)),
    R(23, 22, 2.5, 30, 1.2, { fill: '#f0f4f7' }),
  ].join(''),
  mascarpone: [
    tub({ x: 12, y: 32, w: 40, h: 22, color: '#ffffff', lid: '#fbf7ea' }),
    P('M20,32 C20,24 26,20 32,22 C38,20 44,24 44,32 Z', fs('#fffaf0', -0.15)),
    P('M30,22 C32,16 36,18 34,22', fs('#fffaf0', -0.15, 1)),
    R(16, 40, 32, 7, 2, { fill: '#5b8db8', opacity: 0.8 }),
  ].join(''),
  'serek-kremowy': [
    tub({ x: 12, y: 34, w: 40, h: 20, color: '#ffffff', lid: '#f7f3e8' }),
    P('M16,34 C20,30 26,32 32,30 C38,32 44,30 48,34 Z', fs('#fffdf6', -0.15)),
    R(16, 41, 32, 7, 2, { fill: '#3f9a3a', opacity: 0.8 }),
    tr(
      'translate(44 22) rotate(30)',
      R(-2, -14, 4, 22, 2, fs('#c7cdd3', -0.25, 1)),
      EL(0, 9, 4, 6, fs('#dfe4e8', -0.25, 1)),
    ),
  ].join(''),
  camembert: [
    EL(28, 44, 20, 9, fs('#f7f3e6', -0.22)),
    P('M8,38 L8,44 C8,49 17,53 28,53 C39,53 48,49 48,44 L48,38', fs('#f7f3e6', -0.22)),
    EL(28, 38, 20, 9, fs('#fdfbf3', -0.15)),
    ...scatter(71, 8, 14, 33, 42, 43).map(([x, y]) => C(x.toFixed(1), y.toFixed(1), 1, { fill: '#ebe5d1' })),
    tr(
      'translate(48 46)',
      P('M-6,-6 L10,-2 L10,4 L-6,0 Z', fs('#f7e8a8', -0.25, 1.1)),
      P('M-6,-6 L10,-2 L9,-4 L-6,-8 Z', fs('#f7f3e6', -0.22, 1)),
    ),
  ].join(''),
  jajka: [
    P('M6,44 L58,44 L54,56 L10,56 Z', fs('#d9c6a3', -0.3)),
    P('M10,48 q4,4 8,0 q4,4 8,0 q4,4 8,0 q4,4 8,0 q4,4 8,0', line('#c2ab82', 1.2)),
    ...[
      [16, 36],
      [27, 33],
      [38, 34],
      [48, 37],
    ].map(([x, y]) => [EL(x, y, 6.5, 9, fs('#f0d6b3', -0.25)), gloss(x - 2, y - 4, 1.8, 2.8, 0, 0.5)].join('')),
  ].join(''),
  'maslo-klar': jar({ fill: '#f2c94c', texture: 'granules', lid: '#d9a441', x: 17, w: 30, level: 0.7, seed: 81 }),
};

export const helpers = { shade };
