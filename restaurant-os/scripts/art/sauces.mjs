// Sosy, dipy i octy.
import { C, EL, P, R, at, bottle, fs, gloss, jar, line, scatter, tr } from './lib.mjs';
import { shared } from './produce.mjs';

const dipBowl = (sauce, extra = '') =>
  [
    P('M8,38 C8,50 18,56 32,56 C46,56 56,50 56,38 Z', { fill: '#fff', stroke: '#b4c0cc', 'stroke-width': 1.4 }),
    EL(32, 38, 24, 7, { fill: '#fff', stroke: '#b4c0cc', 'stroke-width': 1.4 }),
    EL(32, 38.5, 21, 5.6, { fill: sauce }),
    P('M24,37 c4,-3 10,-3 14,0', { ...line('#fff', 1.4), opacity: 0.6 }),
    extra,
  ].join('');

const gravyBoat = (sauce) =>
  [
    P('M8,34 L50,30 C58,30 58,40 50,42 L46,50 Q32,56 18,52 Q10,48 8,34 Z', {
      fill: '#fff',
      stroke: '#b4c0cc',
      'stroke-width': 1.4,
      'stroke-linejoin': 'round',
    }),
    P('M50,34 C56,34 56,40 50,40', line('#b4c0cc', 1.4)),
    P('M10,35 L48,32 Q40,38 24,38 Q14,38 10,35 Z', { fill: sauce }),
    P('M4,32 Q6,28 12,30 L10,35 Z', { fill: sauce, stroke: '#b4c0cc', 'stroke-width': 1 }),
    R(22, 52, 18, 4, 2, { fill: '#e5ebf0', stroke: '#b4c0cc', 'stroke-width': 1 }),
  ].join('');

const garlicClove = (x, y, s = 1) =>
  tr(
    `translate(${x} ${y}) scale(${s})`,
    P('M0,-8 C5,-4 6,4 2,8 C0,9 -3,8 -4,5 C-5,0 -3,-5 0,-8 Z', fs('#f4efe6', -0.28)),
    P('M0,-8 q0,-2 1,-3', line('#a99a80', 1.2)),
  );

export default {
  ketchup: [
    bottle({ shape: 'squeeze', liquid: '#d7261e', cap: '#f2f2f2', x: 16, w: 22, y: 10, h: 46 }),
    R(19, 30, 16, 12, 2, { fill: '#fff', opacity: 0.9 }),
    shared.tomato(26, 36, 4.2),
    shared.tomato(48, 48, 8),
  ].join(''),
  majonez: [
    jar({ x: 14, y: 16, w: 36, h: 38, fill: '#fbf3d5', texture: 'granules', lid: '#3b82c4', level: 0.82, seed: 31 }),
    at(32, 44, EL(0, 0, 5, 3.4, fs('#fff', -0.15, 0.9)), C(0.5, 0, 1.8, { fill: '#f2c230' })),
  ].join(''),
  musztarda: [
    jar({ x: 14, y: 16, w: 36, h: 38, fill: '#e3b31a', texture: 'seeds', lid: '#7a5a1a', level: 0.82, seed: 33 }),
  ].join(''),
  'sos-sojowy': [
    bottle({ x: 20, y: 8, w: 22, h: 48, liquid: '#2b1a10', cap: '#c9302c', label: '#f6efe2', glass: '#e9e2da' }),
    P('M44,44 c4,-6 10,-6 12,0 Z', fs('#2b1a10', -0.2, 1)),
    EL(50, 48, 8, 2.4, fs('#fff', -0.2, 1)),
  ].join(''),
  'sos-czosnkowy': dipBowl(
    '#f4f0e6',
    [
      garlicClove(46, 30, 0.9),
      ...scatter(41, 8, 18, 36, 44, 41).map(([x, y]) => C(x.toFixed(1), y.toFixed(1), 0.9, { fill: '#3f9a3a' })),
    ].join(''),
  ),
  'sos-bbq': [
    bottle({ x: 18, y: 8, w: 24, h: 48, liquid: '#6b2e14', cap: '#1f2937', label: '#f2a33a', glass: '#e9ddd2' }),
    P('M24,44 c2,-6 5,-6 5,-2 c0,-4 3,-4 4,1 c2,-6 6,-4 5,2', line('#c9302c', 1.6)),
    P('M46,52 c-3,-5 3,-7 0,-12 c-2,-3 1,-6 2,-8 c4,5 6,10 2,20 Z', fs('#f08a24', -0.3, 1)),
  ].join(''),
  'sos-pomidor': [
    jar({ x: 14, y: 16, w: 30, h: 38, fill: '#c8321f', texture: 'granules', lid: '#2f5d2a', level: 0.82, seed: 35 }),
    shared.tomato(48, 46, 8),
    P('M48,34 c3,-6 9,-6 10,-2 c-4,2 -7,3 -10,2 Z', fs('#3f9a3a', -0.3, 1)),
  ].join(''),
  'sos-smietan': gravyBoat('#f5ecd6'),
  'slodko-kwasny': [
    bottle({ x: 16, y: 8, w: 22, h: 48, liquid: '#e8562b', cap: '#1f2937', label: '#fff1d6', glass: '#f6e3dc' }),
    at(
      48,
      46,
      P('M-7,-2 L0,-8 L7,-2 L4,8 L-4,8 Z', fs('#f6c52a', -0.3)),
      P('M-4,0 l8,0 M-3,4 l6,0', line('#e0a412', 1)),
      P('M0,-8 c-2,-4 -1,-7 0,-8 c1,1 2,4 0,8', fs('#5aa24a', -0.3, 1)),
    ),
  ].join(''),
  teriyaki: [
    bottle({ x: 18, y: 8, w: 22, h: 48, liquid: '#3d1f0f', cap: '#8a2a1f', label: '#efe2c6', glass: '#e2d8cf' }),
    ...scatter(43, 10, 42, 46, 56, 54).map(([x, y, r]) =>
      EL(x.toFixed(1), y.toFixed(1), 1.6, 1, {
        fill: '#f1e3c2',
        stroke: '#c9b48a',
        'stroke-width': 0.4,
        transform: `rotate(${Math.round(r * 180)} ${x.toFixed(1)} ${y.toFixed(1)})`,
      }),
    ),
  ].join(''),
  tatarski: dipBowl(
    '#f2ecd2',
    [
      ...scatter(45, 9, 18, 36, 46, 41).map(([x, y]) =>
        R(x.toFixed(1), y.toFixed(1), 2.2, 1.6, 0.4, { fill: '#6aa84f' }),
      ),
      tr(
        'translate(46 28) rotate(-30)',
        R(-8, -3.5, 16, 7, 3.5, fs('#5f8f3a', -0.3, 1)),
        ...[-4, 0, 4].map((x) => C(x, 0, 0.7, { fill: '#3d6a24' })),
      ),
    ].join(''),
  ),
  holenderski: gravyBoat('#f2d15b'),
  pesto: [
    jar({ x: 14, y: 16, w: 30, h: 38, fill: '#5c8a2a', texture: 'flakes', lid: '#c9a14a', level: 0.8, seed: 37 }),
    tr(
      'translate(50 54) rotate(10)',
      P('M0,0 C8,-5 8,-15 0,-20 C-8,-15 -8,-5 0,0 Z', fs('#3f9a3a', -0.3, 1)),
      P('M0,-1 V-18', line('#2d6a20', 0.9)),
    ),
    ...[
      [44, 54],
      [56, 52],
    ].map(([x, y]) => EL(x, y, 2, 1.2, fs('#f2e2b0', -0.25, 0.6))),
  ].join(''),
  sriracha: [
    bottle({ shape: 'squeeze', liquid: '#d7261e', cap: '#2f9c4a', x: 20, w: 22, y: 10, h: 46 }),
    R(23, 30, 16, 10, 2, { fill: '#fff', opacity: 0.9 }),
    P('M27,36 c3,-4 6,-4 8,0', line('#d7261e', 1.6)),
    shared.chili(50, 44, 25),
  ].join(''),
  tabasco: [
    bottle({
      shape: 'small',
      x: 22,
      y: 16,
      w: 18,
      h: 40,
      liquid: '#b8231c',
      cap: '#e2e2e2',
      label: '#f2e5c4',
      glass: '#efe2df',
    }),
    shared.chili(48, 44, 30, '#c42a1e'),
  ].join(''),
  worcester: [
    bottle({ x: 20, y: 6, w: 22, h: 50, liquid: '#3a1f12', cap: '#e8a33a', label: '#f2a33a', glass: '#2f2420' }),
  ].join(''),
  ocet: [
    bottle({ x: 20, y: 6, w: 22, h: 50, liquid: '#f2ead0', cap: '#5b6770', label: '#ffffff', glass: '#f4f8fa' }),
  ].join(''),
  'ocet-balsam': [
    bottle({ x: 16, y: 6, w: 22, h: 50, liquid: '#2a1410', cap: '#1f2937', label: '#e9d9b5', glass: '#3a2a26' }),
    ...[
      [46, 44],
      [52, 44],
      [49, 49],
      [43, 49],
      [55, 49],
      [46, 54],
      [52, 54],
    ].map(([x, y]) =>
      [C(x, y, 3.4, fs('#5b2a6e', -0.3, 0.9)), C(x - 1, y - 1, 0.9, { fill: '#fff', opacity: 0.4 })].join(''),
    ),
    P('M49,40 v-6', line('#6b5a3a', 1.6)),
  ].join(''),
};

export const _ = { gloss };
