import './helpers/browserShim.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const r = await import('../public/assets/js/lib/receipt.js');
const cat = await import('../public/assets/js/lib/catalog.js');

const P = [
  { id: 'p1', name: 'Mleko 3,2%', unit: 'l', active: true },
  { id: 'p2', name: 'Pomidory', unit: 'kg', active: true },
  { id: 'p3', name: 'Mąka pszenna', unit: 'kg', active: true },
  { id: 'p4', name: 'Stary produkt', unit: 'kg', active: false },
];
const item = (o) => ({
  name: 'X',
  name_guess: 'X',
  match: '',
  quantity: 1,
  unit: 'szt',
  unit_price: 1,
  total: 1,
  vat_rate: null,
  package_size: null,
  package_unit: null,
  uncertain: false,
  ...o,
});

test('matchProduct: alias → podpowiedź modelu → podobna nazwa; nieaktywne pomijane', () => {
  const aliases = new Map([[r.aliasKey('MĄKA  TORTOWA 1KG'), 'p3']]);
  assert.equal(r.matchProduct(item({ name: 'mąka tortowa 1kg' }), P, aliases).source, 'alias');
  assert.equal(r.matchProduct(item({ name: 'MLK 3,2', match: 'mleko 3,2%' }), P, aliases).product.id, 'p1');
  const sim = r.matchProduct(item({ name: 'POMID. MALINOWE', name_guess: 'Pomidory malinowe' }), P, new Map());
  assert.equal(sim.product.id, 'p2');
  assert.equal(sim.source, 'similar');
  assert.equal(r.matchProduct(item({ name: 'BATON', name_guess: 'Baton czekoladowy' }), P, new Map()).product, null);
  assert.equal(r.matchProduct(item({ match: 'Stary produkt' }), P, new Map()).product, null);
});

test('toPurchaseLine: jednostki, opakowania i cena netto z brutto', () => {
  // 2 × mleko 1 l po 4,10 brutto (VAT 5%) → 2 l, netto 3,9048
  let l = r.toPurchaseLine(
    item({ quantity: 2, unit: 'szt', total: 8.2, vat_rate: 5, package_size: 1, package_unit: 'l' }),
    'l',
  );
  assert.deepEqual(l, { quantity: 2, unit_price_net: 3.9048, vat_rate: 5, warning: null });
  // 500 g → kg
  l = r.toPurchaseLine(
    item({ quantity: 3, unit: 'szt', total: 9, vat_rate: 5, package_size: 500, package_unit: 'g' }),
    'kg',
  );
  assert.equal(l.quantity, 1.5);
  assert.equal(l.unit_price_net, 5.7143);
  // waga w kg, produkt w kg
  l = r.toPurchaseLine(item({ quantity: 1.85, unit: 'kg', total: 22.2, vat_rate: 0 }), 'kg');
  assert.equal(l.quantity, 1.85);
  assert.equal(l.unit_price_net, 12);
  // brak VAT → cena z paragonu, VAT 0; niezgodne jednostki → ostrzeżenie
  l = r.toPurchaseLine(item({ quantity: 4, unit: 'szt', total: 10 }), 'kg');
  assert.equal(l.vat_rate, 0);
  assert.equal(l.unit_price_net, 2.5);
  assert.match(l.warning, /Sprawdź ilość/);
  assert.equal(r.convertQty(250, 'ml', 'l'), 0.25);
  assert.equal(r.convertQty(1, 'kg', 'l'), null);
  assert.equal(r.unitForNewProduct({ unit: 'szt', package_unit: 'g' }), 'kg');
  assert.equal(r.unitForNewProduct({ unit: 'kg', package_unit: null }), 'kg');
});

test('tabela paragonu: TSV do arkusza i CSV dla polskiego Excela', () => {
  const items = [
    item({
      name: 'MLEKO 1L',
      name_guess: 'Mleko',
      product_id: 'p1',
      quantity: 2,
      unit_price: 4.1,
      total: 8.2,
      vat_rate: 5,
    }),
    item({ name: 'TORBA; "duża"', name_guess: 'Torba', quantity: 1, unit_price: 0.5, total: 0.5 }),
    item({ name: 'POMINIĘTE', skip: true }),
  ];
  const rows = r.receiptRows(items, (id) => P.find((p) => p.id === id)?.name ?? '');
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[1], ['1', 'MLEKO 1L', 'Mleko 3,2%', '2', 'szt', '4,10', '8,20', '5']);
  assert.equal(rows[2][2], 'Torba');
  assert.ok(r.toTsv(rows).split('\n')[1].includes('\t'));
  const csv = r.toCsv(rows);
  assert.ok(csv.startsWith('﻿Lp.;'));
  assert.ok(csv.includes('"TORBA; ""duża"""'));
});

test('katalog: ilustracje dla produktów, kategorii i nazw wpisanych ręcznie', () => {
  const groups = cat.CATALOG.map((g) => g.category);
  assert.deepEqual(groups, ['Mięso', 'Warzywa', 'Zupy', 'Przyprawy', 'Sosy']);
  const all = cat.CATALOG.flatMap((g) => g.items);
  assert.ok(all.length >= 100, `pozycji: ${all.length}`);
  assert.equal(new Set(all.map((i) => i.name.toLowerCase())).size, all.length, 'bez duplikatów nazw');
  assert.ok(all.every((i) => i.icon && i.icon.length <= 16 && i.name.length <= 80));
  assert.equal(cat.guessIcon('Pierś z kurczaka'), '🐔');
  assert.equal(cat.guessIcon('Fasola czerwona'), '🫘');
  assert.equal(cat.guessIcon('Mleko 3,2%'), '🥛');
  assert.equal(cat.guessIcon('qwerty'), null);
  assert.equal(cat.productIcon({ name: 'qwerty', icon: null }, 'Nabiał'), '🧀');
  assert.equal(cat.productIcon({ name: 'qwerty', icon: '🍕' }, 'Nabiał'), '🍕');
  assert.equal(cat.categoryIcon('Chemia i czystość'), '🧴');
});
