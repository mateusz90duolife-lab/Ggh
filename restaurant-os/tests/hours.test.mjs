import './helpers/browserShim.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const hrs = await import('../public/assets/js/lib/hours.js');

const W = 'Europe/Warsaw';

test('localToIso: godzina lokalu → UTC (lato, zima, zmiana czasu)', () => {
  assert.equal(hrs.localToIso('2026-07-01', '08:00', W), '2026-07-01T06:00:00.000Z');
  assert.equal(hrs.localToIso('2026-01-15', '08:00', W), '2026-01-15T07:00:00.000Z');
  // 25.10.2026 — zmiana czasu na zimowy o 03:00
  assert.equal(hrs.localToIso('2026-10-25', '12:00', W), '2026-10-25T11:00:00.000Z');
  assert.equal(hrs.localToIso('2026-10-24', '23:30', W), '2026-10-24T21:30:00.000Z');
  assert.equal(hrs.localTime('2026-07-01T06:00:00.000Z', W), '08:00');
});

test('czas trwania i formatowanie', () => {
  const s = { started_at: '2026-10-07T06:00:00Z', ended_at: '2026-10-07T14:05:00Z' };
  assert.equal(hrs.shiftMinutes(s), 485);
  assert.equal(hrs.formatDuration(485), '8 h 05 min');
  assert.equal(hrs.formatDuration(480), '8 h');
  assert.equal(hrs.formatDuration(45), '45 min');
  assert.equal(
    hrs.shiftMinutes({ started_at: '2026-10-07T06:00:00Z', ended_at: null }, new Date('2026-10-07T07:30:00Z')),
    90,
  );
});

test('okresy i sumy godzin według daty lokalu', () => {
  assert.deepEqual(hrs.periodRange('week', '2026-10-07'), {
    from: '2026-10-05',
    to: '2026-10-12',
    label: 'Ten tydzień',
  });
  assert.deepEqual(hrs.periodRange('week', '2026-10-11'), {
    from: '2026-10-05',
    to: '2026-10-12',
    label: 'Ten tydzień',
  });
  assert.equal(hrs.periodRange('month', '2026-12-15').to, '2027-01-01');
  assert.equal(hrs.periodRange('prev_month', '2026-01-10').from, '2025-12-01');
  const shifts = [
    { started_at: '2026-10-05T06:00:00Z', ended_at: '2026-10-05T14:00:00Z' }, // pn: 8 h
    { started_at: '2026-10-04T22:30:00Z', ended_at: '2026-10-05T02:00:00Z' }, // nd 00:30 lokalnie → pn
    { started_at: '2026-10-04T20:00:00Z', ended_at: '2026-10-04T21:00:00Z' }, // nd 22:00 → poprzedni tydzień
  ];
  const week = hrs.periodRange('week', '2026-10-07');
  assert.equal(hrs.sumMinutes(shifts, week, W), 8 * 60 + 210);
  assert.equal(hrs.shiftDate(shifts[1], W), '2026-10-05');
});
