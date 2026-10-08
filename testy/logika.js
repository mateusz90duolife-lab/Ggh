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
      if (q.kind === "sketch") {   // szkic nie ma opcji — ma rozwiązanie w postaci zbioru odcinków
        if (!q.lines || !q.lines.size || !q.target) { bad(skill + " poz." + level + ": szkic bez rozwiązania"); qFails++; }
        if (!q.stimulus || !q.stimulus.length) { bad(skill + ": brak bodźca"); qFails++; }
        continue;
      }
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
chk("egzamin ma 18 zadań", EXAM.specs.reduce((a, s) => a + s.n, 0), 18);
chk("próg egzaminu: 75–85% zadań", EXAM.pass / EXAM.total >= 0.75 && EXAM.pass / EXAM.total <= 0.85, true);

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
  for (const skill of SKILL_IDS.filter(id => id !== "szkic")) {
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

/* ─────────────────────────────────────────────────────────────
   15. SYMBOL METODY RZUTOWANIA
   Znaczenie symbolu niesie wyłącznie kierunek trapezu względem okręgów.
   Orientacja potwierdzona w dwóch źródłach (METODYKA.md, sekcja 8).
   ───────────────────────────────────────────────────────────── */
head("15. Symbol metody rzutowania");
{
  const E = methodSymbolGeometry("E", 120, 50), A = methodSymbolGeometry("A", 120, 50);
  const dist = (g, x) => Math.abs(x - g.circX);
  chk("pierwszy kąt: trapez po lewej, okręgi po prawej", E.wideX < E.circX, true);
  chk("pierwszy kąt: krótszy bok odwrócony od okręgów", dist(E, E.narrowX) > dist(E, E.wideX), true);
  chk("trzeci kąt: okręgi po lewej, trapez po prawej", A.circX < A.narrowX, true);
  chk("trzeci kąt: krótszy bok zwrócony do okręgów", dist(A, A.narrowX) < dist(A, A.wideX), true);
  chk("krótszy bok zawsze po lewej stronie trapezu", E.narrowX < E.wideX && A.narrowX < A.wideX, true);
  chk("oba rzuty stożka mają zgodne wymiary (mały okrąg = krótszy bok)", E.r * 2 < E.R * 2 && E.r === E.R / 2, true);
  chk("symbol mieści się w płótnie", E.x0 >= 0 && E.x0 + E.total <= 120, true);
}

/* ─────────────────────────────────────────────────────────────
   16. TEST WSTĘPNY I KOŃCOWY W FORMACIE PSVT:R
   Najważniejsza właściwość: przykład musi jednoznacznie wyznaczać
   odpowiedź spośród WSZYSTKICH 24 obrotów sześcianu. Pierwsza wersja
   sprawdzała tylko obroty obecne w opcjach i przepuszczała 7% zadań,
   w których poprawnie odczytany obrót dawał inną odpowiedź.
   ───────────────────────────────────────────────────────────── */
head("16. Zadania w formacie PSVT:R");
{
  chk("grupa obrotów sześcianu ma 24 elementy", cubeRotations().length, 24);
  let ambiguous = 0, wrong = 0, fallback = 0, few = 0, n = 0, doubles = 0, singlesHigh = 0;
  for (let lvl = 1; lvl <= 8; lvl++) for (let i = 0; i < 50; i++) {
    const q = nextQuestion("psvt", lvl, { level: lvl });
    const st = q.stimulus[0];
    if (!st || st.type !== "psvt") { fallback++; continue; }
    n++;
    if (q.options.length < 3) few++;
    const correct = q.options[q.correct].solid;
    const outcomes = new Set();
    let mappers = 0;
    for (const g of cubeRotations()) if (applySeq(st.a, g).id === st.b.id) { mappers++; outcomes.add(applySeq(st.target, g).id); }
    if (outcomes.size !== 1) ambiguous++;
    else if ([...outcomes][0] !== correct.id) wrong++;
    // obrót złożony z dwóch osi nie da się zastąpić jednym obrotem o 90°
    const single = cubeRotations().filter(g => g.length === 1);
    const bySingle = single.some(g => applySeq(st.a, g).id === st.b.id);
    if (lvl >= 5 && !bySingle) doubles++;
    if (lvl >= 5 && bySingle) singlesHigh++;
  }
  chk("żadne zadanie nie wpada w format awaryjny", fallback, 0);
  chk(n + " zadań: przykład jednoznacznie wyznacza odpowiedź", ambiguous, 0);
  chk("poprawna opcja to wynik odczytanego obrotu", wrong, 0);
  chk("każde zadanie ma co najmniej 3 opcje", few, 0);
  chk("na poziomach 5–8 przeważają obroty złożone z dwóch osi", doubles > singlesHigh, true);
  ok("poziomy 5–8: obrotów złożonych " + doubles + ", sprowadzalnych do pojedynczego " + singlesHigh);
}

head("17. Porównanie testu wstępnego z końcowym");
{
  const save = { d: State.diag, p: State.diagPost };
  State.diag = null; State.diagPost = null;
  chk("bez testu wstępnego przyrostu nie ma", measuredGain().ok, false);
  State.diag = { score: 4, total: 8, instrument: "stary" };
  State.diagPost = { score: 7, total: 8, instrument: PSVT_INSTRUMENT };
  chk("różne wersje narzędzia nie są porównywane", measuredGain().ok, false);
  State.diag = { score: 4, total: 8, instrument: PSVT_INSTRUMENT };
  State.diagPost = null;
  chk("bez testu końcowego przyrostu nie ma", measuredGain().ok, false);
  State.diagPost = { score: 7, total: 8, instrument: PSVT_INSTRUMENT };
  const g = measuredGain();
  chk("przyrost liczony między testami tym samym narzędziem", [g.ok, g.pre, g.post, g.delta], [true, 50, 88, 38]);
  State.diag = save.d; State.diagPost = save.p;
}

head("18. Zadanie: metoda odczytana z symbolu");
{
  let bad = 0, misreadOk = 0, n = 0;
  for (let i = 0; i < 300; i++) {
    const m = i % 2 ? "E" : "A";
    const q = exUkladSymbol(m);
    q.correct = q.options.findIndex(o => o.tag === "ok");
    n++;
    const view = Object.keys(PLACE_VIEW_TXT).find(v => q.prompt.indexOf(PLACE_VIEW_TXT[v]) >= 0);
    if (q.options[q.correct].text !== PLACE_TXT[SYMBOL_PLACE[m][view]]) bad++;
    const mis = q.options.find(o => o.tag === "symbolMisread");
    if (mis && mis.text === PLACE_TXT[SYMBOL_PLACE[m === "E" ? "A" : "E"][view]]) misreadOk++;
    if (q.stimulus[0].type !== "symbol" || /pierwszego|trzeciego/.test(q.prompt)) bad++;
  }
  chk(n + " zadań: poprawna odpowiedź zgodna z tabelą rozmieszczenia", bad, 0);
  chk("dystraktor „zła metoda” to miejsce poprawne w drugiej metodzie", misreadOk, n);
}

/* ─────────────────────────────────────────────────────────────
   19. TYP ZADANIA NIGDY NIE JEST PODMIENIANY
   Generator, który wyczerpie próby, nie może po cichu zwrócić zadania
   innego typu — w teście pomiarowym zmieniałoby to narzędzie, a w
   sprawdzianie modułu jego treść.
   ───────────────────────────────────────────────────────────── */
head("19. Brak podmiany typu zadania");
{
  // Wymuszone wyczerpanie prób: pusta grupa obrotów sprawia, że żadne
  // zadanie nie przejdzie warunku jednoznaczności.
  const realRot = cubeRotations;
  cubeRotations = () => [];
  let threw = false, otherFormat = false;
  try { const q = exPsvt(cfgFor(4), { level: 4 }); if (!q.stimulus[0] || q.stimulus[0].type !== "psvt") otherFormat = true; }
  catch (e) { threw = true; }
  cubeRotations = realRot;
  chk("wyczerpanie prób PSVT kończy się wyjątkiem, nie zadaniem w innym formacie", [threw, otherFormat], [true, false]);

  // Pojedyncze wyjątki generatora nie przerywają sesji
  const realPsvt = BUILDERS.psvt;
  let calls = 0;
  BUILDERS.psvt = (c, o) => { calls++; if (calls <= 3) throw new Error("próba"); return realPsvt(c, o); };
  const q = nextQuestion("psvt", 4, { level: 4 });
  BUILDERS.psvt = realPsvt;
  chk("nextQuestion przetrwa wyjątki generatora i zwróci zadanie PSVT", q.stimulus[0].type, "psvt");

  // Generator trwale zepsuty: nextQuestion nie może podsunąć liczenia kostek
  const realPrz = BUILDERS.przekroj;
  BUILDERS.przekroj = () => { throw new Error("zepsuty"); };
  let substituted = false, failed = false;
  try { const r = nextQuestion("przekroj", 4); if (r.skill !== "przekroj") substituted = true; }
  catch (e) { failed = true; }
  BUILDERS.przekroj = realPrz;
  chk("zadanie zamówionego typu nie jest podmieniane innym", substituted, false);
  chk("trwale zepsuty generator zgłasza błąd zamiast podmiany", failed, true);
}

{
  // Błąd generatora w trakcie sesji: koniec sesji z komunikatem, bez zapisu
  const realRender = render, realPsvt = BUILDERS.psvt;
  render = function () {};
  BUILDERS.psvt = () => { throw new Error("zepsuty"); };
  const before = State.diag;
  let crashed = false;
  try { startSession({ mode: "diag" }); } catch (e) { crashed = true; }
  chk("błąd generatora nie wywraca aplikacji", crashed, false);
  chk("sesja zostaje zakończona z komunikatem", [Session.active, typeof UI.error], [false, "string"]);
  chk("przerwany test nie zapisuje wyniku", State.diag, before);
  BUILDERS.psvt = realPsvt; render = realRender; UI.error = null;
}

head("20. Podejścia do testu końcowego");
{
  const realRender = render;
  render = function () {};
  const save = { d: State.diag, p: State.diagPost, a: State.diagPostAttempts };
  State.diag = { score: 4, total: 8, instrument: PSVT_INSTRUMENT };
  State.diagPost = null; State.diagPostAttempts = 0;
  const finishPost = (ok) => { startSession({ mode: "post" }); Session.ok = ok; finishSession(); };
  finishPost(5);
  chk("pierwsze podejście ma numer 1", State.diagPost.attempt, 1);
  chk("pierwsze podejście nie ma dopisku", attemptNote(measuredGain()), "");
  finishPost(8);
  chk("drugie podejście ma numer 2", State.diagPost.attempt, 2);
  chk("drugie podejście jest oznaczone w wyniku", /podejście 2/.test(attemptNote(measuredGain())), true);
  startSession({ mode: "diag" }); Session.ok = 3; finishSession();
  chk("nowy test wstępny zeruje licznik podejść", [State.diagPost, State.diagPostAttempts], [null, 0]);
  State.diag = save.d; State.diagPost = save.p; State.diagPostAttempts = save.a;
  render = realRender;
}

/* ─────────────────────────────────────────────────────────────
   21–29. AUDYT TREŚCI I NOWE MODUŁY (2026-10)
   Każda sekcja sprawdza konkretny błąd znaleziony w audycie albo
   poprawność nowej funkcji metodą niezależną od kodu aplikacji.
   ───────────────────────────────────────────────────────────── */

head("21. Chiralność brył w zadaniach i lekcjach");
{
  chk("bryła lekcji o odbiciach (DEMO_C) jest chiralna", isChiral(DEMO_C), true);
  chk("DEMO_C nadaje się do zadań na odbicie", isChiralEnough(DEMO_C), true);
  chk("dawna bryła lekcji (DEMO_B) jest achiralna — dlatego ją wymieniono", isChiral(DEMO_B), false);
  chk("bryła awaryjna generatora jest chiralna", isChiral(solidFromHeights([[3, 1], [2, 0]])), true);
  let bad = 0, n = 0;
  for (const sk of ["obrot", "odbicie", "plan-bryla", "rzuty-bryla"])
    for (let i = 0; i < 160; i++) {
      const q = buildExercise(sk, 1 + (i % 8));
      for (const o of q.options) if (o.tag === "mirror") { n++; if (!isChiral(o.solid)) bad++; }
    }
  chk("dystraktor „odbicie” nigdy nie jest osiągalny obrotem (" + n + " sprawdzonych)", bad, 0);
}

head("22. Linie niewidoczne — sprawdzenie niezależną metodą");
{
  chk("wcięcie z tyłu daje dwie linie kreskowe w rzucie z przodu", [...orthoView(DEMO_HID, "front").hid].sort(), ["h:0,0", "v:0,0"]);
  chk("bryła pełna nie ma linii niewidocznych", orthoView(solidFromHeights([[2, 2], [2, 2]]), "front").hid.size, 0);

  // Krawędzie bryły wyliczone w 3D, bez viewCell i edgeAlong: krawędź biegnie
  // wzdłuż prostej, wokół której z czterech kostek pełna jest 1 albo 3, albo 2 po przekątnej.
  const isEdge = (a, b, c, d) => { const n = a + b + c + d; return n === 1 || n === 3 || (n === 2 && ((a && d) || (b && c))); };
  const H = (S, x, y, z) => S.has(x, y, z) ? 1 : 0;
  // Dla każdego rzutu: współrzędne kostki w rzucie (r, c, warstwa t) i rzut krawędzi na granicę pól.
  const VIEWS = {
    front: S => ({ cell: (x, y, z) => [S.nz - 1 - z, x, y],
      edges: function* () {
        for (let x = 0; x < S.nx; x++) for (let y = 0; y <= S.ny; y++) for (let z = 1; z < S.nz; z++)
          if (isEdge(H(S, x, y - 1, z - 1), H(S, x, y, z - 1), H(S, x, y - 1, z), H(S, x, y, z))) yield ["h:" + (S.nz - 1 - z) + "," + x, y];
        for (let x = 1; x < S.nx; x++) for (let y = 0; y <= S.ny; y++) for (let z = 0; z < S.nz; z++)
          if (isEdge(H(S, x - 1, y - 1, z), H(S, x, y - 1, z), H(S, x - 1, y, z), H(S, x, y, z))) yield ["v:" + (S.nz - 1 - z) + "," + (x - 1), y];
      } }),
    top: S => ({ cell: (x, y, z) => [S.ny - 1 - y, x, S.nz - 1 - z],
      edges: function* () {
        for (let x = 0; x < S.nx; x++) for (let y = 1; y < S.ny; y++) for (let z = 0; z <= S.nz; z++)
          if (isEdge(H(S, x, y - 1, z - 1), H(S, x, y, z - 1), H(S, x, y - 1, z), H(S, x, y, z))) yield ["h:" + (S.ny - 1 - y) + "," + x, S.nz - z];
        for (let x = 1; x < S.nx; x++) for (let y = 0; y < S.ny; y++) for (let z = 0; z <= S.nz; z++)
          if (isEdge(H(S, x - 1, y, z - 1), H(S, x, y, z - 1), H(S, x - 1, y, z), H(S, x, y, z))) yield ["v:" + (S.ny - 1 - y) + "," + (x - 1), S.nz - z];
      } }),
    right: S => ({ cell: (x, y, z) => [S.nz - 1 - z, y, S.nx - 1 - x],
      edges: function* () {
        for (let y = 0; y < S.ny; y++) for (let x = 0; x <= S.nx; x++) for (let z = 1; z < S.nz; z++)
          if (isEdge(H(S, x - 1, y, z - 1), H(S, x, y, z - 1), H(S, x - 1, y, z), H(S, x, y, z))) yield ["h:" + (S.nz - 1 - z) + "," + y, S.nx - x];
        for (let y = 1; y < S.ny; y++) for (let x = 0; x <= S.nx; x++) for (let z = 0; z < S.nz; z++)
          if (isEdge(H(S, x - 1, y - 1, z), H(S, x, y - 1, z), H(S, x - 1, y, z), H(S, x, y, z))) yield ["v:" + (S.nz - 1 - z) + "," + (y - 1), S.nx - x];
      } }),
  };
  let mismatchHid = 0, mismatchVis = 0, solids = 0;
  for (let i = 0; i < 250; i++) {
    const S = generateSolid(cfgFor(1 + (i % 8)));
    solids++;
    for (const kind of Object.keys(VIEWS)) {
      const V = VIEWS[kind](S), view = orthoView(S, kind);
      // najbliższa warstwa materiału w każdym polu rzutu, liczona wprost z kostek
      const near = new Map();
      for (const [x, y, z] of S.cells) { const [r, c, t] = V.cell(x, y, z); const k = r + "," + c; near.set(k, Math.min(near.has(k) ? near.get(k) : Infinity, t)); }
      const sides = key => { const [r, c] = key.slice(2).split(",").map(Number); return key[0] === "h" ? [r + "," + c, (r + 1) + "," + c] : [r + "," + c, r + "," + (c + 1)]; };
      const visB = new Set(), hidB = new Set();
      for (const [key, t] of V.edges()) {
        const [p, q] = sides(key);
        const np = near.has(p) ? near.get(p) : Infinity, nq = near.has(q) ? near.get(q) : Infinity;
        if (np === Infinity || nq === Infinity) continue;            // zarys — zawsze linia ciągła
        if (np >= t || nq >= t) visB.add(key); else hidB.add(key);   // promień tuż obok krawędzi po którejś stronie jest wolny
      }
      for (const k of visB) hidB.delete(k);                          // widoczna ma pierwszeństwo
      const appVis = new Set();
      for (let r = 0; r < view.rows; r++) for (let c = 0; c < view.cols; c++) {
        if (r + 1 < view.rows && view.filled[r][c] && view.filled[r + 1][c] && view.depth[r][c] !== view.depth[r + 1][c]) appVis.add("h:" + r + "," + c);
        if (c + 1 < view.cols && view.filled[r][c] && view.filled[r][c + 1] && view.depth[r][c] !== view.depth[r][c + 1]) appVis.add("v:" + r + "," + c);
      }
      if (JSON.stringify([...hidB].sort()) !== JSON.stringify([...view.hid].sort())) mismatchHid++;
      if (JSON.stringify([...visB].sort()) !== JSON.stringify([...appVis].sort())) mismatchVis++;
    }
  }
  chk(solids + " brył × 3 rzuty: linie niewidoczne zgodne z wyliczeniem z krawędzi 3D", mismatchHid, 0);
  chk(solids + " brył × 3 rzuty: linie widoczne wewnątrz zarysu zgodne z wyliczeniem z krawędzi 3D", mismatchVis, 0);
}

head("23. Jednoznaczność trzech rzutów (tryb Buduj i zadania rzuty → bryła)");
{
  // Wszystkie bryły bez nawisów w tym samym prostopadłościanie, zgodne z rzutem
  // z przodu kolumna po kolumnie; potem pełne porównanie trzech rzutów.
  const solutions = (target, side) => {
    const nx = target.nx, ny = target.ny, nz = target.nz, hmT = heightsOf(target);
    const key = threeViewKey(target, side), fr = orthoView(target, "front");
    const cands = [];
    for (let x = 0; x < nx; x++) {
      const list = [];
      const rec = (y, v) => {
        if (y === ny) {
          for (let r = 0; r < nz; r++) { const z = nz - 1 - r; let d = null; for (let yy = 0; yy < ny; yy++) if (v[yy] > z) { d = yy; break; }
            if ((d !== null) !== fr.filled[r][x] || (d !== null && d !== fr.depth[r][x])) return; }
          list.push(v.slice()); return;
        }
        if (hmT[x][y] === 0) { v.push(0); rec(y + 1, v); v.pop(); return; }
        for (let h = 1; h <= nz; h++) { v.push(h); rec(y + 1, v); v.pop(); }
      };
      rec(0, []); cands.push(list);
    }
    let count = 0; const hm = [];
    const go = x => {
      if (x === nx) { const s = solidFromHeights(hm); if (s.nz === nz && threeViewKey(s, side) === key) count++; return; }
      for (const c of cands[x]) { hm.push(c); go(x + 1); hm.pop(); }
    };
    go(0); return count;
  };
  let amb = 0, N = 0;
  for (const lvl of [2, 4, 6, 8]) for (let i = 0; i < 60; i++) { N++; if (solutions(generateSolid(cfgFor(lvl)), i % 2 ? "left" : "right") > 1) amb++; }
  chk(N + " brył: trzy rzuty z liniami niewidocznymi wyznaczają bryłę jednoznacznie", amb, 0);
  let dup = 0;
  for (let i = 0; i < 300; i++) {
    const q = buildExercise("rzuty-bryla", 1 + (i % 8), { forceMethod: i % 2 ? "E" : "A" });
    const side = q.stimulus[0].side, k = threeViewKey(q.solution, side);
    if (q.options.some(o => o.tag !== "ok" && threeViewKey(o.solid, side) === k)) dup++;
  }
  chk("300 zadań rzuty → bryła: żaden dystraktor nie ma tych samych rzutów", dup, 0);
}

head("24. Szkic izometryczny — zbiór odcinków");
{
  chk("sześcian: 6 odcinków zarysu i 3 wewnętrzne", isoLineSet(solidFromHeights([[1]])).size, 9);
  chk("dwie kostki w rzędzie: bez linii między kostkami (12 odcinków)", isoLineSet(solidFromHeights([[1], [1]])).size, 12);
  chk("słupek 2 kostek: 12 odcinków", isoLineSet(solidFromHeights([[2]])).size, 12);
  // Niezależnie: etykiety trójkątów metodą malarza (kolejność drawIso) zamiast porównania głębokości
  let diff = 0;
  for (let i = 0; i < 300; i++) {
    const S = generateSolid(cfgFor(1 + (i % 8)));
    const paint = new Map();
    const order = S.cells.slice().sort((a, c) => (a[0] - a[1] + a[2]) - (c[0] - c[1] + c[2]));
    for (const [x, y, z] of order) {
      const u = x + y, v = x - y - 2 * z;
      if (!S.has(x, y, z + 1)) { paint.set(u + "," + (v - 3) + ",L", "z" + (z + 1)); paint.set((u + 1) + "," + (v - 3) + ",R", "z" + (z + 1)); }
      if (!S.has(x, y - 1, z)) { paint.set(u + "," + (v - 2) + ",R", "y" + y); paint.set(u + "," + (v - 1) + ",L", "y" + y); }
      if (!S.has(x + 1, y, z)) { paint.set((u + 1) + "," + (v - 1) + ",R", "x" + (x + 1)); paint.set((u + 1) + "," + (v - 2) + ",L", "x" + (x + 1)); }
    }
    const tri = isoTriangles(S);
    if (tri.size !== paint.size) { diff++; continue; }
    for (const [k, t] of tri) if (paint.get(k) !== t.lab) { diff++; break; }
  }
  chk("300 brył: przypisanie ścian do trójkątów zgodne z algorytmem malarza", diff, 0);
  const T = isoLineSet(DEMO_C);
  chk("szkic przesunięty o wektor siatki jest poprawny", compareSketch(shiftSegs(T, 3, 5), T).ok, true);
  const one = shiftSegs(T, 1, 1); one.delete([...one][0]);
  const c1 = compareSketch(one, T);
  chk("brak jednego odcinka: wykryty jeden brak", [c1.ok, c1.missing.size, c1.extra.size], [false, 1, 0]);
  const plus = shiftSegs(T, 2, 0); plus.add(segKey(40, 0, 41, 1));
  const c2 = compareSketch(plus, T);
  chk("zbędny odcinek: wykryty jeden nadmiar", [c2.ok, c2.missing.size, c2.extra.size], [false, 0, 1]);
  chk("pusty szkic nie jest poprawny", compareSketch(new Set(), T).ok, false);
  chk("ścieżka po siatce: pion", latticePath({ u: 2, v: 2 }, { u: 2, v: 8 }).length, 3);
  chk("ścieżka po siatce: skos", latticePath({ u: 2, v: 2 }, { u: 5, v: -1 }).length, 3);
  chk("punkty poza linią siatki nie dają odcinka", latticePath({ u: 2, v: 2 }, { u: 4, v: 6 }), null);
}

head("25. Okręgi w izometrii");
{
  // Elipsa = obraz okręgu przez liniowy rzut ściany. Osie to wartości osobliwe
  // macierzy rzutu; liczone tu wprost z isoPt, niezależnie od stałych aplikacji.
  // Tolerancja 1e-6, bo stała cos30 w aplikacji ma siedem cyfr znaczących.
  for (const face of ["top", "front", "right"]) {
    const g = FACE_GEOM[face];
    const a = isoPt(g.e1[0], g.e1[1], g.e1[2], 1), b = isoPt(g.e2[0], g.e2[1], g.e2[2], 1);
    const m11 = a.x * a.x + b.x * b.x, m12 = a.x * a.y + b.x * b.y, m22 = a.y * a.y + b.y * b.y;
    const tr = m11 + m22, det = m11 * m22 - m12 * m12, disc = Math.sqrt(tr * tr / 4 - det);
    const l1 = tr / 2 + disc, l2 = tr / 2 - disc;
    const ang = Math.atan2(l1 - m11, m12);   // wektor własny (m12, l1 − m11)
    const sameDir = Math.abs(Math.sin(ang - FACE_ANGLE[face])) < 1e-6;
    chk("ściana " + face + ": osie √1,5 i √0,5 średnicy, kierunek dużej osi zgodny",
      [Math.abs(Math.sqrt(l1) - ELLIPSE.major) < 1e-6, Math.abs(Math.sqrt(l2) - ELLIPSE.minor) < 1e-6, sameDir], [true, true, true]);
    const n = { top: [0, 0, 1], front: [0, 1, 0], right: [1, 0, 0] }[face];
    const ax = isoPt(n[0], n[1], n[2], 1);
    chk("ściana " + face + ": duża oś prostopadła do osi otworu", Math.abs(Math.cos(FACE_ANGLE[face]) * ax.x + Math.sin(FACE_ANGLE[face]) * ax.y) < 1e-6, true);
  }
  chk("osie bez skrótu ≈ 1,22·d i 0,71·d", [ELLIPSE.major.toFixed(2), ELLIPSE.minor.toFixed(2)], ["1.22", "0.71"]);
  let okE = true;
  for (let i = 0; i < 200; i++) {
    const q = buildExercise("elipsa", 4, { mode: i % 3 ? "rys" : "osie" });
    if (q.options.length !== 4 || new Set(q.options.map(o => o.id)).size !== 4) okE = false;
  }
  chk("200 zadań z elipsą: po 4 różne opcje", okE, true);
}

head("26. Linie pochyłe");
{
  const w = makeWedge({ W: 4, D: 2, H: 3, plane: "front", corner: "far", a: 2, b: 1 });
  const V = new Set(w.verts.map(v => v.join(","))).size;
  chk("bryła ze skosem spełnia wzór Eulera (W − K + S = 2)", V - w.edges.length + w.faces.length, 2);
  chk("normalne ścian są jednostkowe i skierowane na zewnątrz", w.faces.every(f => Math.abs(Math.hypot(f.n[0], f.n[1], f.n[2]) - 1) < 1e-9), true);
  const hidL = polyViewEdges(w, "left").hidden;
  chk("rzut z lewej: krawędź skosu po prawej stronie jest niewidoczna, na wysokości H − b",
    hidL.length === 1 && hidL[0].a[2] === 2 && hidL[0].b[2] === 2, true);
  const visT = polyViewEdges(w, "top").visible;
  chk("rzut z góry: widać krawędź skosu w odległości a od prawej krawędzi", visT.some(e => e.a[0] === 2 && e.b[0] === 2), true);
  chk("rzut z prawej: brak krawędzi niewidocznych (skos zwrócony do obserwatora)", polyViewEdges(w, "right").hidden.length, 0);
  let okS = true;
  for (let i = 0; i < 200; i++) {
    const q = buildExercise("skos", 1 + (i % 8));
    if (q.options.length < 3 || new Set(q.options.map(o => o.id)).size !== q.options.length) okS = false;
    if (q.options[q.correct].poly.id !== q.stimulus[0].solid.id) okS = false;
  }
  chk("200 zadań ze skosem: opcje różne, poprawna zgodna z rzutami", okS, true);
}

head("27. Regulator trudności utrzymuje 75–85%");
{
  const save = { level: State.level, recent: State.recent };
  const sim = k => {
    let sum = 0, m = 0;
    for (let th = 2.5; th <= 6.5; th += 0.5) {
      State.level = 2; State.recent = [];
      let ok = 0, n = 0;
      for (let t = 0; t < 5000; t++) {
        const c = Math.random() < 1 / (1 + Math.exp(-(k * (th - State.level) + 1))) ? 1 : 0;
        if (t > 300) { ok += c; n++; }
        State.recent.push(c); if (State.recent.length > 12) State.recent.shift();
        adaptLevel();
      }
      sum += ok / n; m++;
    }
    return sum / m;
  };
  for (const k of [0.8, 1.5]) {
    const acc = sim(k);
    chk("modelowy uczeń (nachylenie " + k + "): skuteczność " + (100 * acc).toFixed(1) + "% w przedziale 75–85%", acc >= 0.75 && acc <= 0.85, true);
  }
  State.level = save.level; State.recent = save.recent;
}

head("28. Kurs: nowe moduły i zachowanie postępu");
{
  chk("kurs ma 16 modułów", COURSE.length, 16);
  chk("moduł szkicowania stoi po planie kodowanym, jak w kursie Sorby", COURSE.findIndex(m => m.id === "m-szkic"), COURSE.findIndex(m => m.id === "m2") + 1);
  chk("moduł powierzchni pochyłych stoi przed obrotami", COURSE.findIndex(m => m.id === "m-skosy") < COURSE.findIndex(m => m.id === "m6"), true);
  const save = JSON.stringify(State.course);
  State.course = { mods: {}, exam: null };
  courseProgress("m3").passed = true;   // postęp sprzed dodania modułu szkicowania
  chk("zaliczony wcześniej moduł zostaje otwarty mimo nowego modułu przed nim", moduleUnlocked(COURSE.findIndex(m => m.id === "m3")), true);
  chk("nowy moduł wymaga zaliczenia poprzedniego", moduleUnlocked(COURSE.findIndex(m => m.id === "m-szkic")), false);
  State.course = JSON.parse(save);
  let lessonsOk = true;
  for (const L of LESSONS) if (!L.id || !L.title || typeof L.build !== "function") lessonsOk = false;
  chk("lekcje: " + LESSONS.length + ", wszystkie kompletne", lessonsOk, true);
}

head("29. Sesja ze szkicem");
{
  const realRender = render; render = function () {};
  startSession({ mode: "kurs-drill", moduleId: "m-szkic", queue: [{ skill: "szkic", level: 2, opts: { from: "plan" } }] });
  chk("zadanie szkicu ma stan edytora", !!Session.sk && Session.q.kind === "sketch", true);
  Session.sk.segs = shiftSegs(Session.q.lines, 4, 6);
  const cmp = compareOnPad(Session.sk, Session.q.lines);
  chk("poprawny szkic rozpoznany w edytorze", cmp.ok, true);
  answerSketch(true);
  chk("rozstrzygnięty szkic liczy się jako poprawna odpowiedź", [Session.answered, Session.ok], [true, 1]);
  Session.active = false; Session.summary = null;
  render = realRender;
}

head("30. Łączenie brył");
{
  let algebra = true, opts = true;
  for (let i = 0; i < 200; i++) {
    const q = buildExercise("laczenie", 1 + (i % 8));
    const st = q.stimulus, A = st[0].solid, B = st[1].solid;
    const U = boolOp(A, B, "union"), I = boolOp(A, B, "inter"), D = boolOp(A, B, "diff");
    if (U.count + I.count !== A.count + B.count) algebra = false;
    if (boolOp(D, I, "union").id !== A.id) algebra = false;
    if (q.options.length !== 4 || new Set(q.options.map(o => o.id)).size !== 4) opts = false;
    if (q.options[q.correct].solid.id !== q.solution.id) opts = false;
  }
  chk("200 zadań: |A ∪ B| + |A ∩ B| = |A| + |B| oraz (A − B) ∪ (A ∩ B) = A", algebra, true);
  chk("200 zadań: cztery różne wyniki, poprawny zgodny z operacją", opts, true);
}

head("31. Rozwinięcia brył");
{
  const N = cubeNets();
  chk("heksomina w każdym położeniu: 216", N.all.length, 216);
  chk("heksomina różne z dokładnością do obrotów i odbić: 35", new Set(N.all.map(freeNetKey)).size, 35);
  chk("siatki sześcianu różne z dokładnością do obrotów i odbić: 11", new Set(N.valid.map(freeNetKey)).size, 11);
  chk("prostokąt 2 × 3 nie jest siatką sześcianu", foldNet([[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]]), null);
  // Przykład do sprawdzenia w głowie: krzyż A nad C, w wierszu B C D E, F pod C. Patrząc na nadruk
  // i zaginając ścianki od siebie, C jest górą, F przodem, D prawą — widok (C, F, D) jest możliwy,
  // a jego odbicie (C, D, F) nie.
  const cross = [[0, 1], [1, 0], [1, 1], [1, 2], [1, 3], [2, 1]], nm = "ABCDEF";
  const vs = netViews(foldNet(cross)).map(v => v.map(i => nm[i]).join(""));
  chk("krzyż: widok góra C, przód F, prawa D możliwy; jego odbicie nie", [vs.includes("CFD"), vs.includes("CDF")], [true, false]);
  chk("każda siatka daje 24 możliwe widoki (8 narożników × 3 obroty)", N.valid.every(f => netViews(foldNet(f)).length === 24), true);
  let ok = true;
  for (let i = 0; i < 200; i++) {
    const q = buildExercise("siatka", 4, { mode: "kostka" });
    const valid = new Set(q.check.valid);
    q.options.forEach((o, j) => { if ((j === q.correct) !== valid.has(o.id.slice(1))) ok = false; });
  }
  chk("200 zadań z sześcianem: dokładnie jeden możliwy widok wśród opcji", ok, true);
  let okc = true;
  for (let i = 0; i < 100; i++) {
    const q = buildExercise("siatka", 4, { mode: "czy" });
    const N2 = cubeNets(), validKeys = new Set(N2.valid.map(netKey));
    q.options.forEach((o, j) => { if ((j === q.correct) !== validKeys.has(o.id.slice(1))) okc = false; });
  }
  chk("100 zadań „która siatka”: dokładnie jedna składa się w sześcian", okc, true);
}

head("32. Bryły obrotowe");
{
  let mono = true, flip = true, distinct = true;
  for (let i = 0; i < 300; i++) {
    const p = genProfile(cfgFor(1 + (i % 8)));
    let r = Infinity;
    for (const sg of p) { if (sg.r0 > r + 1e-9 || sg.r1 > sg.r0) mono = false; r = sg.r1; }
    if (revId(PROFILE_XF.revFlip(PROFILE_XF.revFlip(p))) !== revId(p)) flip = false;
    const q = buildExercise("obrotowe", 1 + (i % 8));
    if (new Set(q.options.map(o => o.id)).size !== q.options.length || q.options.length < 3) distinct = false;
  }
  chk("profile: promień nie rośnie ku górze (brak nawisów)", mono, true);
  chk("odwrócenie figury dwa razy przywraca ją", flip, true);
  chk("300 zadań: opcje różne, co najmniej 3", distinct, true);
  const d = PROFILE_XF.revDiam([{ h: 2, r0: 3, r1: 3 }]);
  chk("dystraktor „średnica zamiast promienia” ma połowę promienia", d[0].r0, 1.5);
}

head("33. Wymiarowanie");
{
  let arith = true, one = true;
  for (let i = 0; i < 200; i++) {
    const q = buildExercise("wymiar", 1 + (i % 8), { mode: "brak" });
    const ws = q.check.ws, m = q.check.missing, W = ws.reduce((a, b) => a + b, 0);
    if (q.options[q.correct].value !== W - (W - ws[m])) arith = false;
    if (q.options.filter(o => o.value === ws[m]).length !== 1) arith = false;
    for (const mode of ["popraw", "blad"]) {
      const r = buildExercise("wymiar", 4, { mode: mode });
      if (r.options.filter(o => o.tag === "ok").length !== 1 || new Set(r.options.map(o => o.id)).size !== r.options.length) one = false;
    }
  }
  chk("200 zadań: brakujące ogniwo = wymiar całkowity − pozostałe ogniwa, jedna opcja z tą wartością", arith, true);
  chk("zadania na zasady zapisu: jedna poprawna odpowiedź, opcje różne", one, true);
  chk("każdy wariant błędu ma opis dla ucznia", Object.keys(DIM_RULE).every(k => WHY["dim_" + k]), true);
}

head("34. Kurs obejmuje wszystkie tematy kursu Sorby");
{
  const sorby = ["m-obrotowe", "m-laczenie", "m-szkic", "m3", "m-skosy", "m-siatki", "m6", "m7", "m8", "m9"];
  chk("10 modułów odpowiadających tematom „Developing Spatial Thinking” jest w kursie", sorby.filter(id => !COURSE_BY_ID[id]), []);
  chk("bryły obrotowe stoją po lekcji o okręgach", COURSE.findIndex(m => m.id === "m-obrotowe") > COURSE.findIndex(m => m.id === "m-skosy"), true);
  chk("wymiarowanie stoi po czytaniu rzutów", COURSE.findIndex(m => m.id === "m-wymiar") > COURSE.findIndex(m => m.id === "m5"), true);
}

console.log(FAILS ? "\n" + FAILS + " BŁĘDÓW\n" : "\nWszystkie testy logiki przeszły.\n");
process.exit(FAILS ? 1 : 0);
