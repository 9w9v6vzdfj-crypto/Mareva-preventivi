// ══════════════════════════════════════════════════════════
//  AUTENTICAZIONE — Firebase (login email/password + Google)
//  NB: per ora i dati restano in locale; questo è solo il "cancello"
//  di accesso. Il collegamento dei dati al cloud è il passo successivo.
//  Se Firebase non è disponibile (offline / CDN irraggiungibile), l'app
//  funziona comunque in locale, esattamente come prima.
// ══════════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyDaPd_AB4ju0MjaK_9Ksbgj9TvFAU4_qMk",
  authDomain: "facile-preventivo.firebaseapp.com",
  projectId: "facile-preventivo",
  storageBucket: "facile-preventivo.firebasestorage.app",
  messagingSenderId: "747632433989",
  appId: "1:747632433989:web:6cd4464e0919488398bc2c"
};
let currentUser = null;
let _justCreated = false;

function _authEl(id){ return document.getElementById(id); }
function _authBusy(on){
  const b=_authEl('authBusy'); if(b) b.style.display = on ? 'block' : 'none';
  ['btnAccedi','btnCrea','btnGoogle'].forEach(i=>{ const el=_authEl(i); if(el) el.disabled = on; });
}
function _authMsg(t){ const e=_authEl('authError'); if(e) e.textContent = t || ''; }
function mostraGate(){ const g=_authEl('authGate'); if(g) g.style.display='flex'; }
function mostraApp(){ const g=_authEl('authGate'); if(g) g.style.display='none'; }

function _authErrore(err){
  _authBusy(false);
  const code = (err && err.code) ? err.code : '';
  const map = {
    'auth/email-already-in-use':'Questa email ha già un account. Prova ad accedere.',
    'auth/invalid-email':'Email non valida.',
    'auth/missing-password':'Inserisci la password.',
    'auth/weak-password':'Password troppo debole (minimo 6 caratteri).',
    'auth/wrong-password':'Email o password errati.',
    'auth/invalid-credential':'Email o password errati.',
    'auth/user-not-found':'Nessun account con questa email. Creane uno.',
    'auth/too-many-requests':'Troppi tentativi. Riprova tra poco.',
    'auth/popup-closed-by-user':'Accesso annullato.',
    'auth/popup-blocked':'Il browser ha bloccato la finestra di Google. Riprova.',
    'auth/network-request-failed':'Nessuna connessione. Controlla la rete.',
    'auth/operation-not-allowed':'Metodo di accesso non abilitato nel progetto Firebase.'
  };
  _authMsg(map[code] || ('Errore: ' + ((err && err.message) ? err.message : code)));
}

function creaAccount(){
  if(typeof firebase==='undefined' || !firebase.auth) return;
  const email=(_authEl('authEmail').value||'').trim();
  const pw=_authEl('authPw').value||'';
  if(!email){ _authMsg('Inserisci la tua email.'); return; }
  if(pw.length<6){ _authMsg('La password deve avere almeno 6 caratteri.'); return; }
  _authMsg(''); _authBusy(true);
  firebase.auth().createUserWithEmailAndPassword(email, pw)
    .then(function(){ _justCreated = true; })
    .catch(_authErrore);
}
function accedi(){
  if(typeof firebase==='undefined' || !firebase.auth) return;
  const email=(_authEl('authEmail').value||'').trim();
  const pw=_authEl('authPw').value||'';
  if(!email || !pw){ _authMsg('Inserisci email e password.'); return; }
  _authMsg(''); _authBusy(true);
  firebase.auth().signInWithEmailAndPassword(email, pw).catch(_authErrore);
}
function accediGoogle(){
  if(typeof firebase==='undefined' || !firebase.auth) return;
  _authMsg(''); _authBusy(true);
  const prov=new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(prov).catch(_authErrore);
}
function esci(){
  const m=document.getElementById('accountMenu'); if(m) m.style.display='none';
  if(typeof firebase==='undefined' || !firebase.auth) return;
  // I dati per ora sono solo locali: usciamo dall'account ma i documenti
  // restano sul dispositivo. Meglio dirlo chiaramente che farlo in silenzio.
  if(!confirm('Uscire dall\'account?\nI documenti restano salvati su questo dispositivo e saranno visibili a chiunque lo usi.')) return;
  firebase.auth().signOut();
}
function toggleAccountMenu(ev){
  if(ev) ev.stopPropagation();
  const m=document.getElementById('accountMenu');
  if(!m) return;
  m.style.display = (m.style.display==='block') ? 'none' : 'block';
}
// Chiude la tendina toccando in qualunque altro punto
document.addEventListener('click', function(){
  const m=document.getElementById('accountMenu');
  if(m && m.style.display==='block') m.style.display='none';
});

(function initAuth(){
  if(typeof firebase==='undefined' || !firebase.auth){
    mostraApp(); // Firebase non disponibile → app in modalità locale (come prima)
    return;
  }
  try{ firebase.initializeApp(firebaseConfig); }catch(e){}
  firebase.auth().onAuthStateChanged(function(user){
    currentUser = user;
    _authBusy(false);
    if(user){
      const ae=_authEl('accountEmail');
      if(ae) ae.textContent = user.email || ((user.providerData[0]||{}).email) || 'account Google';
      mostraApp();
      if(_justCreated){
        _justCreated = false;
        setTimeout(function(){ alert('✅ Account creato con successo!\nBenvenuto in Facile Preventivo.'); }, 300);
      }
      // (Passo successivo della Fase 3: qui caricheremo i dati dell'utente dal cloud)
    }else{
      mostraGate();
    }
  });
})();

// ══════════════════════════════════════════════════════════
//  COSTANTI / LISTE
// ══════════════════════════════════════════════════════════
const TIPI_STRUTTURA = ['Appartamento','Villa / Casa indipendente','Spazio commerciale','Ufficio','Capannone / Industriale','Altro'];

const CONDIZIONI_LISTA = [
  'Buono stato','Piccole imperfezioni','Crepe da riparare','Umidità / muffa','Intonaco parziale','Intonaco completo'
];

// ── Stato / condizioni COERENTE per mestiere ──
// Imbianchino e muratore usano la lista storica (CONDIZIONI_LISTA): invariata.
// Elettricista e idraulico hanno opzioni sullo stato dell'impianto.
// "libero" non mostra alcuna sezione stato.
const STATO_ELETTRICISTA = [
  'Nuovo impianto (da zero)','Rifacimento totale','Adeguamento a norma','Ampliamento esistente',
  'Impianto funzionante','Quadro / centralino da sostituire'
];
const STATO_IDRAULICO = [
  'Nuovo impianto (da zero)','Rifacimento tubazioni','Sostituzione sanitari','Riparazione perdita',
  'Impianto funzionante','Adeguamento scarichi'
];
const STATO_CFG = {
  imbianchino: { mostra:true,  titolo:'Stato / condizioni', titoloLoc:'Stato / condizioni locale', opzioni:CONDIZIONI_LISTA,   noteGenPh:'Eventuali dettagli su crepe, umidità, ecc.', noteLocPh:'Note sullo stato di questo locale…' },
  muratore:    { mostra:true,  titolo:'Stato / condizioni', titoloLoc:'Stato / condizioni locale', opzioni:CONDIZIONI_LISTA,   noteGenPh:'Eventuali dettagli su crepe, umidità, ecc.', noteLocPh:'Note sullo stato di questo locale…' },
  elettricista:{ mostra:true,  titolo:'Stato impianto',      titoloLoc:'Stato impianto (locale)',  opzioni:STATO_ELETTRICISTA, noteGenPh:'Es. quadro datato, mancano salvavita, contatore…', noteLocPh:'Note sull’impianto di questo locale…' },
  idraulico:   { mostra:true,  titolo:'Stato impianto',      titoloLoc:'Stato impianto (locale)',  opzioni:STATO_IDRAULICO,    noteGenPh:'Es. tubazioni vecchie, scarichi lenti, posizione attacchi…', noteLocPh:'Note sull’impianto di questo locale…' },
  libero:      { mostra:false, titolo:'',                    titoloLoc:'',                          opzioni:[],                 noteGenPh:'', noteLocPh:'' }
};
function statoCfg(m){ return STATO_CFG[m] || STATO_CFG.imbianchino; }
function mestiereMostraStato(m){ return !!statoCfg(m).mostra; }
function statoOpzioni(m){ return statoCfg(m).opzioni || []; }
// Per i mestieri "tecnici" (elettricista/idraulico) le condizioni sono chip
// toccabili (più immediate su mobile); imbianchino/muratore restano checklist.
function condUsaChip(m){ return mestiereMostraStato(m) && m!=='imbianchino' && m!=='muratore'; }

// Placeholder materiali coerente col mestiere (imbianchino/muratore invariati).
const MATERIALI_PH = {
  imbianchino:'es. pittura lavabile, stucco, primer…',
  muratore:'es. pittura lavabile, stucco, primer…',
  elettricista:'es. cavi, scatole, frutti, canaline…',
  idraulico:'es. tubi, raccordi, sifoni, valvole…',
  libero:'es. materiali previsti…'
};
function materialiPh(m){ return MATERIALI_PH[m] || MATERIALI_PH.imbianchino; }

// ── Lavori predefiniti per mestiere ──
// (Imbianchino e muratore: liste invariate rispetto alla versione precedente.)
const LAVORI_IMBIANCHINO = [
  'Tutto bianco','Soffitto bianco','Pareti colorate','Parete testata (colore diverso)',
  '2 colori pareti','Stucco veneziano','Spatolato','Carta da parati','Effetto cemento','Risanamento / antimuffa'
];
const LAVORI_MURATORE = [
  'Demolizione tramezzo','Demolizione pavimento','Costruzione tramezzo in cartongesso','Costruzione tramezzo in laterizio',
  'Massetto / sottofondo','Posa pavimento / piastrelle','Posa rivestimento parete','Intonaco e rasatura',
  'Impermeabilizzazione','Controsoffitto cartongesso','Realizzazione vano porta','Battiscopa','Smaltimento macerie',
  'Impianto idraulico','Impianto elettrico','Impianto riscaldamento','Predisposizione climatizzazione',
  'Sostituzione sanitari','Rifacimento bagno completo'
];
// Per il muratore non si usa l'elenco lungo: campo libero + poche scorciatoie.
const MURATORE_SUGGERITI = ['Demolizioni','Tramezzo cartongesso','Massetto','Posa piastrelle','Intonaco e rasatura','Rifacimento bagno'];

// Nuovi mestieri: voci con quantità × prezzo unitario.
const LAVORI_ELETTRICISTA = [
  'Punto luce','Punto presa','Punto comandato / deviato','Quadro elettrico','Salvavita / centralino',
  'Stesura linea (canalina)','Punto TV / dati','Faretti / illuminazione','Citofono / videocitofono','Certificazione (DiCo)'
];
const LAVORI_IDRAULICO = [
  'Punto acqua (carico)','Punto scarico','Posa sanitari (wc/bidet/lavabo)','Box doccia / vasca','Caldaia / scaldabagno',
  'Radiatore / termoarredo','Rubinetteria / miscelatori','Allaccio lavatrice/lavastoviglie','Collettore / distribuzione','Collaudo impianto'
];

// ══════════════════════════════════════════════════════════
//  CONFIGURAZIONE MESTIERI
//  Tutta la UI/PDF legge da qui invece di if mestiere==='...'.
//  - superficie: 'pareti_soffitto' | 'pavimento' | 'nessuna' | 'opzionale'
//      (solo i primi due mostrano misure, badge m² e riga superficie nel PDF)
//  - quantita:   true → ogni voce ha quantità × prezzo unitario
//  - lavoriMode: 'checklist' (elenco con caselle) | 'freetext' (riga libera + chip)
//  - suggeriti:  scorciatoie a chip per la modalità freetext
// ══════════════════════════════════════════════════════════
const MESTIERI = {
  imbianchino:  { nome:'Imbianchino',     short:'Imbianchino',  icona:'🎨', superficie:'pareti_soffitto', quantita:false, lavoriMode:'checklist', suggeriti:[],                lavori:LAVORI_IMBIANCHINO },
  muratore:     { nome:'Muratore',        short:'Muratore',     icona:'🧱', superficie:'pavimento',        quantita:false, lavoriMode:'freetext',  suggeriti:MURATORE_SUGGERITI, lavori:LAVORI_MURATORE },
  elettricista: { nome:'Elettricista',    short:'Elettricista', icona:'⚡', superficie:'nessuna',          quantita:true,  lavoriMode:'checklist', suggeriti:[],                lavori:LAVORI_ELETTRICISTA },
  idraulico:    { nome:'Idraulico',       short:'Idraulico',    icona:'🔧', superficie:'nessuna',          quantita:true,  lavoriMode:'checklist', suggeriti:[],                lavori:LAVORI_IDRAULICO },
  libero:       { nome:'Mestiere libero', short:'Libero',       icona:'🛠', superficie:'opzionale',        quantita:true,  lavoriMode:'freetext',  suggeriti:[],                lavori:[] }
};
function cfgMestiere(m){ return MESTIERI[m] || MESTIERI.imbianchino; }
// Solo pareti_soffitto e pavimento mostrano misure/superficie.
function mestiereHaSuperficie(m){ const s=cfgMestiere(m).superficie; return s==='pareti_soffitto' || s==='pavimento'; }
function mestiereIcona(m){ return cfgMestiere(m).icona; }

const LOCALI_EMOJI = {Camera:'🛏',Cameretta:'🛏',Bagno:'🚿',Antibagno:'🪥',Corridoio:'🚪',Cucina:'🍳',Sala:'🛋',Scala:'🪜'};
const PAGE_TITLES={dashboard:'Home',sopralluogo:'Sopralluogo',nuovo:'Preventivo',lista:'Archivio',impostazioni:'Dati impresa'};

// ── Utility ──
// ══════════════════════════════════════════════════════════
//  STORE — unico punto di accesso ai dati (il "cassetto dei dati")
//  Oggi i dati stanno nella memoria del telefono (localStorage).
//  Domani, per account + database online, basterà cambiare QUI dentro:
//  il resto dell'app non sa né dove né come i dati sono salvati.
// ══════════════════════════════════════════════════════════
const Store = {
  KEYS: { prev:'mv_prev', sop:'mv_sop', impresa:'mv_impresa', mestiere:'mv_mestiere', lavoriCustom:'mv_lavori_custom' },

  // -- uso interno: leggi un valore JSON in modo sicuro (se corrotto, usa il fallback) --
  _read(key, fallback){
    if(typeof localStorage==='undefined') return fallback;
    const raw=localStorage.getItem(key);
    if(raw==null) return fallback;
    try{ const v=JSON.parse(raw); return v==null ? fallback : v; }
    catch(e){ console.warn('Dato non valido in memoria per', key); return fallback; }
  },
  // -- uso interno: leggi una stringa semplice non-JSON (es. il mestiere) --
  _readRaw(key, fallback){
    if(typeof localStorage==='undefined') return fallback;
    const v=localStorage.getItem(key);
    return v==null ? fallback : v;
  },
  // -- uso interno: scrivi un valore (avvisa se la memoria è piena) --
  _write(key, value){
    try{ localStorage.setItem(key, typeof value==='string' ? value : JSON.stringify(value)); return true; }
    catch(e){
      alert('⚠️ Memoria piena: impossibile salvare.\nElimina qualche vecchio documento dall\'Archivio, poi riprova.');
      return false;
    }
  },

  // -- metodi per ciascun tipo di dato: questi li usa il resto dell'app --
  loadPreventivi(){ return this._read(this.KEYS.prev, []); },
  savePreventivi(arr){ return this._write(this.KEYS.prev, arr); },

  loadSopralluoghi(){ return this._read(this.KEYS.sop, []); },
  saveSopralluoghi(arr){ return this._write(this.KEYS.sop, arr); },

  loadImpresa(){ return this._read(this.KEYS.impresa, {}); },
  saveImpresa(obj){ return this._write(this.KEYS.impresa, obj); },

  loadLavoriCustom(){ return this._read(this.KEYS.lavoriCustom, {imbianchino:[],muratore:[],elettricista:[],idraulico:[],libero:[]}); },
  saveLavoriCustom(obj){ return this._write(this.KEYS.lavoriCustom, obj); },

  getMestiere(){ return this._readRaw(this.KEYS.mestiere, 'imbianchino'); },
  setMestiere(m){ return this._write(this.KEYS.mestiere, m); }
};
// Escape HTML per evitare XSS quando si interpolano dati utente nei template.
function esc(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
// Escape per valori utente dentro una stringa JS a apici singoli in un
// attributo onclick/onchange: prima escape JS (\ e '), poi escape HTML
// dell'attributo. L'HTML dell'attributo viene decodificato prima di eseguire
// il JS, quindi l'ordine e' importante.
function escJs(s){
  return esc(String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"));
}

// Liste personalizzabili (lavori extra aggiunti dall'utente), salvate per mestiere
let lavoriCustom = Store.loadLavoriCustom();

function lavoriList(mest){
  return [...(cfgMestiere(mest).lavori||[]), ...(lavoriCustom[mest]||[])];
}
function addLavoroCustom(mest,nome){
  nome=(nome||'').trim();
  if(!nome) return;
  if(!lavoriCustom[mest]) lavoriCustom[mest]=[];
  if(!lavoriList(mest).includes(nome)) lavoriCustom[mest].push(nome);
  Store.saveLavoriCustom(lavoriCustom);
}

// ── Quantità × prezzo (retrocompatibile) ──
// Quantità mancante/vuota = 1, così imbianchino/muratore (che non scrivono mai
// lavoriQta) e i documenti già salvati hanno totale riga = prezzo, invariato.
function qtaOf(loc, nome){
  const q=(loc.lavoriQta||{})[nome];
  if(q===undefined||q===null||q==='') return 1;
  const n=parseFloat(q);
  return Number.isFinite(n)?n:1;
}
// Somma dei lavori di un locale.
// Mestieri SENZA quantità (imbianchino/muratore): formula ORIGINALE invariata.
// Mestieri CON quantità: somma di qta×prezzo sulle voci selezionate.
function sommaLavoriLoc(loc, mest){
  const prezzi=loc.lavoriPrezzi||{};
  if(cfgMestiere(mest||mestiere).quantita){
    return (loc.lavori||[]).reduce((s,n)=>s + qtaOf(loc,n)*((prezzi[n])||0), 0);
  }
  return Object.values(prezzi).reduce((s,p)=>s+(p||0),0);
}

// ══════════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════════
let preventivi = Store.loadPreventivi();
let sopralluoghi = Store.loadSopralluoghi();
let mestiere = Store.getMestiere();

// Sopralluogo
let sLocali=[]; let sLocCnt=0;
let sTipoStruttura='Appartamento';
let sCondizioni=[]; // condizioni generali sopralluogo
let sEditId=null;

// Preventivo
let locali=[]; let locCnt=0;
let pTipoStruttura='Appartamento';
let condizioni=[]; // condizioni generali preventivo
let optMdoPerLocale=false;
let optCondPerLocale=false;
let editId=null;
let currentStato='bozza'; // stato del preventivo attualmente in modifica

// Impresa
let impresa = Store.loadImpresa();

function salvaImpresa(){
  impresa={
    nome: document.getElementById('impNome').value,
    piva: document.getElementById('impPiva').value,
    tel: document.getElementById('impTel').value,
    email: document.getElementById('impEmail').value,
    indirizzo: document.getElementById('impIndirizzo').value,
    sito: document.getElementById('impSito').value,
  };
  Store.saveImpresa(impresa);
  aggiornaPreviewImpresa();
  const msg=document.getElementById('impSavedMsg');
  msg.textContent='✓ Salvato';
  setTimeout(()=>msg.textContent='',2000);
}

function caricaImpresa(){
  document.getElementById('impNome').value=impresa.nome||'';
  document.getElementById('impPiva').value=impresa.piva||'';
  document.getElementById('impTel').value=impresa.tel||'';
  document.getElementById('impEmail').value=impresa.email||'';
  document.getElementById('impIndirizzo').value=impresa.indirizzo||'';
  document.getElementById('impSito').value=impresa.sito||'';
  aggiornaPreviewImpresa();
}

function aggiornaPreviewImpresa(){
  const el=document.getElementById('impPreview');
  if(!el) return;
  const nome=impresa.nome||'';
  if(!nome){
    el.innerHTML=`<div style="font-size:18px;font-weight:800;color:var(--text)">Facile Preventivo</div>
      <div style="font-size:11px;color:var(--sub);margin-top:2px">Inserisci i dati impresa per personalizzare il PDF</div>`;
    return;
  }
  el.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:18px;font-weight:800;color:var(--text)">${esc(nome)}</div>
        ${impresa.piva?`<div style="font-size:12px;color:var(--sub)">P.IVA ${esc(impresa.piva)}</div>`:''}
      </div>
    </div>
    ${impresa.indirizzo?`<div style="font-size:12px;color:var(--sub);margin-top:4px">📍 ${esc(impresa.indirizzo)}</div>`:''}
    <div style="font-size:12px;color:var(--sub);margin-top:2px;display:flex;gap:12px;flex-wrap:wrap">
      ${impresa.tel?`<span>📞 ${esc(impresa.tel)}</span>`:''}
      ${impresa.email?`<span>✉️ ${esc(impresa.email)}</span>`:''}
      ${impresa.sito?`<span>🌐 ${esc(impresa.sito)}</span>`:''}
    </div>`;
}

function intestazionePDF(tipo){
  // tipo: 'preventivo' | 'sopralluogo'
  const sottotitolo = tipo==='sopralluogo' ? 'Scheda sopralluogo' : 'Preventivo lavori';
  if(impresa.nome){
    return `
      <div>
        <div style="font-size:20px;font-weight:800;color:#111827">${esc(impresa.nome)}</div>
        ${impresa.piva?`<div style="font-size:11px;color:#6B7280">P.IVA ${esc(impresa.piva)}</div>`:''}
        ${impresa.indirizzo?`<div style="font-size:11px;color:#6B7280">${esc(impresa.indirizzo)}</div>`:''}
        <div style="font-size:11px;color:#6B7280">${[impresa.tel,impresa.email,impresa.sito].filter(Boolean).map(esc).join(' · ')}</div>
      </div>`;
  }
  return `
    <div>
      <div style="font-size:22px;font-weight:800;color:#111827">Facile <span style="color:#2563EB">Preventivo</span></div>
      <div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:.5px">${sottotitolo}</div>
    </div>`;
}
// Numero progressivo basato sul MASSIMO numero esistente dell'anno corrente,
// non sul conteggio: così cancellare un documento non crea duplicati e la
// numerazione riparte da 001 ogni anno.
function maxNumAnno(arr, lettera, anno){
  let max=0;
  const re=new RegExp(lettera+'\\s*[–-]\\s*'+anno+'\\/(\\d+)');
  (arr||[]).forEach(r=>{
    const m=String(r.numero||'').match(re);
    if(m){ const n=parseInt(m[1],10); if(n>max) max=n; }
  });
  return max;
}
function nextNum(){ const y=new Date().getFullYear(); return `📄 P–${y}/${String(maxNumAnno(preventivi,'P',y)+1).padStart(3,'0')}`; }
function sNextNum(){ const y=new Date().getFullYear(); return `📋 S–${y}/${String(maxNumAnno(sopralluoghi,'S',y)+1).padStart(3,'0')}`; }
function fmt(n){return'€ '+n.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}
// Numero documento "pulito" per il PDF (senza emoji iniziale): es. "P–2026/001"
function numDoc(n){ return String(n||'').replace(/^[^\p{L}\p{N}]+/u,'').trim(); }

// ── AUTO-SALVATAGGIO BOZZA (preventivo) ──
let _autoSalvaTimer=null;
function autoSalva(){
  clearTimeout(_autoSalvaTimer);
  _autoSalvaTimer=setTimeout(()=>{
    const d=getDati();
    if(!d.cliente.nome) return; // non salvare se manca il nome
    const i=preventivi.findIndex(p=>p.id===d.id);
    if(i>=0) preventivi[i]=d; else preventivi.push(d);
    Store.savePreventivi(preventivi);
    editId=d.id;
  }, 2000);
}

// ══════════════════════════════════════════════════════════
//  MESTIERE
// ══════════════════════════════════════════════════════════
function setMestiere(m, force){
  if(m===mestiere){ applyMestiereUI(); return; }
  // force=true: apertura di un documento salvato. Niente conferma ne' pulizia:
  // la verifica riguarda i dati del form corrente, che verranno comunque
  // sostituiti da quelli del documento. Prima il confirm poteva bloccare
  // l'apertura e, se annullato, il documento si apriva col mestiere sbagliato.
  if(!force){
    // Se ci sono lavorazioni gia' inserite non compatibili col nuovo mestiere,
    // chiedi conferma (verranno rimosse insieme ai relativi prezzi/quantita').
    const newList = lavoriList(m);
    const allLocs = [...sLocali, ...locali];
    const hasIncompatible = allLocs.some(loc =>
      (loc.lavori||[]).some(n => !newList.includes(n))
    );
    if(hasIncompatible && !confirm('Cambiando attivita\' le lavorazioni non compatibili saranno rimosse. Continuare?')){
      applyMestiereUI(); // ripristina la selezione UI senza cambiare mestiere
      return;
    }
    if(hasIncompatible){
      const clean = loc => {
        const rimossi = (loc.lavori||[]).filter(n => !newList.includes(n));
        loc.lavori = (loc.lavori||[]).filter(n => newList.includes(n));
        if(loc.lavoriPrezzi) rimossi.forEach(n => delete loc.lavoriPrezzi[n]);
        if(loc.lavoriQta)    rimossi.forEach(n => delete loc.lavoriQta[n]);
      };
      sLocali.forEach(clean);
      locali.forEach(clean);
    }
  }
  mestiere=m;
  Store.setMestiere(m);
  applyMestiereUI();
}
// Genera i bottoni del selettore ciclando la config.
function renderMestiereSelector(){
  const row=document.getElementById('mestiereRow');
  if(!row) return;
  row.innerHTML=Object.keys(MESTIERI).map(k=>{
    const m=MESTIERI[k];
    return `<button class="mestiere-btn" id="mest-${k}" onclick="setMestiere('${k}')">
      <span class="mestiere-emoji">${m.icona}</span>
      <span class="mestiere-lbl">${m.short||m.nome}</span>
    </button>`;
  }).join('');
}
function applyMestiereUI(){
  Object.keys(MESTIERI).forEach(k=>{
    const b=document.getElementById('mest-'+k);
    if(b) b.classList.toggle('on', mestiere===k);
  });
  // Sezione "Stato / condizioni": coerente col mestiere.
  const sc=statoCfg(mestiere);
  if(mestiereMostraStato(mestiere)){
    const setTxt=(id,t)=>{ const el=document.getElementById(id); if(el) el.textContent=t; };
    setTxt('sCondTitle', sc.titolo); setTxt('pCondTitle', sc.titolo);
    const sN=document.getElementById('sCondNote'); if(sN) sN.placeholder=sc.noteGenPh;
    const pN=document.getElementById('pCondNote'); if(pN) pN.placeholder=sc.noteGenPh;
    renderCondGenerali('s'); renderCondGenerali('p');
    if(condUsaChip(mestiere)){
      ['sCondCollapse','pCondCollapse'].forEach(cid=>{
        const el=document.getElementById(cid); if(!el) return;
        const bdy=el.querySelector('.collapse-bdy'); if(bdy) bdy.classList.add('open');
        const ar=el.querySelector('.locale-arrow'); if(ar) ar.classList.add('open');
      });
    }
  }
  aggiornaVisibilitaStato();
  sRenderLocali();
  pRenderLocali();
}
// Visibilità sezione stato/condizioni: dipende dal mestiere (alcuni non la prevedono)
// e dalla modalità per-locale (la card generale sparisce se le condizioni sono per locale).
function aggiornaVisibilitaStato(){
  const mostra = mestiereMostraStato(mestiere);
  const showGen = mostra && !optCondPerLocale;
  const sg=document.getElementById('sCondGenCard'); if(sg) sg.style.display = showGen ? '' : 'none';
  const pg=document.getElementById('pCondGenCard'); if(pg) pg.style.display = showGen ? '' : 'none';
  const orow=document.getElementById('optCondRow'); if(orow) orow.style.display = mostra ? 'flex' : 'none';
  const odiv=document.getElementById('optCondDivider'); if(odiv) odiv.style.display = mostra ? 'block' : 'none';
}

// ══════════════════════════════════════════════════════════
//  NAVIGAZIONE
// ══════════════════════════════════════════════════════════
function goPage(name) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('.tab-item').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+name)?.classList.add('active');
  document.getElementById('pageTitle').textContent=PAGE_TITLES[name]||'';
  if(name==='dashboard') aggStats();
  if(name==='lista') renderLista();
  if(name==='nuovo' && !editId) resetForm(true);
  if(name==='sopralluogo' && !sEditId) sResetForm(true);
  if(name==='impostazioni') caricaImpresa();
  window.scrollTo(0,0);
}

// ══════════════════════════════════════════════════════════
//  COLLAPSE GENERICO (tendine)
// ══════════════════════════════════════════════════════════
function toggleCollapse(id){
  const el=document.getElementById(id);
  if(!el) return;
  const bdy=el.querySelector('.collapse-bdy');
  const arr=el.querySelector('.locale-arrow');
  bdy.classList.toggle('open');
  arr?.classList.toggle('open');
}

// ══════════════════════════════════════════════════════════
//  TIPOLOGIA STRUTTURA
// ══════════════════════════════════════════════════════════
function renderTipoStruttura(prefix, current, setter){
  const list=document.getElementById(prefix+'TipoList');
  const lbl=document.getElementById(prefix+'TipoLabel');
  lbl.textContent=current;
  list.innerHTML=TIPI_STRUTTURA.map(t=>`
    <label class="check-item${t===current?' on':''}">
      <input type="radio" name="${prefix}TipoRadio" ${t===current?'checked':''} onchange="${setter}('${t.replace(/'/g,"\\'")}')">
      <span>${t}</span>
    </label>`).join('');
}

function sSetTipo(val){
  sTipoStruttura=val;
  renderTipoStruttura('s', sTipoStruttura, 'sSetTipo');
  toggleCollapse('sTipoCollapse');
}
function pSetTipo(val){
  pTipoStruttura=val;
  renderTipoStruttura('p', pTipoStruttura, 'pSetTipo');
  toggleCollapse('pTipoCollapse');
}

// ══════════════════════════════════════════════════════════
//  CONDIZIONI GENERALI
// ══════════════════════════════════════════════════════════
function renderCondGenerali(prefix){
  const arr = prefix==='s' ? sCondizioni : condizioni;
  const list=document.getElementById(prefix+'CondList');
  if(!list) return;
  if(condUsaChip(mestiere)){
    list.innerHTML=`<div class="chip-row">${statoOpzioni(mestiere).map(c=>`
      <button type="button" class="cond-chip${arr.includes(c)?' on':''}" onclick="toggleCondGen('${prefix}','${c.replace(/'/g,"\\'")}')">${c}</button>`).join('')}</div>`;
  } else {
    list.innerHTML=statoOpzioni(mestiere).map(c=>`
      <label class="check-item${arr.includes(c)?' on':''}">
        <input type="checkbox" ${arr.includes(c)?'checked':''} onchange="toggleCondGen('${prefix}','${c.replace(/'/g,"\\'")}')">
        <span>${c}</span>
      </label>`).join('');
  }
}
function toggleCondGen(prefix,val){
  const arr = prefix==='s' ? sCondizioni : condizioni;
  const i=arr.indexOf(val);
  if(i>=0) arr.splice(i,1); else arr.push(val);
  renderCondGenerali(prefix);
}

// ══════════════════════════════════════════════════════════
//  AMBIENTI — modello dati condiviso
//  loc = {id, nome, lung, larg, h, lavori:[nomi], materiali:'',
//         condizioni:[], condNote:'', mq (override opzionale),
//         lavoriPrezzi:{nome:prezzo}, mdoLocale:0}
// ══════════════════════════════════════════════════════════
function calcoloMq(loc){
  const l=loc.lung||0, w=loc.larg||0;
  return l*w;
}
function calcoloMqPareti(loc){
  const l=loc.lung||0, w=loc.larg||0, h=loc.h||2.7;
  return 2*(l+w)*h;
}
// Superficie da imbiancare = pareti (perimetro × altezza) + soffitto (L×W),
// ciascuno includibile/escludibile tramite gli interruttori del locale.
// NB: non sottrae porte/finestre (stima lorda).
function supImbianchino(loc){
  const l=loc.lung||0, w=loc.larg||0, h=loc.h||2.7;
  const pareti   = (loc.incPareti!==false)   ? 2*(l+w)*h : 0;
  const soffitto = (loc.incSoffitto!==false) ? l*w       : 0;
  return pareti + soffitto;
}
// Superficie "utile" in base al mestiere:
//  - imbianchino → pareti + soffitto (superficie da pitturare)
//  - muratore    → pavimento (L×W)
// mest opzionale: di default usa il mestiere corrente (sempre allineato al
// documento, perché ogni flusso imposta il mestiere prima di generare il PDF).
function supLoc(loc, mest){
  const s = cfgMestiere(mest || mestiere).superficie;
  if(s==='pareti_soffitto') return supImbianchino(loc);
  if(s==='pavimento'){ const l=loc.lung||0, w=loc.larg||0; return l*w; }
  return 0; // 'nessuna' / 'opzionale' → nessuna superficie
}

// ── SOPRALLUOGO ──
function sAddLocale(){
  const inp=document.getElementById('sNuovoLocale');
  const nome=(inp.value||'').trim();
  if(!nome){inp.focus();return;}
  sLocali.push({id:sLocCnt++, nome, lung:4, larg:3, h:2.7, lavori:[], lavoriPrezzi:{}, lavoriQta:{}, materiali:'', condizioni:[], condNote:'', incPareti:true, incSoffitto:true, _open:true});
  inp.value='';
  sRenderLocali();
}
function sRemoveLocale(id){ sLocali=sLocali.filter(l=>l.id!==id); sRenderLocali(); }

function sRenderLocali(){
  renderLocaliGeneric('s', sLocali, 'sLocaliList', 'sSupTotBox', 'sSupTotVal');
}

// ── PREVENTIVO ──
function pAddLocale(){
  const inp=document.getElementById('pNuovoLocale');
  const nome=(inp.value||'').trim();
  if(!nome){inp.focus();return;}
  locali.push({id:locCnt++, nome, lung:4, larg:3, h:2.7, lavori:[], materiali:'', condizioni:[], condNote:'', lavoriPrezzi:{}, lavoriQta:{}, mdoLocale:0, incPareti:true, incSoffitto:true, _open:true});
  inp.value='';
  pRenderLocali();
}
function pRemoveLocale(id){ locali=locali.filter(l=>l.id!==id); pRenderLocali(); ricalcola(); }

function pRenderLocali(){
  renderLocaliGeneric('p', locali, 'pLocaliList', 'pSupTotBox', 'pSupTotVal');
}

// ── RENDER GENERICO LISTA AMBIENTI ──
function renderLocaliGeneric(prefix, arr, listId, boxId, valId){
  const c=document.getElementById(listId);
  if(!arr.length){
    c.innerHTML='<p style="text-align:center;color:var(--sub);font-size:13px;padding:16px 0">Nessun ambiente aggiunto.</p>';
    document.getElementById(boxId).style.display='none';
    return;
  }
  c.innerHTML=arr.map(loc=>buildLocCard(prefix,loc)).join('');
  document.getElementById(boxId).style.display = mestiereHaSuperficie(mestiere) ? 'block' : 'none';
  aggSupTotGeneric(prefix, arr, valId);
  // init sub-renders
  arr.forEach(loc=>{
    renderLavoriList(prefix,loc.id);
    if((prefix==='s'?optCondLocaleS():optCondPerLocale)) renderCondLocale(prefix,loc.id);
  });
}
function optCondLocaleS(){ return optCondPerLocale; } // il sopralluogo segue, nella sessione corrente, lo stesso interruttore del preventivo; l'opzione viene salvata nel documento come condPerLocale

function aggSupTotGeneric(prefix, arr, valId){
  const tot=arr.reduce((s,l)=>s+supLoc(l),0);
  const el=document.getElementById(valId);
  if(el) el.textContent=tot.toFixed(1)+' m²';
}

// Sottotitolo header del locale. Per i mestieri con superficie (imbianchino/
// muratore) la stringa è IDENTICA a prima ("X m² · N lavorazioni …"); per i
// mestieri senza superficie mostra solo il conteggio voci (niente "0.0 m²").
function subLocale(loc, aperto){
  const lavCount=(loc.lavori||[]).length;
  const lavTxt = lavCount ? `${lavCount} lavorazion${lavCount===1?'e':'i'}` : '';
  if(mestiereHaSuperficie(mestiere)){
    const mqTxt=`${supLoc(loc).toFixed(1)} m²`;
    return aperto
      ? (lavCount ? `${mqTxt} · ${lavTxt}` : mqTxt)
      : (lavCount ? `${mqTxt} · ${lavTxt} · tocca per modificare` : `${mqTxt} · tocca per misure e lavori`);
  }
  return aperto
    ? (lavCount ? lavTxt : 'Nessuna voce')
    : (lavCount ? `${lavTxt} · tocca per modificare` : 'Tocca per aggiungere voci');
}
// Aggiorna il totale riga (qta×prezzo) di una voce, se presente nel DOM.
// Per imbianchino/muratore la riga non ha questo elemento → no-op.
function aggiornaRigaTot(id, loc, nome){
  const idx=(loc.lavori||[]).indexOf(nome);
  const el=document.getElementById('prigatot-'+id+'-'+idx);
  if(el) el.textContent='€'+(qtaOf(loc,nome)*(((loc.lavoriPrezzi||{})[nome])||0)).toFixed(2);
}

function buildLocCard(prefix, loc){
  const e=LOCALI_EMOJI[loc.nome]||'🏠';
  const lavCount=loc.lavori.length;
  const aperto = !!loc._open;
  const sub = subLocale(loc, aperto);
  const totHTML = prefix==='p' ? `<span class="locale-hdr-tot" id="${prefix}hdr-tot-${loc.id}">€${pCalcoloTotLoc(loc).toFixed(2)}</span>` : '';
  return `<div class="locale-card">
    <div class="locale-hdr" onclick="${prefix}ToggleLocBody(${loc.id})">
      <div class="locale-hdr-l">
        <div class="locale-emoji">${e}</div>
        <div style="min-width:0;flex:1">
          <input class="locale-hdr-name" value="${esc(loc.nome)}" onclick="event.stopPropagation()" oninput="${prefix}RenameLocale(${loc.id},this.value)">
          <div class="locale-hdr-sub" id="${prefix}hdr-sub-${loc.id}">${sub}</div>
        </div>
      </div>
      <div class="locale-hdr-r">
        ${totHTML}
        <button class="btn-danger" onclick="event.stopPropagation();${prefix}RemoveLocale(${loc.id})" aria-label="Rimuovi locale">✕</button>
        <span class="locale-toggle${aperto?' open':''}" id="${prefix}arr-${loc.id}" aria-hidden="true">▾</span>
      </div>
    </div>
    <div class="locale-bdy${aperto?' open':''}" id="${prefix}body-${loc.id}">${locBodyHTML(prefix,loc)}</div>
  </div>`;
}

function sRenameLocale(id,val){ const l=sLocali.find(x=>x.id===id); if(l) l.nome=val; }
function pRenameLocale(id,val){ const l=locali.find(x=>x.id===id); if(l) l.nome=val; }

function sToggleLocBody(id){ toggleLocBodyGeneric('s',id); }
function pToggleLocBody(id){ toggleLocBodyGeneric('p',id); }
function toggleLocBodyGeneric(prefix,id){
  const arr = prefix==='s' ? sLocali : locali;
  const loc = arr.find(l=>l.id===id);
  const b=document.getElementById(prefix+'body-'+id);
  const a=document.getElementById(prefix+'arr-'+id);
  if(!b)return;
  const open = !b.classList.contains('open');
  b.classList.toggle('open', open);
  if(a) a.classList.toggle('open', open);
  if(loc){
    loc._open = open;
    // aggiorna il sottotitolo: invito a toccare solo quando il locale è chiuso
    const sub=document.getElementById(prefix+'hdr-sub-'+id);
    if(sub) sub.textContent = subLocale(loc, open);
  }
}

function locBodyHTML(prefix, loc){
  const arr = prefix==='s' ? sLocali : locali;
  const condPerLocale = optCondPerLocale;
  const cfg = cfgMestiere(mestiere);
  // Sezione misure + badge superficie: solo per i mestieri con superficie.
  const sezioneMisure = mestiereHaSuperficie(mestiere) ? `
    <div class="section-lbl" style="margin-top:0">Misure</div>
    <div class="row3">
      <div class="field"><label class="label">Lunghezza (m)</label>
        <input class="input" type="number" inputmode="decimal" min="0" step="0.1" value="${loc.lung}" oninput="${prefix}SetMisura(${loc.id},'lung',this.value)"></div>
      <div class="field"><label class="label">Larghezza (m)</label>
        <input class="input" type="number" inputmode="decimal" min="0" step="0.1" value="${loc.larg}" oninput="${prefix}SetMisura(${loc.id},'larg',this.value)"></div>
      <div class="field"><label class="label">Altezza (m)</label>
        <input class="input" type="number" inputmode="decimal" min="0" step="0.1" value="${loc.h}" oninput="${prefix}SetMisura(${loc.id},'h',this.value)"></div>
    </div>
    <div class="sup-badge">
      <span>📐 ${mestiere==='imbianchino'?'Sup. da imbiancare':'Superficie (L×W)'}</span>
      <span id="${prefix}mq-${loc.id}">${supLoc(loc).toFixed(1)} m²</span>
    </div>
    ${mestiere==='imbianchino'?`
    <div style="background:var(--white);border:1.5px solid var(--border);border-radius:8px;padding:2px 12px;margin-bottom:10px">
      <div class="toggle-row">
        <span class="label">🧱 Pareti</span>
        <label class="switch"><input type="checkbox" ${loc.incPareti!==false?'checked':''} onchange="${prefix}SetInc(${loc.id},'incPareti',this.checked)"><span class="slider"></span></label>
      </div>
      <div class="divider" style="margin:6px 0"></div>
      <div class="toggle-row">
        <span class="label">⬜ Soffitto</span>
        <label class="switch"><input type="checkbox" ${loc.incSoffitto!==false?'checked':''} onchange="${prefix}SetInc(${loc.id},'incSoffitto',this.checked)"><span class="slider"></span></label>
      </div>
    </div>`:''}` : '';
  // Sezione scelta lavori: freetext (riga libera + chip) oppure checklist (elenco).
  const sezioneSceltaLavori = cfg.lavoriMode==='freetext' ? `
    <div class="add-custom-row" style="margin-top:0">
      <input class="input" id="${prefix}lavnew-${loc.id}" placeholder="${mestiere==='libero'?'Descrivi la voce…':'Scrivi una lavorazione…'}"
        onkeydown="if(event.key==='Enter'){event.preventDefault();${prefix}AddLavoroCustom(${loc.id});}">
      <button class="btn btn-primary btn-sm" onclick="${prefix}AddLavoroCustom(${loc.id})">+ Aggiungi</button>
    </div>
    <div id="${prefix}lavquick-${loc.id}" class="chip-row" style="margin-top:8px"></div>
    ` : `
    <div class="collapse" id="${prefix}lavcol-${loc.id}">
      <div class="collapse-hdr" onclick="toggleCollapse('${prefix}lavcol-${loc.id}')">
        <span>Scegli dall'elenco</span>
        <span class="locale-arrow">▾</span>
      </div>
      <div class="collapse-bdy">
        <div class="check-list" id="${prefix}lavchecks-${loc.id}"></div>
        <div class="add-custom-row">
          <input class="input" id="${prefix}lavnew-${loc.id}" placeholder="Aggiungi voce all'elenco…">
          <button class="btn btn-secondary btn-sm" onclick="${prefix}AddLavoroCustom(${loc.id})">+ Aggiungi</button>
        </div>
      </div>
    </div>
    `;
  return `
    ${sezioneMisure}
    <div class="section-lbl"${mestiereHaSuperficie(mestiere)?'':' style="margin-top:0"'}>Lavori da effettuare</div>
    ${sezioneSceltaLavori}
    <div id="${prefix}lavlist-${loc.id}"></div>

    <div class="section-lbl">Materiali previsti</div>
    <div class="field" style="margin-bottom:0">
      <textarea class="textarea" placeholder="${materialiPh(mestiere)}" rows="2"
        oninput="${prefix}SetMateriali(${loc.id},this.value)">${esc(loc.materiali||'')}</textarea>
    </div>

    ${(condPerLocale && mestiereMostraStato(mestiere))?`
    <div class="section-lbl">${statoCfg(mestiere).titoloLoc}</div>
    <div class="collapse" id="${prefix}condcol-${loc.id}">
      <div class="collapse-hdr" onclick="toggleCollapse('${prefix}condcol-${loc.id}')">
        <span>Condizioni rilevate</span>
        <span class="locale-arrow">▾</span>
      </div>
      <div class="collapse-bdy">
        <div class="check-list" id="${prefix}condchecks-${loc.id}"></div>
      </div>
    </div>
    <div class="field" style="margin-top:8px;margin-bottom:0">
      <textarea class="textarea" placeholder="${statoCfg(mestiere).noteLocPh}" rows="2"
        oninput="${prefix}SetCondNote(${loc.id},this.value)">${esc(loc.condNote||'')}</textarea>
    </div>`:''}

    ${(prefix==='p' && optMdoPerLocale)?`
    <div class="section-lbl">Manodopera locale</div>
    <div class="field" style="margin-bottom:0">
      <label class="label">Prezzo manodopera (€)</label>
      <input class="input" type="number" inputmode="decimal" min="0" step="1" value="${loc.mdoLocale||''}" placeholder="0"
        oninput="pSetMdoLocale(${loc.id},this.value)">
    </div>`:''}`;
}

// ── MISURE ──
function sSetMisura(id,field,val){ setMisuraGeneric('s',sLocali,id,field,val); }
function pSetMisura(id,field,val){ setMisuraGeneric('p',locali,id,field,val); }
function setMisuraGeneric(prefix,arr,id,field,val){
  const loc=arr.find(l=>l.id===id); if(!loc) return;
  loc[field]=parseFloat(val)||0;
  const mqEl=document.getElementById(prefix+'mq-'+id);
  if(mqEl) mqEl.textContent=supLoc(loc).toFixed(1)+' m²';
  const sub=document.getElementById(prefix+'hdr-sub-'+id);
  if(sub) sub.textContent = subLocale(loc, true);
  aggSupTotGeneric(prefix, arr, prefix==='s'?'sSupTotVal':'pSupTotVal');
  if(prefix==='p') ricalcola();
}

// ── INCLUDI PARETI / SOFFITTO (imbianchino) ──
function sSetInc(id,field,val){ setIncGeneric('s',sLocali,id,field,val); }
function pSetInc(id,field,val){ setIncGeneric('p',locali,id,field,val); }
function setIncGeneric(prefix,arr,id,field,val){
  const loc=arr.find(l=>l.id===id); if(!loc) return;
  loc[field]=val;
  const mqEl=document.getElementById(prefix+'mq-'+id);
  if(mqEl) mqEl.textContent=supLoc(loc).toFixed(1)+' m²';
  const sub=document.getElementById(prefix+'hdr-sub-'+id);
  if(sub) sub.textContent = subLocale(loc, true);
  aggSupTotGeneric(prefix, arr, prefix==='s'?'sSupTotVal':'pSupTotVal');
}

// ── MATERIALI ──
function sSetMateriali(id,val){ const l=sLocali.find(x=>x.id===id); if(l) l.materiali=val; }
function pSetMateriali(id,val){ const l=locali.find(x=>x.id===id); if(l) l.materiali=val; }

// ── MANODOPERA PER LOCALE (preventivo) ──
function pSetMdoLocale(id,val){
  const l=locali.find(x=>x.id===id); if(!l) return;
  l.mdoLocale=parseFloat(val)||0;
  ricalcola();
}

// ── LAVORI: render + toggle + custom ──
function renderLavoriList(prefix,id){
  const arr = prefix==='s' ? sLocali : locali;
  const loc=arr.find(l=>l.id===id); if(!loc) return;
  const checks=document.getElementById(prefix+'lavchecks-'+id);
  if(checks){
    const lista=lavoriList(mestiere);
    checks.innerHTML=lista.map(n=>`
      <label class="check-item${loc.lavori.includes(n)?' on':''}">
        <input type="checkbox" ${loc.lavori.includes(n)?'checked':''} onchange="${prefix}ToggleLavoro(${id},'${escJs(n)}')">
        <span>${esc(n)}</span>
      </label>`).join('');
  }
  // Mestieri freetext: scorciatoie (suggerite + già digitate) non ancora selezionate
  const quick=document.getElementById(prefix+'lavquick-'+id);
  if(quick){
    const base=[...(cfgMestiere(mestiere).suggeriti||[]), ...(lavoriCustom[mestiere]||[])];
    const usati=[...new Set(base)].filter(n=>!loc.lavori.includes(n));
    quick.innerHTML=usati.map(n=>`<button class="chip-add" onclick="${prefix}ToggleLavoro(${id},'${escJs(n)}')">+ ${esc(n)}</button>`).join('');
  }
  const list=document.getElementById(prefix+'lavlist-'+id);
  if(list){
    if(!loc.lavori.length){
      list.innerHTML='';
    } else if(prefix==='s' && cfgMestiere(mestiere).quantita){
      // sopralluogo CON quantità (elettricista/idraulico/libero): conta i pezzi sul posto
      list.innerHTML=`<div style="margin-top:8px">${loc.lavori.map(n=>`
        <div class="lavoro-rowq">
          <div class="lavoro-rowq-top">
            <span class="lavoro-nome">${esc(n)}</span>
            <button class="btn-danger" onclick="sToggleLavoro(${id},'${escJs(n)}')">✕</button>
          </div>
          <div class="lavoro-rowq-bot">
            <span class="qlbl">Quantità</span>
            <div class="qstep">
              <button type="button" class="qstep-btn" onclick="sStepQta(${id},'${escJs(n)}',-1)">−</button>
              <input class="qbox qbox-step" type="number" inputmode="numeric" min="1" step="1"
                value="${qtaOf(loc,n)}" oninput="sSetLavoroQta(${id},'${escJs(n)}',this.value)">
              <button type="button" class="qstep-btn" onclick="sStepQta(${id},'${escJs(n)}',1)">+</button>
            </div>
          </div>
        </div>`).join('')}</div>`;
    } else if(prefix==='s'){
      list.innerHTML=`<div class="chip-row">${loc.lavori.map(n=>`
        <span class="chip">${esc(n)}<button onclick="sToggleLavoro(${id},'${escJs(n)}')">✕</button></span>`).join('')}</div>`;
    } else if(cfgMestiere(mestiere).quantita){
      // preventivo CON quantità: Q.tà (con −/+) × Prezzo = Totale
      list.innerHTML=`<div style="margin-top:8px">${loc.lavori.map((n,idx)=>`
        <div class="lavoro-rowq">
          <div class="lavoro-rowq-top">
            <span class="lavoro-nome">${esc(n)}</span>
            <button class="btn-danger" onclick="pToggleLavoro(${id},'${escJs(n)}')">✕</button>
          </div>
          <div class="lavoro-rowq-bot">
            <div class="qstep">
              <button type="button" class="qstep-btn" onclick="pStepQta(${id},'${escJs(n)}',-1)">−</button>
              <input class="qbox qbox-step" type="number" inputmode="numeric" min="1" step="1"
                value="${qtaOf(loc,n)}" oninput="pSetLavoroQta(${id},'${escJs(n)}',this.value)">
              <button type="button" class="qstep-btn" onclick="pStepQta(${id},'${escJs(n)}',1)">+</button>
            </div>
            <span class="qmul">×</span>
            <input class="qbox" type="number" inputmode="decimal" min="0" step="0.01" placeholder="€"
              value="${loc.lavoriPrezzi?.[n]||''}"
              oninput="pSetLavoroPrezzo(${id},'${escJs(n)}',this.value)">
            <span class="qeq">=</span>
            <span class="qtot" id="prigatot-${id}-${idx}">€${(qtaOf(loc,n)*((loc.lavoriPrezzi?.[n])||0)).toFixed(2)}</span>
          </div>
        </div>`).join('')}</div>`;
    } else {
      // preventivo: ogni lavoro con prezzo
      list.innerHTML=`<div style="margin-top:8px">${loc.lavori.map(n=>`
        <div class="lavoro-row">
          <span class="lavoro-nome">${esc(n)}</span>
          <input class="input" type="number" inputmode="decimal" min="0" step="0.01" placeholder="€"
            value="${loc.lavoriPrezzi?.[n]||''}"
            oninput="pSetLavoroPrezzo(${id},'${escJs(n)}',this.value)">
          <button class="btn-danger" onclick="pToggleLavoro(${id},'${escJs(n)}')">✕</button>
        </div>`).join('')}</div>`;
    }
  }
}

function sToggleLavoro(id,nome){ toggleLavoroGeneric('s',sLocali,id,nome); }
function pToggleLavoro(id,nome){ toggleLavoroGeneric('p',locali,id,nome); }
function toggleLavoroGeneric(prefix,arr,id,nome){
  const loc=arr.find(l=>l.id===id); if(!loc) return;
  const i=loc.lavori.indexOf(nome);
  if(i>=0){
    loc.lavori.splice(i,1);
    if(loc.lavoriPrezzi) delete loc.lavoriPrezzi[nome];
    if(loc.lavoriQta) delete loc.lavoriQta[nome];
  } else {
    loc.lavori.push(nome);
  }
  renderLavoriList(prefix,id);
  // aggiorna sottotitolo header
  const sub=document.getElementById(prefix+'hdr-sub-'+id);
  if(sub) sub.textContent = subLocale(loc, true);
  if(prefix==='p'){
    const th=document.getElementById('phdr-tot-'+id);
    if(th) th.textContent='€'+pCalcoloTotLoc(loc).toFixed(2);
    ricalcola();
  }
}

function pSetLavoroPrezzo(id,nome,val){
  const loc=locali.find(l=>l.id===id); if(!loc) return;
  if(!loc.lavoriPrezzi) loc.lavoriPrezzi={};
  loc.lavoriPrezzi[nome]=parseFloat(val)||0;
  aggiornaRigaTot(id,loc,nome);
  const th=document.getElementById('phdr-tot-'+id);
  if(th) th.textContent='€'+pCalcoloTotLoc(loc).toFixed(2);
  ricalcola();
}
// Quantità di una voce (solo mestieri con quantità). Vuoto/non valido ⇒ chiave
// rimossa, così qtaOf() ritorna 1 di default.
function pSetLavoroQta(id,nome,val){
  const loc=locali.find(l=>l.id===id); if(!loc) return;
  if(!loc.lavoriQta) loc.lavoriQta={};
  const t=(val==null?'':String(val)).trim();
  const n=parseFloat(t);
  if(t===''||!Number.isFinite(n)) delete loc.lavoriQta[nome];
  else loc.lavoriQta[nome]=n;
  aggiornaRigaTot(id,loc,nome);
  const th=document.getElementById('phdr-tot-'+id);
  if(th) th.textContent='€'+pCalcoloTotLoc(loc).toFixed(2);
  ricalcola();
}
// Stepper −/+ quantità (preventivo). Minimo 1.
function pStepQta(id,nome,delta){
  const loc=locali.find(l=>l.id===id); if(!loc) return;
  if(!loc.lavoriQta) loc.lavoriQta={};
  loc.lavoriQta[nome]=Math.max(1, Math.round(qtaOf(loc,nome)+delta));
  renderLavoriList('p',id);
  const th=document.getElementById('phdr-tot-'+id);
  if(th) th.textContent='€'+pCalcoloTotLoc(loc).toFixed(2);
  ricalcola();
}
// Quantità nel sopralluogo (solo mestieri con quantità): conteggio pezzi.
function sSetLavoroQta(id,nome,val){
  const loc=sLocali.find(l=>l.id===id); if(!loc) return;
  if(!loc.lavoriQta) loc.lavoriQta={};
  const t=(val==null?'':String(val)).trim();
  const n=parseFloat(t);
  if(t===''||!Number.isFinite(n)) delete loc.lavoriQta[nome];
  else loc.lavoriQta[nome]=n;
}
function sStepQta(id,nome,delta){
  const loc=sLocali.find(l=>l.id===id); if(!loc) return;
  if(!loc.lavoriQta) loc.lavoriQta={};
  loc.lavoriQta[nome]=Math.max(1, Math.round(qtaOf(loc,nome)+delta));
  renderLavoriList('s',id);
}

function sAddLavoroCustom(id){
  const inp=document.getElementById('slavnew-'+id);
  const nome=(inp.value||'').trim(); if(!nome) return;
  addLavoroCustom(mestiere,nome);
  const loc=sLocali.find(l=>l.id===id);
  if(loc && !loc.lavori.includes(nome)) loc.lavori.push(nome);
  inp.value='';
  renderLavoriList('s',id);
  const sub=document.getElementById('shdr-sub-'+id);
  if(sub) sub.textContent=subLocale(loc,true);
}
function pAddLavoroCustom(id){
  const inp=document.getElementById('plavnew-'+id);
  const nome=(inp.value||'').trim(); if(!nome) return;
  addLavoroCustom(mestiere,nome);
  const loc=locali.find(l=>l.id===id);
  if(loc && !loc.lavori.includes(nome)) loc.lavori.push(nome);
  inp.value='';
  renderLavoriList('p',id);
  const sub=document.getElementById('phdr-sub-'+id);
  if(sub) sub.textContent=subLocale(loc,true);
  ricalcola();
}

// ── CONDIZIONI PER LOCALE ──
function sSetCondNote(id,val){ const l=sLocali.find(x=>x.id===id); if(l) l.condNote=val; }
function pSetCondNote(id,val){ const l=locali.find(x=>x.id===id); if(l) l.condNote=val; }

function renderCondLocale(prefix,id){
  const arr = prefix==='s' ? sLocali : locali;
  const loc=arr.find(l=>l.id===id); if(!loc) return;
  const c=document.getElementById(prefix+'condchecks-'+id);
  if(!c) return;
  if(condUsaChip(mestiere)){
    c.innerHTML=`<div class="chip-row">${statoOpzioni(mestiere).map(cnd=>`
      <button type="button" class="cond-chip${(loc.condizioni||[]).includes(cnd)?' on':''}" onclick="${prefix}ToggleCondLocale(${id},'${cnd.replace(/'/g,"\\'")}')">${cnd}</button>`).join('')}</div>`;
  } else {
    c.innerHTML=statoOpzioni(mestiere).map(cnd=>`
      <label class="check-item${(loc.condizioni||[]).includes(cnd)?' on':''}">
        <input type="checkbox" ${(loc.condizioni||[]).includes(cnd)?'checked':''} onchange="${prefix}ToggleCondLocale(${id},'${cnd.replace(/'/g,"\\'")}')">
        <span>${cnd}</span>
      </label>`).join('');
  }
}
function sToggleCondLocale(id,val){ toggleCondLocaleGeneric('s',sLocali,id,val); }
function pToggleCondLocale(id,val){ toggleCondLocaleGeneric('p',locali,id,val); }
function toggleCondLocaleGeneric(prefix,arr,id,val){
  const loc=arr.find(l=>l.id===id); if(!loc) return;
  if(!loc.condizioni) loc.condizioni=[];
  const i=loc.condizioni.indexOf(val);
  if(i>=0) loc.condizioni.splice(i,1); else loc.condizioni.push(val);
  renderCondLocale(prefix,id);
}

// ── PREZZO TOTALE LOCALE (preventivo) ──
function pCalcoloTotLoc(loc){
  const lav=sommaLavoriLoc(loc);
  const mdo=optMdoPerLocale?(loc.mdoLocale||0):0;
  return lav+mdo;
}

// ══════════════════════════════════════════════════════════
//  OPZIONI PREVENTIVO (toggle manodopera/condizioni per locale)
// ══════════════════════════════════════════════════════════
function onOptMdoChange(){
  optMdoPerLocale=document.getElementById('optMdoPerLocale').checked;
  document.getElementById('pMdoGenCard').style.display = optMdoPerLocale ? 'none' : '';
  pRenderLocali();
  ricalcola();
}
function onOptCondChange(){
  optCondPerLocale=document.getElementById('optCondPerLocale').checked;
  aggiornaVisibilitaStato();
  pRenderLocali();
  sRenderLocali();
}

// ══════════════════════════════════════════════════════════
//  CALCOLI / RICALCOLA (preventivo)
// ══════════════════════════════════════════════════════════
function ricalcola(){
  const subLav=locali.reduce((s,l)=>s+sommaLavoriLoc(l),0);
  let mdo;
  if(optMdoPerLocale){
    mdo=locali.reduce((s,l)=>s+(l.mdoLocale||0),0);
  } else {
    mdo=parseFloat(document.getElementById('mdoGenerale').value)||0;
  }
  const sub=subLav+mdo;
  const sp=parseFloat(document.getElementById('sconto').value)||0;
  const sv=sub*sp/100;
  const imp=sub-sv;
  const ip=parseFloat(document.getElementById('iva').value)||0;
  const iv=imp*ip/100;
  const tot=imp+iv;
  document.getElementById('tLav').textContent=fmt(subLav);
  document.getElementById('tMdo').textContent=fmt(mdo);
  document.getElementById('tSco').textContent='— '+fmt(sv);
  document.getElementById('tIva').textContent=fmt(iv);
  document.getElementById('tFin').textContent=fmt(tot);
  autoSalva();
}

// ══════════════════════════════════════════════════════════
//  RESET FORM
// ══════════════════════════════════════════════════════════
function sResetForm(skipConfirm){
  if(!skipConfirm && !confirm('Azzerare tutti i dati del sopralluogo?')) return;
  sEditId=null; sLocali=[]; sLocCnt=0; sCondizioni=[]; sTipoStruttura='Appartamento';
  ['sNome','sCognome','sTel','sEmail','sIndirizzo','sNote','sCondNote'].forEach(id=>{const e=document.getElementById(id); if(e) e.value='';});
  document.getElementById('sopNum').textContent=sNextNum();
  renderTipoStruttura('s', sTipoStruttura, 'sSetTipo');
  renderCondGenerali('s');
  aggiornaVisibilitaStato();
  sRenderLocali();
}

function resetForm(skipConfirm){
  if(!skipConfirm && !confirm('Azzerare tutti i dati del preventivo?')) return;
  clearTimeout(_autoSalvaTimer); // annulla un eventuale auto-salvataggio in coda
  editId=null; locali=[]; locCnt=0; condizioni=[]; pTipoStruttura='Appartamento';
  currentStato='bozza';
  optMdoPerLocale=false; optCondPerLocale=false;
  ['clNome','clCognome','clTel','clEmail','clIndirizzo','mdoGenerale','sconto','nNote','pCondNote'].forEach(id=>{const e=document.getElementById(id); if(e) e.value='';});
  document.getElementById('iva').value='22';
  document.getElementById('nVal').value='30';
  document.getElementById('optMdoPerLocale').checked=false;
  document.getElementById('optCondPerLocale').checked=false;
  document.getElementById('pMdoGenCard').style.display='';
  aggiornaVisibilitaStato();
  document.getElementById('prevNum').textContent=nextNum();
  renderTipoStruttura('p', pTipoStruttura, 'pSetTipo');
  renderCondGenerali('p');
  pRenderLocali();
  ricalcola();
}

// ══════════════════════════════════════════════════════════
//  SALVA SOPRALLUOGO
// ══════════════════════════════════════════════════════════
function sSalva(ev){
  const nome=document.getElementById('sNome').value;
  if(!nome){alert('Inserisci il nome del cliente.');return;}
  // Preserva lo stato "convertito" se il sopralluogo era gia' stato convertito:
  // in precedenza sSalva sovrascriveva con convertito:false, facendo riapparire
  // il sopralluogo nella lista "da preventivare".
  const existing = sEditId ? sopralluoghi.find(s=>s.id===sEditId) : null;
  const d={
    id: sEditId||Date.now(),
    numero: document.getElementById('sopNum').textContent,
    data: existing?.data || new Date().toLocaleDateString('it-IT'),
    dataISO: existing?.dataISO || new Date().toISOString(),
    mestiere: mestiere,
    tipoStruttura: sTipoStruttura,
    cliente:{nome,cognome:document.getElementById('sCognome').value,tel:document.getElementById('sTel').value,email:document.getElementById('sEmail').value,indirizzo:document.getElementById('sIndirizzo').value},
    locali: sLocali.map(l=>({...l,lavori:[...l.lavori],lavoriQta:{...(l.lavoriQta||{})},condizioni:[...(l.condizioni||[])]})),
    supTot: sLocali.reduce((s,l)=>s+supLoc(l),0),
    condizioniGen: sCondizioni.slice(),
    condNoteGen: document.getElementById('sCondNote').value,
    condPerLocale: optCondPerLocale,
    note: document.getElementById('sNote').value,
    convertito: existing ? !!existing.convertito : false
  };
  const i=sopralluoghi.findIndex(s=>s.id===d.id);
  if(i>=0) sopralluoghi[i]=d; else sopralluoghi.push(d);
  Store.saveSopralluoghi(sopralluoghi);
  sEditId=d.id;
  const btn=ev&&ev.target?ev.target.closest('button'):null;
  if(btn){const orig=btn.textContent; btn.textContent='✓ Salvato!'; setTimeout(()=>{btn.textContent=orig;},2000);}
}

function apriSopralluogo(id){
  const s=sopralluoghi.find(s=>String(s.id)===String(id)); if(!s) return;
  sEditId=s.id;
  if(s.mestiere) setMestiere(s.mestiere, true);
  goPage('sopralluogo');
  document.getElementById('sopNum').textContent=s.numero;
  document.getElementById('sNome').value=s.cliente?.nome||'';
  document.getElementById('sCognome').value=s.cliente?.cognome||'';
  document.getElementById('sTel').value=s.cliente?.tel||'';
  document.getElementById('sEmail').value=s.cliente?.email||'';
  document.getElementById('sIndirizzo').value=s.cliente?.indirizzo||'';
  sTipoStruttura=s.tipoStruttura||'Appartamento';
  renderTipoStruttura('s', sTipoStruttura, 'sSetTipo');
  // Copia completa: include lavoriQta e lavoriPrezzi (prima venivano persi al riaprire).
  sLocali=(s.locali||[]).map(l=>({
    ...l,
    lavori:[...(l.lavori||[])],
    lavoriPrezzi:{...(l.lavoriPrezzi||{})},
    lavoriQta:{...(l.lavoriQta||{})},
    condizioni:[...(l.condizioni||[])]
  }));
  sLocCnt=sLocali.length?Math.max(...sLocali.map(l=>l.id))+1:0;
  sCondizioni=(s.condizioniGen||[]).slice();
  document.getElementById('sCondNote').value=s.condNoteGen||'';
  // Ripristina l'opzione "condizioni per locale" (prima dimenticata: la card
  // generale restava visibile anche se il sopralluogo era salvato per-locale).
  optCondPerLocale=!!s.condPerLocale;
  const occ=document.getElementById('optCondPerLocale'); if(occ) occ.checked=optCondPerLocale;
  aggiornaVisibilitaStato();
  renderCondGenerali('s');
  sRenderLocali();
  document.getElementById('sNote').value=s.note||'';
}

function eliminaSopralluogo(id){
  if(!confirm('Eliminare questo sopralluogo?'))return;
  sopralluoghi=sopralluoghi.filter(s=>String(s.id)!==String(id));
  Store.saveSopralluoghi(sopralluoghi);
  // Come in elimina(): se era aperto nell'editor, azzera il form per non
  // ricrearlo al prossimo "Salva".
  if(String(id)===String(sEditId)) sResetForm(true);
  aggStats();
}

// ══════════════════════════════════════════════════════════
//  CONVERTI SOPRALLUOGO → PREVENTIVO
// ══════════════════════════════════════════════════════════
function sConvertiInPreventivo(){
  const nome=document.getElementById('sNome').value;
  if(!nome){alert('Inserisci almeno il nome del cliente prima di procedere.');return;}
  // assicura salvataggio prima della conversione
  const _esist = sEditId ? sopralluoghi.find(s=>s.id===sEditId) : null;
  const d={
    id: sEditId||Date.now(),
    numero: document.getElementById('sopNum').textContent,
    data: _esist?.data || new Date().toLocaleDateString('it-IT'),
    dataISO: _esist?.dataISO || new Date().toISOString(),
    mestiere: mestiere,
    tipoStruttura: sTipoStruttura,
    cliente:{nome,cognome:document.getElementById('sCognome').value,tel:document.getElementById('sTel').value,email:document.getElementById('sEmail').value,indirizzo:document.getElementById('sIndirizzo').value},
    locali: sLocali.map(l=>({...l,lavori:[...l.lavori],lavoriQta:{...(l.lavoriQta||{})},condizioni:[...(l.condizioni||[])]})),
    supTot: sLocali.reduce((s,l)=>s+supLoc(l),0),
    condizioniGen: sCondizioni.slice(),
    condNoteGen: document.getElementById('sCondNote').value,
    condPerLocale: optCondPerLocale,
    note: document.getElementById('sNote').value,
    convertito:true
  };
  const i=sopralluoghi.findIndex(s=>s.id===d.id);
  if(i>=0) sopralluoghi[i]=d; else sopralluoghi.push(d);
  Store.saveSopralluoghi(sopralluoghi);

  // popola preventivo
  editId=null;
  currentStato='bozza';
  // Reset completo delle opzioni preventivo (prima optMdoPerLocale non veniva
  // resettato: la manodopera generale restava ignorata anche se la card era visibile).
  optMdoPerLocale=false;
  optCondPerLocale=false;
  document.getElementById('optMdoPerLocale').checked=false;
  document.getElementById('optCondPerLocale').checked=false;
  document.getElementById('pMdoGenCard').style.display='';
  goPage('nuovo');
  document.getElementById('prevNum').textContent=nextNum();
  document.getElementById('clNome').value=d.cliente.nome;
  document.getElementById('clCognome').value=d.cliente.cognome;
  document.getElementById('clTel').value=d.cliente.tel;
  document.getElementById('clEmail').value=d.cliente.email;
  document.getElementById('clIndirizzo').value=d.cliente.indirizzo;
  pTipoStruttura=d.tipoStruttura;
  renderTipoStruttura('p', pTipoStruttura, 'pSetTipo');
  locali=d.locali.map(l=>({...l, lavoriPrezzi:{}, lavoriQta:{...(l.lavoriQta||{})}, mdoLocale:0}));
  locCnt=locali.length?Math.max(...locali.map(l=>l.id))+1:0;
  condizioni=(d.condizioniGen||[]).slice();
  document.getElementById('pCondNote').value=d.condNoteGen||'';
  optCondPerLocale=!!d.condPerLocale;
  document.getElementById('optCondPerLocale').checked=optCondPerLocale;
  aggiornaVisibilitaStato();
  renderCondGenerali('p');
  pRenderLocali();
  document.getElementById('nNote').value=d.note||'';
  document.getElementById('mdoGenerale').value='';
  document.getElementById('sconto').value='';
  document.getElementById('iva').value='22';
  document.getElementById('nVal').value='30';
  ricalcola();
  window.scrollTo(0,0);
}

function renderSopList(){
  const c=document.getElementById('sopList');
  const pending=sopralluoghi.filter(s=>!s.convertito).sort((a,b)=>b.id-a.id);
  const archiviati=sopralluoghi.filter(s=>s.convertito).sort((a,b)=>b.id-a.id);
  let html='';
  if(!pending.length){
    html+=`<div style="background:var(--white);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;font-size:13px;color:var(--sub);text-align:center">Nessun sopralluogo in attesa</div>`;
  } else {
    html+=pending.map(s=>`
    <div class="prev-item">
      <div class="prev-item-top">
        <div>
          <div class="prev-item-name">${mestiereIcona(s.mestiere)} ${esc(s.cliente?.nome||'')} ${esc(s.cliente?.cognome||'')}</div>
          <div class="prev-item-num">${esc(s.numero)} · ${esc(s.data)}${mestiereHaSuperficie(s.mestiere)?` · ${(s.supTot||0).toFixed(1)} m²`:''}</div>
        </div>
        <span class="badge badge-blue">Da preventivare</span>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="apriSopralluogo('${s.id}')">✏️ Modifica</button>
        <button class="btn btn-sm" style="background:var(--red-lt);color:var(--red);border:none" onclick="eliminaSopralluogo('${s.id}')">✕</button>
      </div>
    </div>`).join('');
  }
  // Sezione "gia' preventivati": prima erano invisibili (filter !s.convertito).
  if(archiviati.length){
    html+=`<div class="section-lbl" style="margin-top:14px">Gia' preventivati</div>`;
    html+=archiviati.map(s=>`
    <div class="prev-item" style="opacity:.75">
      <div class="prev-item-top">
        <div>
          <div class="prev-item-name">${mestiereIcona(s.mestiere)} ${esc(s.cliente?.nome||'')} ${esc(s.cliente?.cognome||'')}</div>
          <div class="prev-item-num">${esc(s.numero)} · ${esc(s.data)}${mestiereHaSuperficie(s.mestiere)?` · ${(s.supTot||0).toFixed(1)} m²`:''}</div>
        </div>
        <span class="badge badge-green">Convertito</span>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="apriSopralluogo('${s.id}')">✏️ Modifica</button>
        <button class="btn btn-sm" style="background:var(--red-lt);color:var(--red);border:none" onclick="eliminaSopralluogo('${s.id}')">✕</button>
      </div>
    </div>`).join('');
  }
  c.innerHTML=html;
}

// ══════════════════════════════════════════════════════════
//  GET DATI (preventivo) / SALVA / APRI
// ══════════════════════════════════════════════════════════
function getDati(){
  const _esist = editId ? preventivi.find(p=>String(p.id)===String(editId)) : null;
  return {
    id: editId||Date.now(),
    numero: document.getElementById('prevNum').textContent,
    data: _esist?.data || new Date().toLocaleDateString('it-IT'),
    dataISO: _esist?.dataISO || new Date().toISOString(),
    stato: currentStato,
    mestiere: mestiere,
    tipoStruttura: pTipoStruttura,
    cliente:{
      nome:document.getElementById('clNome').value,
      cognome:document.getElementById('clCognome').value,
      tel:document.getElementById('clTel').value,
      email:document.getElementById('clEmail').value,
      indirizzo:document.getElementById('clIndirizzo').value,
    },
    locali: locali.map(l=>({...l, lavori:[...l.lavori], lavoriPrezzi:{...(l.lavoriPrezzi||{})}, lavoriQta:{...(l.lavoriQta||{})}, condizioni:[...(l.condizioni||[])]})),
    supTot: locali.reduce((s,l)=>s+supLoc(l),0),
    optMdoPerLocale, optCondPerLocale,
    mdoGenerale: parseFloat(document.getElementById('mdoGenerale').value)||0,
    sconto:parseFloat(document.getElementById('sconto').value)||0,
    iva:(()=>{const v=parseFloat(document.getElementById('iva').value);return Number.isFinite(v)?v:22;})(),
    condizioniGen: condizioni.slice(),
    condNoteGen: document.getElementById('pCondNote').value,
    note:{libere:document.getElementById('nNote').value},
    validita:document.getElementById('nVal').value,
    totale:(()=>{
      const _subLav=locali.reduce((s,l)=>s+sommaLavoriLoc(l),0);
      const _mdo=optMdoPerLocale?locali.reduce((s,l)=>s+(l.mdoLocale||0),0):(parseFloat(document.getElementById('mdoGenerale').value)||0);
      const _sconto=parseFloat(document.getElementById('sconto').value)||0;
      const _iva=(()=>{const v=parseFloat(document.getElementById('iva').value);return Number.isFinite(v)?v:22;})();
      const _sub=_subLav+_mdo;
      const _imp=_sub-(_sub*_sconto/100);
      return _imp+(_imp*_iva/100);
    })()
  };
}

function salvaBozza(ev){
  const d=getDati();
  if(!d.cliente.nome){alert('Inserisci il nome del cliente.');return;}
  const i=preventivi.findIndex(p=>p.id===d.id);
  if(i>=0) preventivi[i]=d; else preventivi.push(d);
  Store.savePreventivi(preventivi);
  editId=d.id;
  const btn=ev&&ev.target?ev.target.closest('button'):null;
  if(btn){const orig=btn.textContent; btn.textContent='✓ Salvato!'; setTimeout(()=>btn.textContent=orig,2000);}
}

function apriPrev(id){
  const p=preventivi.find(p=>String(p.id)===String(id)); if(!p) return;
  editId=p.id;
  currentStato=p.stato||'bozza';
  if(p.mestiere) setMestiere(p.mestiere, true);
  goPage('nuovo');
  document.getElementById('prevNum').textContent=p.numero;
  document.getElementById('clNome').value=p.cliente?.nome||'';
  document.getElementById('clCognome').value=p.cliente?.cognome||'';
  document.getElementById('clTel').value=p.cliente?.tel||'';
  document.getElementById('clEmail').value=p.cliente?.email||'';
  document.getElementById('clIndirizzo').value=p.cliente?.indirizzo||'';
  pTipoStruttura=p.tipoStruttura||'Appartamento';
  renderTipoStruttura('p', pTipoStruttura, 'pSetTipo');
  optMdoPerLocale=!!p.optMdoPerLocale;
  optCondPerLocale=!!p.optCondPerLocale;
  document.getElementById('optMdoPerLocale').checked=optMdoPerLocale;
  document.getElementById('optCondPerLocale').checked=optCondPerLocale;
  document.getElementById('pMdoGenCard').style.display = optMdoPerLocale ? 'none' : '';
  aggiornaVisibilitaStato();
  locali=(p.locali||[]).map(l=>({...l, lavori:[...(l.lavori||[])], lavoriPrezzi:{...(l.lavoriPrezzi||{})}, lavoriQta:{...(l.lavoriQta||{})}, condizioni:[...(l.condizioni||[])]}));
  locCnt=locali.length?Math.max(...locali.map(l=>l.id))+1:0;
  condizioni=(p.condizioniGen||[]).slice();
  document.getElementById('pCondNote').value=p.condNoteGen||'';
  renderCondGenerali('p');
  pRenderLocali();
  document.getElementById('mdoGenerale').value=p.mdoGenerale||'';
  document.getElementById('sconto').value=p.sconto||'';
  document.getElementById('iva').value=p.iva||22;
  document.getElementById('nNote').value=p.note?.libere||'';
  document.getElementById('nVal').value=p.validita||30;
  ricalcola();
}

function pdfById(id){
  apriPrev(id);
  esportaPDF();
}

// ══════════════════════════════════════════════════════════
//  MODAL PDF — sistema unificato senza window.open()
// ══════════════════════════════════════════════════════════
let _pdfOpen = false;
function apriPdfModal(htmlContenuto, titolo){
  document.getElementById('pdfModalContent').innerHTML = htmlContenuto;
  document.getElementById('pdfModalTitolo').textContent = titolo;
  const m = document.getElementById('pdfModal');
  m.style.display = 'block';
  m.scrollTop = 0;
  document.body.style.overflow = 'hidden';
  if(!_pdfOpen){
    _pdfOpen = true;
    // Aggiunge una voce nella cronologia: così il tasto "Indietro" del telefono
    // (o lo swipe) CHIUDE il documento e torna all'app invece di uscire dalla PWA.
    try{ history.pushState({pdfModal:true}, ''); }catch(e){}
  }
}
function chiudiPdfModal(){
  const m = document.getElementById('pdfModal');
  m.style.display = 'none';
  document.body.style.overflow = '';
  if(_pdfOpen){
    _pdfOpen = false;
    if(history.state && history.state.pdfModal){ try{ history.back(); }catch(e){} }
  }
}
// Tasto Indietro / swipe del telefono → chiude il documento restando nell'app
window.addEventListener('popstate', function(){
  if(_pdfOpen){
    _pdfOpen = false;
    const m = document.getElementById('pdfModal');
    if(m) m.style.display = 'none';
    document.body.style.overflow = '';
  }
});
// Tasto ESC (utile da desktop)
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape'){
    if(_pdfOpen) chiudiPdfModal();
    else if(document.getElementById('modalBg').style.display === 'block') chiudiAnteprima();
  }
});
// Stampa / salva PDF tramite iframe isolato: il documento dell'app NON viene
// mai sostituito, quindi al termine si torna sempre all'app (niente blocchi su iOS).
function stampaPDF(){
  try{
    const content = document.getElementById('pdfModalContent').innerHTML;
    const titolo  = (document.getElementById('pdfModalTitolo').textContent || 'Documento').replace(/[<>]/g,'');
    const css = '@page{size:A4;margin:14mm}'
      + '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + 'html,body{margin:0;background:#fff}'
      + 'body{font-family:-apple-system,Arial,sans-serif;font-size:12px;line-height:1.45;color:#111827}'
      + 'table{width:100%;border-collapse:collapse}'
      + 'thead{display:table-header-group}'
      + 'tr,.no-break,.firme{page-break-inside:avoid}'
      + 'img{max-width:100%;page-break-inside:avoid}';
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden','true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>'+titolo+'</title><style>'+css+'</style></head><body>'+content+'</body></html>');
    doc.close();
    const cleanup = ()=>{ try{ iframe.remove(); }catch(e){} };
    setTimeout(function(){
      try{
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }catch(e){
        window.print(); // fallback: usa le regole @media print della pagina
      }
      setTimeout(cleanup, 2000);
    }, 350);
  }catch(e){
    window.print();
  }
}
function apriAnteprima(){
  const d=getDati();
  document.getElementById('anteprimaContent').innerHTML=buildAntHTML(d);
  document.getElementById('modalBg').style.display='block';
}
function chiudiAnteprima(){document.getElementById('modalBg').style.display='none';}
function apriPdfPreventivo(){ chiudiAnteprima(); esportaPDF(); }

function buildAntHTML(d){
  const locs=d.locali||[];
  const mdoTot = d.optMdoPerLocale ? locs.reduce((s,l)=>s+(l.mdoLocale||0),0) : (d.mdoGenerale||0);
  const subLav=locs.reduce((s,l)=>s+sommaLavoriLoc(l,d.mestiere),0);
  const sub=subLav+mdoTot;
  const sv=sub*(d.sconto||0)/100;
  const imp=sub-sv;
  const ivaPerc=Number.isFinite(+d.iva)?+d.iva:22;
  const iv=imp*ivaPerc/100;
  const tot=imp+iv;
  // parseInt con guard: se validita non e' un numero valido, fallback a 30 giorni.
  const valGiorni = parseInt(d.validita);
  const scad=new Date(d.dataISO); scad.setDate(scad.getDate()+(Number.isFinite(valGiorni)?valGiorni:30));

  const righeLocali = locs.map(loc=>{
    const conQta=cfgMestiere(d.mestiere).quantita;
    const lavRows=(loc.lavori||[]).map(n=>{
      const prezzo=(loc.lavoriPrezzi||{})[n]||0;
      const qta=qtaOf(loc,n);
      const rigaTot=conQta?qta*prezzo:prezzo;
      const desc=conQta?`${esc(n)} <span style="color:#6B7280;font-size:.85em;white-space:nowrap">×${(+qta.toFixed(2))}${prezzo>0?` @ €${prezzo.toFixed(2)}`:''}</span>`:esc(n);
      return `<tr>
        <td style="padding:.5em .6em;border-bottom:1px solid #E4E7EC">${desc}</td>
        <td style="padding:.5em .6em;border-bottom:1px solid #E4E7EC;text-align:right;white-space:nowrap">${rigaTot>0?'€'+rigaTot.toFixed(2):''}</td>
      </tr>`;
    }).join('');
    const mdoRow = d.optMdoPerLocale && (loc.mdoLocale||0)>0 ? `<tr>
        <td style="padding:.5em .6em;border-bottom:1px solid #E4E7EC;font-style:italic;color:#6B7280">Manodopera</td>
        <td style="padding:.5em .6em;border-bottom:1px solid #E4E7EC;text-align:right;font-weight:700;white-space:nowrap">€${(loc.mdoLocale||0).toFixed(2)}</td>
      </tr>` : '';
    const _condLoc = (loc.condizioni||[]).filter(c=>statoOpzioni(d.mestiere).includes(c));
    const condTxt = mestiereMostraStato(d.mestiere) && d.optCondPerLocale && (_condLoc.length || loc.condNote) ?
      `<div style="font-size:.8em;color:#9CA3AF;margin-top:.3em">Stato: ${[..._condLoc,esc(loc.condNote)].filter(Boolean).join(' · ')}</div>` : '';
    return `
      <tr style="background:#F3F4F6" class="no-break">
        <td colspan="2" style="padding:.5em .6em;font-weight:700;color:#111827">
          ${esc(loc.nome)}${mestiereHaSuperficie(d.mestiere)?` <span style="font-weight:400;color:#6B7280">(${supLoc(loc).toFixed(1)} m²)</span>`:''}
        </td>
      </tr>
      ${lavRows || mdoRow ? lavRows+mdoRow : `<tr><td colspan="2" style="padding:.4em .6em;color:#9CA3AF;font-style:italic">Nessuna lavorazione con prezzo</td></tr>`}
      ${loc.materiali?`<tr><td colspan="2" style="padding:.3em .6em;font-size:.85em;color:#6B7280">Materiali: ${esc(loc.materiali)}${condTxt}</td></tr>`:(condTxt?`<tr><td colspan="2" style="padding:.3em .6em">${condTxt}</td></tr>`:'')}
    `;
  }).join('');

  const tabellaLavori = `
    ${d.tipoStruttura?`<div style="font-size:.85em;color:#6B7280;margin-bottom:.6em">Tipo struttura: <strong style="color:#111827">${esc(d.tipoStruttura)}</strong></div>`:''}
    <div style="font-size:.75em;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;margin-bottom:.4em">Dettaglio lavori per ambiente</div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#111827;color:#fff">
        <th style="padding:.5em .6em;text-align:left;font-size:.85em">Descrizione</th>
        <th style="padding:.5em .6em;text-align:right;font-size:.85em;white-space:nowrap">Prezzo</th>
      </tr></thead>
      <tbody>
        ${righeLocali}
        ${!d.optMdoPerLocale && mdoTot>0?`<tr style="background:#F7F8FA"><td style="padding:.5em .6em;border-bottom:1px solid #E4E7EC;font-style:italic;color:#6B7280">Manodopera</td><td style="padding:.5em .6em;border-bottom:1px solid #E4E7EC;text-align:right;font-weight:700;white-space:nowrap">€${mdoTot.toFixed(2)}</td></tr>`:''}
      </tbody>
    </table>
    ${d.supTot>0?`<div style="font-size:.85em;color:#6B7280;margin-bottom:1em">Superficie ${d.mestiere==='imbianchino'?'da imbiancare':'totale'}: <strong style="color:#111827">${d.supTot.toFixed(1)} m²</strong></div>`:''}`;

  const _condGen = (d.condizioniGen||[]).filter(c=>statoOpzioni(d.mestiere).includes(c));
  const condGenTxt = mestiereMostraStato(d.mestiere) && !d.optCondPerLocale && (_condGen.length || d.condNoteGen) ?
    `<div style="background:#F7F8FA;border-radius:8px;padding:.8em;margin-bottom:1em" class="no-break">
      <div style="font-size:.75em;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;margin-bottom:.4em">Condizioni rilevate</div>
      ${_condGen.length?`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:.4em">${_condGen.map(c=>`<span style="background:#E5E7EB;border-radius:20px;padding:2px 10px;font-size:.85em;font-weight:500">${esc(c)}</span>`).join('')}</div>`:''}
      ${d.condNoteGen?`<div style="font-size:.9em">${esc(d.condNoteGen)}</div>`:''}
    </div>` : '';

  return `<div style="font-family:-apple-system,Arial,sans-serif">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1em;padding-bottom:1em;border-bottom:2px solid #111827" class="no-break">
      ${intestazionePDF('preventivo')}
      <div style="text-align:right;font-size:.85em;color:#6B7280;flex-shrink:0;margin-left:1em">
        <div style="font-weight:700;color:#111827;font-size:1em;white-space:nowrap">${esc(numDoc(d.numero))}</div>
        <div>${esc(d.data)}</div>
        <div>Scade: ${esc(scad.toLocaleDateString('it-IT'))}</div>
      </div>
    </div>

    <div style="background:#F7F8FA;border-radius:8px;padding:.8em;margin-bottom:1em;border-left:3px solid #2563EB" class="no-break">
      <div style="font-weight:700;font-size:1.05em">${esc(d.cliente?.nome||'')} ${esc(d.cliente?.cognome||'')}</div>
      <div style="font-size:.875em;color:#6B7280">${esc(d.cliente?.indirizzo||'')}</div>
      <div style="font-size:.875em;color:#6B7280">${[d.cliente?.tel,d.cliente?.email].filter(Boolean).map(esc).join(' · ')}</div>
    </div>

    ${tabellaLavori}
    ${condGenTxt}

    <div style="background:#111827;border-radius:8px;padding:1em;margin-bottom:1em" class="no-break">
      ${subLav>0?`<div style="display:flex;justify-content:space-between;color:rgba(255,255,255,.6);font-size:.9em;padding:.2em 0"><span>Subtotale lavori</span><span>€${subLav.toFixed(2)}</span></div>`:''}
      ${mdoTot>0?`<div style="display:flex;justify-content:space-between;color:rgba(255,255,255,.6);font-size:.9em;padding:.2em 0"><span>Manodopera</span><span>€${mdoTot.toFixed(2)}</span></div>`:''}
      ${d.sconto>0?`<div style="display:flex;justify-content:space-between;color:rgba(255,255,255,.6);font-size:.9em;padding:.2em 0"><span>Sconto ${d.sconto}%</span><span>— €${sv.toFixed(2)}</span></div>`:''}
      <div style="display:flex;justify-content:space-between;color:rgba(255,255,255,.6);font-size:.9em;padding:.2em 0"><span>IVA ${ivaPerc}%</span><span>€${iv.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;color:#fff;font-size:1.2em;font-weight:700;border-top:1px solid rgba(255,255,255,.2);margin-top:.6em;padding-top:.6em"><span>TOTALE</span><span style="color:#60A5FA">€${tot.toFixed(2)}</span></div>
    </div>

    ${d.note?.libere?`<div style="background:#F7F8FA;border-radius:8px;padding:.8em;margin-bottom:1em;font-size:.9em;color:#374151" class="no-break"><strong style="font-size:.8em;text-transform:uppercase;letter-spacing:.5px;color:#6B7280">Note</strong><div style="margin-top:.3em">${esc(d.note.libere)}</div></div>`:''}

    <div class="firme no-break" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:1.5em">
      <div style="border-top:1px solid #111827;padding-top:.4em;font-size:.8em;color:#6B7280;text-align:center">Firma cliente</div>
      <div style="border-top:1px solid #111827;padding-top:.4em;font-size:.8em;color:#6B7280;text-align:center">Firma impresa</div>
    </div>
    <div style="margin-top:1em;padding-top:.6em;border-top:1px solid #E4E7EC;font-size:.75em;color:#9CA3AF">
      ${esc(numDoc(d.numero))} · ${esc(d.data)}
    </div>
  </div>`;
}

function esportaPDF(){
  // Auto-salva prima di aprire il PDF
  const d=getDati();
  if(d.cliente.nome){
    const i=preventivi.findIndex(p=>p.id===d.id);
    if(i>=0) preventivi[i]=d; else preventivi.push(d);
    Store.savePreventivi(preventivi);
    editId=d.id;
  }
  const cliente=`${d.cliente?.nome||''} ${d.cliente?.cognome||''}`.trim();
  apriPdfModal(buildAntHTML(d), `Preventivo – ${cliente}`);
}

// ══════════════════════════════════════════════════════════
//  PDF — SOPRALLUOGO
// ══════════════════════════════════════════════════════════
function sBuildAntHTML(d){
  const locs=d.locali||[];

  const righeLocali = locs.map(loc=>{
    const _q=cfgMestiere(d.mestiere).quantita;
    const lavTxt=(loc.lavori||[]).map(n=>_q?`${esc(n)} ×${(+qtaOf(loc,n).toFixed(2))}`:esc(n)).join(', ')||'—';
    const _condLoc = (loc.condizioni||[]).filter(c=>statoOpzioni(d.mestiere).includes(c));
    const condTxt = (mestiereMostraStato(d.mestiere) && d.condPerLocale) ? [..._condLoc,esc(loc.condNote)].filter(Boolean).join(' · ') : '';
    return `<tr style="background:#F3F4F6">
        <td colspan="2" style="padding:6px 8px;font-weight:700;color:#111827">
          ${esc(loc.nome)}${mestiereHaSuperficie(d.mestiere)?` <span style="font-weight:400;color:#6B7280">(${supLoc(loc).toFixed(1)} m² · L${loc.lung}×W${loc.larg}×H${loc.h})</span>`:''}
        </td>
      </tr>
      <tr><td style="padding:6px 8px;border-bottom:1px solid #E4E7EC;font-size:12px;color:#6B7280">Lavori</td><td style="padding:6px 8px;border-bottom:1px solid #E4E7EC;font-size:12px">${lavTxt}</td></tr>
      ${loc.materiali?`<tr><td style="padding:6px 8px;border-bottom:1px solid #E4E7EC;font-size:12px;color:#6B7280">Materiali</td><td style="padding:6px 8px;border-bottom:1px solid #E4E7EC;font-size:12px">${esc(loc.materiali)}</td></tr>`:''}
      ${condTxt?`<tr><td style="padding:6px 8px;border-bottom:1px solid #E4E7EC;font-size:12px;color:#6B7280">Condizioni</td><td style="padding:6px 8px;border-bottom:1px solid #E4E7EC;font-size:12px">${condTxt}</td></tr>`:''}
    `;
  }).join('');

  const _condGen = (d.condizioniGen||[]).filter(c=>statoOpzioni(d.mestiere).includes(c));
  const condGenTxt = mestiereMostraStato(d.mestiere) && !d.condPerLocale && (_condGen.length || d.condNoteGen) ?
    `<div style="background:#F7F8FA;border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;color:#374151">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;margin-bottom:6px">Condizioni rilevate</div>
      ${_condGen.length?`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px">${_condGen.map(c=>`<span style="background:#E5E7EB;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:500">${esc(c)}</span>`).join('')}</div>`:''}
      ${d.condNoteGen?`<div>${esc(d.condNoteGen)}</div>`:''}
    </div>` : '';

  return `<div style="font-family:-apple-system,sans-serif;font-size:14px">
    <div style="display:flex;justify-content:space-between;margin-bottom:16px;padding-bottom:16px;border-bottom:2px solid #111827">
      ${intestazionePDF('sopralluogo')}
      <div style="text-align:right;font-size:12px;color:#6B7280">
        <div style="font-weight:700;color:#111827;font-size:14px;white-space:nowrap">${esc(numDoc(d.numero))}</div>
        <div>${esc(d.data)}</div>
      </div>
    </div>

    <div style="background:#F7F8FA;border-radius:8px;padding:12px;margin-bottom:14px;border-left:3px solid #2563EB">
      <div style="font-weight:700">${esc(d.cliente?.nome||'')} ${esc(d.cliente?.cognome||'')}</div>
      <div style="font-size:12px;color:#6B7280">${esc(d.cliente?.indirizzo||'')}</div>
      <div style="font-size:12px;color:#6B7280">${[d.cliente?.tel,d.cliente?.email].filter(Boolean).map(esc).join(' · ')}</div>
    </div>

    ${d.tipoStruttura?`<div style="font-size:12px;color:#6B7280;margin-bottom:10px">Tipo struttura: <strong style="color:#111827">${esc(d.tipoStruttura)}</strong></div>`:''}

    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;margin-bottom:6px">Ambienti rilevati</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:14px">
      <tbody>${righeLocali}</tbody>
    </table>
    ${d.supTot>0?`<div style="font-size:12px;color:#6B7280;margin-bottom:14px">Superficie ${d.mestiere==='imbianchino'?'da imbiancare':'totale'}: <strong style="color:#111827">${d.supTot.toFixed(1)} m²</strong></div>`:''}

    ${condGenTxt}

    ${d.note?`<div style="background:#F7F8FA;border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;color:#374151"><strong style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#6B7280">Note generali</strong><br><span style="margin-top:4px;display:block">${esc(d.note)}</span></div>`:''}

    <div style="margin-top:16px;padding-top:10px;border-top:1px solid #E4E7EC;display:flex;justify-content:space-between;font-size:11px;color:#9CA3AF">
      <span>${esc(numDoc(d.numero))} · ${esc(d.data)}</span>
    </div>
  </div>`;
}

function sEsportaPDF(){
  const nome=document.getElementById('sNome').value;
  if(!nome){alert('Inserisci il nome del cliente.');return;}
  // Preserva lo stato "convertito" (come in sSalva).
  const existing = sEditId ? sopralluoghi.find(s=>s.id===sEditId) : null;
  const d={
    id: sEditId||Date.now(),
    numero: document.getElementById('sopNum').textContent,
    data: existing?.data || new Date().toLocaleDateString('it-IT'),
    dataISO: existing?.dataISO || new Date().toISOString(),
    mestiere: mestiere,
    tipoStruttura: sTipoStruttura,
    cliente:{nome,cognome:document.getElementById('sCognome').value,tel:document.getElementById('sTel').value,email:document.getElementById('sEmail').value,indirizzo:document.getElementById('sIndirizzo').value},
    locali: sLocali.map(l=>({...l,lavori:[...l.lavori],lavoriQta:{...(l.lavoriQta||{})},condizioni:[...(l.condizioni||[])]})),
    supTot: sLocali.reduce((s,l)=>s+supLoc(l),0),
    condizioniGen: sCondizioni.slice(),
    condNoteGen: document.getElementById('sCondNote').value,
    condPerLocale: optCondPerLocale,
    note: document.getElementById('sNote').value,
    convertito: existing ? !!existing.convertito : false
  };
  // Auto-salva il sopralluogo prima di aprire il PDF
  const i=sopralluoghi.findIndex(s=>s.id===d.id);
  if(i>=0) sopralluoghi[i]=d; else sopralluoghi.push(d);
  Store.saveSopralluoghi(sopralluoghi);
  sEditId=d.id;

  const cliente=`${nome} ${d.cliente.cognome||''}`.trim();
  apriPdfModal(sBuildAntHTML(d), `Sopralluogo – ${cliente}`);
}

// ══════════════════════════════════════════════════════════
//  DASHBOARD / ARCHIVIO
// ══════════════════════════════════════════════════════════
function aggStats(){
  document.getElementById('s1').textContent=preventivi.length;
  document.getElementById('s2').textContent=preventivi.filter(p=>p.stato==='accettato').length;
  document.getElementById('s3').textContent=preventivi.filter(p=>!p.stato||p.stato==='bozza'||p.stato==='inviato').length;
  const s5=document.getElementById('s5'); if(s5) s5.textContent=preventivi.filter(p=>p.stato==='rifiutato').length;
  const valAcc=preventivi.filter(p=>p.stato==='accettato').reduce((s,p)=>s+(p.totale||0),0);
  document.getElementById('s4').textContent='€'+valAcc.toLocaleString('it-IT',{maximumFractionDigits:0});
  renderSopList();
  const sorted=[...preventivi].sort((a,b)=>b.id-a.id).slice(0,5);
  const c=document.getElementById('dashList');
  if(!sorted.length){
    c.innerHTML=`<div class="empty"><div class="empty-icon">📄</div><p>Nessun preventivo ancora.</p></div>`;
  } else {
    c.innerHTML=sorted.map(p=>prevItemHTML(p,true)).join('');
  }
}

function renderLista(){
  const c=document.getElementById('listaContent');
  if(!preventivi.length){
    c.innerHTML=`<div class="empty"><div class="empty-icon">📋</div><p>Nessun preventivo salvato.</p></div>`;
    return;
  }
  const sorted=[...preventivi].sort((a,b)=>b.id-a.id);
  c.innerHTML=sorted.map(p=>prevItemHTML(p,false)).join('');
}

function prevItemHTML(p,compact){
  const statoColors={bozza:'badge-gray',inviato:'badge-blue',accettato:'badge-green',rifiutato:'badge-red'};
  const statoStyle={
    bozza:'background:#F3F4F6;color:#374151;border-color:#E5E7EB',
    inviato:'background:var(--accent-lt);color:var(--accent);border-color:var(--accent)',
    accettato:'background:var(--green-lt);color:var(--green);border-color:var(--green)',
    rifiutato:'background:var(--red-lt);color:var(--red);border-color:var(--red)'
  };
  const azioni=compact?'':`<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;align-items:center">
    <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();apriPrev('${p.id}')">✏️ Modifica</button>
    <button class="btn btn-success btn-sm" onclick="event.stopPropagation();pdfById('${p.id}')">⬇ PDF</button>
    <label style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--sub);font-weight:600">Stato:
      <select class="status-select" style="${statoStyle[p.stato||'bozza']}" onclick="event.stopPropagation()" onchange="cambiaStato('${p.id}',this.value)">
        <option value="bozza" ${p.stato==='bozza'?'selected':''}>📝 Bozza</option>
        <option value="inviato" ${p.stato==='inviato'?'selected':''}>📤 Inviato</option>
        <option value="accettato" ${p.stato==='accettato'?'selected':''}>✅ Accettato</option>
        <option value="rifiutato" ${p.stato==='rifiutato'?'selected':''}>❌ Rifiutato</option>
      </select>
    </label>
    <button class="btn btn-sm" style="background:var(--red-lt);color:var(--red);border:none" onclick="event.stopPropagation();elimina('${p.id}')">✕</button>
  </div>`;
  return `<div class="prev-item" role="button" tabindex="0" onclick="${compact?`apriPrev('${p.id}')`:''}">
    <div class="prev-item-top">
      <div>
        <div class="prev-item-name">${mestiereIcona(p.mestiere)} ${esc(p.cliente?.nome||'')} ${esc(p.cliente?.cognome||'')}</div>
        <div class="prev-item-num">${esc(p.numero)} · ${esc(p.data)}</div>
      </div>
      <span class="badge ${statoColors[p.stato]||'badge-gray'}">${esc(p.stato||'bozza')}</span>
    </div>
    <div class="prev-item-bottom">
      <span class="prev-item-tot">€${(p.totale||0).toLocaleString('it-IT',{minimumFractionDigits:2})}</span>
      <span class="prev-item-info">${esc(p.cliente?.indirizzo||'')}</span>
    </div>
    ${azioni}
  </div>`;
}

function cambiaStato(id,stato){
  const p=preventivi.find(p=>String(p.id)===String(id));
  if(p){p.stato=stato; if(String(p.id)===String(editId)) currentStato=stato; Store.savePreventivi(preventivi);aggStats();}
}

function elimina(id){
  if(!confirm('Eliminare questo preventivo?'))return;
  preventivi=preventivi.filter(p=>String(p.id)!==String(id));
  Store.savePreventivi(preventivi);
  // Se era il preventivo aperto nell'editor, azzera anche il form: altrimenti
  // l'auto-salvataggio lo farebbe "risorgere" al prossimo tocco su un campo.
  if(String(id)===String(editId)) resetForm(true);
  renderLista(); aggStats();
}

// ══════════════════════════════════════════════════════════
//  BACKUP DATI (export / import JSON)
// ══════════════════════════════════════════════════════════
function esportaBackup(){
  const backup={
    versione: 1,
    esportato: new Date().toISOString(),
    impresa: impresa,
    mestiere: mestiere,
    lavoriCustom: lavoriCustom,
    preventivi: preventivi,
    sopralluoghi: sopralluoghi
  };
  try{
    const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    const oggi=new Date().toISOString().slice(0,10);
    a.download=`facile-preventivo-backup-${oggi}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    const msg=document.getElementById('backupMsg');
    if(msg){ msg.textContent='✓ Backup esportato'; msg.style.color='var(--green)'; setTimeout(()=>{msg.textContent='';},3000); }
  }catch(e){
    const msg=document.getElementById('backupMsg');
    if(msg){ msg.textContent='✕ Errore: '+e.message; msg.style.color='var(--red)'; }
  }
}

function importaBackup(file){
  if(!file) return;
  if(!confirm('L\'importazione sostituira tutti i dati attuali. Continuare?')) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);
      if(!data || typeof data!=='object') throw new Error('Formato non valido');
      if(Array.isArray(data.preventivi)) preventivi=data.preventivi;
      if(Array.isArray(data.sopralluoghi)) sopralluoghi=data.sopralluoghi;
      if(data.impresa && typeof data.impresa==='object') impresa=data.impresa;
      if(typeof data.mestiere==='string' && MESTIERI[data.mestiere]) mestiere=data.mestiere;
      if(data.lavoriCustom && typeof data.lavoriCustom==='object') lavoriCustom=data.lavoriCustom;
      Store.savePreventivi(preventivi);
      Store.saveSopralluoghi(sopralluoghi);
      Store.saveImpresa(impresa);
      Store.setMestiere(mestiere);
      Store.saveLavoriCustom(lavoriCustom);
      const msg=document.getElementById('backupMsg');
      if(msg){ msg.textContent='✓ Backup ripristinato'; msg.style.color='var(--green)'; setTimeout(()=>{msg.textContent='';},3000); }
      caricaImpresa();
      applyMestiereUI();
      aggStats();
      if(document.getElementById('page-lista').classList.contains('active')) renderLista();
    }catch(e){
      const msg=document.getElementById('backupMsg');
      if(msg){ msg.textContent='✕ File non valido: '+e.message; msg.style.color='var(--red)'; }
    }
  };
  reader.readAsText(file);
}

// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded',()=>{
  renderMestiereSelector();
  applyMestiereUI();
  resetForm(true);
  sResetForm(true);
  aggStats();
  caricaImpresa();
  // PWA — registra service worker e gestisce gli aggiornamenti
  if('serviceWorker' in navigator){
    let _reloading=false;
    navigator.serviceWorker.register('sw.js').then(reg=>{
      // se c'è già una nuova versione in attesa, attivala
      if(reg.waiting) reg.waiting.postMessage('skipWaiting');
      reg.addEventListener('updatefound',()=>{
        const nw=reg.installing;
        if(!nw) return;
        nw.addEventListener('statechange',()=>{
          if(nw.state==='installed' && navigator.serviceWorker.controller){
            nw.postMessage('skipWaiting');
          }
        });
      });
    }).catch(()=>{});
    // quando il nuovo SW prende il controllo, ricarica una sola volta
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(_reloading) return; _reloading=true; location.reload();
    });
  }
});
