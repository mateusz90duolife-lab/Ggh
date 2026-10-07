// Zupy w miskach (kolor zupy + charakterystyczne dodatki) i zakwas.
import { C, EL, P, R, at, bottle, fs, line, scatter, soupBowl, tr } from './lib.mjs';

const noodles = (color = '#f7e3a6') =>
  P(
    'M16,30 c3,-2 5,2 8,0 c3,-2 5,2 8,0 M20,33 c3,-2 5,2 8,0 c3,-2 5,2 8,0 M30,28 c3,-2 5,2 8,0 c3,-2 5,2 8,0',
    line(color, 1.4),
  );
const carrotSlices = (pts) => pts.map(([x, y]) => [EL(x, y, 2.6, 1.6, fs('#f08a2a', -0.25, 0.8))].join('')).join('');
const herbs = (seed) =>
  scatter(seed, 7, 14, 27, 50, 34)
    .map(([x, y]) => EL(x.toFixed(1), y.toFixed(1), 1.2, 0.7, { fill: '#3f9a3a' }))
    .join('');
const cubes = (pts, color) => pts.map(([x, y]) => R(x - 1.8, y - 1.4, 3.6, 2.8, 0.6, fs(color, -0.25, 0.7))).join('');
const sausage = (pts) =>
  pts
    .map(([x, y]) => [EL(x, y, 3, 1.9, fs('#c86b5a', -0.25, 0.8)), EL(x, y, 1.8, 1, { fill: '#e8968a' })].join(''))
    .join('');
const swirl = (color = '#fff') => P('M24,30 c4,-4 10,-4 14,0 c-4,3 -8,3 -10,0', { ...line(color, 1.8), opacity: 0.95 });

export default {
  rosol: soupBowl(
    '#f2c14e',
    [
      noodles(),
      carrotSlices([
        [22, 31],
        [36, 33],
        [42, 29],
      ]),
      herbs(3),
    ].join(''),
  ),
  zurek: soupBowl(
    '#e9dfc4',
    [
      at(26, 30, EL(0, 0, 5, 3.2, fs('#ffffff', -0.15, 0.9)), C(0.5, 0, 1.8, { fill: '#f2c230' })),
      sausage([
        [38, 29],
        [42, 32],
        [33, 33],
      ]),
      herbs(5),
    ].join(''),
  ),
  zakwas:
    bottle({ liquid: '#e7dcc0', cap: '#8a6a3a', shape: 'wide', label: '#f5ecd8', x: 20, w: 24 }) +
    P('M24,46 c3,-2 6,2 8,0 c3,-2 6,2 8,0', line('#d4c49c', 1.2)),
  barszcz: soupBowl(
    '#a3122a',
    [
      at(26, 30, P('M-4,1 C-4,-3 4,-3 4,1 Q0,3 -4,1 Z', fs('#f1e2c9', -0.25, 0.9))),
      at(38, 31, P('M-4,1 C-4,-3 4,-3 4,1 Q0,3 -4,1 Z', fs('#f1e2c9', -0.25, 0.9))),
      herbs(7),
    ].join(''),
  ),
  pomidorowa: soupBowl('#e0532f', [noodles('#f7dca0'), herbs(9), swirl('#fbe7d9')].join('')),
  ogorkowa: soupBowl(
    '#e7dfb2',
    [
      cubes(
        [
          [22, 30],
          [30, 33],
          [40, 30],
          [44, 33],
        ],
        '#6aa84f',
      ),
      cubes(
        [
          [26, 33],
          [36, 29],
        ],
        '#f3e3b5',
      ),
      herbs(11),
    ].join(''),
  ),
  grochowka: soupBowl(
    '#c2a73e',
    [
      sausage([
        [24, 30],
        [38, 32],
      ]),
      cubes(
        [
          [30, 29],
          [44, 30],
        ],
        '#f0c27a',
      ),
      herbs(13),
    ].join(''),
  ),
  kapusniak: soupBowl(
    '#e7a65a',
    [
      P('M18,30 c4,-3 6,1 10,-1 M30,33 c4,-3 6,1 10,-1 M34,28 c4,-3 6,1 10,-1', line('#dfeaa8', 2)),
      carrotSlices([[24, 33]]),
      herbs(15),
    ].join(''),
  ),
  pieczarkowa: soupBowl(
    '#e3d3b8',
    [
      ...[
        [24, 30],
        [36, 32],
        [42, 28],
      ].map(([x, y]) =>
        at(
          x,
          y,
          P('M-4,0 C-4,-4 4,-4 4,0 Z', fs('#d6c0a0', -0.3, 0.8)),
          R(-1.2, 0, 2.4, 2.4, 0.6, { fill: '#e8dccb' }),
        ),
      ),
      herbs(17),
    ].join(''),
  ),
  'krem-dynia': soupBowl(
    '#f08a24',
    [
      swirl(),
      ...[
        [40, 29],
        [43, 31],
        [37, 32],
      ].map(([x, y]) => EL(x, y, 1.6, 0.9, fs('#5d7a2a', -0.2, 0.6))),
    ].join(''),
  ),
  'krem-brokul': soupBowl(
    '#86b24a',
    [swirl(), at(42, 29, C(0, 0, 2.4, fs('#3d8b37', -0.3, 0.8)), C(2, 1, 2, fs('#3d8b37', -0.3, 0.8)))].join(''),
  ),
  cebulowa: soupBowl(
    '#a8692b',
    [
      ...[
        [22, 30],
        [34, 32],
      ].map(([x, y]) => EL(x, y, 4, 2, line('#f1d7a4', 1.4))),
      at(
        40,
        29,
        R(-5, -3, 10, 6, 1.5, fs('#d9a14f', -0.3, 0.9)),
        P('M-5,-3 C-2,-6 3,-6 5,-3', fs('#f7d36a', -0.2, 0.8)),
      ),
    ].join(''),
  ),
  flaki: soupBowl(
    '#d0773a',
    [
      P('M18,30 c3,1 5,-1 8,0 M24,33 c3,1 5,-1 8,0 M34,29 c3,1 5,-1 8,0 M38,33 c3,1 5,-1 8,0', line('#f5e3b8', 2.2)),
      herbs(19),
    ].join(''),
  ),
  'bulion-warz': soupBowl(
    '#f1d46a',
    [
      cubes(
        [
          [22, 30],
          [36, 32],
        ],
        '#f08a2a',
      ),
      cubes(
        [
          [30, 29],
          [42, 30],
        ],
        '#e9e3c4',
      ),
      herbs(21),
    ].join(''),
  ),
  'bulion-wol': soupBowl(
    '#b5762f',
    [
      cubes(
        [
          [24, 30],
          [38, 31],
        ],
        '#8a3a2a',
      ),
      carrotSlices([
        [31, 33],
        [44, 29],
      ]),
      herbs(23),
    ].join(''),
  ),
};

export const unused = { tr };
