// ============================================================
//  Facile Preventivo — Test automatici (rete di sicurezza v1)
//  Uso:  node test-app.js [index.html]
//  Regola: NON si rilascia se questo script non è 🟢 TUTTO VERDE.
// ============================================================
const fs = require('fs');
const vm = require('vm');
const { execSync } = require('child_process');

const FILE = process.argv[2] || 'app.js';

// --- Baseline PDF imbianchino/muratore (devono restare INVARIATI).
// Se un giorno cambi VOLUTAMENTE questi due mestieri, aggiorna qui i valori.
const BASELINE = {
  imbianchino: { prev: 'c3669fa8d1c3b4ef', sop: 'acf8df2f06effb87' },
  muratore:    { prev: 'ac04e5ef38a64924', sop: '006d91a777eab508' },
};

let pass = 0, fail = 0;
function check(name, ok, detail) {
  console.log((ok ? '✅ PASS' : '❌ FAIL') + '  ' + name + (!ok && detail ? '  → ' + detail : ''));
  ok ? pass++ : fail++;
}

// --- Carica l'app in una finta pagina (sandbox), con un dato localStorage iniziale.
function loadApp(seed) {
  const _txt = fs.readFileSync(FILE, 'utf8');
  const code = FILE.endsWith('.html') ? _txt.match(/<script>([\s\S]*)<\/script>/)[1] : _txt;
  const noop = () => {};
  const mk = (id) => ({
    id, style: {}, checked: false, value: '', textContent: '', innerHTML: '',
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    appendChild: noop, remove: noop, click: noop, setAttribute: noop,
    addEventListener: noop, focus: noop, closest: () => null,
    querySelector: () => null, querySelectorAll: () => [],
  });
  const sb = {
    console, Math, Date, JSON, parseFloat, parseInt, isNaN, isFinite,
    Number, String, Array, Object, encodeURIComponent, decodeURIComponent,
    setTimeout: noop, clearTimeout: noop, alert: noop, confirm: () => true,
  };
  sb.document = { getElementById: mk, createElement: () => mk('x'), querySelectorAll: () => [], querySelector: () => null, addEventListener: noop, body: mk('body') };
  sb.window = sb; sb.window.addEventListener = noop; sb.navigator = {}; sb.globalThis = sb;
  sb.localStorage = { getItem: (k) => (k in seed ? seed[k] : null), setItem: (k, v) => { seed[k] = String(v); }, removeItem: (k) => { delete seed[k]; } };
  sb.Blob = function (p) { this._ = p.join(''); };
  sb.URL = { createObjectURL: (b) => { sb._json = b._; return 'blob:x'; }, revokeObjectURL: noop };
  sb.FileReader = function () { this.readAsText = () => { this.result = sb._json; if (this.onload) this.onload(); }; };
  vm.createContext(sb);
  vm.runInContext(code, sb);
  return sb;
}
// Simula l'avvio dell'app (quello che gira al caricamento della pagina).
function boot(sb) {
  sb.renderMestiereSelector(); sb.applyMestiereUI();
  sb.resetForm(true); sb.sResetForm(true);
  sb.aggStats(); sb.caricaImpresa();
}

console.log('— Test su ' + FILE + ' —\n');

// 1) Avvio con memoria VUOTA (utente nuovo): non deve crashare.
try { boot(loadApp({})); check('Avvio con memoria vuota (utente nuovo)', true); }
catch (e) { check('Avvio con memoria vuota (utente nuovo)', false, e.message); }

// 2) Avvio con dati CORROTTI in memoria: non deve crashare.
try {
  boot(loadApp({ mv_prev: '{rotto', mv_sop: '[[[', mv_impresa: 'null', mv_lavori_custom: 'xyz', mv_mestiere: 'idraulico' }));
  check('Avvio con dati corrotti in memoria', true);
} catch (e) { check('Avvio con dati corrotti in memoria', false, e.message); }

// 3) Backup: esporta → svuota → importa, i dati devono tornare identici.
try {
  const seed = {
    mv_prev: JSON.stringify([{ id: 1, numero: 'P-1', mestiere: 'elettricista', locali: [{ id: 0, nome: 'Sala', lavori: ['Punto luce'], lavoriQta: { 'Punto luce': 5 }, lavoriPrezzi: { 'Punto luce': 30 }, condizioni: ['Rifacimento totale'] }] }]),
    mv_sop: JSON.stringify([{ id: 9, numero: 'S-1', convertito: true }]),
    mv_impresa: JSON.stringify({ nome: 'MarEva', piva: '123' }),
    mv_mestiere: 'elettricista',
    mv_lavori_custom: JSON.stringify({ elettricista: ['Voce mia'] }),
  };
  const before = JSON.stringify(seed);
  const sb = loadApp(seed);
  sb.esportaBackup();
  ['mv_prev', 'mv_sop', 'mv_impresa', 'mv_mestiere', 'mv_lavori_custom'].forEach((k) => delete seed[k]);
  sb.importaBackup({ name: 'b.json' });
  const after = JSON.stringify({ mv_prev: seed.mv_prev, mv_sop: seed.mv_sop, mv_impresa: seed.mv_impresa, mv_mestiere: seed.mv_mestiere, mv_lavori_custom: seed.mv_lavori_custom });
  check('Backup: esporta → importa restituisce dati identici', before === after, 'i dati non coincidono');
} catch (e) { check('Backup: esporta → importa restituisce dati identici', false, e.message); }

// 4) PDF imbianchino/muratore INVARIATI (anti-regressione), via harness.js.
function shaFromHarness(trade) {
  const out = execSync(`node harness.js "${FILE}" ${trade} t`, { cwd: __dirname }).toString();
  const prev = (out.match(/preventivo_pdf_sha=([0-9a-f]+)/) || [])[1];
  const sop = (out.match(/sopralluogo_pdf_sha=([0-9a-f]+)/) || [])[1];
  return { prev, sop };
}
for (const trade of ['imbianchino', 'muratore']) {
  try {
    const got = shaFromHarness(trade);
    const want = BASELINE[trade];
    const ok = got.prev === want.prev && got.sop === want.sop;
    check('PDF ' + trade + ' invariato', ok, `preventivo ${got.prev} (atteso ${want.prev}), sopralluogo ${got.sop} (atteso ${want.sop})`);
  } catch (e) { check('PDF ' + trade + ' invariato', false, e.message); }
}

console.log('\n' + (fail === 0 ? `🟢 TUTTO VERDE — ${pass} test superati` : `🔴 ${fail} test FALLITI (${pass} superati)`));
process.exit(fail === 0 ? 0 : 1);
