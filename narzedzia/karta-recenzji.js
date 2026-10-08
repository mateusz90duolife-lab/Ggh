/* Generuje kartę recenzji merytorycznej z treści trener.html.

   Każde twierdzenie z lekcji, z tabel w lekcjach i z informacji zwrotnej
   po błędnej odpowiedzi trafia do karty jako osobny wiersz do oceny.
   Karta powstaje z kodu aplikacji, więc nie da się w niej czegoś pominąć,
   a test (testy/uruchom.sh) pilnuje, żeby była aktualna.

   Uruchomienie:  node narzedzia/karta-recenzji.js > recenzja/karta.md */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "..", "trener.html"), "utf8");
const script = html.slice(html.indexOf("<script>\n\"use strict\";") + 8, html.lastIndexOf("</script>"));
const core = script.slice(0, script.indexOf("/* ═══ START APLIKACJI"));

/* ── Minimalna atrapa DOM: lekcje budują elementy i rysują na płótnie, ale
      do karty potrzebny jest tylko tekst. ── */
const noop = () => {};
const ctxProxy = new Proxy({}, {
  get: (t, k) => k === "createLinearGradient" ? () => ({ addColorStop: noop })
               : k === "measureText" ? () => ({ width: 10 }) : noop,
  set: () => true,
});
let tableSink = null;
function fakeEl(tag) {
  const e = {
    tagName: String(tag).toUpperCase(), children: [], style: {}, dataset: {},
    classList: { add: noop, remove: noop, toggle: () => false, contains: () => false },
    appendChild(c) { this.children.push(c); return c; }, setAttribute: noop, removeAttribute: noop,
    addEventListener: noop, getContext: () => ctxProxy, focus: noop, remove: noop,
    set innerHTML(v) { if (this.tagName === "TABLE" && tableSink) tableSink(v); },
    get innerHTML() { return ""; },
    textContent: "",
  };
  return e;
}
const sandbox = {
  window: { devicePixelRatio: 1 }, document: { createElement: fakeEl, querySelector: () => fakeEl("div"), addEventListener: noop },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop }, console, Math, JSON, Set, Map, Proxy,
  setTimeout: noop, Infinity, Number, String, Array, Object, Date, Error,
};
vm.createContext(sandbox);
vm.runInContext(core + "\n;this.__api = { LESSONS, WHY, SKILLS, COURSE, " +
  "set: (n, f) => { if (n === 'para') para = f; if (n === 'bullets') bullets = f; if (n === 'noteBox') noteBox = f; if (n === 'srcLine') srcLine = f; } };", sandbox);
const api = sandbox.__api;

const strip = s => String(s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const sentences = t => strip(t).split(/(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ„(0-9])/).filter(Boolean);
const cell = s => s.replace(/\|/g, "\\|");

const out = [];
const w = s => out.push(s);

w("# Karta recenzji merytorycznej — ISO Master Trener");
w("");
w("Karta jest generowana automatycznie z treści aplikacji (`node narzedzia/karta-recenzji.js`).");
w("Zawiera każde twierdzenie z lekcji, z tabel w lekcjach i z informacji zwrotnej po błędnej");
w("odpowiedzi — " + "%%LICZBA%%" + ". Nie edytuj tego pliku: skopiuj go jako");
w("`recenzja/RRRR-MM-nazwisko.md` i wypełniaj kopię.");
w("");
w("## Dla recenzenta");
w("");
w("Treści przygotowano na podstawie materiałów uczelnianych i podręcznikowych wymienionych przy");
w("lekcjach oraz w `METODYKA.md`. **Tekstu norm nie czytano** — są płatne, a dostępne w sieci");
w("bezpłatne kopie pełnych tekstów nie pochodzą z legalnego źródła. Najbardziej potrzebne jest");
w("sprawdzenie zgodności z normami:");
w("");
w("- PN-EN ISO 128 — rodzaje linii, widoki, przekroje i kłady;");
w("- PN-EN ISO 129-1 — wymiarowanie;");
w("- PN-EN ISO 5456-2 — rzutowanie prostokątne, metody E i A, symbol metody;");
w("- PN-EN ISO 5456-3 — aksonometria, w tym skala izometrii.");
w("");
w("W kolumnie **Ocena** wpisz: `✔` — zgodne, `✘` — błędne, `~` — wymaga doprecyzowania.");
w("W kolumnie **Uwagi** podaj poprawną treść i, jeśli to możliwe, punkt normy lub podręcznika.");
w("Szacowany czas: około dwóch godzin.");
w("");
w("Recenzent: ……………………  Kwalifikacje: ……………………  Data: ……………");
w("");

let n = 0;
const rows = [];
const row = (...cols) => { n++; rows.push("| " + n + " | " + cols.map(cell).join(" | ") + " |  |  |"); };
const head = (...cols) => { w("| # | " + cols.join(" | ") + " | Ocena | Uwagi |"); w("|" + " --- |".repeat(cols.length + 3)); };

w("## 1. Lekcje");
w("");
const usedIn = id => api.COURSE.filter(m => m.lessons.indexOf(id) >= 0).map(m => m.title).join(", ");
api.LESSONS.forEach((L, i) => {
  const items = [];
  let src = "";
  api.set("para", (b, t) => items.push(...sentences(t)));
  api.set("noteBox", (b, t) => items.push(...sentences(t)));
  api.set("bullets", (b, list) => list.forEach(t => items.push(strip(t))));
  api.set("srcLine", (b, t) => { src = t; });
  tableSink = h => {
    const trs = h.split(/<\/tr>/).map(r => r.split(/<\/t[dh]>/).map(strip).filter(Boolean)).filter(r => r.length);
    const hdr = trs.shift() || [];
    for (const r of trs) items.push(r.map((c, j) => (hdr[j] ? hdr[j] + ": " : "") + c).join("; "));
  };
  L.build(fakeEl("div"));
  w("### 1." + (i + 1) + ". " + L.title);
  const mod = usedIn(L.id);
  w("");
  if (mod) { w("Moduł kursu: " + mod + "."); w(""); }
  w(src ? "Źródło wskazane w lekcji: " + src : "Lekcja nie wskazuje źródła — twierdzenia wynikają z geometrii albo z działania aplikacji.");
  w("");
  rows.length = 0;
  for (const t of items) row(t);
  head("Twierdzenie"); rows.forEach(r => w(r)); w("");
});

w("## 2. Informacja zwrotna po błędnej odpowiedzi");
w("");
w("Tekst pokazywany uczniowi, który wybrał daną błędną odpowiedź. Każdy opisuje typowy błąd.");
w("");
rows.length = 0;
for (const k of Object.keys(api.WHY)) if (k !== "ok") row(k, api.WHY[k]);
head("Kod błędu", "Tekst dla ucznia"); rows.forEach(r => w(r)); w("");

w("## 3. Uwagi ogólne");
w("");
w("Czego w aplikacji brakuje albo co jest przedstawione w sposób, który utrudni uczniowi pracę z prawdziwą");
w("dokumentacją techniczną?");
w("");
w("……………………………………………………………………………………………………………………");
w("");

const forma = n === 1 ? "pozycja" : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? "pozycje" : "pozycji";
process.stdout.write(out.join("\n").replace("%%LICZBA%%", n + " " + forma).replace(" pozycji. Nie", ". Nie") + "\n");
