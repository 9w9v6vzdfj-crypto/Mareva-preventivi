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

// 5) Escape HTML: nome locale / materiali con caratteri speciali non devono
//    rompere il markup della card (XSS via rinomina locale o backup importato).
try {
  const sb = loadApp({});
  boot(sb);
  const evil = {
    id: 0, nome: '"><img src=x onerror=1>', lung: 4, larg: 3, h: 2.7,
    lavori: [], lavoriPrezzi: {}, lavoriQta: {},
    materiali: '</textarea><script>alert(1)<\/script>',
    condizioni: [], condNote: '', incPareti: true, incSoffitto: true, _open: true,
  };
  const html = sb.buildLocCard('s', evil);
  const ok = !html.includes('"><img') && !html.includes('<script>');
  check('Escape HTML nei template dei locali', ok, 'markup non escapato');
} catch (e) { check('Escape HTML nei template dei locali', false, e.message); }

// 6) Serramentista: totale (qta × prezzo dei serramenti + voci), disegno SVG
//    con simboli di apertura e quote, e PDF preventivo che li include.
try {
  const sb = loadApp({ mv_mestiere: 'serramentista' });
  boot(sb);
  const loc = {
    id: 0, nome: 'Soggiorno', lavori: ['Posa in opera'], lavoriPrezzi: { 'Posa in opera': 100 }, lavoriQta: { 'Posa in opera': 2 },
    serramenti: [
      { id: 0, tipo: 'finestra', lung: 1200, alt: 1400, ante: 2, aperture: ['battente-sx', 'ribalta-dx'], qta: 2, prezzo: 450, note: 'PVC bianco' },
      { id: 1, tipo: 'portafinestra', lung: 1400, alt: 2300, ante: 2, aperture: ['vasistas', 'battente-dx'], qta: 1, prezzo: 820, note: '' },
    ],
    condizioni: [], condNote: '', materiali: '',
  };
  // 2×450 + 820 (serramenti) + 2×100 (posa) = 1920
  const somma = sb.sommaLavoriLoc(loc, 'serramentista');
  const svg = sb.disegnoSerramento(loc.serramenti[0]);
  sb.mestiere = 'serramentista';
  const d = {
    id: 1, numero: '📄 P–2026/001', data: '10/03/2026', dataISO: '2026-03-10T09:00:00.000Z', stato: 'bozza',
    mestiere: 'serramentista', tipoStruttura: 'Appartamento',
    cliente: { nome: 'Mario', cognome: 'Rossi' }, locali: [loc], supTot: 0,
    optMdoPerLocale: false, optCondPerLocale: false, mdoGenerale: 0, sconto: 0, iva: 22,
    condizioniGen: [], condNoteGen: '', note: { libere: '' }, validita: '30', totale: 0,
  };
  const html = sb.buildAntHTML(d);
  const ok = Math.abs(somma - 1920) < 1e-9
    && svg.includes('<svg') && svg.includes('stroke-dasharray')   // simboli apertura tratteggiati
    && svg.includes('>1200<') && svg.includes('>1400<')           // quote in mm
    && html.includes('<svg') && html.includes('€1920.00');        // disegno + subtotale nel PDF
  check('Serramentista: totale, disegno SVG e PDF', ok, `somma=${somma}`);
} catch (e) { check('Serramentista: totale, disegno SVG e PDF', false, e.message); }

// 7) Moduli: muratore con voci elettrico (qta × prezzo) e serramenti.
//    Totale corretto e PDF con riepilogo per categoria.
try {
  const sb = loadApp({ mv_mestiere: 'muratore' });
  boot(sb);
  const loc = {
    id: 0, nome: 'Bagno',
    lavori: ['Massetto / sottofondo', 'Punto luce'],
    lavoriPrezzi: { 'Massetto / sottofondo': 500, 'Punto luce': 30 },
    lavoriQta: { 'Punto luce': 4 },
    lavoriCat: { 'Punto luce': 'elettricista' },
    serramenti: [{ id: 0, tipo: 'finestra', lung: 600, alt: 600, ante: 1, aperture: ['vasistas'], qta: 1, prezzo: 400, note: '' }],
    lung: 2.5, larg: 2, h: 2.7, condizioni: [], condNote: '', materiali: '',
  };
  // 500 (massetto) + 4×30 (punti luce) + 400 (finestra) = 1020
  const somma = sb.sommaLavoriLoc(loc, 'muratore');
  sb.mestiere = 'muratore';
  const d = {
    id: 1, numero: '📄 P–2026/002', data: '10/03/2026', dataISO: '2026-03-10T09:00:00.000Z', stato: 'bozza',
    mestiere: 'muratore', tipoStruttura: 'Appartamento', moduli: ['elettricista', 'serramentista'],
    cliente: { nome: 'Mario', cognome: 'Rossi' }, locali: [loc], supTot: 5,
    optMdoPerLocale: false, optCondPerLocale: false, mdoGenerale: 0, sconto: 0, iva: 22,
    condizioniGen: [], condNoteGen: '', note: { libere: '' }, validita: '30', totale: 0,
  };
  const html = sb.buildAntHTML(d);
  const ok = Math.abs(somma - 1020) < 1e-9
    && html.includes('Riepilogo per categoria')
    && html.includes('Opere murarie') && html.includes('Impianto elettrico') && html.includes('Serramenti')
    && html.includes('€120.00') && html.includes('€1020.00') && html.includes('<svg');
  check('Moduli: muratore + elettrico + serramenti (totali e PDF)', ok, `somma=${somma}`);
} catch (e) { check('Moduli: muratore + elettrico + serramenti (totali e PDF)', false, e.message); }

console.log('\n' + (fail === 0 ? `🟢 TUTTO VERDE — ${pass} test superati` : `🔴 ${fail} test FALLITI (${pass} superati)`));
process.exit(fail === 0 ? 0 : 1);
