// Usage: node harness.js <index.html> <trade>
// Extracts the <script> block, evaluates it in a sandbox with minimal stubs,
// then runs buildAntHTML(d) and sBuildAntHTML(d) on deterministic sample data
// and prints sha256 hashes so we can compare original vs modified output.
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const file = process.argv[2];
const trade = process.argv[3] || 'imbianchino';

const _txt = fs.readFileSync(file, 'utf8');
// Supporta sia un .html (estrae il blocco <script>) sia un file .js (legge tutto).
const code = file.endsWith('.html') ? (_txt.match(/<script>([\s\S]*)<\/script>/) || [])[1] : _txt;
if (!code) { console.error('no script'); process.exit(1); }

// ---- stubs ----
const noop = () => {};
const fakeEl = new Proxy({}, {
  get(t, p) {
    if (p === 'value' || p === 'textContent' || p === 'innerHTML') return '';
    if (p === 'style') return {};
    if (p === 'classList') return { toggle: noop, add: noop, remove: noop, contains: () => false };
    if (p === 'querySelector' || p === 'querySelectorAll') return () => [];
    if (p === 'closest') return () => null;
    if (p === 'checked') return false;
    return noop;
  },
  set() { return true; }
});
const localStorageStub = { getItem: () => null, setItem: noop, removeItem: noop };
const documentStub = {
  getElementById: () => fakeEl,
  querySelector: () => fakeEl,
  querySelectorAll: () => [],
  addEventListener: noop,
  createElement: () => fakeEl,
  body: fakeEl,
};
const windowStub = { addEventListener: noop, scrollTo: noop, event: null };

const sandbox = {
  console,
  document: documentStub,
  window: windowStub,
  localStorage: localStorageStub,
  navigator: {},
  history: { pushState: noop, back: noop, state: null },
  location: { reload: noop },
  alert: noop,
  confirm: () => true,
  setTimeout: noop,
  clearTimeout: noop,
  Image: function(){ return {}; },
  URL: { createObjectURL: () => '', revokeObjectURL: noop },
  Date,
  JSON,
  Math,
  parseFloat,
  parseInt,
  Number,
  String,
  Object,
  Array,
  isNaN,
  RegExp,
  btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  encodeURIComponent,
  decodeURIComponent,
  unescape,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'app.js' });

// deterministic sample data --------------------------------------------------
function sampleData(trade) {
  const dataISO = '2026-03-10T09:00:00.000Z';
  const data = '10/03/2026';
  const locA = {
    id: 0, nome: 'Cucina', lung: 4, larg: 3, h: 2.7,
    lavori: ['Tutto bianco', 'Soffitto bianco'],
    lavoriPrezzi: { 'Tutto bianco': 320.5, 'Soffitto bianco': 0 },
    lavoriQta: {}, mdoLocale: 150, materiali: 'pittura lavabile, primer',
    condizioni: ['Crepe da riparare'], condNote: 'angolo nord umido',
    incPareti: true, incSoffitto: false, _open: true
  };
  const locB = {
    id: 1, nome: 'Bagno', lung: 2.5, larg: 2, h: 2.7,
    lavori: ['Pareti colorate'],
    lavoriPrezzi: { 'Pareti colorate': 90 },
    lavoriQta: { 'Pareti colorate': 3 }, mdoLocale: 0, materiali: '',
    condizioni: [], condNote: '', incPareti: true, incSoffitto: true, _open: false
  };
  return {
    id: 12345, numero: '📄 P–2026/007', data, dataISO, stato: 'inviato',
    mestiere: trade, tipoStruttura: 'Appartamento',
    cliente: { nome: 'Mario', cognome: 'Rossi', tel: '+39 333 1234567', email: 'mario@email.it', indirizzo: 'Via Roma 1, Milano' },
    locali: [locA, locB],
    supTot: 0, // filled below
    optMdoPerLocale: true, optCondPerLocale: true,
    mdoGenerale: 0, sconto: 10,
    iva: 22,
    condizioniGen: ['Buono stato'], condNoteGen: 'note generali',
    note: { libere: 'accesso difficile al 3° piano' },
    validita: '60',
    totale: 0
  };
}

// align supTot the way the app does (sum of supLoc)
function withSup(d) {
  sandbox.mestiere = d.mestiere;
  d.supTot = d.locali.reduce((s, l) => s + sandbox.supLoc(l, d.mestiere), 0);
  return d;
}

sandbox.impresa = { nome: 'Rossi Imbianchini SRL', piva: 'IT01234567890', tel: '02 1234567', email: 'info@rossi.it', indirizzo: 'Via Milano 5, Milano', sito: 'www.rossi.it' };

const d = withSup(sampleData(trade));
// sopralluogo sample (subset)
const sd = {
  id: 999, numero: '📋 S–2026/003', data: '10/03/2026', dataISO: '2026-03-10T09:00:00.000Z',
  mestiere: trade, tipoStruttura: 'Villa / Casa indipendente',
  cliente: d.cliente, locali: d.locali, supTot: d.supTot,
  condizioniGen: ['Piccole imperfezioni'], condNoteGen: 'nota stato', condPerLocale: true,
  note: 'note sopralluogo'
};

const h = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

const prevHTML = sandbox.buildAntHTML(d);
const sopHTML = sandbox.sBuildAntHTML(sd);
console.log('trade=' + trade);
console.log('supTot=' + d.supTot.toFixed(3));
console.log('preventivo_pdf_sha=' + h(prevHTML) + ' len=' + prevHTML.length);
console.log('sopralluogo_pdf_sha=' + h(sopHTML) + ' len=' + sopHTML.length);

// dump full HTML to files for diffing
fs.writeFileSync('/tmp/prev_' + trade + '_' + (process.argv[4]||'x') + '.html', prevHTML);
fs.writeFileSync('/tmp/sop_' + trade + '_' + (process.argv[4]||'x') + '.html', sopHTML);

// sommaLavoriLoc equivalence check (only meaningful on modified build)
if (typeof sandbox.sommaLavoriLoc === 'function') {
  const orig = (loc) => Object.values(loc.lavoriPrezzi || {}).reduce((s, p) => s + (p || 0), 0);
  let ok = true;
  for (const loc of d.locali) {
    const a = sandbox.sommaLavoriLoc(loc, trade);
    if (trade === 'imbianchino' || trade === 'muratore') {
      if (Math.abs(a - orig(loc)) > 1e-9) { ok = false; console.log('  MISMATCH somma ' + loc.nome + ': ' + a + ' vs ' + orig(loc)); }
    }
  }
  if (trade === 'imbianchino' || trade === 'muratore') console.log('sommaLavoriLoc_equiv=' + ok);
}
