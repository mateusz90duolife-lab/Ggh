/* ═══════════════════════════════════════════════════════════════
   TESTY LOGIKI KURSU POMP CIEPŁA I KLIMATYZACJI

   Ten plik nie jest samodzielny. Skrypt testy/uruchom.sh wycina
   kod JavaScript z pompy.html i dokleja ten plik na końcu, dzięki
   czemu testy widzą wszystkie funkcje aplikacji bez modyfikowania
   jej pod kątem testowania.

   Uruchomienie:  ./testy/uruchom.sh
   ═══════════════════════════════════════════════════════════════ */

let FAILS = 0;
const bad  = m => { FAILS++; console.log("  BŁĄD  " + m); };
const ok   = m => console.log("  ok    " + m);
const head = t => console.log("\n" + t);
const eq   = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const chk  = (name, got, want) => eq(got, want)
  ? ok(name)
  : bad(name + "\n         otrzymano: " + JSON.stringify(got) + "\n         oczekiwano: " + JSON.stringify(want));
const near = (name, got, want, tol) => Math.abs(got - want) <= tol
  ? ok(name + " (" + got.toFixed(3) + ")")
  : bad(name + ": " + got + " zamiast " + want + " ± " + tol);
const num = s => parseFloat(String(s).replace(",", "."));

/* ─────────────────────────────────────────────────────────────
   1. TABELE CIŚNIENIA NASYCENIA
   Równanie Clausiusa–Clapeyrona: ln p jest prawie liniowe
   względem 1/T. Literówka w tabeli psuje tę gładkość, więc
   test wykrywa błąd pojedynczej wartości rzędu 1%.
   ───────────────────────────────────────────────────────────── */
head("1. Tabele ciśnienia nasycenia");
for (const r of PT_REFS) {
  const pt = REF[r].pt;
  chk(r + ": " + PT_T.length + " wartości", pt.length, PT_T.length);
  chk(r + ": ciśnienie rośnie z temperaturą", pt.every((p, i) => i === 0 || p > pt[i - 1]), true);
  let worst = 0;
  for (let i = 1; i < pt.length - 1; i++) {
    const x = k => 1 / (PT_T[k] + K0), y = k => Math.log(pt[k]);
    const pred = y(i - 1) + (y(i + 1) - y(i - 1)) * (x(i) - x(i - 1)) / (x(i + 1) - x(i - 1));
    worst = Math.max(worst, Math.abs(pred - y(i)));
  }
  chk(r + ": gładkość ln p(1/T), największe odchylenie < 0,4%", worst < 0.004, true);
  let rt = 0;
  for (let t = -28; t <= 58; t += 3.7) rt = Math.max(rt, Math.abs(tsat(r, psat(r, t)) - t));
  chk(r + ": tsat(psat(t)) = t", rt < 1e-9, true);
}
// Punkty odniesienia z tabel producentów czynników (ciśnienie bezwzględne)
near("R32 przy 0 °C ≈ 8,13 bar", psat("R32", 0), 8.13, 0.05);
near("R32 przy 40 °C ≈ 24,8 bar", psat("R32", 40), 24.8, 0.15);
near("R410A przy 0 °C ≈ 7,99 bar", psat("R410A", 0), 7.99, 0.05);
near("R410A przy 40 °C ≈ 24,2 bar", psat("R410A", 40), 24.2, 0.15);
near("R290 przy 0 °C ≈ 4,74 bar", psat("R290", 0), 4.74, 0.05);
near("R290 przy 40 °C ≈ 13,7 bar", psat("R290", 40), 13.7, 0.1);
chk("R32 i R410A mają zbliżone ciśnienia (< 4% różnicy)", PT_T.every((t, i) => Math.abs(REF.R32.pt[i] / REF.R410A.pt[i] - 1) < 0.04), true);

/* ─────────────────────────────────────────────────────────────
   2. WZORY — przykłady z lekcji i przypadki graniczne
   ───────────────────────────────────────────────────────────── */
head("2. Wzory instalatora");
near("3,0 kg R410A = 6,264 t CO₂e", co2e("R410A", 3), 6.264, 1e-9);
near("1,2 kg R32 = 0,81 t CO₂e", co2e("R32", 1.2), 0.81, 1e-9);
const kgFor = (ref, t) => t * 1000 / REF[ref].gwp;
chk("tuż poniżej 5 t: bez kontroli", leakCheck("R410A", kgFor("R410A", 4.99), false, false).months, 0);
chk("5 t: co 12 miesięcy", leakCheck("R410A", kgFor("R410A", 5), false, false).months, 12);
chk("50 t: co 6 miesięcy", leakCheck("R410A", kgFor("R410A", 50), false, false).months, 6);
chk("500 t: co 3 miesiące", leakCheck("R410A", kgFor("R410A", 500), false, false).months, 3);
chk("system wykrywania podwaja okres (50 t → 12)", leakCheck("R410A", kgFor("R410A", 50), false, true).months, 12);
chk("hermetyczne 9,9 t: zwolnione", leakCheck("R410A", kgFor("R410A", 9.9), true, false).months, 0);
chk("hermetyczne 10 t: co 12 miesięcy", leakCheck("R410A", kgFor("R410A", 10), true, false).months, 12);
chk("R290 nie jest F-gazem: brak kontroli", leakCheck("R290", 50, false, false).months, 0);
near("COP Carnota 35/−7 °C", carnotCOP(35, -7), 308.15 / 42, 1e-12);
near("przepływ 8 kW, ΔT 5 K = 1,376 m³/h", flowM3h(8, 5), 1.376, 1e-9);
near("prędkość 1 m³/h w d = 20 mm ≈ 0,884 m/s", velocity(1, 20), 0.8842, 1e-3);
const tb = bivalent(8, -20, 15, -7, 4.8, 7, 6.96);
near("punkt biwalentny: obciążenie = moc pompy", loadAt(8, -20, 15, tb), 4.8 + (6.96 - 4.8) / 14 * (tb + 7), 1e-9);
chk("punkt biwalentny leży między θe a +15 °C", tb > -20 && tb < 15, true);
near("sonda: 10 kW, COP 5, 50 W/m = 160 m", boreholeLength(10, 5, 50), 160, 1e-9);
chk("doładowanie 0 g przy instalacji krótszej niż fabryczna", addCharge(4, 7.5, 20), 0);
near("doładowanie (15 − 7,5) × 20 = 150 g", addCharge(15, 7.5, 20), 150, 1e-9);
near("azot 40 bar, 25 → 15 °C ≈ 38,62 bar", pressureAt(40, 25, 15), 38.62, 0.01);
near("azot bez zmiany temperatury: bez zmiany ciśnienia", pressureAt(40, 20, 20), 40, 1e-9);
near("limit R32, 20 m², ściana ≈ 4,60 kg", chargeLimit(0.307, 1.8, 20), 4.60, 0.01);
near("limit R290, 20 m², ściana ≈ 0,34 kg", chargeLimit(0.038, 1.8, 20), 0.338, 0.002);
near("limit rośnie z √A (4 × A → 2 × m)", chargeLimit(0.307, 1.8, 80) / chargeLimit(0.307, 1.8, 20), 2, 1e-12);
near("minArea odwraca chargeLimit", minArea(0.307, 1.8, chargeLimit(0.307, 1.8, 17)), 17, 1e-9);
near("prąd 3f: 6 kW, cos φ 0,95 ≈ 9,12 A", current(6, 3, 0.95), 9.117, 0.01);
near("prąd 1f: 2,3 kW, cos φ 1 = 10 A", current(2.3, 1, 1), 10, 1e-9);
near("krzywa: w punkcie projektowym zasilanie projektowe", heatCurve(20, -20, 35, -20), 35, 1e-12);
near("krzywa: 35 °C przy −20 °C → 27,5 °C przy 0 °C", heatCurve(20, -20, 35, 0), 27.5, 1e-12);
near("punkt rosy przy 100% RH = temperatura powietrza", dewPoint(21, 100), 21, 1e-9);
near("punkt rosy 24 °C / 60% ≈ 15,8 °C", dewPoint(24, 60), 15.8, 0.1);
near("hałas: podwojenie odległości ≈ −6 dB", soundAt(55, 5, 2) - soundAt(55, 10, 2), 6.02, 0.01);
near("hałas: ściana zamiast gruntu ≈ +3 dB", soundAt(55, 5, 4) - soundAt(55, 5, 2), 3.01, 0.01);
near("500 µm Hg ≈ 66,7 Pa", micronToPa(500), 66.66, 0.01);
chk("fmt: przecinek dziesiętny i brak „-0”", [fmt(1.5, 2), fmt(-0.01, 1), fmt(2, 0)], ["1,50", "0,0", "2"]);

/* ─────────────────────────────────────────────────────────────
   3. GENERATORY
   Każde zadanie: 4 różne odpowiedzi, poprawna w zakresie,
   bez NaN. Dla części generatorów dane są odczytywane z treści
   zadania i poprawna odpowiedź liczona niezależnie od nowa.
   ───────────────────────────────────────────────────────────── */
head("3. Generatory zadań obliczeniowych");
const N = 400;
for (const g of GEN_IDS) {
  let good = true;
  for (let i = 0; i < N && good; i++) {
    const q = GEN[g]();
    const why = q.options.length !== 4 ? "nie 4 odpowiedzi"
      : new Set(q.options).size !== 4 ? "powtórzone odpowiedzi"
      : !(q.correct >= 0 && q.correct < 4) ? "brak poprawnej"
      : q.options.concat([q.text, q.why]).some(s => /NaN|Infinity|undefined/.test(s)) ? "NaN lub undefined w treści"
      : q.wrongWhy.length !== 4 || q.wrongWhy[q.correct] !== null ? "objaśnienia nie pasują do odpowiedzi" : null;
    if (why) { bad(g + ": " + why + " — " + q.text + " " + JSON.stringify(q.options)); good = false; }
  }
  if (good) ok(g + ": " + N + " zadań poprawnych formalnie");
}
const cross = {
  flow(q)     { const P = num(q.text.match(/mocy (\d+) kW/)[1]), dT = num(q.text.match(/powrót (\d+) K/)[1]); return fmt(P * 0.86 / dT, 2) + " m³/h"; },
  co2e(q)     { const kg = num(q.text.match(/zawiera ([\d,]+) kg/)[1]), gwp = num(q.text.match(/GWP (\d+)/)[1]); return fmt(kg * gwp / 1000, 2) + " t CO₂e"; },
  charge(q)   { const pre = num(q.text.match(/napełniona na ([\d,]+) m/)[1]), g = num(q.text.match(/doładować (\d+) g/)[1]), L = num(q.text.match(/Instalacja ma ([\d,]+) m/)[1]); return fmt((L - pre) * g, 0) + " g"; },
  pressure(q) { const m = q.text.match(/do ([\d,]+) bar \(manometr\) przy (-?\d+) °C/), t2 = num(q.text.match(/spadła do (-?\d+) °C/)[1]); return fmt((num(m[1]) + 1.013) * (t2 + 273.15) / (num(m[2]) + 273.15) - 1.013, 1) + " bar"; },
  borehole(q) { const Q = num(q.text.match(/grzewczą (\d+) kW/)[1]), cop = num(q.text.match(/COP ([\d,]+)/)[1]), w = num(q.text.match(/gruntu (\d+) W\/m/)[1]); return fmt(Q * (1 - 1 / cop) * 1000 / w, 0) + " m"; },
  superheat(q) {
    const ref = q.text.match(/Instalacja (R\w+)/)[1], p = num(q.text.match(/ssania: ([\d,]+) bar/)[1]), t = num(q.text.match(/ssawnej: (-?[\d,]+) °C/)[1]);
    return fmt(t - tsat(ref, p + 1.013), 1) + " K";
  },
  current(q) {
    const P = num(q.text.match(/pobiera ([\d,]+) kW/)[1]), cf = num(q.text.match(/cos φ = ([\d,]+)/)[1]), three = /trójfazowa/.test(q.text);
    return fmt(three ? P * 1000 / (Math.sqrt(3) * 400 * cf) : P * 1000 / (230 * cf), 1) + " A";
  },
};
for (const g in cross) {
  let good = true;
  for (let i = 0; i < N && good; i++) {
    const q = GEN[g]();
    const want = cross[g](q);
    if (q.options[q.correct] !== want) { bad(g + ": klucz " + q.options[q.correct] + ", z treści wynika " + want + " — " + q.text); good = false; }
  }
  if (good) ok(g + ": klucz zgodny z danymi w treści (" + N + " prób)");
}
let noLeak = true;
for (let i = 0; i < N; i++) {
  const q = GEN.leak();
  const ref = q.text.match(/kg (R\w+)/)[1], kg = num(q.text.match(/zawiera ([\d,]+) kg/)[1]), herm = /hermetyczny/.test(q.text);
  const m = leakCheck(ref, kg, herm, false).months;
  const want = m === 0 ? "Nie podlega obowiązkowej kontroli szczelności" : "Co najmniej co " + m + " miesięcy";
  if (q.options[q.correct] !== want) { bad("leak: " + q.text + " → " + q.options[q.correct]); noLeak = false; break; }
}
if (noLeak) ok("leak: klucz zgodny z art. 5 dla danych z treści");

/* ─────────────────────────────────────────────────────────────
   4. TREŚĆ KURSU
   ───────────────────────────────────────────────────────────── */
head("4. Struktura kursu");
chk("12 modułów", COURSE.length, 12);
chk("identyfikatory unikalne", new Set(COURSE.map(m => m.id)).size, COURSE.length);
let contentOk = true;
for (const m of COURSE) {
  const where = "moduł " + m.id;
  if (!m.title || !m.goal || !m.time || !m.part) { bad(where + ": brak pola opisowego"); contentOk = false; }
  if (m.lessons.length < 3) { bad(where + ": mniej niż 3 lekcje"); contentOk = false; }
  for (const l of m.lessons) if (!l.t || l.h.length < 400 || /undefined|NaN/.test(l.h)) { bad(where + ": pusta lub uszkodzona lekcja „" + l.t + "”"); contentOk = false; }
  if (m.bank.length < 10) { bad(where + ": bank ma " + m.bank.length + " pytań, minimum 10"); contentOk = false; }
  for (const g of m.gens) if (!GEN[g]) { bad(where + ": nieznany generator " + g); contentOk = false; }
  m.bank.forEach((b, i) => {
    if (b.a.length !== 4 || new Set(b.a).size !== 4) { bad(where + " pytanie " + (i + 1) + ": wymaga 4 różnych odpowiedzi"); contentOk = false; }
    if (!b.q || !b.why) { bad(where + " pytanie " + (i + 1) + ": brak treści lub objaśnienia"); contentOk = false; }
    if (b.e && (b.e.length !== 4 || b.e[0] !== null)) { bad(where + " pytanie " + (i + 1) + ": objaśnienia błędnych nie pasują do odpowiedzi"); contentOk = false; }
  });
}
if (contentOk) ok("opisy, lekcje, banki pytań i generatory spójne");
const bankTotal = COURSE.reduce((a, m) => a + m.bank.length, 0);
chk("co najmniej 120 pytań stałych", bankTotal >= 120, true);
console.log("        (" + bankTotal + " pytań stałych, " + GEN_IDS.length + " generatorów, " + COURSE.reduce((a, m) => a + m.lessons.length, 0) + " lekcji)");
chk("każdy generator jest użyty w którymś module", GEN_IDS.filter(g => !COURSE.some(m => m.gens.indexOf(g) >= 0)), []);

let keyOk = true;
for (const m of COURSE) m.bank.forEach((b, i) => {
  const q = makeQuestion({ mid: m.id, bank: i });
  if (q.options[q.correct] !== b.a[0] || q.options.length !== 4) { bad(m.id + " pytanie " + (i + 1) + ": zły klucz po przetasowaniu"); keyOk = false; }
});
if (keyOk) ok("przetasowanie zachowuje poprawną odpowiedź we wszystkich " + bankTotal + " pytaniach");

/* ─────────────────────────────────────────────────────────────
   5. KOLEJKI
   ───────────────────────────────────────────────────────────── */
head("5. Kolejki zadań");
let qOk = true;
for (const m of COURSE) {
  const d = drillQueue(m), t = testQueue(m);
  if (d.length !== DRILL_LEN) { bad(m.id + ": ćwiczenia mają " + d.length + " zadań"); qOk = false; }
  if (t.length !== TEST_LEN) { bad(m.id + ": sprawdzian ma " + t.length + " zadań"); qOk = false; }
  const b = t.filter(s => s.bank != null).map(s => s.bank);
  if (new Set(b).size !== b.length) { bad(m.id + ": powtórzone pytanie w sprawdzianie"); qOk = false; }
  if (m.gens.length && !t.some(s => s.gen)) { bad(m.id + ": sprawdzian bez zadań obliczeniowych"); qOk = false; }
  if (d.concat(t).some(s => s.mid !== m.id)) { bad(m.id + ": zadanie z innego modułu"); qOk = false; }
}
if (qOk) ok("ćwiczenia " + DRILL_LEN + ", sprawdzian " + TEST_LEN + ", bez powtórzeń, z zadaniami obliczeniowymi");
const ex = examQueue();
chk("egzamin: " + COURSE.length * EXAM_PER_MOD + " zadań", ex.length, COURSE.length * EXAM_PER_MOD);
chk("egzamin: po " + EXAM_PER_MOD + " zadania z każdego modułu", COURSE.every(m => ex.filter(s => s.mid === m.id).length === EXAM_PER_MOD), true);
chk("próg sprawdzianu 60–90%", TEST_PASS / TEST_LEN >= 0.6 && TEST_PASS / TEST_LEN <= 0.9, true);
chk("próg egzaminu 70–90%", EXAM_PASS / ex.length >= 0.7 && EXAM_PASS / ex.length <= 0.9, true);
let all = 0;
for (const m of COURSE) for (const s of drillQueue(m).concat(testQueue(m))) { makeQuestion(s); all++; }
for (const s of ex) { makeQuestion(s); all++; }
ok("zbudowano " + all + " pytań ze wszystkich kolejek kursu");

/* ─────────────────────────────────────────────────────────────
   6. BRAMKOWANIE, WYNIKI, TRENING
   ───────────────────────────────────────────────────────────── */
head("6. Bramkowanie i zapisywanie wyników");
State = freshState();
chk("pierwszy moduł otwarty na starcie", moduleUnlocked(0), true);
chk("drugi moduł zamknięty na starcie", moduleUnlocked(1), false);
chk("egzamin zamknięty na starcie", examUnlocked(), false);
const finish = (mode, mid, okN, len) => { Object.assign(Session, { active: true, mode, moduleId: mid, ok: okN, queue: new Array(len).fill({}) }); finishSession(); };
finish("test", "m1", TEST_PASS - 1, TEST_LEN);
chk("sprawdzian poniżej progu nie zalicza modułu", modProgress("m1").passed, false);
chk("…i nie otwiera kolejnego", moduleUnlocked(1), false);
finish("test", "m1", TEST_PASS, TEST_LEN);
chk("sprawdzian na progu zalicza moduł", modProgress("m1").passed, true);
chk("…i otwiera kolejny", moduleUnlocked(1), true);
finish("test", "m1", 2, TEST_LEN);
chk("gorsza poprawka nie odbiera zaliczenia ani najlepszego wyniku", [modProgress("m1").passed, modProgress("m1").best], [true, TEST_PASS]);
for (const m of COURSE) modProgress(m.id).passed = true;
chk("egzamin otwiera się po zaliczeniu wszystkich modułów", examUnlocked(), true);
finish("exam", null, EXAM_PASS - 1, 24);
chk("egzamin poniżej progu: kurs nieukończony", courseDone(), false);
finish("exam", null, EXAM_PASS + 2, 24);
chk("egzamin zdany: kurs ukończony", courseDone(), true);
finish("exam", null, 3, 24);
chk("słabsza powtórka egzaminu nie obniża wyniku", [State.exam.score, State.exam.passed], [EXAM_PASS + 2, true]);

head("7. Trening przeplatany");
State = freshState();
chk("na starcie trening obejmuje tylko moduł 1", new Set(trainingQueue(30).map(s => s.mid)), new Set(["m1"]));
for (let i = 0; i < 5; i++) modProgress(COURSE[i].id).passed = true;
let rep = false, outside = false;
for (let k = 0; k < 50; k++) {
  const tq = trainingQueue(TRAIN_LEN);
  for (let i = 1; i < tq.length; i++) if (tq[i].mid === tq[i - 1].mid) rep = true;
  if (tq.some(s => moduleIndex(s.mid) > 5)) outside = true;
}
chk("dwa zadania z tego samego modułu nie występują po sobie", rep, false);
chk("trening nie sięga do zamkniętych modułów", outside, false);
State.stats = { m1: { seen: 100, ok: 100 }, m2: { seen: 100, ok: 100 }, m3: { seen: 100, ok: 20 }, m4: { seen: 100, ok: 100 }, m5: { seen: 100, ok: 100 }, m6: { seen: 100, ok: 100 } };
let weak = 0, strong = 0;
for (let k = 0; k < 200; k++) for (const s of trainingQueue(TRAIN_LEN)) { if (s.mid === "m3") weak++; if (s.mid === "m1") strong++; }
chk("słaby moduł pojawia się częściej niż opanowany", weak > strong * 1.5, true);

console.log(FAILS ? "\n" + FAILS + " BŁĘDÓW\n" : "\nWszystkie testy logiki kursu pomp ciepła przeszły.\n");
process.exit(FAILS ? 1 : 0);
