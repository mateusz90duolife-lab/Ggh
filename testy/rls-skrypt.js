/* Sprawdza logikę testy/sprawdz-rls.sh bez dostępu do prawdziwego projektu:
   uruchamia lokalny serwer udający REST API Supabase i podstawia jego adres.
   Najważniejszy przypadek to brak połączenia — musi dać wynik
   nierozstrzygnięty, a nie fałszywą szczelność. */
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const SCRIPT = path.resolve(__dirname, 'sprawdz-rls.sh');
let fails = 0;
const ok  = m => console.log('  ok    ' + m);
const bad = m => { fails++; console.log('  BŁĄD  ' + m); };

function serve(handler) {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      const table = (req.url.match(/\/rest\/v1\/([a-z_]+)/) || [])[1];
      const [code, body] = handler(table);
      resp.writeHead(code, { 'Content-Type': 'application/json' });
      resp.end(body);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

// Asynchronicznie: serwer działa w tym samym procesie, więc blokujące
// spawnSync zatrzymałoby pętlę zdarzeń i serwer nigdy by nie odpowiedział.
function run(url) {
  const env = Object.assign({}, process.env, {
    RLS_CHECK_URL: url, NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost',
  });
  return new Promise(res => {
    const ch = spawn('bash', [SCRIPT], { env });
    let out = '';
    ch.stdout.on('data', d => out += d);
    ch.stderr.on('data', d => out += d);
    const timer = setTimeout(() => ch.kill('SIGKILL'), 60000);
    ch.on('close', code => { clearTimeout(timer); res({ code: code, out: out }); });
  });
}

(async () => {
  console.log('\nSkrypt sprawdzający RLS');

  let srv = await serve(t => t === 'questions' ? [200, '[{"id":1}]'] : [200, '[]']);
  let r = await run('http://127.0.0.1:' + srv.address().port);
  srv.close();
  r.code === 1 && /NIESZCZELNA/.test(r.out) && /WYCIEK/.test(r.out)
    ? ok('widoczne pytania → wyciek, kod 1') : bad('wyciek nie został wykryty (kod ' + r.code + ')');

  srv = await serve(() => [200, '[]']);
  r = await run('http://127.0.0.1:' + srv.address().port);
  srv.close();
  r.code === 0 && /pusta odpowiedź oznacza albo/i.test(r.out)
    ? ok('puste odpowiedzi → kod 0 z ostrzeżeniem o pustej tabeli') : bad('pusta odpowiedź źle obsłużona (kod ' + r.code + ')');

  srv = await serve(() => [401, '{"message":"permission denied"}']);
  r = await run('http://127.0.0.1:' + srv.address().port);
  srv.close();
  r.code === 0 && /odmowa dostępu/.test(r.out)
    ? ok('odmowa dostępu → kod 0') : bad('odmowa źle obsłużona (kod ' + r.code + ')');

  // Port, na którym nic nie nasłuchuje: brak połączenia
  const dead = await serve(() => [200, '[]']);
  const port = dead.address().port; dead.close();
  await new Promise(res => setTimeout(res, 100));
  r = await run('http://127.0.0.1:' + port);
  r.code === 2 && /NIEROZSTRZYGNIĘTY/.test(r.out) && !/odmowa dostępu/.test(r.out)
    ? ok('brak połączenia → wynik nierozstrzygnięty, kod 2, nigdy „odmowa"')
    : bad('brak połączenia daje fałszywy wynik (kod ' + r.code + ')');

  srv = await serve(t => t === 'progress' ? [500, '{}'] : [200, '[]']);
  r = await run('http://127.0.0.1:' + srv.address().port);
  srv.close();
  r.code === 2 ? ok('błąd serwera → wynik nierozstrzygnięty, kod 2') : bad('błąd serwera dał kod ' + r.code);

  console.log(fails ? '\n' + fails + ' BŁĘDÓW\n' : '\nSkrypt RLS działa poprawnie we wszystkich przypadkach.\n');
  process.exit(fails ? 1 : 0);
})();
