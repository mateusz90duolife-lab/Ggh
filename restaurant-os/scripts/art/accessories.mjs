// Akcesoria: folie, papier, opakowania na wynos, rękawiczki, worki itp.
import { C, EL, P, R, at, fs, gloss, line, scatter, shade, tr } from './lib.mjs';

/** Rolka w kartonie z wyciągniętym arkuszem (folia, papier). */
const rollBox = (box, sheet, sheetStroke, pattern = '') =>
  [
    P('M6,30 L50,22 L58,28 L14,36 Z', fs(shade(box, 0.25), -0.3)),
    P('M14,36 L58,28 L58,40 L14,48 Z', fs(box, -0.3)),
    P('M6,30 L14,36 L14,48 L6,42 Z', fs(shade(box, -0.15), -0.3)),
    P('M14,36 L58,28 L58,30 L14,38 Z', { fill: '#fff', opacity: 0.25 }),
    P('M16,40 L56,32 L56,34 C42,40 30,56 12,58 C18,52 20,46 16,42 Z', {
      fill: sheet,
      stroke: sheetStroke,
      'stroke-width': 1.2,
      'stroke-linejoin': 'round',
    }),
    pattern,
    P('M20,44 L40,40', { ...line('#fff', 1.4), opacity: 0.7 }),
  ].join('');

const paperRoll = (x, y, w, h, color = '#ffffff', core = '#c9a97a') =>
  [
    R(x, y, w, h, 4, fs(color, -0.2)),
    EL(x + w / 2, y + 3, w / 2, 3, fs(shade(color, -0.04), -0.2, 1.2)),
    EL(x + w / 2, y + 3, w / 6, 1.4, { fill: core }),
  ].join('');

export default {
  'folia-alu': rollBox(
    '#2f6db5',
    '#d7dde2',
    '#9aa6b0',
    P('M22,46 L34,44 M18,52 L28,50', { ...line('#ffffff', 1.6), opacity: 0.8 }),
  ),
  'folia-spoz': rollBox('#2f9c6a', '#e3f2fb', '#a8c8d9', P('M22,48 L36,44', { ...line('#ffffff', 1.4), opacity: 0.9 })),
  'papier-piecz': rollBox('#c9302c', '#f3e7cf', '#cdb98d'),
  rekawiczki: [
    tr(
      'translate(30 36) rotate(-15)',
      P(
        'M-9,22 L-10,2 L-14,-12 C-15,-15 -11,-17 -10,-14 L-7,-4 L-7,-18 C-7,-21 -3,-21 -3,-18 L-3,-6 L-2,-20 C-2,-23 2,-23 2,-20 L2,-6 L3,-17 C3,-20 7,-20 7,-17 L6,-4 L8,-12 C9,-15 13,-14 12,-11 L9,4 L9,22 Z',
        fs('#5aa8e0', -0.3),
      ),
      R(-10, 18, 20, 6, 2, fs('#4a98d0', -0.3, 1.1)),
      P('M-5,-14 V-6 M0,-16 V-6 M5,-14 V-5', { ...line('#fff', 1.1), opacity: 0.4 }),
    ),
    tr(
      'translate(44 40) rotate(20)',
      P(
        'M-8,18 L-8,2 L-12,-8 C-13,-11 -9,-12 -8,-9 L-6,-2 L-6,-14 C-6,-17 -2,-17 -2,-14 L-2,-4 L-1,-16 C-1,-19 3,-19 3,-16 L3,-4 L4,-13 C4,-16 8,-16 8,-13 L7,-2 L8,-8 C9,-11 12,-10 11,-7 L8,6 L8,18 Z',
        fs('#7cbcea', -0.3),
      ),
    ),
  ].join(''),
  worki: [
    P('M14,24 C10,34 10,50 18,56 L46,56 C54,50 54,34 50,24 Z', fs('#2b3036', -0.4)),
    P('M24,24 C22,16 26,10 30,14 M40,24 C42,16 38,10 34,14', line('#2b3036', 3)),
    P('M18,30 C16,38 16,46 20,52', { ...line('#fff', 1.6), opacity: 0.25 }),
    R(26, 18, 12, 6, 2, fs('#c9302c', -0.3, 1)),
  ].join(''),
  reczniki: [
    paperRoll(14, 12, 22, 44),
    paperRoll(36, 18, 20, 38),
    ...scatter(53, 18, 16, 18, 34, 54).map(([x, y]) => C(x.toFixed(1), y.toFixed(1), 0.6, { fill: '#d8dfe4' })),
  ].join(''),
  serwetki: [
    ...[0, 1, 2, 3, 4].map((k) =>
      tr(
        `translate(32 ${50 - k * 5})`,
        P('M-20,0 L0,-8 L20,0 L0,8 Z', fs(k === 4 ? '#ffffff' : '#f2f5f7', -0.18, 1.1)),
      ),
    ),
    P('M-12,0 L0,-5 L12,0', { ...line('#d5dde3', 1), transform: 'translate(32 30)' }),
  ].join(''),
  pojemniki: [
    P('M8,38 L14,56 L50,56 L56,38 Z', fs('#d9b98a', -0.3)),
    P('M6,38 L32,30 L58,38 L32,46 Z', fs('#e9d0a6', -0.3)),
    P('M8,30 L32,22 L56,30 L56,34 L32,26 L8,34 Z', fs('#e9d0a6', -0.3, 1.1)),
    P('M22,46 L22,56 M42,46 L42,56', line('#c4a070', 1)),
  ].join(''),
  'pojemnik-zupa': [
    P('M14,30 L18,56 L46,56 L50,30 Z', {
      fill: '#f4f8fa',
      stroke: '#9fb3bb',
      'stroke-width': 1.4,
      'stroke-linejoin': 'round',
    }),
    P('M16,40 L18,54 L46,54 L48,40 Z', { fill: '#f2c14e', opacity: 0.85 }),
    EL(32, 30, 19, 5, fs('#e5edf2', -0.25, 1.3)),
    EL(32, 27, 17, 4, fs('#f4f8fa', -0.25, 1.2)),
    R(19, 32, 3, 18, 1.5, { fill: '#fff', opacity: 0.6 }),
  ].join(''),
  kubki: [
    ...[
      [24, 0],
      [40, 6],
    ].map(([x, d]) =>
      tr(
        `translate(${x} ${d})`,
        P('M-11,14 L-8,50 L8,50 L11,14 Z', fs('#ffffff', -0.22)),
        R(-12, 10, 24, 5, 2, fs('#e5ebf0', -0.25, 1.1)),
        P('M-10.3,24 L10.3,24 L9.4,36 L-9.4,36 Z', { fill: d ? '#2f9c6a' : '#c9302c' }),
      ),
    ),
  ].join(''),
  sztucce: [
    tr(
      'translate(24 32) rotate(-20)',
      R(-2, 0, 4, 26, 2, fs('#ffffff', -0.25)),
      P('M-6,-20 L-6,-6 C-6,0 6,0 6,-6 L6,-20 M-2,-20 V-6 M2,-20 V-6', {
        fill: 'none',
        stroke: '#c7cfd6',
        'stroke-width': 1.6,
        'stroke-linecap': 'round',
      }),
      P('M-6,-6 C-6,0 6,0 6,-6 L6,-8 L-6,-8 Z', fs('#ffffff', -0.25, 1.1)),
    ),
    tr(
      'translate(40 32) rotate(20)',
      R(-2.2, 2, 4.4, 24, 2, fs('#ffffff', -0.25)),
      P('M-2.5,4 L-2.5,-20 C3,-18 5,-8 3,4 Z', fs('#ffffff', -0.25, 1.2)),
    ),
  ].join(''),
  torby: [
    P('M14,24 L50,24 L54,56 L10,56 Z', fs('#c9a06a', -0.3)),
    P('M14,24 L10,56 L6,52 L10,24 Z', fs('#b58c58', -0.3, 1.1)),
    P('M24,24 C24,12 40,12 40,24', line('#8a6a3a', 2.4)),
    R(18, 34, 28, 14, 2, { fill: '#e9d3b0', opacity: 0.8 }),
  ].join(''),
  'woreczki-zip': [
    tr(
      'translate(32 38) rotate(-8)',
      R(-18, -20, 36, 38, 3, { fill: '#e6f2f8', stroke: '#9fbccc', 'stroke-width': 1.4 }),
      R(-18, -16, 36, 3, 1, { fill: '#2f6db5' }),
      R(-14, -8, 14, 6, 1.5, { fill: '#fff', stroke: '#9fbccc', 'stroke-width': 0.8 }),
      R(-14, -10, 3, 26, 1.5, { fill: '#fff', opacity: 0.7 }),
    ),
    tr(
      'translate(40 44) rotate(10)',
      R(-14, -14, 28, 28, 3, { fill: '#eef7fb', stroke: '#9fbccc', 'stroke-width': 1.3 }),
      R(-14, -11, 28, 3, 1, { fill: '#c9302c' }),
    ),
  ].join(''),
  'woreczki-prozn': [
    tr(
      'translate(32 38) rotate(-6)',
      R(-20, -18, 40, 36, 4, { fill: '#e9f1f5', stroke: '#9fb3bb', 'stroke-width': 1.4 }),
      ...Array.from({ length: 8 }, (_, r) =>
        Array.from({ length: 9 }, (_, c) => C(-16 + c * 4, -14 + r * 4, 0.7, { fill: '#c3d3dc' })),
      ).flat(),
      R(-20, -18, 40, 5, 3, { fill: '#cfdde5' }),
    ),
  ].join(''),
  wykalaczki: [
    P('M20,30 L22,56 L42,56 L44,30 Z', fs('#d9b98a', -0.3)),
    EL(32, 30, 12, 3.5, fs('#c9a06a', -0.3, 1.2)),
    ...Array.from({ length: 9 }, (_, k) =>
      P(`M${24 + k * 2},30 L${22 + k * 2.5},${8 + (k % 3) * 3}`, line('#e9cf9f', 1.3)),
    ),
    R(20, 40, 24, 8, 1, { fill: '#c9302c', opacity: 0.85 }),
  ].join(''),
  patyczki: [
    ...Array.from({ length: 8 }, (_, k) =>
      P(`M${12 + k * 3},${56 - k} L${36 + k * 3},${8 + k}`, line(k % 2 ? '#e2c48e' : '#d8b67a', 1.8)),
    ),
    R(28, 30, 10, 5, 1.5, { ...fs('#c9302c', -0.3, 1), transform: 'rotate(-62 33 32)' }),
  ].join(''),
  'rolki-kasa': [
    ...[
      [22, 44],
      [42, 44],
      [32, 30],
    ].map(([x, y]) =>
      at(
        x,
        y,
        C(0, 0, 10, fs('#ffffff', -0.2)),
        C(0, 0, 7.5, { fill: 'none', stroke: '#e3e8ec', 'stroke-width': 1 }),
        C(0, 0, 3, fs('#e9d3b0', -0.25, 1)),
        C(0, 0, 1.4, { fill: '#c9b48a' }),
      ),
    ),
  ].join(''),
  gabki: [
    ...[
      [24, 40, -10],
      [42, 44, 12],
    ].map(([x, y, r]) =>
      tr(
        `translate(${x} ${y}) rotate(${r})`,
        R(-14, -4, 28, 12, 2.5, fs('#f6d548', -0.3)),
        R(-14, -9, 28, 6, 2, fs('#3f9a3a', -0.3)),
        ...scatter(x, 6, -11, -1, 11, 6).map(([a, b]) => C(a.toFixed(1), b.toFixed(1), 0.9, { fill: '#e0bb2a' })),
      ),
    ),
  ].join(''),
};

export const _ = { gloss };
