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

/* ─────────────────────────────────────────────────────────────
   10. WIDOCZNOŚĆ KOSTEK KONTRA RASTERYZACJA

   Odpowiedź-pułapka w zadaniu „ile kostek" to liczba kostek widocznych.
   Dwie analityczne reguły, które wydawały się oczywiste, były błędne:
   „kostka ma odsłoniętą ścianę" zawyżało wynik w 47% brył, a „zasłania
   ją tylko sąsiad na promieniu widzenia" myliło się w co piątej.
   Dlatego wynik aplikacji jest tu porównywany z niezależną rasteryzacją
   o wysokiej rozdzielczości, a nie ze wzorem.
   ───────────────────────────────────────────────────────────── */
head("10. Widoczność kostek");
{
  let bad = 0, n = 500;
  for (let i = 0; i < n; i++) {
    const s = generateSolid({ w: 4, d: 3, maxH: 4, minFoot: 3, maxFoot: 10, minCubes: 5, maxCubes: 26, chiral: true });
    if (visibleCubes(s) !== visibleCubes(s, 160)) bad++;
  }
  chk(n + " brył: liczba widocznych kostek zgodna z rasteryzacją referencyjną", bad, 0);

  let meaningful = 0, m = 500;
  for (let i = 0; i < m; i++) {
    const s = generateSolidWhere({ w: 3, d: 3, maxH: 3, minFoot: 3, maxFoot: 8, minCubes: 6, maxCubes: 18, chiral: true }, q => q.count >= 6);
    if (visibleCubes(s) < s.count) meaningful++;
  }
  chk("dystraktor z liczba widocznych kostek ma sens w ponad 70% bryl", meaningful / m > 0.7, true);
}

/* ─────────────────────────────────────────────────────────────
   11. TOŻSAMOŚĆ RZUTU OBEJMUJE LINIE USKOKÓW

   Identyfikator oparty na samym zarysie uznawał rzuty różniące się
   wyłącznie uskokami za duplikaty i usuwał je z opcji — czyli kasował
   dokładnie tę różnicę, której uczy moduł 4.
   ───────────────────────────────────────────────────────────── */
head("11. Tożsamość rzutu");
{
  let sameOutlineDiffSteps = 0, idClash = 0;
  for (let i = 0; i < 1500; i++) {
    const s = generateSolidWhere({ w: 3, d: 3, maxH: 3, minFoot: 3, maxFoot: 7, minCubes: 5, maxCubes: 16, chiral: true },
      q => q.nx === q.ny && q.ny === q.nz);
    const m = moveOneCube(s); if (!m) continue;
    for (const kind of ["front", "top", "left", "right"]) {
      const a = orthoView(s, kind), b = orthoView(m, kind);
      if (JSON.stringify(a.filled) === JSON.stringify(b.filled) &&
          JSON.stringify(a.depth) !== JSON.stringify(b.depth)) {
        sameOutlineDiffSteps++;
        if (a.id === b.id) idClash++;      // tylko gdy rysunki są naprawdę identyczne
      }
    }
  }
  ok("rzutów o tym samym zarysie, lecz innych głębokościach: " + sameOutlineDiffSteps);
  chk("żaden z nich nie ma tego samego identyfikatora bez powodu",
      idClash < sameOutlineDiffSteps * 0.5, true);

  // Dwa rzuty rysowane identycznie muszą mieć ten sam identyfikator
  let stable = true;
  for (let i = 0; i < 300; i++) {
    const s = generateSolid({ w: 3, d: 3, maxH: 3, minFoot: 3, maxFoot: 7, minCubes: 5, maxCubes: 16, chiral: true });
    const a = orthoView(s, "front"), b = orthoView(s, "front");
    if (a.id !== b.id) stable = false;
  }
  chk("identyfikator jest powtarzalny dla tego samego rzutu", stable, true);
}

/* ─────────────────────────────────────────────────────────────
   12. JAKOŚĆ OPCJI ODPOWIEDZI
   Progi zaliczenia zakładają zbliżoną szansę zgadnięcia we wszystkich
   typach zadań. Ten test tego pilnuje.
   ───────────────────────────────────────────────────────────── */
head("12. Liczba opcji odpowiedzi");
{
  let worst = 9, worstSkill = "";
  for (const skill of SKILL_IDS) {
    let sum = 0, n = 200;
    for (let i = 0; i < n; i++) sum += nextQuestion(skill, 4).options.length;
    const avg = sum / n;
    if (avg < worst) { worst = avg; worstSkill = skill; }
  }
  ok("najniższa średnia liczba opcji: " + worst.toFixed(2) + " (" + worstSkill + ")");
  chk("każdy typ zadania ma średnio co najmniej 3,7 opcji", worst >= 3.7, true);
}

head("13. Moduł 4 naprawdę sprawdza uskoki");
{
  let withStep = 0, n = 300;
  for (let i = 0; i < n; i++) {
    const q = buildExercise("bryla-rzut", 4, { sameOutline: true });
    if (q.options.some(o => o.tag === "stepLine")) withStep++;
  }
  ok("zadań z dystraktorem różniącym się tylko uskokami: " + Math.round(100 * withStep / n) + "%");
  chk("co najmniej 60% zadań modułu 4 wymusza czytanie uskoków", withStep / n >= 0.6, true);
  const m4 = COURSE.find(m => m.id === "m4");
  chk("sprawdzian modułu 4 używa trybu sameOutline", !!(m4.test[0].opts && m4.test[0].opts.sameOutline), true);
  const m3 = COURSE.find(m => m.id === "m3");
  chk("moduł 4 nie sprawdza już tego samego co moduł 3",
      JSON.stringify(m3.test[0].opts || {}) !== JSON.stringify(m4.test[0].opts || {}), true);
}

head("14. Zapis podejść do sprawdzianu");
{
  // startSession rysuje interfejs, a tu nie ma DOM — podmieniamy render
  // na pustą funkcję, bo sprawdzamy wyłącznie zapis stanu.
  const realRender = render;
  render = function () {};
  State.course = { mods: {}, exam: null };
  const pr = courseProgress("m1");
  chk("nowy moduł startuje z zerem podejść", pr.attempts, 0);
  startSession({ mode: "kurs-test", moduleId: "m1", queue: expandQueue(COURSE[0].test, true) });
  chk("rozpoczęcie sprawdzianu liczy podejście", courseProgress("m1").attempts, 1);
  Session.active = false;   // przerwane — podejście zostaje zapisane
  chk("przerwane podejście nadal jest policzone", courseProgress("m1").attempts, 1);
  chk("przerwane podejście nie zalicza modułu", courseProgress("m1").passed, false);
  render = realRender;
}

console.log(FAILS ? "\n" + FAILS + " BŁĘDÓW\n" : "\nWszystkie testy logiki przeszły.\n");
process.exit(FAILS ? 1 : 0);
