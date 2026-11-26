// ============================================================
//  Facile Preventivo — Test automatici
//  Uso:  node test-app.js
//  Regola: NON si rilascia se questo script non è 🟢 TUTTO VERDE.
// ============================================================
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const crypto = require('crypto');

const FILES = ['app.js', 'preventivo.js', 'pianta.js'];

let pass = 0, fail = 0;
function check(name, ok, detail) {
  console.log((ok ? '✅ PASS' : '❌ FAIL') + '  ' + name + (!ok && detail ? '  → ' + detail : ''));
  ok ? pass++ : fail++;
}

// --- Carica l'app in una finta pagina (sandbox), con un dato localStorage iniziale.
function loadApp(seed) {
  const code = FILES.map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n;\n');
  const noop = () => {};
  const mk = (id) => ({
    id, style: {}, checked: false, value: '', textContent: '', innerHTML: '', dataset: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    appendChild: noop, remove: noop, click: noop, setAttribute: noop,
    addEventListener: noop, focus: noop, closest: () => null,
    querySelector: () => null, querySelectorAll: () => [],
  });
  const els = {};
  const sb = {
    console, Math, Date, JSON, parseFloat, parseInt, isNaN, isFinite,
    Number, String, Array, Object, Map, Set, Uint8Array, Int32Array, encodeURIComponent, decodeURIComponent,
    setTimeout: noop, clearTimeout: noop, alert: noop, confirm: () => true,
    requestAnimationFrame: noop, performance: { now: () => 0 }, matchMedia: () => ({ matches: false, addEventListener: noop }),
  };
  sb.document = { getElementById: (id) => (els[id] = els[id] || mk(id)), createElement: () => mk('x'), querySelectorAll: () => [], querySelector: () => null, addEventListener: noop, body: mk('body') };
  sb.window = sb; sb.window.addEventListener = noop; sb.scrollTo = noop; sb.navigator = {}; sb.globalThis = sb;
  sb.history = { pushState: noop, back: noop, state: null };
  sb.localStorage = { getItem: (k) => (k in seed ? seed[k] : null), setItem: (k, v) => { seed[k] = String(v); }, removeItem: (k) => { delete seed[k]; } };
  sb.Blob = function (p) { this._ = p.join(''); };
  sb.URL = { createObjectURL: (b) => { sb._json = b._; return 'blob:x'; }, revokeObjectURL: noop };
  sb.FileReader = function () { this.readAsText = () => { this.result = sb._json; if (this.onload) this.onload(); }; };
  sb._els = els;
  vm.createContext(sb);
  vm.runInContext(code, sb);
  return sb;
}
// Simula l'avvio dell'app (quello che gira al caricamento della pagina).
function boot(sb) { sb.wzInit(); sb.wzNuovo(); sb.aggStats(); sb.caricaImpresa(); }
const run = (sb, js) => vm.runInContext(js, sb);
const near = (a, b) => Math.abs(a - b) < 1e-6;

// Documento d'esempio deterministico (usato da più test).
const DOC = {
  v: 2, id: 1, numero: '📄 P–2026/001', data: '10/03/2026', dataISO: '2026-03-10T09:00:00.000Z', stato: 'bozza', mod: 1, via: 'manuale',
  cliente: { nome: 'Mario Rossi', tel: '333', email: '', indirizzo: 'Via Roma 1' },
  prezzi: { dp: 12, ms: 18, pp: 30, ir: 22, tp: 6.5, ts: 7, cs: 35, sm: 250 },
  sconto: 5, iva: 22, validita: 30, totale: 0,
  locali: [
    { id: 1, nome: 'Soggiorno', L: 7, W: 5, H: 2.7, lav: { tp: true, ts: true }, imp: {}, inf: [], man: [], note: '' },
    { id: 2, nome: 'Bagno', L: 2.5, W: 2, H: 2.7, lav: { tp: true, ts: true, pp: true },
      imp: { id: { on: true, p: 1800, nota: '5 punti acqua' } },
      inf: [{ tipo: 'finestra', lung: 600, alt: 900, ante: 1, apr: 'ribalta', prezzo: 420 }],
      man: [{ nome: 'Posa rivestimento', q: 18, u: 'm²', p: 35 }, { nome: '', q: 3, u: 'pz', p: 99 }],
      note: 'Piastrelle scelte dal cliente' },
    { id: 3, nome: 'Ripostiglio', L: 0, W: 0, H: 2.7, lav: { tp: true, sm: true }, imp: {}, inf: [], man: [], note: '' },
  ],
};

console.log('— Test su ' + FILES.join(' + ') + ' —\n');

// 1) Avvio con memoria VUOTA (utente nuovo): non deve crashare.
try { boot(loadApp({})); check('Avvio con memoria vuota (utente nuovo)', true); }
catch (e) { check('Avvio con memoria vuota (utente nuovo)', false, e.message); }

// 2) Avvio con dati CORROTTI o di vecchie versioni: non deve crashare.
try {
  const sb = loadApp({ mv_prev: '{rotto', mv_impresa: 'null', mv_listino: '[1,2]', mv_del: 'x' });
  boot(sb);
  const sb2 = loadApp({ mv_prev: JSON.stringify([{ id: 5, numero: 'P-1', mestiere: 'elettricista', locali: [{ nome: 'Sala', lavori: ['Punto luce'] }] }]) });
  boot(sb2);
  const html = run(sb2, 'prevItemHTML(preventivi[0], false)');
  const apre = run(sb2, 'wzApri(5)');
  check('Avvio con dati corrotti / vecchio formato', html.includes('Vecchia versione') && apre === false, 'vecchio documento non gestito');
} catch (e) { check('Avvio con dati corrotti / vecchio formato', false, e.message); }

// 3) Calcoli: superfici, infissi tolti dalle pareti, quantità automatiche, totali.
try {
  const sb = loadApp({});
  const d = sb.normalizzaDoc(JSON.parse(JSON.stringify(DOC)));
  const bagno = d.locali[1];
  const s = sb.locSup(bagno);
  // pareti lorde 2×(2,5+2)×2,7 = 24,3 − finestra 0,6×0,9 = 0,54 → 23,76
  const supOk = near(s.lordo, 24.3) && near(s.ded, 0.54) && near(s.pareti, 23.76) && near(s.pavimento, 5);
  // Bagno: 23,76×6,5 + 5×7 + 5×30 + 1800 + 420 + 18×35 (la riga senza nome non conta)
  const totBagno = 23.76 * 6.5 + 35 + 150 + 1800 + 420 + 630;
  const totSogg = 64.8 * 6.5 + 35 * 7;
  // Ripostiglio senza misure: tinteggiatura senza importo a corpo → non entra;
  // lo smaltimento (prima lavoro del locale) diventa una voce del cantiere da 250
  const T = sb.docTotali(d);
  const sub = totBagno + totSogg + 250, imp = sub * 0.95;
  const locTot = run(sb, 'locTot');
  const cant = JSON.stringify(d.cantiere.map(x => [x.nome, x.p]));
  const ok = supOk && near(locTot(bagno, d.prezzi), totBagno) && near(locTot(d.locali[2], d.prezzi), 0) && cant === '[["Smaltimento macerie",250]]'
    && near(T.sub, sub) && near(T.imp, imp) && near(T.tot, imp * 1.22) && sb.locRighe(bagno, d.prezzi).length === 6;
  check('Calcoli: superfici, infissi, quantità automatiche e totali', ok, JSON.stringify({ s, T }));
} catch (e) { check('Calcoli: superfici, infissi, quantità automatiche e totali', false, e.message); }

// 4) PDF: contiene cliente, locali, voci, note, disegno dell'infisso e totale;
//    è deterministico (stesso documento → stesso HTML).
try {
  const sb = loadApp({ mv_impresa: JSON.stringify({ nome: 'Rossi Costruzioni', piva: '123' }) });
  boot(sb);
  const h1 = sb.buildPdfPrev(DOC), h2 = sb.buildPdfPrev(DOC);
  const T = sb.docTotali(sb.normalizzaDoc(JSON.parse(JSON.stringify(DOC))));
  const ok = h1 === h2 && h1.includes('Rossi Costruzioni') && h1.includes('Mario Rossi') && h1.includes('P–2026/001')
    && h1.includes('Soggiorno') && h1.includes('Impianto idraulico') && h1.includes('5 punti acqua')
    && h1.includes('Finestra 600×900 mm') && h1.includes('stroke-dasharray') && h1.includes('Posa rivestimento')
    && h1.includes('Piastrelle scelte dal cliente') && h1.includes(run(sb, 'prEur')(T.tot)) && h1.includes('Sconto 5%')
    && h1.includes('Per tutto il cantiere') && h1.includes('Smaltimento macerie');
  const sha = crypto.createHash('sha256').update(h1).digest('hex').slice(0, 16);
  check('PDF del preventivo: contenuti e determinismo (sha ' + sha + ')', ok, 'contenuto mancante');
} catch (e) { check('PDF del preventivo: contenuti e determinismo', false, e.message); }

// 5) Escape HTML: nomi e note con caratteri speciali non rompono il markup.
try {
  const sb = loadApp({});
  boot(sb);
  const evil = JSON.parse(JSON.stringify(DOC));
  evil.cliente.nome = '"><img src=x onerror=1>';
  evil.locali[0].nome = '<script>alert(1)</script>';
  evil.locali[1].note = '</td><b>x';
  evil.locali[1].man[0].nome = '<i onmouseover=1>';
  const pdf = sb.buildPdfPrev(evil);
  const item = sb.prevItemHTML(evil, false);
  run(sb, 'doc=normalizzaDoc(' + JSON.stringify(evil) + '); wzStep=1; wzRender(); wzStep=2; wzRender(); wzStep=3; wzRender();');
  const scr = run(sb, 'wzSchermata()');
  const bad = s => s.includes('"><img') || s.includes('<script>') || s.includes('</td><b>') || s.includes('<i onmouseover');
  check('Escape HTML: PDF, archivio ed editor', !bad(pdf) && !bad(item) && !bad(scr), 'markup non escapato');
} catch (e) { check('Escape HTML: PDF, archivio ed editor', false, e.message); }

// 6) Editor: salvataggio (serve il nome), listino dei prezzi ricordato, riapertura.
try {
  const seed = {};
  const sb = loadApp(seed);
  boot(sb);
  const senzaNome = run(sb, 'wzSalvaOra()');
  run(sb, `doc.cliente.nome='Anna'; wzAddLocale('Cucina'); doc.locali[0].L=4; doc.locali[0].W=3; doc.locali[0].lav.tp=true;
           wzAggiornaListino('tp', 9); doc.prezzi.tp=9; wzSalvaOra();`);
  const salvati = JSON.parse(seed.mv_prev);
  const listino = JSON.parse(seed.mv_listino);
  const nuovo = run(sb, 'wzNuovo(); doc.prezzi.tp');
  const riapre = run(sb, `wzApri(${salvati[0].id}) && doc.cliente.nome==='Anna' && wzStep===3`);
  const ok = senzaNome === false && salvati.length === 1 && salvati[0].v === 2 && near(salvati[0].totale, 37.8 * 9 * 1.22)
    && listino.tp === 9 && nuovo === 9 && riapre === true;
  check('Editor: salvataggio, listino prezzi e riapertura', ok, JSON.stringify({ senzaNome, n: salvati.length, tot: salvati[0] && salvati[0].totale, listino, nuovo, riapre }));
} catch (e) { check('Editor: salvataggio, listino prezzi e riapertura', false, e.message); }

// 7) Backup: esporta → svuota → importa, i dati devono tornare identici.
try {
  const seed = {
    mv_prev: JSON.stringify([DOC]),
    mv_impresa: JSON.stringify({ nome: 'MarEva', piva: '123' }),
    mv_listino: JSON.stringify({ tp: 8 }),
  };
  const before = JSON.stringify([seed.mv_prev, seed.mv_impresa, seed.mv_listino]);
  const sb = loadApp(seed);
  sb.esportaBackup();
  ['mv_prev', 'mv_impresa', 'mv_listino'].forEach((k) => delete seed[k]);
  sb.importaBackup({ name: 'b.json' });
  const after = JSON.stringify([seed.mv_prev, seed.mv_impresa, seed.mv_listino]);
  check('Backup: esporta → importa restituisce dati identici', before === after, after.slice(0, 200));
} catch (e) { check('Backup: esporta → importa restituisce dati identici', false, e.message); }

// 8) Sync: fusione documenti per id (vince il piu' recente, pari merito al
//    locale) e tombstone (gli eliminati non "risorgono" dal cloud).
try {
  const sb = loadApp({});
  const locale = [{ id: 1, mod: 10, n: 'a-locale' }, { id: 2, mod: 5, n: 'b-locale' }];
  const cloud = [{ id: 2, mod: 9, n: 'b-cloud' }, { id: 3, mod: 1, n: 'c-cloud' }, { id: 4, mod: 7, n: 'd-cloud' }];
  const fusi = sb.mergeById(locale, cloud);
  const byId = Object.fromEntries(fusi.map(x => [x.id, x.n]));
  const dels = [{ id: '3', ts: 2 }, { id: '4', ts: 3 }];
  const vivi = sb.applicaTombstone(fusi, dels).map(x => x.id).sort().join(',');
  const delFusi = sb.mergeDel([{ id: '9', ts: 1 }], [{ id: '9', ts: 4 }, { id: '8', ts: 2 }]);
  const ok = fusi.length === 4
    && byId[1] === 'a-locale' && byId[2] === 'b-cloud' && byId[3] === 'c-cloud'
    && vivi === '1,2,4'
    && delFusi.length === 2 && delFusi.find(t => t.id === '9').ts === 4;
  check('Sync: fusione per id e tombstone eliminazioni', ok, `fusi=${JSON.stringify(byId)} vivi=${vivi}`);
} catch (e) { check('Sync: fusione per id e tombstone eliminazioni', false, e.message); }

// 9) Guida al primo utilizzo: ogni passo punta a un elemento che esiste
//    davvero in index.html, e avvio/avanzamento/chiusura non crashano.
try {
  const sb = loadApp({});
  boot(sb);
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const passi = JSON.parse(run(sb, 'JSON.stringify(GUIDA_PASSI)'));
  const targetsOk = passi.every(p => !p.el || html.includes('id="' + p.el + '"'));
  const mockOk = ['flusso', 'preventivo', 'pdf'].every(m => run(sb, `mockGuida('${m}')`).includes('<svg'));
  run(sb, 'Guida.avvia(); Guida.avanti(); Guida.chiudi();');
  const vista = run(sb, 'Store.getGuidaVista()');
  check('Guida: passi validi, mockup e ciclo di vita', passi.length >= 5 && targetsOk && mockOk && vista === true,
    `passi=${passi.length} targetsOk=${targetsOk} mockOk=${mockOk} vista=${vista}`);
} catch (e) { check('Guida: passi validi, mockup e ciclo di vita', false, e.message); }

// 10) Abbonamento: gating spento di default (prezzi vuoti), limite e stato
//     abbonato quando acceso, contatore che cresce e non si azzera.
try {
  const sb = loadApp({});
  boot(sb);
  const r1 = run(sb, 'Abbo.gatingAttivo()===false && Abbo.puoCreare()===true');
  run(sb, `STRIPE_PREZZI.mensile='price_test'; localStorage.setItem('mv_stat', JSON.stringify({prevCreati:5}));`);
  const r2 = run(sb, 'Abbo.gatingAttivo()===true && Abbo.puoCreare()===false && Abbo.rimasti()===0');
  run(sb, `localStorage.setItem('mv_abbo', JSON.stringify({attivo:true, fine: Date.now()+86400000}));`);
  const r3 = run(sb, 'Abbo.attivo()===true && Abbo.puoCreare()===true');
  run(sb, `localStorage.setItem('mv_abbo', JSON.stringify({attivo:true, fine: Date.now()-1000}));`);
  const r4 = run(sb, 'Abbo.attivo()===false && Abbo.puoCreare()===false');
  run(sb, 'Abbo.registraCreazione()');
  const r5 = run(sb, 'Abbo.usati()===6');
  run(sb, `localStorage.setItem('mv_stat', JSON.stringify({prevCreati:0})); localStorage.setItem('mv_abbo','{}');`);
  const r6 = run(sb, 'Abbo.usati()===1 && Abbo.puoCreare()===true');
  run(sb, `localStorage.setItem('mv_stat_dev', JSON.stringify({prevCreati:5}));`);
  const r7 = run(sb, 'Abbo.usati()===5 && Abbo.puoCreare()===false');
  // col limite raggiunto un NUOVO preventivo non si salva (i vecchi sì)
  const r8 = run(sb, `wzNuovo(); doc.cliente.nome='X'; wzSalvaOra()===false && preventivi.length===0`);
  check('Abbonamento: gating, limite, stato e contatore (account+dispositivo)', r1 && r2 && r3 && r4 && r5 && r6 && r7 && r8,
    `r1=${r1} r2=${r2} r3=${r3} r4=${r4} r5=${r5} r6=${r6} r7=${r7} r8=${r8}`);
} catch (e) { check('Abbonamento: gating, limite, stato e contatore (account+dispositivo)', false, e.message); }

// 11) Isolamento account: un nuovo account NON eredita i dati locali del
//     precedente; al ritorno del primo account i suoi dati tornano.
try {
  const seed = {
    mv_uid: 'utenteA',
    mv_prev: JSON.stringify([DOC]),
    mv_impresa: JSON.stringify({ nome: 'Impresa A' }),
    mv_listino: JSON.stringify({ tp: 8 }),
    mv_stat_dev: JSON.stringify({ prevCreati: 5 }),
  };
  const sb = loadApp(seed);
  boot(sb);
  const primaN = run(sb, 'preventivi.length');
  run(sb, 'preparaDatiPerUtente("utenteB")');
  const dopo = JSON.parse(run(sb,
    `JSON.stringify({n:preventivi.length, imp:impresa.nome||'', uid:localStorage.getItem('mv_uid'), stash:!!localStorage.getItem('mv_saved_utenteA'), usati:Abbo.usati(), listino:Store.loadListino().tp||0, docNome:doc.cliente.nome})`));
  run(sb, 'preparaDatiPerUtente("utenteA")');
  const ritorno = JSON.parse(run(sb,
    `JSON.stringify({n:preventivi.length, nome:(preventivi[0]||{}).cliente ? preventivi[0].cliente.nome : '', listino:Store.loadListino().tp||0, stashB:!!localStorage.getItem('mv_saved_utenteB'), stashA:!!localStorage.getItem('mv_saved_utenteA')})`));
  const ok = primaN === 1
    && dopo.n === 0 && dopo.imp === '' && dopo.uid === 'utenteB' && dopo.stash === true && dopo.usati === 5 && dopo.listino === 0 && dopo.docNome === ''
    && ritorno.n === 1 && ritorno.nome === 'Mario Rossi' && ritorno.listino === 8 && ritorno.stashB === true && ritorno.stashA === false;
  check('Isolamento account: switch pulito e ripristino al ritorno', ok, `prima=${primaN} dopo=${JSON.stringify(dopo)} ritorno=${JSON.stringify(ritorno)}`);
} catch (e) { check('Isolamento account: switch pulito e ripristino al ritorno', false, e.message); }

// 12) Disegno tecnico degli infissi: aperture corrette e quote in mm.
try {
  const sb = loadApp({});
  const a = (apr, ante) => JSON.stringify(sb.apertureInfisso({ apr, ante }));
  const svg = sb.disegnoInfisso({ tipo: 'portafinestra', lung: 1400, alt: 2300, ante: 2, apr: 'battente' });
  const ok = a('battente', 2) === '["battente-sx","battente-dx"]' && a('ribalta', 1) === '["ribalta-dx"]'
    && a('scorrevole', 2) === '["fissa","scorrevole-sx"]' && a('fissa', 3) === '["fissa","fissa","fissa"]'
    && svg.includes('<svg') && svg.includes('>1400<') && svg.includes('>2300<') && svg.includes('stroke-dasharray');
  check('Infissi: aperture e disegno con quote', ok, svg.slice(0, 80));
} catch (e) { check('Infissi: aperture e disegno con quote', false, e.message); }

// 13) Pianta (senza schermo): stanze disegnate → locali, porta tra due stanze
//     tolta dalle pareti di entrambe (prezzata solo se si mette un prezzo),
//     messa in scala con le misure, pianta nel PDF.
try {
  const sb = loadApp({});
  boot(sb);
  const C = 12, k = 4, P = (x, y) => ({ x: x * k * C, y: y * k * C });
  const seg = (a, b, c, d) => { const p = P(a, b), q = P(c, d); return { x1: Math.min(p.x, q.x), y1: Math.min(p.y, q.y), x2: Math.max(p.x, q.x), y2: Math.max(p.y, q.y) }; };
  // schizzo "a occhio": due stanze 6×8 affiancate (fuori proporzione)
  const d = JSON.parse(JSON.stringify(DOC));
  d.via = 'disegno'; d.locali = [];
  d.pianta = { walls: [seg(0,0,6,0), seg(6,0,12,0), seg(0,8,6,8), seg(6,8,12,8), seg(0,0,0,8), seg(12,0,12,8), seg(6,0,6,8)],
               rooms: [], infissi: [{ id: 'p1', o: 'V', x: 6 * k * C, y: 4 * k * C, tipo: 'porta', w: .8, h: 2.1, sill: 0 }] };
  run(sb, 'doc=normalizzaDoc(' + JSON.stringify(d) + '); Pianta.aggiornaDoc(doc);');
  const r1 = JSON.parse(run(sb, 'JSON.stringify(doc.locali.map(l=>({id:l.id, inPianta:l.inPianta, inf:l.inf.length, ded:l.dedExtra})))'));
  const collegati = r1.length === 2 && r1.every(l => l.inPianta) && r1[0].inf === 1 && r1[1].ded === 1.68 && r1[0].ded === 0;
  const nonPrezzata = run(sb, 'locRighe(doc.locali[0], doc.prezzi).length') === 0;
  // misure vere: 4×5 e 3,5×5 → in scala le due stanze hanno queste proporzioni
  run(sb, `doc.locali[0].nome='Soggiorno'; doc.locali[0].L=4; doc.locali[0].W=5; doc.locali[1].nome='Camera'; doc.locali[1].L=3.5; doc.locali[1].W=5; doc.locali[0].lav.tp=true;`);
  const esito = JSON.parse(run(sb, 'JSON.stringify(Pianta.scala(doc))'));
  const st = JSON.parse(run(sb, 'JSON.stringify(doc.pianta.anteprima.stanze.map(s=>[s.w,s.h]))'));
  const PPM = C * 20;
  const scalaOk = esito.esito === 'ok' && esito.avvisi.length === 0 && run(sb, 'doc.pianta.inScala') === true
    && Math.abs(st[0][0] / PPM - 4) < .06 && Math.abs(st[0][1] / PPM - 5) < .06 && Math.abs(st[1][0] / PPM - 3.5) < .06;
  // pareti Soggiorno: 2×9×2,7 = 48,6 − porta 1,68 = 46,92
  const pareti = run(sb, 'locSup(doc.locali[0]).pareti');
  const pdf = run(sb, 'buildPdfPrev(doc)');
  const pdfOk = pdf.includes('Pianta dei locali') && pdf.includes('aria-label="Pianta dei locali"') && pdf.includes('Soggiorno') && !pdf.includes('Porta interna');
  const svgMis = run(sb, "svgPianta(doc,'misure')");
  check('Pianta: stanze→locali, porte, messa in scala e PDF', collegati && nonPrezzata && scalaOk && near(pareti, 46.92) && pdfOk && svgMis.includes('data-room="1"'),
    JSON.stringify({ r1, nonPrezzata, esito, st, pareti, pdfOk }));
} catch (e) { check('Pianta: stanze→locali, porte, messa in scala e PDF', false, e.message); }

// 14) Lavori "in tutti i locali": una spunta vale per ogni stanza, le eccezioni
//     restano per locale, i locali aggiunti dopo li ricevono; listino col segno _ok.
try {
  const sb = loadApp({ mv_listino: JSON.stringify({ tp: 8, _ok: 1 }) });
  boot(sb);
  run(sb, `doc.cliente.nome='Test'; doc.via='manuale'; wzStep=1;
    wzAddLocale('Soggiorno'); wzAddLocale('Bagno');
    doc.locali.forEach(l=>{ l.L=4; l.W=3; });
    wzStep=2; wzRender();
    wzChange({target:{dataset:{tutti:'tp'}, checked:true}});
    doc.locali[1].lav.tp=false;           // eccezione: niente tinteggiatura nel bagno
    wzAddLocale('Camera');`);
  const r = JSON.parse(run(sb, `JSON.stringify({lav:doc.locali.map(l=>!!l.lav.tp), prezzo:doc.prezzi.tp, ok:'_ok' in doc.prezzi, diff:wzDiff(doc.locali[1]), passi:passiLbl().length})`));
  const ok = r.lav.join() === 'true,false,true' && r.prezzo === 8 && r.ok === false
    && r.diff.includes('senza tinteggiatura pareti') && r.passi === 3;
  check('Lavori in tutti i locali, eccezioni, listino', ok, JSON.stringify(r));
} catch (e) { check('Lavori in tutti i locali, eccezioni, listino', false, e.message); }

// 15) Senza misure: lavori a corpo; togliere la pianta lascia i locali.
try {
  const sb = loadApp({});
  boot(sb);
  run(sb, `doc=normalizzaDoc(${JSON.stringify(DOC)});`);
  const rip = JSON.parse(run(sb, `doc.locali[2].lav.ts=true; doc.locali[2].corpo={tp:300}; JSON.stringify(locRighe(doc.locali[2], doc.prezzi).map(r=>[r.nome,r.u,r.tot]))`));
  // Ripostiglio senza misure: tinteggiatura pareti a corpo 300, soffitto senza importo (escluso)
  const corpoOk = JSON.stringify(rip) === JSON.stringify([['Tinteggiatura pareti','a corpo',300]]);
  run(sb, `doc.via='disegno'; doc.pianta={walls:[]}; doc.locali[1].inPianta=true; doc.locali[1].daPianta=true;
           doc.locali[1].inf.push({tipo:'porta',lung:800,alt:2100,ante:1,apr:'battente',prezzo:0,pid:'p9'});
           doc.locali[1].dedExtra=1.5; wzTogliPianta();`);
  const dopo = JSON.parse(run(sb, `JSON.stringify({via:doc.via, p:doc.pianta, n:doc.locali.length, inf:doc.locali[1].inf.length, pid:doc.locali[1].inf.some(x=>x.pid), ded:doc.locali[1].dedExtra, flag:'daPianta' in doc.locali[1]})`));
  const togliOk = dopo.via === 'manuale' && dopo.p === null && dopo.n === 3 && dopo.inf === 1 && !dopo.pid && dopo.ded === 0 && !dopo.flag;
  check('Senza misure (a corpo) e pianta tolta', corpoOk && togliOk, JSON.stringify({ rip, dopo }));
} catch (e) { check('Senza misure (a corpo) e pianta tolta', false, e.message); }

// 16) Usa come modello: stessi locali e lavori, cliente vuoto, nuovo numero;
//     si salva solo quando c'è il nome. Elimina in blocco dei vecchi.
try {
  const vecchio = { id: 7, numero: 'P-1', mestiere: 'muratore', locali: [] };
  const seed = { mv_prev: JSON.stringify([DOC, vecchio]) };
  const sb = loadApp(seed);
  boot(sb);
  const r = JSON.parse(run(sb, `wzModello(1); JSON.stringify({nome:doc.cliente.nome, tel:doc.cliente.tel, loc:doc.locali.length, num:doc.numero, id:doc.id, stato:doc.stato, step:wzStep, n:preventivi.length})`));
  const salvaVuoto = run(sb, 'wzSalvaOra()');
  run(sb, `doc.cliente.nome='Nuovo'; wzSalvaOra(); eliminaVecchi();`);
  const dopo = JSON.parse(run(sb, `JSON.stringify(preventivi.map(p=>[p.id===1?'orig':(p.v===2?'nuovo':'vecchio'), p.cliente&&p.cliente.nome]))`));
  const ok = r.nome === '' && r.tel === '' && r.loc === 3 && r.id !== 1 && r.stato === 'bozza' && r.step === 0 && r.n === 2
    && salvaVuoto === false && dopo.length === 2 && dopo.some(x => x[0] === 'orig' && x[1] === 'Mario Rossi') && dopo.some(x => x[0] === 'nuovo' && x[1] === 'Nuovo');
  check('Usa come modello (cliente nuovo) ed eliminazione dei vecchi', ok, JSON.stringify({ r, salvaVuoto, dopo }));
} catch (e) { check('Usa come modello (cliente nuovo) ed eliminazione dei vecchi', false, e.message); }

console.log('\n' + (fail === 0 ? `🟢 TUTTO VERDE — ${pass} test superati` : `🔴 ${fail} test FALLITI (${pass} superati)`));
process.exit(fail === 0 ? 0 : 1);
