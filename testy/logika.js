/* ═══════════════════════════════════════════════════════════════
   TESTY LOGIKI TRENERA

   Ten plik nie jest samodzielny. Skrypt testy/uruchom.sh wycina
   kod JavaScript z trener.html i dokleja ten plik na końcu, dzięki
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

/* ─────────────────────────────────────────────────────────────
   1. GEOMETRIA RZUTÓW
   Bryła schodkowa: słupek wysokości 2 z przodu-lewo, wysokości 1
   z tyłu-prawo. hm[x][y], x = 0 to lewo, y = 0 to przód.
   ───────────────────────────────────────────────────────────── */
head("1. Geometria rzutów");
const L = solidFromHeights([[2, 0], [0, 1]]);
chk("rzut z przodu", orthoView(L, "front").filled.map(r => r.map(x => x ? "#" : ".").join("")), ["#.", "##"]);
chk("rzut z góry (tył u góry obrazu)", orthoView(L, "top").filled.map(r => r.map(x => x ? "#" : ".").join("")), [".#", "#."]);
chk("rzut z lewej (tył po lewej)", orthoView(L, "left").filled.map(r => r.map(x => x ? "#" : ".").join("")), [".#", "##"]);
chk("rzut z prawej (przód po lewej)", orthoView(L, "right").filled.map(r => r.map(x => x ? "#" : ".").join("")), ["#.", "##"]);
chk("głębokości wyznaczają uskok", orthoView(L, "front").depth, [[0, null], [0, 1]]);
chk("plan kodowany odtwarza bryłę", solidFromHeights(heightsOf(L)).id, L.id);

/* ─────────────────────────────────────────────────────────────
   2. PRZEKSZTAŁCENIA
   ───────────────────────────────────────────────────────────── */
head("2. Obroty i odbicia");
const S1 = generateSolid({ w: 3, d: 3, maxH: 3, minFoot: 4, maxFoot: 6, minCubes: 6, maxCubes: 14, chiral: true });
chk("rotZ ×4 = tożsamość", xform(S1, XF.rotZ, 4).id, S1.id);
chk("rotX ×4 = tożsamość", xform(S1, XF.rotX, 4).id, S1.id);
chk("rotY ×4 = tożsamość", xform(S1, XF.rotY, 4).id, S1.id);
chk("mirX ×2 = tożsamość", xform(S1, XF.mirX, 2).id, S1.id);
chk("obrót zachowuje liczbę kostek", xform(S1, XF.rotX).count, S1.count);
const mv = moveOneCube(S1);
chk("moveOneCube zachowuje liczbę kostek", mv && mv.count, S1.count);
chk("moveOneCube zmienia bryłę", !!(mv && mv.id !== S1.id), true);

/* ─────────────────────────────────────────────────────────────
   3. GENERATOR BRYŁ
   ───────────────────────────────────────────────────────────── */
head("3. Generator brył");
let stackOk = true, chiralOk = true, boxOk = true;
for (let i = 0; i < 400; i++) {
  const g = generateSolid({ w: 3, d: 3, maxH: 3, minFoot: 3, maxFoot: 7, minCubes: 5, maxCubes: 16, chiral: true });
  if (!isStackable(g)) stackOk = false;
  if (!isChiralEnough(g)) chiralOk = false;
  if (isFullBox(g)) boxOk = false;
}
chk("400 brył: wszystkie postawione (mają plan kodowany)", stackOk, true);
chk("400 brył: wszystkie chiralne", chiralOk, true);
chk("400 brył: żadna nie jest pełnym prostopadłościanem", boxOk, true);

/* ─────────────────────────────────────────────────────────────
   4. ZGODNOŚĆ OBROTÓW Z RZUTAMI
   Dwa niezależne fragmenty kodu muszą dawać ten sam wynik.
   ───────────────────────────────────────────────────────────── */
head("4. Zgodność obrotów z rzutami");
const rotCW  = M => M[0].map((_, c) => M.map(r => r[c]).reverse());
const flipLR = M => M.map(r => r.slice().reverse());
const gridOf = v => v.filled.map(r => r.map(x => x ? 1 : 0));
let cross = 0;
for (let i = 0; i < 400; i++) {
  const S = generateSolid({ w: 3, d: 3, maxH: 3, minFoot: 3, maxFoot: 7, minCubes: 5, maxCubes: 16, chiral: true });
  if (!eq(gridOf(orthoView(xform(S, XF.rotZ), "top")), rotCW(gridOf(orthoView(S, "top"))))) { bad("obrót bryły nie obraca rzutu z góry"); break; }
  if (!eq(gridOf(orthoView(xform(S, XF.rotZ), "front")), gridOf(orthoView(S, "right")))) { bad("po obrocie w prawo rzut z prawej nie stał się rzutem z przodu"); break; }
  if (!eq(gridOf(orthoView(xform(S, XF.rotZi), "front")), gridOf(orthoView(S, "left")))) { bad("po obrocie w lewo rzut z lewej nie stał się rzutem z przodu"); break; }
  if (!eq(gridOf(orthoView(xform(S, XF.mirX), "front")), flipLR(gridOf(orthoView(S, "front"))))) { bad("odbicie bryły nie odbija rzutu z przodu"); break; }
  let sum = 0; for (const col of heightsOf(S)) for (const h of col) sum += h;
  if (sum !== S.count) { bad("suma planu kodowanego ≠ liczba kostek"); break; }
  cross++;
}
if (cross === 400) {
  ok("400 brył: obrót w prawo obraca rzut z góry w prawo");
  ok("400 brył: rotZ zamienia rzut z prawej na rzut z przodu");
  ok("400 brył: rotZi zamienia rzut z lewej na rzut z przodu");
  ok("400 brył: odbicie odbija rzut z przodu");
  ok("400 brył: plan kodowany sumuje się do liczby kostek");
}

/* ─────────────────────────────────────────────────────────────
   5. GENERATORY ZADAŃ
   ───────────────────────────────────────────────────────────── */
head("5. Generatory zadań");
let checked = 0, qFails = 0;
for (const skill of SKILL_IDS) {
  for (let level = 1; level <= 8; level++) {
    for (let i = 0; i < 4; i++) {
      let q;
      try { q = nextQuestion(skill, level); }
      catch (e) { bad(skill + " poz." + level + " wyjątek: " + e.message); qFails++; continue; }
      checked++;
      if (q.skill !== skill) { bad(skill + ": zwrócono " + q.skill); qFails++; }
      if (q.options.filter(o => o.tag === "ok").length !== 1) { bad(skill + " poz." + level + ": zła liczba poprawnych opcji"); qFails++; }
      if (q.options[q.correct].tag !== "ok") { bad(skill + ": indeks nie wskazuje poprawnej opcji"); qFails++; }
      if (q.options.length < 3) { bad(skill + " poz." + level + ": mniej niż 3 opcje"); qFails++; }
      if (new Set(q.options.map(o => o.id)).size !== q.options.length) { bad(skill + ": zduplikowane opcje"); qFails++; }
      if (!q.prompt || q.prompt.length < 10) { bad(skill + ": brak treści polecenia"); qFails++; }
      if (!q.stimulus || !q.stimulus.length) { bad(skill + ": brak bodźca"); qFails++; }
      for (const o of q.options) if (o.tag !== "ok" && !WHY[o.tag]) { bad(skill + ": dystraktor bez opisu błędu (" + o.tag + ")"); qFails++; }
    }
  }
}
if (!qFails) ok(checked + " zadań we wszystkich typach i poziomach: poprawna struktura");

head("6. Zawężanie zadań przez opcje (używane przez kurs)");
let axZ = true, axXY = true, kinds = true;
for (let i = 0; i < 150; i++) {
  if (!/osi pionowej/.test(buildExercise("obrot", 4, { axes: ["z"] }).prompt)) axZ = false;
  if (/osi pionowej/.test(buildExercise("obrot", 4, { axes: ["x", "y"] }).prompt)) axXY = false;
  if (!/z przodu|z góry/.test(buildExercise("bryla-rzut", 3, { kinds: ["front", "top"] }).prompt)) kinds = false;
}
chk("axes=['z'] daje wyłącznie obroty wokół osi pionowej", axZ, true);
chk("axes=['x','y'] wyklucza oś pionową", axXY, true);
chk("kinds zawęża rodzaj rzutu", kinds, true);

/* ─────────────────────────────────────────────────────────────
   7. MODEL UCZNIA
   ───────────────────────────────────────────────────────────── */
head("7. Model ucznia");
State.level = 4; State.recent = [];
for (let i = 0; i < 9; i++) recordAnswer("liczenie", true);
chk("poziom rośnie po serii trafień", State.level > 4, true);
State.level = 4; State.recent = [];
for (let i = 0; i < 9; i++) recordAnswer("liczenie", false);
chk("poziom spada po serii błędów", State.level < 4, true);
chk("poziom mieści się w zakresie 1–8", State.level >= 1 && State.level <= 8, true);

State.skills = {};
const sk = skillOf("obrot");
recordAnswer("obrot", true); const d1 = sk.due - Date.now();
recordAnswer("obrot", true); const d2 = sk.due - Date.now();
chk("odstęp powtórki rośnie po kolejnym trafieniu", d2 > d1, true);
recordAnswer("obrot", false);
chk("błąd zeruje pudełko Leitnera", sk.box, 0);
chk("błąd cofa termin powtórki na teraz", sk.due - Date.now() < 1000, true);

State.lastSkills = ["obrot", "obrot"];
let repeated = false;
for (let i = 0; i < 400; i++) if (chooseSkill() === "obrot") repeated = true;
chk("przeplatanie blokuje trzecie z rzędu to samo zadanie", repeated, false);

State.skills = {};
for (let i = 0; i < 25; i++) recordAnswer("odbicie", true);
chk("opanowanie dąży do 1 i nie przekracza go", skillOf("odbicie").m > 0.9 && skillOf("odbicie").m <= 1, true);

/* ─────────────────────────────────────────────────────────────
   8. KURS
   ───────────────────────────────────────────────────────────── */
head("8. Struktura kursu");
let modOk = true;
for (const m of COURSE) {
  if (!m.id || !m.title || !m.goal || !m.time) { bad("moduł " + m.id + ": brak pola opisowego"); modOk = false; }
  for (const lid of m.lessons) if (!LESSON_BY_ID[lid]) { bad("moduł " + m.id + ": nieznana lekcja " + lid); modOk = false; }
  for (const sp of m.drill.concat(m.test)) if (!SKILLS[sp.skill]) { bad("moduł " + m.id + ": nieznana umiejętność " + sp.skill); modOk = false; }
  const total = m.test.reduce((a, t) => a + t.n, 0);
  if (m.pass > total) { bad("moduł " + m.id + ": próg wyższy niż liczba zadań"); modOk = false; }
  if (m.pass < Math.ceil(total * 0.6)) { bad("moduł " + m.id + ": próg poniżej 60%"); modOk = false; }
}
if (modOk) ok(COURSE.length + " modułów: opisy, lekcje, umiejętności i progi spójne");

const taught = new Set();
for (const m of COURSE) for (const sp of m.drill.concat(m.test)) taught.add(sp.skill);
chk("kurs pokrywa wszystkie umiejętności", SKILL_IDS.filter(id => !taught.has(id)), []);
chk("egzamin ma 12 zadań", EXAM.specs.reduce((a, s) => a + s.n, 0), 12);
chk("próg egzaminu nie przekracza liczby zadań", EXAM.pass <= 12, true);

let queued = 0, qcOk = true;
for (const m of COURSE) {
  for (const queue of [expandQueue(m.drill, false), expandQueue(m.test, true)]) {
    for (const spec of queue) {
      const ex = nextQuestion(spec.skill, spec.level, spec.opts);
      queued++;
      if (ex.skill !== spec.skill) { bad(m.id + ": kolejka dała " + ex.skill); qcOk = false; }
    }
  }
}
for (const spec of expandQueue(EXAM.specs, true)) { nextQuestion(spec.skill, spec.level, spec.opts); queued++; }
if (qcOk) ok("wygenerowano " + queued + " zadań ze wszystkich kolejek kursu");

head("9. Bramkowanie modułów");
State.course = { mods: {}, exam: null };
chk("pierwszy moduł otwarty na starcie", moduleUnlocked(0), true);
chk("drugi moduł zamknięty na starcie", moduleUnlocked(1), false);
courseProgress(COURSE[0].id).passed = true;
chk("drugi moduł otwiera się po zaliczeniu pierwszego", moduleUnlocked(1), true);
chk("egzamin zamknięty przy jednym zaliczonym module", examUnlocked(), false);
for (const m of COURSE) courseProgress(m.id).passed = true;
chk("egzamin otwiera się po zaliczeniu wszystkich modułów", examUnlocked(), true);

console.log(FAILS ? "\n" + FAILS + " BŁĘDÓW\n" : "\nWszystkie testy logiki przeszły.\n");
process.exit(FAILS ? 1 : 0);
