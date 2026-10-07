// Przyprawy (słoik z przyprawą + charakterystyczny składnik obok) oraz oleje i oliwy.
import { C, EL, P, R, at, bottle, fs, gloss, jar, line, scatter, shade, tr } from './lib.mjs';
import { shared } from './produce.mjs';

const J = (fill, texture, seed, extra = {}) => jar({ x: 10, y: 14, w: 28, h: 40, fill, texture, seed, ...extra });

const sprig = (x, y, rot, leaf, color = '#4a9a3a', n = 5, size = 3) =>
  tr(
    `translate(${x} ${y}) rotate(${rot})`,
    P(`M0,0 L0,${-n * 5}`, line(shade(color, -0.3), 1.2)),
    ...Array.from({ length: n }, (_, k) => {
      const yy = -4 - k * 5;
      if (leaf === 'needle') return P(`M0,${yy} l-5,-2 M0,${yy} l5,-2`, line(color, 1.6));
      if (leaf === 'tiny') return [C(-2, yy, 1.4, { fill: color }), C(2, yy - 1, 1.4, { fill: color })].join('');
      return [
        EL(-size, yy, size, size * 0.6, { ...fs(color, -0.3, 0.8), transform: `rotate(-30 ${-size} ${yy})` }),
        EL(size, yy - 1, size, size * 0.6, { ...fs(color, -0.3, 0.8), transform: `rotate(30 ${size} ${yy - 1})` }),
      ].join('');
    }),
  );

const bigLeaf = (x, y, rot, color = '#3f9a3a', len = 18, w = 8) =>
  tr(
    `translate(${x} ${y}) rotate(${rot})`,
    P(
      `M0,0 C${w},${-len * 0.3} ${w},${-len * 0.8} 0,${-len} C${-w},${-len * 0.8} ${-w},${-len * 0.3} 0,0 Z`,
      fs(color, -0.3, 1.1),
    ),
    P(`M0,-1 V${-len + 2}`, line(shade(color, -0.3), 1)),
  );

const pile = (cx, cy, color, seed, n = 16, r = 1.6) =>
  [
    P(`M${cx - 12},${cy} C${cx - 8},${cy - 9} ${cx + 8},${cy - 9} ${cx + 12},${cy} Z`, fs(color, -0.25, 1)),
    ...scatter(seed, n, cx - 9, cy - 6, cx + 9, cy - 1).map(([x, y]) =>
      C(x.toFixed(1), y.toFixed(1), r * 0.5, { fill: shade(color, -0.3) }),
    ),
  ].join('');

const balls = (seed, color, x0, y0, x1, y1, n = 7, r = 2.6) =>
  scatter(seed, n, x0, y0, x1, y1)
    .map(([x, y]) =>
      [
        C(x.toFixed(1), y.toFixed(1), r, fs(color, -0.35, 0.9)),
        C((x - r * 0.35).toFixed(1), (y - r * 0.35).toFixed(1), r * 0.3, { fill: '#fff', opacity: 0.35 }),
      ].join(''),
    )
    .join('');

const oilBottle = (liquid, cap, label) => bottle({ x: 14, y: 6, w: 22, h: 50, liquid, cap, label, glass: '#f0f6ea' });

const olive = (x, y, color = '#7a8f2a', r = 4) =>
  [EL(x, y, r, r * 1.35, fs(color, -0.35, 1)), gloss(x - 1.2, y - 1.8, 1, 1.6, 0, 0.5)].join('');

export default {
  sol: [
    at(
      24,
      34,
      P('M-10,-10 L-12,22 Q0,25 12,22 L10,-10 Z', { fill: '#f2f7f9', stroke: '#9fb3bb', 'stroke-width': 1.4 }),
      P('M-11.2,6 L-12,22 Q0,25 12,22 L11.2,6 Z', { fill: '#fff' }),
      P('M-10,-10 C-10,-20 10,-20 10,-10 Z', fs('#c9d1d8', -0.3)),
      ...[
        [-4, -14],
        [0, -15.5],
        [4, -14],
        [-2, -12],
        [2, -12],
      ].map(([x, y]) => C(x, y, 0.9, { fill: '#5b6770' })),
    ),
    ...scatter(91, 14, 38, 46, 56, 54).map(([x, y]) =>
      R(x.toFixed(1), y.toFixed(1), 2, 2, 0.3, { fill: '#fff', stroke: '#b8c6ce', 'stroke-width': 0.6 }),
    ),
  ].join(''),
  pieprz: [
    at(
      22,
      34,
      R(-7, -18, 14, 10, 4, fs('#5a3a22', -0.35)),
      C(0, -20, 3, fs('#5a3a22', -0.35)),
      R(-5, -8, 10, 30, 4, fs('#7a4e2c', -0.35)),
      R(-3, -4, 2, 22, 1, { fill: '#fff', opacity: 0.25 }),
    ),
    balls(93, '#2b2b2b', 36, 44, 54, 54, 10, 2.4),
  ].join(''),
  'papryka-slod': [J('#d94a2a', 'powder', 1), shared.pepper(48, 46, 0.6, '#d8312a')].join(''),
  'papryka-ostra': [J('#9e1b10', 'powder', 2), shared.chili(48, 42, 25)].join(''),
  'papryka-wedz': [
    J('#8e3a1c', 'powder', 3),
    P('M44,52 c-4,-6 4,-8 0,-14 c-3,-5 3,-8 1,-12 M52,52 c-4,-6 4,-8 0,-14', { ...line('#9aa3ab', 1.6), opacity: 0.8 }),
    shared.pepper(48, 50, 0.4, '#a8301c'),
  ].join(''),
  'czosnek-gran': [
    J('#e6d3a2', 'granules', 4),
    tr(
      'translate(48 46) scale(0.55)',
      P('M0,-20 C3,-14 16,-10 16,2 C16,13 8,17 0,17 C-8,17 -16,13 -16,2 C-16,-10 -3,-14 0,-20 Z', fs('#f4efe6', -0.28)),
      P('M0,-18 C-9,-8 -10,8 -3,17 M0,-18 C9,-8 10,8 3,17', line('#d5c9b6', 1.4)),
    ),
  ].join(''),
  oregano: [J('#6f8a3a', 'flakes', 5), sprig(48, 56, 10, 'oval', '#4f8a32', 5, 2.4)].join(''),
  bazylia: [
    J('#4f7f2a', 'flakes', 6),
    bigLeaf(44, 56, -20, '#3f9a3a', 18, 8),
    bigLeaf(52, 56, 15, '#4aa63f', 16, 7),
  ].join(''),
  tymianek: [
    J('#7c8f4a', 'flakes', 7),
    sprig(46, 56, -10, 'tiny', '#5f7f3a', 7),
    sprig(52, 56, 12, 'tiny', '#5f7f3a', 6),
  ].join(''),
  majeranek: [J('#8a9a5b', 'flakes', 8), sprig(48, 56, 8, 'oval', '#7f9a62', 5, 2)].join(''),
  rozmaryn: [
    J('#5f7a3a', 'leaves', 9),
    sprig(46, 56, -12, 'needle', '#3f7a3a', 7),
    sprig(52, 56, 14, 'needle', '#4a8a42', 6),
  ].join(''),
  'lisc-laurowy': [
    J('#9aa35a', 'leaves', 10, { level: 0.6 }),
    bigLeaf(44, 58, -55, '#8a9a4a', 20, 5),
    bigLeaf(48, 56, -20, '#7f8f3f', 20, 5),
    bigLeaf(54, 56, 20, '#94a252', 18, 4.5),
  ].join(''),
  'ziele-ang': [J('#6b3a1f', 'balls', 11), balls(95, '#6b3a1f', 40, 46, 56, 54, 8, 2.6)].join(''),
  kminek: [
    J('#8a6a3a', 'seeds', 12),
    ...scatter(97, 10, 40, 46, 56, 54).map(([x, y, r]) =>
      P(`M${x.toFixed(1)},${y.toFixed(1)} q2,-2 4,0`, line('#7a5a2a', 1.6)),
    ),
  ].join(''),
  curry: [J('#e0a41b', 'powder', 13), pile(48, 55, '#e0a41b', 99)].join(''),
  kurkuma: [
    J('#f0a000', 'powder', 14),
    tr(
      'translate(48 48) rotate(-20)',
      P('M-10,2 C-10,-4 -2,-4 0,-2 C2,-6 8,-6 9,-1 C12,0 12,6 8,6 C4,8 -6,8 -10,2 Z', fs('#c9874a', -0.3, 1.1)),
      EL(-2, 2, 3, 2, { fill: '#f08a00' }),
    ),
  ].join(''),
  'galka-musz': [
    J('#a0703a', 'powder', 15),
    ...[
      [44, 48],
      [53, 50],
    ].map(([x, y]) =>
      [
        EL(x, y, 5.5, 4.5, fs('#7a4a24', -0.3)),
        P(`M${x - 4},${y - 1} c2,-2 6,2 8,0 M${x - 3},${y + 2} c2,-2 5,2 7,0`, line('#a8723c', 0.9)),
      ].join(''),
    ),
  ].join(''),
  cynamon: [
    J('#9b5a2a', 'powder', 16),
    ...[0, 1, 2].map((k) =>
      tr(
        `translate(${44 + k * 4} ${50 - k}) rotate(${-70 + k * 8})`,
        R(-2.6, -12, 5.2, 24, 2.6, fs('#a0582a', -0.3, 1)),
        P('M0,-12 V12', line('#7a3f1a', 0.8)),
      ),
    ),
  ].join(''),
  imbir: [
    J('#d9b77a', 'powder', 17),
    tr(
      'translate(48 48) rotate(10)',
      P(
        'M-10,4 C-12,-2 -6,-4 -4,-2 C-4,-8 2,-8 3,-3 C6,-6 11,-4 10,1 C12,4 8,8 4,6 C0,8 -6,8 -10,4 Z',
        fs('#d7b071', -0.3, 1.1),
      ),
    ),
  ].join(''),
  'chili-platki': [J('#c8321f', 'flakes', 18), shared.chili(48, 44, 30)].join(''),
  vegeta: [J('#e8b24a', 'granules', 19, { accent: '#3f9a3a' }), pile(48, 55, '#e8b24a', 101)].join(''),
  cukier: [
    ...[
      [20, 44],
      [34, 44],
      [27, 33],
      [44, 46],
    ].map(([x, y]) =>
      at(
        x,
        y,
        P('M0,-6 L8,-2 L8,7 L0,11 L-8,7 L-8,-2 Z', fs('#ffffff', -0.2, 1.2)),
        P('M-8,-2 L0,2 L8,-2 M0,2 V11', line('#d3dbe1', 1)),
        P('M0,-6 L8,-2 L0,2 L-8,-2 Z', { fill: '#f7f9fa' }),
      ),
    ),
  ].join(''),
  // ------------------------------------------------------------- oleje i oliwy
  oliwa: [
    oilBottle('#b5a92e', '#2f5d2a', '#f3ecc8'),
    tr(
      'translate(46 34) rotate(25)',
      P('M0,-14 L0,16', line('#6b5a3a', 1.4)),
      ...[
        [-1, -10, -40],
        [1, -2, 40],
        [-1, 6, -40],
      ].map(([x, y, r]) => tr(`rotate(${r} ${x} ${y})`, EL(x, y, 2.4, 6, fs('#5f8a3a', -0.3, 0.9)))),
      olive(4, 2),
      olive(-4, 12),
    ),
  ].join(''),
  'oliwa-ev': [
    bottle({ x: 14, y: 6, w: 22, h: 50, liquid: '#6f7f1c', cap: '#1f3d22', label: '#e8e2c3', glass: '#2f4a2a' }),
    olive(44, 48, '#3a3f22'),
    olive(52, 50, '#7a8f2a'),
    tr('translate(50 38) rotate(-30)', EL(0, 0, 2.6, 7, fs('#5f8a3a', -0.3, 0.9))),
  ].join(''),
  'olej-rzep': [
    oilBottle('#f2c230', '#d9a441', '#fff6d6'),
    ...[
      [46, 40],
      [52, 44],
      [48, 48],
    ].map(([x, y]) =>
      at(
        x,
        y,
        ...[0, 90, 180, 270].map((a) =>
          EL(
            (2.2 * Math.cos((a * Math.PI) / 180)).toFixed(1),
            (2.2 * Math.sin((a * Math.PI) / 180)).toFixed(1),
            2,
            1.3,
            {
              fill: '#f7d21a',
              transform: `rotate(${a} ${(2.2 * Math.cos((a * Math.PI) / 180)).toFixed(1)} ${(2.2 * Math.sin((a * Math.PI) / 180)).toFixed(1)})`,
            },
          ),
        ),
        C(0, 0, 1, { fill: '#c99a10' }),
      ),
    ),
    P('M48,52 V58 M46,48 l2,4', line('#5aa24a', 1.4)),
  ].join(''),
  'olej-slon': [
    oilBottle('#f5c518', '#3b82c4', '#fff6d6'),
    at(
      48,
      44,
      ...Array.from({ length: 12 }, (_, k) =>
        EL(
          (7 * Math.cos((k * 30 * Math.PI) / 180)).toFixed(1),
          (7 * Math.sin((k * 30 * Math.PI) / 180)).toFixed(1),
          3.2,
          1.6,
          {
            fill: '#f6c71a',
            stroke: '#d4a10a',
            'stroke-width': 0.6,
            transform: `rotate(${k * 30} ${(7 * Math.cos((k * 30 * Math.PI) / 180)).toFixed(1)} ${(7 * Math.sin((k * 30 * Math.PI) / 180)).toFixed(1)})`,
          },
        ),
      ),
      C(0, 0, 4.6, fs('#6b4a22', -0.3, 1)),
      ...scatter(103, 6, -3, -3, 3, 3).map(([x, y]) => C(x.toFixed(1), y.toFixed(1), 0.6, { fill: '#3d2a14' })),
    ),
  ].join(''),
  'olej-kokos': [
    jar({ x: 10, y: 16, w: 30, h: 38, fill: '#fbf8ef', texture: 'granules', lid: '#6b4a2a', level: 0.75, seed: 21 }),
    at(50, 48, C(0, 0, 9, fs('#7a4e2c', -0.3)), C(0, 0, 6.6, { fill: '#fbf8ef' }), P('M-9,0 H9', line('#7a4e2c', 1.4))),
  ].join(''),
  'olej-sezam': [
    bottle({ x: 14, y: 6, w: 22, h: 50, liquid: '#b5651d', cap: '#3d2a14', label: '#f6ead2', glass: '#f3e6d6' }),
    ...scatter(105, 12, 40, 44, 56, 54).map(([x, y, r]) =>
      EL(x.toFixed(1), y.toFixed(1), 1.6, 1, {
        fill: '#f1e3c2',
        stroke: '#c9b48a',
        'stroke-width': 0.4,
        transform: `rotate(${Math.round(r * 180)} ${x.toFixed(1)} ${y.toFixed(1)})`,
      }),
    ),
  ].join(''),
  'olej-frytura': [
    P('M12,18 L12,54 Q12,57 15,57 L49,57 Q52,57 52,54 L52,18 Q52,14 48,14 L16,14 Q12,14 12,18 Z', {
      fill: '#f6efc6',
      stroke: '#b9a65a',
      'stroke-width': 1.4,
    }),
    R(14, 26, 36, 29, 2, { fill: '#f2c230' }),
    P('M36,14 L36,8 Q36,4 40,4 L46,4 Q50,4 50,8 L50,14', line('#8a7a3a', 2.4)),
    R(18, 8, 10, 7, 2, fs('#d9a441', -0.3, 1.1)),
    R(17, 34, 30, 12, 2, { fill: '#fff', opacity: 0.85 }),
    P('M22,42 c2,-6 6,-6 6,-1 c0,-5 4,-5 6,1 c2,-6 6,-6 6,-1', line('#e8962a', 1.4)),
  ].join(''),
};

export const _ = { EL, R };
