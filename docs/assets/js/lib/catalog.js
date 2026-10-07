import { normalize } from './format.js';
const i = (name, unit, art) => ({ name, unit, art });
/** Katalog startowy: mięso, warzywa, nabiał, zupy, przyprawy i oleje, sosy, akcesoria. */
export const CATALOG = [
    {
        category: 'Mięso',
        icon: '🥩',
        items: [
            i('Wołowina (antrykot)', 'kg', 'antrykot'),
            i('Polędwica wołowa', 'kg', 'poledwica'),
            i('Wołowina mielona', 'kg', 'mielone-wol'),
            i('Schab wieprzowy', 'kg', 'schab'),
            i('Karkówka', 'kg', 'karkowka'),
            i('Łopatka wieprzowa', 'kg', 'lopatka'),
            i('Wieprzowina mielona', 'kg', 'mielone-wp'),
            i('Żeberka wieprzowe', 'kg', 'zeberka'),
            i('Boczek', 'kg', 'boczek'),
            i('Golonka', 'kg', 'golonka'),
            i('Pierś z kurczaka', 'kg', 'piers-kurczak'),
            i('Udka z kurczaka', 'kg', 'udko'),
            i('Skrzydełka z kurczaka', 'kg', 'skrzydelka'),
            i('Kurczak cały', 'szt', 'kurczak'),
            i('Indyk (filet)', 'kg', 'indyk'),
            i('Kaczka', 'szt', 'kaczka'),
            i('Cielęcina', 'kg', 'cielecina'),
            i('Jagnięcina', 'kg', 'jagniecina'),
            i('Wątróbka drobiowa', 'kg', 'watrobka'),
            i('Kiełbasa', 'kg', 'kielbasa'),
            i('Parówki', 'kg', 'parowki'),
            i('Szynka', 'kg', 'szynka'),
            i('Salami', 'kg', 'salami'),
        ],
    },
    {
        category: 'Warzywa',
        icon: '🥕',
        items: [
            i('Ziemniaki', 'kg', 'ziemniaki'),
            i('Marchew', 'kg', 'marchew'),
            i('Cebula', 'kg', 'cebula'),
            i('Cebula czerwona', 'kg', 'cebula-czerw'),
            i('Czosnek', 'kg', 'czosnek'),
            i('Pomidory', 'kg', 'pomidory'),
            i('Pomidorki koktajlowe', 'kg', 'pomidorki'),
            i('Ogórki', 'kg', 'ogorki'),
            i('Papryka czerwona', 'kg', 'papryka-czerw'),
            i('Papryka zielona', 'kg', 'papryka-ziel'),
            i('Papryczka chili', 'kg', 'chili'),
            i('Sałata lodowa', 'szt', 'salata'),
            i('Rukola', 'kg', 'rukola'),
            i('Szpinak', 'kg', 'szpinak'),
            i('Kapusta biała', 'szt', 'kapusta'),
            i('Kapusta kiszona', 'kg', 'kapusta-kisz'),
            i('Brokuły', 'kg', 'brokuly'),
            i('Kalafior', 'szt', 'kalafior'),
            i('Cukinia', 'kg', 'cukinia'),
            i('Bakłażan', 'kg', 'baklazan'),
            i('Pieczarki', 'kg', 'pieczarki'),
            i('Kukurydza', 'kg', 'kukurydza'),
            i('Fasolka szparagowa', 'kg', 'fasolka'),
            i('Por', 'szt', 'por'),
            i('Seler', 'kg', 'seler'),
            i('Pietruszka (korzeń)', 'kg', 'pietruszka'),
            i('Burak', 'kg', 'burak'),
            i('Dynia', 'kg', 'dynia'),
            i('Awokado', 'szt', 'awokado'),
            i('Natka pietruszki', 'opak', 'natka'),
            i('Koperek', 'opak', 'koperek'),
            i('Szczypiorek', 'opak', 'szczypiorek'),
            i('Cytryny', 'kg', 'cytryny'),
        ],
    },
    {
        category: 'Nabiał',
        icon: '🧀',
        items: [
            i('Mleko 3,2%', 'l', 'mleko'),
            i('Śmietana 18%', 'l', 'smietana'),
            i('Śmietanka 30%', 'l', 'smietanka'),
            i('Masło', 'kg', 'maslo'),
            i('Ser żółty', 'kg', 'ser-zolty'),
            i('Ser żółty w plastrach', 'kg', 'ser-plastry'),
            i('Mozzarella', 'kg', 'mozzarella'),
            i('Parmezan', 'kg', 'parmezan'),
            i('Ser feta', 'kg', 'feta'),
            i('Twaróg', 'kg', 'twarog'),
            i('Jogurt naturalny', 'kg', 'jogurt'),
            i('Kefir', 'l', 'kefir'),
            i('Mascarpone', 'kg', 'mascarpone'),
            i('Serek kremowy', 'kg', 'serek-kremowy'),
            i('Camembert', 'szt', 'camembert'),
            i('Jajka', 'szt', 'jajka'),
            i('Masło klarowane', 'kg', 'maslo-klar'),
        ],
    },
    {
        category: 'Zupy',
        icon: '🍲',
        items: [
            i('Rosół', 'l', 'rosol'),
            i('Żurek', 'l', 'zurek'),
            i('Zakwas na żurek', 'l', 'zakwas'),
            i('Barszcz czerwony', 'l', 'barszcz'),
            i('Pomidorowa', 'l', 'pomidorowa'),
            i('Ogórkowa', 'l', 'ogorkowa'),
            i('Grochówka', 'l', 'grochowka'),
            i('Kapuśniak', 'l', 'kapusniak'),
            i('Pieczarkowa', 'l', 'pieczarkowa'),
            i('Krem z dyni', 'l', 'krem-dynia'),
            i('Krem z brokułów', 'l', 'krem-brokul'),
            i('Zupa cebulowa', 'l', 'cebulowa'),
            i('Flaki', 'l', 'flaki'),
            i('Bulion warzywny', 'l', 'bulion-warz'),
            i('Bulion wołowy', 'l', 'bulion-wol'),
        ],
    },
    {
        category: 'Przyprawy',
        icon: '🧂',
        items: [
            i('Sól', 'kg', 'sol'),
            i('Pieprz czarny', 'kg', 'pieprz'),
            i('Papryka słodka mielona', 'kg', 'papryka-slod'),
            i('Papryka ostra mielona', 'kg', 'papryka-ostra'),
            i('Papryka wędzona', 'kg', 'papryka-wedz'),
            i('Czosnek granulowany', 'kg', 'czosnek-gran'),
            i('Oregano', 'opak', 'oregano'),
            i('Bazylia', 'opak', 'bazylia'),
            i('Tymianek', 'opak', 'tymianek'),
            i('Majeranek', 'opak', 'majeranek'),
            i('Rozmaryn', 'opak', 'rozmaryn'),
            i('Liść laurowy', 'opak', 'lisc-laurowy'),
            i('Ziele angielskie', 'opak', 'ziele-ang'),
            i('Kminek', 'opak', 'kminek'),
            i('Curry', 'opak', 'curry'),
            i('Kurkuma', 'opak', 'kurkuma'),
            i('Gałka muszkatołowa', 'opak', 'galka-musz'),
            i('Cynamon', 'opak', 'cynamon'),
            i('Imbir mielony', 'opak', 'imbir'),
            i('Chili płatki', 'opak', 'chili-platki'),
            i('Vegeta', 'kg', 'vegeta'),
            i('Cukier', 'kg', 'cukier'),
            i('Oliwa z oliwek', 'l', 'oliwa'),
            i('Oliwa extra virgin', 'l', 'oliwa-ev'),
            i('Olej rzepakowy', 'l', 'olej-rzep'),
            i('Olej słonecznikowy', 'l', 'olej-slon'),
            i('Olej kokosowy', 'l', 'olej-kokos'),
            i('Olej sezamowy', 'l', 'olej-sezam'),
            i('Olej do smażenia (frytura)', 'l', 'olej-frytura'),
        ],
    },
    {
        category: 'Sosy',
        icon: '🥫',
        items: [
            i('Ketchup', 'kg', 'ketchup'),
            i('Majonez', 'kg', 'majonez'),
            i('Musztarda', 'kg', 'musztarda'),
            i('Sos sojowy', 'l', 'sos-sojowy'),
            i('Sos czosnkowy', 'l', 'sos-czosnkowy'),
            i('Sos BBQ', 'l', 'sos-bbq'),
            i('Sos pomidorowy', 'l', 'sos-pomidor'),
            i('Sos śmietanowy', 'l', 'sos-smietan'),
            i('Sos słodko-kwaśny', 'l', 'slodko-kwasny'),
            i('Sos teriyaki', 'l', 'teriyaki'),
            i('Sos tatarski', 'kg', 'tatarski'),
            i('Sos holenderski', 'l', 'holenderski'),
            i('Pesto', 'kg', 'pesto'),
            i('Sriracha', 'but', 'sriracha'),
            i('Tabasco', 'but', 'tabasco'),
            i('Sos Worcestershire', 'but', 'worcester'),
            i('Ocet', 'l', 'ocet'),
            i('Ocet balsamiczny', 'but', 'ocet-balsam'),
        ],
    },
    {
        category: 'Akcesoria',
        icon: '🧻',
        items: [
            i('Folia aluminiowa', 'opak', 'folia-alu'),
            i('Folia spożywcza (stretch)', 'opak', 'folia-spoz'),
            i('Papier do pieczenia', 'opak', 'papier-piecz'),
            i('Rękawiczki jednorazowe', 'opak', 'rekawiczki'),
            i('Worki na śmieci', 'opak', 'worki'),
            i('Ręczniki papierowe', 'opak', 'reczniki'),
            i('Serwetki', 'opak', 'serwetki'),
            i('Pojemniki na wynos', 'szt', 'pojemniki'),
            i('Pojemniki na zupę', 'szt', 'pojemnik-zupa'),
            i('Kubki jednorazowe', 'szt', 'kubki'),
            i('Sztućce jednorazowe', 'opak', 'sztucce'),
            i('Torby papierowe', 'szt', 'torby'),
            i('Woreczki strunowe', 'opak', 'woreczki-zip'),
            i('Woreczki próżniowe', 'opak', 'woreczki-prozn'),
            i('Wykałaczki', 'opak', 'wykalaczki'),
            i('Patyczki do szaszłyków', 'opak', 'patyczki'),
            i('Rolki do kasy', 'szt', 'rolki-kasa'),
            i('Gąbki do naczyń', 'szt', 'gabki'),
        ],
    },
];
/** Ilustracje kategorii (emoji w zakładkach; także kategorie spoza katalogu). */
const CATEGORY_ICONS = {
    mieso: '🥩',
    warzywa: '🥕',
    zupy: '🍲',
    przyprawy: '🧂',
    sosy: '🥫',
    nabial: '🧀',
    akcesoria: '🧻',
    owoce: '🍎',
    ryby: '🐟',
    pieczywo: '🍞',
    suche: '🌾',
    napoje: '🥤',
    alkohole: '🍷',
    'chemia i czystosc': '🧴',
    inne: '📦',
};
export const DEFAULT_ICON = '📦';
export function categoryIcon(name) {
    return (name && CATEGORY_ICONS[normalize(name)]) || DEFAULT_ICON;
}
/** Dodatkowe ilustracje (bez pozycji w katalogu) — dla produktów wpisanych ręcznie. */
const EXTRA_ART = ['maka', 'makaron', 'ryz', 'chleb', 'ryba', 'woda', 'jablko'];
/** Wszystkie dostępne ilustracje (klucze plików SVG). */
export const ART_KEYS = [...CATALOG.flatMap((g) => g.items.map((it) => it.art)), ...EXTRA_ART];
const ART_SET = new Set(ART_KEYS);
/**
 * Początki słów w nazwie → ilustracja (dla produktów spoza katalogu). Kolejność ma znaczenie:
 * bardziej szczegółowe frazy (np. „sos pomidorowy”, „papryka słodka”) są przed ogólnymi („pomidor”, „papryk”).
 */
const ART_KEYWORDS = [
    // oleje i oliwy
    ['oliwa extra', 'oliwa-ev'],
    ['oliw', 'oliwa'],
    ['olej kokos', 'olej-kokos'],
    ['olej sezam', 'olej-sezam'],
    ['olej slonecz', 'olej-slon'],
    ['frytur', 'olej-frytura'],
    ['olej', 'olej-rzep'],
    // zupy
    ['rosol', 'rosol'],
    ['zurek', 'zurek'],
    ['zakwas', 'zakwas'],
    ['barszcz', 'barszcz'],
    ['pomidorowa', 'pomidorowa'],
    ['ogorkowa', 'ogorkowa'],
    ['grochow', 'grochowka'],
    ['kapusniak', 'kapusniak'],
    ['pieczarkowa', 'pieczarkowa'],
    ['krem z dyni', 'krem-dynia'],
    ['krem z brokul', 'krem-brokul'],
    ['zupa cebul', 'cebulowa'],
    ['cebulowa', 'cebulowa'],
    ['flaki', 'flaki'],
    ['bulion wol', 'bulion-wol'],
    ['bulion', 'bulion-warz'],
    // sosy
    ['ketchup', 'ketchup'],
    ['majonez', 'majonez'],
    ['musztard', 'musztarda'],
    ['sos sojow', 'sos-sojowy'],
    ['sos czosnk', 'sos-czosnkowy'],
    ['sos bbq', 'sos-bbq'],
    ['bbq', 'sos-bbq'],
    ['sos pomidor', 'sos-pomidor'],
    ['sos smietan', 'sos-smietan'],
    ['sos slodko', 'slodko-kwasny'],
    ['teriyaki', 'teriyaki'],
    ['sos tatar', 'tatarski'],
    ['sos holender', 'holenderski'],
    ['pesto', 'pesto'],
    ['sriracha', 'sriracha'],
    ['tabasco', 'tabasco'],
    ['worcester', 'worcester'],
    ['ocet balsam', 'ocet-balsam'],
    ['ocet', 'ocet'],
    // nabiał
    ['mleko', 'mleko'],
    ['smietank', 'smietanka'],
    ['smietan', 'smietana'],
    ['jogurt', 'jogurt'],
    ['kefir', 'kefir'],
    ['maslo klar', 'maslo-klar'],
    ['maslo', 'maslo'],
    ['mozzarel', 'mozzarella'],
    ['parmez', 'parmezan'],
    ['feta', 'feta'],
    ['ser feta', 'feta'],
    ['twarog', 'twarog'],
    ['mascarpone', 'mascarpone'],
    ['serek', 'serek-kremowy'],
    ['camembert', 'camembert'],
    ['serwetk', 'serwetki'],
    ['ser zolty w plastr', 'ser-plastry'],
    ['ser', 'ser-zolty'],
    ['jaj', 'jajka'],
    // akcesoria
    ['folia spoz', 'folia-spoz'],
    ['folia strecz', 'folia-spoz'],
    ['folia', 'folia-alu'],
    ['papier do piecz', 'papier-piecz'],
    ['rekawicz', 'rekawiczki'],
    ['worki', 'worki'],
    ['worek', 'worki'],
    ['recznik', 'reczniki'],
    ['pojemnik na zup', 'pojemnik-zupa'],
    ['pojemnik', 'pojemniki'],
    ['kubk', 'kubki'],
    ['kubek', 'kubki'],
    ['sztucc', 'sztucce'],
    ['torb', 'torby'],
    ['woreczki strun', 'woreczki-zip'],
    ['woreczki proz', 'woreczki-prozn'],
    ['wykalacz', 'wykalaczki'],
    ['patyczk', 'patyczki'],
    ['rolk', 'rolki-kasa'],
    ['gabk', 'gabki'],
    // mięso i ryby
    ['udk', 'udko'],
    ['skrzyd', 'skrzydelka'],
    ['piers', 'piers-kurczak'],
    ['kurczak', 'kurczak'],
    ['indyk', 'indyk'],
    ['kaczk', 'kaczka'],
    ['boczek', 'boczek'],
    ['kielbas', 'kielbasa'],
    ['parowk', 'parowki'],
    ['salami', 'salami'],
    ['szynk', 'szynka'],
    ['watrob', 'watrobka'],
    ['zeberk', 'zeberka'],
    ['golonk', 'golonka'],
    ['schab', 'schab'],
    ['karkow', 'karkowka'],
    ['poledwic', 'poledwica'],
    ['wieprzowina miel', 'mielone-wp'],
    ['mielon', 'mielone-wol'],
    ['antrykot', 'antrykot'],
    ['stek', 'antrykot'],
    ['wolow', 'antrykot'],
    ['lopatk', 'lopatka'],
    ['wieprz', 'lopatka'],
    ['ciel', 'cielecina'],
    ['jagni', 'jagniecina'],
    ['losos', 'ryba'],
    ['dorsz', 'ryba'],
    ['tunczyk', 'ryba'],
    ['ryb', 'ryba'],
    // przyprawy
    ['sol', 'sol'],
    ['pieprz', 'pieprz'],
    ['papryka slod', 'papryka-slod'],
    ['papryka ostr', 'papryka-ostra'],
    ['papryka wedz', 'papryka-wedz'],
    ['czosnek gran', 'czosnek-gran'],
    ['oregano', 'oregano'],
    ['bazyli', 'bazylia'],
    ['tymian', 'tymianek'],
    ['majeran', 'majeranek'],
    ['rozmaryn', 'rozmaryn'],
    ['lisc laur', 'lisc-laurowy'],
    ['ziele ang', 'ziele-ang'],
    ['kminek', 'kminek'],
    ['curry', 'curry'],
    ['kurkum', 'kurkuma'],
    ['galka', 'galka-musz'],
    ['cynamon', 'cynamon'],
    ['imbir', 'imbir'],
    ['chili platk', 'chili-platki'],
    ['vegeta', 'vegeta'],
    ['cukier', 'cukier'],
    // warzywa i owoce
    ['ziemniak', 'ziemniaki'],
    ['frytk', 'ziemniaki'],
    ['marchew', 'marchew'],
    ['cebula czerw', 'cebula-czerw'],
    ['cebul', 'cebula'],
    ['czosn', 'czosnek'],
    ['pomidork', 'pomidorki'],
    ['pomidor', 'pomidory'],
    ['ogor', 'ogorki'],
    ['papryka ziel', 'papryka-ziel'],
    ['papryk', 'papryka-czerw'],
    ['chili', 'chili'],
    ['salat', 'salata'],
    ['rukol', 'rukola'],
    ['szpinak', 'szpinak'],
    ['kapusta kisz', 'kapusta-kisz'],
    ['kapust', 'kapusta'],
    ['brokul', 'brokuly'],
    ['kalafior', 'kalafior'],
    ['cukini', 'cukinia'],
    ['baklazan', 'baklazan'],
    ['pieczark', 'pieczarki'],
    ['grzyb', 'pieczarki'],
    ['kukurydz', 'kukurydza'],
    ['fasolk', 'fasolka'],
    ['por', 'por'],
    ['seler', 'seler'],
    ['pietruszk', 'pietruszka'],
    ['natk', 'natka'],
    ['burak', 'burak'],
    ['dyni', 'dynia'],
    ['awokado', 'awokado'],
    ['koper', 'koperek'],
    ['szczypior', 'szczypiorek'],
    ['cytryn', 'cytryny'],
    ['limon', 'cytryny'],
    ['jablk', 'jablko'],
    // pozostałe
    ['maka', 'maka'],
    ['makaron', 'makaron'],
    ['spaghetti', 'makaron'],
    ['ryz', 'ryz'],
    ['chleb', 'chleb'],
    ['bulk', 'chleb'],
    ['bagiet', 'chleb'],
    ['woda', 'woda'],
];
/** Emoji dla nazw bez ilustracji (ostatnia deska ratunku przed ikoną kategorii). */
const EMOJI_KEYWORDS = [
    ['kaw', '☕'],
    ['herbat', '🍵'],
    ['sok', '🧃'],
    ['piwo', '🍺'],
    ['wino', '🍷'],
    ['wodk', '🥃'],
    ['ciast', '🍰'],
    ['czekolad', '🍫'],
    ['lod', '🧊'],
    ['krewet', '🦐'],
    ['banan', '🍌'],
    ['truskaw', '🍓'],
    ['pomarancz', '🍊'],
    ['winogron', '🍇'],
    ['plyn', '🧴'],
    ['zup', '🍲'],
    ['sos', '🥫'],
];
const CATALOG_BY_NAME = new Map(CATALOG.flatMap((g) => g.items.map((it) => [normalize(it.name), it])));
/** Krótkie słowa dopasowywane tylko w całości (np. „por”, ale nie „porcja”). */
const WHOLE_WORDS = new Set(['por', 'sol']);
/** Czy fraza występuje na początku któregoś słowa nazwy. */
function hasWordStart(name, kw) {
    if (WHOLE_WORDS.has(kw))
        return name.split(/[\s(),]+/).includes(kw);
    return name.startsWith(kw) || name.includes(` ${kw}`) || name.includes(`(${kw}`);
}
/** Klucz ilustracji dla nazwy produktu: katalog → słowa kluczowe. */
export function artKeyFor(name) {
    const n = normalize(name).replace(/\s+/g, ' ');
    if (!n)
        return null;
    const exact = CATALOG_BY_NAME.get(n);
    if (exact)
        return exact.art;
    for (const [kw, key] of ART_KEYWORDS)
        if (hasWordStart(n, kw))
            return key;
    return null;
}
/** Ikona zapisana w produkcie: „@klucz” = wybrana ilustracja, inny tekst = emoji wybrane ręcznie. */
export const artIcon = (key) => `@${key}`;
/**
 * Ilustracja produktu: ręczny wybór (ilustracja albo emoji) → ilustracja dopasowana do nazwy →
 * emoji po słowie kluczowym → ikona kategorii.
 */
export function artFor(p, categoryName) {
    if (p.icon?.startsWith('@') && ART_SET.has(p.icon.slice(1)))
        return { kind: 'img', key: p.icon.slice(1) };
    if (p.icon && !p.icon.startsWith('@'))
        return { kind: 'emoji', char: p.icon };
    const key = artKeyFor(p.name);
    if (key)
        return { kind: 'img', key };
    const n = normalize(p.name);
    for (const [kw, ch] of EMOJI_KEYWORDS)
        if (hasWordStart(n, kw))
            return { kind: 'emoji', char: ch };
    return { kind: 'emoji', char: categoryIcon(categoryName) };
}
export const artUrl = (key) => `img/p/${key}.svg`;
/** Tekstowa ikona (tam, gdzie nie da się pokazać obrazka, np. w opcjach listy rozwijanej). */
export function productIcon(p, categoryName) {
    const a = artFor(p, categoryName);
    return a.kind === 'emoji' ? a.char : categoryIcon(categoryName);
}
