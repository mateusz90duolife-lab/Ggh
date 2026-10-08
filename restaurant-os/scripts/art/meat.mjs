// Mięso i wędliny (surowe kawałki na desce, wędliny w całości i w plastrach).
import { C, EL, P, R, at, board, fs, gloss, line, scatter, shade, tr } from './lib.mjs';

const BEEF = '#c8423a';
const PORK = '#ec9a92';
const FAT = '#f6ead9';
const SKIN = '#f3c9a6';
const BONE = '#f7f0e2';

const marbling = (seed, x0, y0, x1, y1, color = '#f8e6dc', n = 6) =>
  scatter(seed, n, x0, y0, x1, y1)
    .map(([x, y, r]) =>
      P(
        `M${x.toFixed(1)},${y.toFixed(1)} c2,${(r * 3 - 1.5).toFixed(1)} 4,${(1.5 - r * 3).toFixed(1)} ${(5 + r * 3).toFixed(1)},${(r * 2 - 1).toFixed(1)}`,
        { ...line(color, 1), opacity: 0.9 },
      ),
    )
    .join('');

function mince(color) {
  const swirls = scatter(color === BEEF ? 21 : 22, 26, 14, 30, 50, 48)
    .map(([x, y, r]) =>
      P(
        `M${x.toFixed(1)},${y.toFixed(1)} q1.5,-2 3,0 q1.5,2 3,0`,
        line(r > 0.5 ? shade(color, 0.3) : shade(color, -0.25), 1.2),
      ),
    )
    .join('');
  return [
    R(6, 36, 52, 18, 6, { fill: '#fff', stroke: '#c7d0d8', 'stroke-width': 1.3 }),
    P('M10,44 C10,28 20,22 32,22 C44,22 54,28 54,44 Q54,48 50,48 L14,48 Q10,48 10,44 Z', fs(color, -0.3)),
    swirls,
    gloss(24, 28, 6, 2.5, -10, 0.3),
  ].join('');
}

const fillet = (x, y, rot, s, color = '#f2b4a6') =>
  tr(
    `translate(${x} ${y}) rotate(${rot}) scale(${s})`,
    P('M-16,2 C-16,-8 -4,-12 6,-10 C14,-8 18,-2 16,4 C12,10 -2,10 -16,2 Z', fs(color, -0.25)),
    P('M-8,-4 C-2,-2 6,-2 12,-4 M-10,2 C-2,4 6,4 12,2', { ...line(shade(color, -0.12), 1), opacity: 0.8 }),
    gloss(-4, -6, 6, 1.6, -5, 0.4),
  );

const drumstick = (x, y, rot, s = 1, skin = SKIN) =>
  tr(
    `translate(${x} ${y}) rotate(${rot}) scale(${s})`,
    R(-2.5, 8, 5, 12, 2.5, fs(BONE, -0.25, 1.2)),
    C(-3, 21, 3, fs(BONE, -0.25, 1.2)),
    C(3, 21, 3, fs(BONE, -0.25, 1.2)),
    P('M-11,-6 C-11,-18 11,-18 11,-6 C11,2 4,9 2,11 L-2,11 C-4,9 -11,2 -11,-6 Z', fs(skin, -0.28)),
    gloss(-5, -10, 3.5, 2.2),
  );

const meat = {
  antrykot: [
    board(),
    tr(
      'translate(32 40) rotate(-8)',
      P('M-20,-4 C-20,-14 -6,-18 6,-16 C18,-14 22,-6 20,2 C18,10 4,12 -8,10 C-16,9 -20,4 -20,-4 Z', fs(FAT, -0.25)),
      P('M-17,-3 C-17,-11 -5,-14 5,-13 C15,-12 18,-6 17,1 C15,7 4,9 -6,7 C-13,6 -17,3 -17,-3 Z', fs(BEEF, -0.3, 1.1)),
      marbling(1, -14, -10, 10, 5),
      C(4, -3, 3.2, { fill: FAT }),
    ),
  ].join(''),
  poledwica: [
    board(),
    tr(
      'translate(30 40) rotate(-10)',
      R(-20, -8, 36, 16, 8, fs('#b8352f', -0.3)),
      EL(16, 0, 5, 8, fs('#d65a4c', -0.3)),
      EL(16, 0, 2.6, 4.5, { fill: '#e57b6b' }),
      P('M-14,-4 h22 M-12,3 h18', { ...line('#e8c3b5', 1), opacity: 0.7 }),
    ),
  ].join(''),
  'mielone-wol': mince(BEEF),
  'mielone-wp': mince(PORK),
  schab: [
    board(),
    tr(
      'translate(30 40) rotate(-6)',
      R(-20, -10, 34, 18, 7, fs('#ee9f97', -0.28)),
      R(-20, -10, 34, 6, 4, fs(FAT, -0.2, 1)),
      EL(14, 0, 6, 9, fs('#f4b3aa', -0.28)),
      EL(14, -5, 6, 3, { fill: FAT }),
    ),
  ].join(''),
  karkowka: [
    board(),
    ...[
      [22, 42, -15],
      [40, 42, 12],
    ].map(([x, y, r]) =>
      tr(
        `translate(${x} ${y}) rotate(${r})`,
        P('M-11,0 C-11,-9 -3,-11 3,-10 C10,-9 12,-3 11,3 C9,9 2,10 -4,9 C-9,8 -11,5 -11,0 Z', fs('#e98a84', -0.3)),
        marbling(x, -8, -6, 6, 6, FAT, 5),
      ),
    ),
  ].join(''),
  lopatka: [
    board(),
    tr(
      'translate(32 40)',
      P('M-20,2 C-22,-10 -8,-16 4,-14 C16,-12 22,-4 18,6 C14,12 0,12 -10,10 C-16,9 -19,6 -20,2 Z', fs('#e3857c', -0.3)),
      P('M-12,-6 C-4,-2 4,-8 12,-4 M-14,4 C-6,2 2,8 12,4', line(FAT, 2.2)),
    ),
  ].join(''),
  zeberka: [
    board(),
    tr(
      'translate(32 42) rotate(-6)',
      ...[-14, -5, 4, 13].map((x) => R(x - 2.2, -16, 4.4, 10, 2, fs(BONE, -0.28, 1.1))),
      R(-22, -8, 44, 14, 5, fs('#d76f63', -0.3)),
      P('M-18,-2 h36 M-16,3 h30', { ...line('#f0c0b0', 1), opacity: 0.8 }),
    ),
  ].join(''),
  boczek: [
    board(),
    ...[0, 1, 2].map((k) =>
      tr(
        `translate(32 ${30 + k * 7})`,
        P(
          'M-22,0 C-14,-4 -6,4 2,0 C10,-4 16,4 22,0 L22,5 C16,9 10,1 2,5 C-6,9 -14,1 -22,5 Z',
          fs('#d65b4d', -0.3, 1.1),
        ),
        P('M-22,2.5 C-14,-1.5 -6,6.5 2,2.5 C10,-1.5 16,6.5 22,2.5', line(FAT, 1.6)),
      ),
    ),
  ].join(''),
  golonka: [
    board(),
    tr(
      'translate(30 38) rotate(-25)',
      R(14, -3, 10, 6, 3, fs(BONE, -0.28)),
      C(25, -3, 3.4, fs(BONE, -0.28, 1.1)),
      C(25, 3, 3.4, fs(BONE, -0.28, 1.1)),
      P('M-18,0 C-18,-14 0,-16 10,-8 C14,-4 14,4 10,8 C0,16 -18,14 -18,0 Z', fs('#e9b08a', -0.3)),
      P('M-12,-6 c4,2 8,2 12,0 M-12,2 c4,2 8,2 12,0', line('#d48f68', 1)),
      gloss(-8, -8, 5, 2),
    ),
  ].join(''),
  'piers-kurczak': [board(), fillet(24, 38, -12, 0.95), fillet(40, 45, 10, 0.95)].join(''),
  udko: [board(), drumstick(24, 34, -25), drumstick(42, 36, 20)].join(''),
  skrzydelka: [
    board(),
    ...[
      [22, 40, -10],
      [42, 42, 15],
    ].map(([x, y, r]) =>
      tr(
        `translate(${x} ${y}) rotate(${r})`,
        P(
          'M-12,-2 C-12,-8 -4,-9 0,-6 C2,-10 8,-12 12,-8 C14,-4 10,0 6,2 C2,4 -2,6 -6,6 C-10,6 -12,2 -12,-2 Z',
          fs(SKIN, -0.28),
        ),
        P('M0,-6 C0,-2 1,1 3,3', line('#d9a07a', 1.2)),
        gloss(-6, -4, 3, 1.6),
      ),
    ),
  ].join(''),
  kurczak: [
    board(),
    at(
      32,
      38,
      P('M-18,2 C-18,-12 -6,-18 4,-17 C16,-16 20,-6 18,4 C16,12 6,15 -4,14 C-14,13 -18,8 -18,2 Z', fs(SKIN, -0.28)),
      drumstick(-14, 10, 150, 0.7),
      drumstick(10, 13, -150, 0.7),
      P('M-10,-10 C-4,-6 4,-6 10,-10', line('#d9a07a', 1.2)),
      gloss(-6, -10, 6, 2.6),
    ),
  ].join(''),
  indyk: [
    board(),
    tr(
      'translate(32 41) rotate(-6)',
      P('M-22,2 C-22,-10 -6,-14 8,-12 C18,-10 22,-4 20,4 C16,10 0,11 -22,2 Z', fs('#f0b2a3', -0.25)),
      P('M8,-12 C12,-6 12,4 8,9 M13,-11 C17,-5 17,4 13,8', line('#d98e7e', 1.3)),
      gloss(-8, -6, 7, 1.8, -5, 0.4),
    ),
  ].join(''),
  kaczka: [
    board(),
    at(
      32,
      38,
      P(
        'M-20,2 C-20,-12 -8,-17 4,-16 C14,-15 20,-8 20,0 C20,10 10,15 -2,15 C-14,15 -20,10 -20,2 Z',
        fs('#e7a982', -0.3),
      ),
      P('M18,-4 C24,-8 27,-6 26,-2 C25,1 22,1 19,0', fs('#e7a982', -0.3)),
      drumstick(-14, 11, 150, 0.65, '#e7a982'),
      drumstick(8, 14, -150, 0.65, '#e7a982'),
      P('M-12,-8 C-4,-4 6,-4 12,-8', line('#c98660', 1.2)),
      gloss(-6, -9, 6, 2.4),
    ),
  ].join(''),
  cielecina: [
    board(),
    tr(
      'translate(32 41) rotate(-10)',
      P('M-20,0 C-22,-9 -10,-13 0,-12 C10,-13 22,-8 20,1 C18,9 6,11 -4,10 C-14,10 -19,6 -20,0 Z', fs('#f3b0a3', -0.25)),
      P('M-14,-2 C-6,1 6,-4 14,0', { ...line('#e59586', 1), opacity: 0.8 }),
      gloss(-6, -6, 6, 1.6, -5, 0.4),
    ),
  ].join(''),
  jagniecina: [
    board(),
    tr(
      'translate(30 44) rotate(-12)',
      ...[-12, -4, 4, 12].map((x) => R(x - 1.8, -24, 3.6, 16, 1.8, fs(BONE, -0.28, 1.1))),
      R(-18, -10, 36, 14, 6, fs('#b94a45', -0.3)),
      R(-18, -10, 36, 5, 3, fs(FAT, -0.2, 1)),
    ),
  ].join(''),
  watrobka: [
    board(),
    ...[
      [22, 40, 10, 7, -15],
      [38, 38, 11, 8, 10],
      [32, 46, 9, 6, 0],
    ].map(([x, y, rx, ry, r]) =>
      tr(
        `rotate(${r} ${x} ${y})`,
        EL(x, y, rx, ry, fs('#7a2a23', -0.3)),
        gloss(x - rx * 0.3, y - ry * 0.4, rx * 0.4, ry * 0.25, 0, 0.35),
      ),
    ),
  ].join(''),
  kielbasa: [
    P('M14,40 C10,26 20,14 32,14 C44,14 54,26 50,40', { ...line('#a5452d', 9), 'stroke-linecap': 'round' }),
    P('M14,40 C10,26 20,14 32,14 C44,14 54,26 50,40', { ...line('#b8573c', 6.4), 'stroke-linecap': 'round' }),
    P('M18,28 C22,20 30,18 34,18', { ...line('#fff', 1.6), opacity: 0.35 }),
    P('M12,42 l-2,4 M52,42 l2,4', line('#8a6a4a', 1.4)),
    ...[
      [26, 48],
      [40, 49],
    ].map(([x, y]) =>
      at(
        x,
        y,
        C(0, 0, 7, fs('#c86b5a', -0.3)),
        C(0, 0, 5.6, { fill: '#e8968a' }),
        ...scatter(x, 6, -4, -4, 4, 4).map(([a, b]) => C(a.toFixed(1), b.toFixed(1), 0.8, { fill: FAT })),
      ),
    ),
  ].join(''),
  parowki: [
    board(),
    ...[-8, 0, 8].map((dy) =>
      tr(
        `translate(32 ${40 + dy * 0.9}) rotate(-8)`,
        R(-20, -3.6, 40, 7.2, 3.6, fs('#e88f6f', -0.28)),
        P('M-16,-1.4 H14', { ...line('#fff', 1.2), opacity: 0.35 }),
      ),
    ),
  ].join(''),
  szynka: [
    board(),
    tr(
      'translate(24 38)',
      EL(0, 0, 14, 11, fs('#f1a29e', -0.28)),
      P('M-14,0 A14,11 0 0 1 14,0', line(FAT, 2.6)),
      P('M-6,-2 c3,2 7,2 10,-1 M-8,4 c4,2 8,2 12,-1', { ...line('#f8c9c4', 1.1) }),
    ),
    tr(
      'translate(42 44)',
      EL(0, 0, 12, 9, fs('#ee9993', -0.28)),
      EL(0, 0, 9.5, 7, { fill: '#f6b5b0' }),
      P('M-6,0 c3,2 7,2 10,-1', line('#f8c9c4', 1.1)),
    ),
  ].join(''),
  salami: [
    tr(
      'translate(26 36) rotate(-25)',
      R(-18, -7, 34, 14, 7, fs('#9e2b2b', -0.3)),
      ...scatter(31, 12, -14, -5, 12, 5).map(([x, y]) => C(x.toFixed(1), y.toFixed(1), 0.9, { fill: '#f1d9d0' })),
      EL(16, 0, 3.5, 7, fs('#b84040', -0.3, 1.1)),
      P('M-20,0 l-3,-2', line('#8a6a4a', 1.4)),
    ),
    ...[
      [42, 46, 8],
      [50, 38, 7],
    ].map(([x, y, r]) =>
      at(
        x,
        y,
        C(0, 0, r, fs('#a83434', -0.3)),
        C(0, 0, r - 1.6, { fill: '#c24646' }),
        ...scatter(x + y, 8, -r + 3, -r + 3, r - 3, r - 3).map(([a, b]) =>
          C(a.toFixed(1), b.toFixed(1), 0.9, { fill: '#f1d9d0' }),
        ),
      ),
    ),
  ].join(''),
};

/** Mięso na desce jest rysowane nisko — powiększamy całość, żeby wypełniała kafelek. */
export default Object.fromEntries(
  Object.entries(meat).map(([k, v]) => [k, tr('translate(32 40) scale(1.1) translate(-32 -40)', v)]),
);
