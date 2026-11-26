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
  ['btnAccedi','btnCrea','btnGoogle','btnVerOk','btnVerResend'].forEach(i=>{ const el=_authEl(i); if(el) el.disabled = on; });
}
function _authMsg(t, ok){
  const e=_authEl('authError'); if(!e) return;
  e.textContent = t || '';
  e.style.color = ok ? 'var(--green)' : '';
}
function mostraGate(){ const g=_authEl('authGate'); if(g) g.style.display='flex'; }
function mostraApp(){ const g=_authEl('authGate'); if(g) g.style.display='none'; }
// Cancello in modalità "conferma email": account creato ma link non cliccato.
function mostraVerifica(email){
  mostraGate();
  const f=_authEl('authForm');     if(f) f.style.display='none';
  const v=_authEl('authVerifica'); if(v) v.style.display='block';
  const t=_authEl('verificaEmail');if(t) t.textContent=email||'';
  _authBusy(false);
}
function mostraFormAccesso(){
  const f=_authEl('authForm');     if(f) f.style.display='';
  const v=_authEl('authVerifica'); if(v) v.style.display='none';
}
// L'utente ha cliccato il link? Ricontrolla lo stato sul server.
function verificaControlla(){
  if(typeof firebase==='undefined' || !firebase.auth) return;
  const u=firebase.auth().currentUser; if(!u) return;
  _authMsg(''); _authBusy(true);
  u.reload().then(function(){
    _authBusy(false);
    const u2=firebase.auth().currentUser;
    if(u2 && u2.emailVerified){ location.reload(); }
    else _authMsg('Email non ancora confermata: apri il link che ti abbiamo inviato (guarda anche nello spam).');
  }).catch(function(){ _authBusy(false); _authMsg('Controllo non riuscito: verifica la connessione e riprova.'); });
}
function verificaReinvia(){
  if(typeof firebase==='undefined' || !firebase.auth) return;
  const u=firebase.auth().currentUser; if(!u) return;
  _authMsg(''); _authBusy(true);
  u.sendEmailVerification().then(function(){
    _authBusy(false);
    _authMsg('📧 Email inviata di nuovo a '+(u.email||'')+'.', true);
  }).catch(function(e){
    _authBusy(false);
    _authMsg(e && e.code==='auth/too-many-requests' ? 'Hai richiesto troppe email: aspetta qualche minuto e riprova.' : 'Invio non riuscito, riprova tra poco.');
  });
}

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
    'auth/operation-not-allowed':'Metodo di accesso non abilitato nel progetto Firebase.',
    'auth/unauthorized-domain':'Dominio del sito non autorizzato. In Firebase Console: Authentication → Settings → Authorized domains → aggiungi il dominio di questa pagina.',
    'auth/missing-email':'Inserisci la tua email.',
    'auth/user-disabled':'Questo account è stato disabilitato.'
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
    .then(function(cred){
      _justCreated = true;
      // Verifica email obbligatoria: senza il link confermato l'app non si apre
      // (evita email inventate e account usa-e-getta per aggirare il piano gratuito)
      try{ if(cred && cred.user) cred.user.sendEmailVerification(); }catch(e){}
    })
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
function recuperaPassword(){
  if(typeof firebase==='undefined' || !firebase.auth) return;
  const email=(_authEl('authEmail').value||'').trim();
  if(!email){ _authMsg('Scrivi la tua email nel campo qui sopra, poi tocca di nuovo "Password dimenticata?".'); return; }
  _authMsg(''); _authBusy(true);
  firebase.auth().sendPasswordResetEmail(email)
    .then(function(){ _authBusy(false); _authMsg('📧 Email inviata a '+email+': apri il link per reimpostare la password.', true); })
    .catch(_authErrore);
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

// ══════════════════════════════════════════════════════════
//  ISOLAMENTO DATI PER ACCOUNT (stesso dispositivo)
//  I dati locali appartengono a UN account (mv_uid). Se accede un account
//  diverso, i dati del precedente vengono messi da parte sul dispositivo
//  (mv_saved_<uid>, NIENTE viene perso) e ripristinati al suo ritorno;
//  il nuovo account parte pulito e carica il SUO cloud. Senza questo, un
//  nuovo account "ereditava" i preventivi locali dell'account precedente
//  e la sync li copiava pure sul suo cloud.
// ══════════════════════════════════════════════════════════
function preparaDatiPerUtente(uid){
  if(typeof localStorage==='undefined' || !uid) return;
  const attuale = localStorage.getItem('mv_uid') || '';
  if(attuale === uid) return;
  const KEYS_DATI = ['mv_prev','mv_impresa','mv_listino','mv_del','mv_mod','mv_stat','mv_abbo'];
  if(attuale){
    // metti da parte i dati dell'account precedente (restano sul dispositivo)
    const stash={};
    KEYS_DATI.forEach(k=>{ const v=localStorage.getItem(k); if(v!=null) stash[k]=v; });
    try{ localStorage.setItem('mv_saved_'+attuale, JSON.stringify(stash)); }catch(e){}
    KEYS_DATI.forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });
  }
  // (se attuale era vuoto: primo login su questo dispositivo → i dati locali
  //  creati senza account vengono adottati da questo account, come sempre)

  // ripristina eventuali dati messi da parte per QUESTO account
  const salvatiRaw = localStorage.getItem('mv_saved_'+uid);
  if(salvatiRaw){
    try{
      const salvati=JSON.parse(salvatiRaw);
      Object.keys(salvati).forEach(k=>{ try{ localStorage.setItem(k, salvati[k]); }catch(e){} });
    }catch(e){}
    try{ localStorage.removeItem('mv_saved_'+uid); }catch(e){}
  }
  try{ localStorage.setItem('mv_uid', uid); }catch(e){}

  // ricarica lo stato in memoria dai dati (eventualmente nuovi) e azzera i
  // form: potevano contenere bozze dell'altro account
  preventivi   = Store.loadPreventivi();
  impresa      = Store.loadImpresa();
  wzNuovo();
  aggStats();
  caricaImpresa();
  Abbo.aggiornaCard();
  const pl=document.getElementById('page-lista');
  if(pl && pl.classList.contains('active')) renderLista();
}

(function initAuth(){
  if(typeof firebase==='undefined' || !firebase.auth){
    mostraApp(); // Firebase non disponibile → app in modalità locale (come prima)
    avviaGuidaPrimoUso();
    return;
  }
  try{ firebase.initializeApp(firebaseConfig); }catch(e){}
  firebase.auth().onAuthStateChanged(function(user){
    currentUser = user;
    _authBusy(false);
    // Account email/password non ancora verificato → schermata di conferma,
    // niente app e niente sincronizzazione finché il link non è cliccato.
    if(user && !user.emailVerified &&
       (user.providerData||[]).some(function(p){ return p && p.providerId==='password'; })){
      mostraVerifica(user.email);
      return;
    }
    if(user){
      const ae=_authEl('accountEmail');
      if(ae) ae.textContent = user.email || ((user.providerData[0]||{}).email) || 'account Google';
      mostraApp();
      if(_justCreated){
        _justCreated = false;
        setTimeout(function(){ alert('✅ Account creato con successo!\nBenvenuto in Facile Preventivo.'); }, 300);
      }
      // Isolamento per account: se e' entrato un account diverso, i dati
      // locali del precedente vengono messi da parte PRIMA di sincronizzare.
      preparaDatiPerUtente(user.uid);
      // Fase 3: dati dell'account sul cloud (se le regole Firestore sono pubblicate)
      Sync.avvia();
      avviaGuidaPrimoUso();
    }else{
      Sync.spegni();
      mostraFormAccesso();
      mostraGate();
    }
  });
})();

const PAGE_TITLES={nuovo:'Nuovo',lista:'Preventivi',impostazioni:'Impresa'};

// ══════════════════════════════════════════════════════════
//  NAVIGAZIONE
// ══════════════════════════════════════════════════════════
function goPage(name) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('.tab-item').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+name)?.classList.add('active');
  document.getElementById('pageTitle').textContent= name==='nuovo' && typeof wzStep!=='undefined' && wzStep ? 'Preventivo' : (PAGE_TITLES[name]||'');
  if(name!=='nuovo'){ wzChiudiScheda(true); const t=document.getElementById('wzToast'); if(t) t.style.display='none'; }
  if(name==='lista') renderLista();
  if(name==='nuovo') wzRender();
  if(name==='impostazioni') caricaImpresa();
  window.scrollTo(0,0);
}
function nuovoPreventivo(){ wzNuovo(); goPage('nuovo'); }
// Tab "Nuovo": dalla pagina iniziale (le due scelte). Il preventivo aperto è già salvato.
function tabNuovo(){
  const aperto=document.getElementById('page-nuovo').classList.contains('active');
  if(typeof wzStep==='undefined' || !wzStep || aperto){ if(typeof wzSalvaOra==='function') wzSalvaOra(); wzNuovo(); }
  goPage('nuovo');
}
function apriPrev(id){ if(wzApri(id)) goPage('nuovo'); }
function pdfById(id){
  const p=preventivi.find(x=>String(x.id)===String(id)); if(!p) return;
  if(p.v!==2){ alert('Questo preventivo è della vecchia versione dell\'app: non si può più stampare.'); return; }
  apriPdfModal(buildPdfPrev(p), 'Preventivo '+numDoc(p.numero));
}

// ── Utility ──
// ══════════════════════════════════════════════════════════
//  STORE — unico punto di accesso ai dati (il "cassetto dei dati")
//  Oggi i dati stanno nella memoria del telefono (localStorage).
//  Domani, per account + database online, basterà cambiare QUI dentro:
//  il resto dell'app non sa né dove né come i dati sono salvati.
// ══════════════════════════════════════════════════════════
const Store = {
  KEYS: { prev:'mv_prev', impresa:'mv_impresa', listino:'mv_listino', del:'mv_del', mod:'mv_mod', guida:'mv_guida' },

  // -- uso interno: leggi un valore JSON in modo sicuro (se corrotto, usa il fallback) --
  _read(key, fallback){
    if(typeof localStorage==='undefined') return fallback;
    const raw=localStorage.getItem(key);
    if(raw==null) return fallback;
    try{ const v=JSON.parse(raw); return v==null ? fallback : v; }
    catch(e){ console.warn('Dato non valido in memoria per', key); return fallback; }
  },
  // -- uso interno: leggi una stringa semplice non-JSON --
  _readRaw(key, fallback){
    if(typeof localStorage==='undefined') return fallback;
    const v=localStorage.getItem(key);
    return v==null ? fallback : v;
  },
  // -- uso interno: scrivi un valore (avvisa se la memoria è piena) --
  // Ogni scrittura aggiorna il "timestamp di modifica locale" (per il
  // confronto col cloud) e mette in coda una sincronizzazione.
  _write(key, value){
    try{ localStorage.setItem(key, typeof value==='string' ? value : JSON.stringify(value)); }
    catch(e){
      alert('⚠️ Memoria piena: impossibile salvare.\nElimina qualche vecchio documento dall\'Archivio, poi riprova.');
      return false;
    }
    if(key!==this.KEYS.mod){
      try{ localStorage.setItem(this.KEYS.mod, String(Date.now())); }catch(e){}
      Sync.schedule();
    }
    return true;
  },

  // -- metodi per ciascun tipo di dato: questi li usa il resto dell'app --
  loadPreventivi(){ return this._read(this.KEYS.prev, []); },
  savePreventivi(arr){ return this._write(this.KEYS.prev, arr); },

  loadImpresa(){ return this._read(this.KEYS.impresa, {}); },
  saveImpresa(obj){ return this._write(this.KEYS.impresa, obj); },

  // Listino: gli ultimi prezzi usati per i lavori più comuni (proposti nei nuovi preventivi)
  loadListino(){ const l=this._read(this.KEYS.listino, {}); return (l && typeof l==='object' && !Array.isArray(l)) ? l : {}; },
  saveListino(obj){ return this._write(this.KEYS.listino, obj); },

  // Tombstone delle eliminazioni: senza, la sincronizzazione "risusciterebbe"
  // dal cloud i documenti cancellati su questo dispositivo.
  loadDel(){ const d=this._read(this.KEYS.del, {}); return {prev:(d&&d.prev)||[]}; },
  saveDel(d){ return this._write(this.KEYS.del, d); },
  segnaEliminato(tipo, id){
    const d=this.loadDel();
    d[tipo]=[...(d[tipo]||[]), {id:String(id), ts:Date.now()}].slice(-300);
    this.saveDel(d);
  },

  getMod(){ return parseInt(this._readRaw(this.KEYS.mod,'0'),10)||0; },

  // Guide (tour benvenuto + mini-tour per pagina): viste una volta sola
  // per dispositivo, ciascuna col proprio flag.
  getGuidaVista(chiave){ return this._readRaw(chiave||this.KEYS.guida,'')==='1'; },
  setGuidaVista(chiave){ return this._write(chiave||this.KEYS.guida,'1'); }
};

// ══════════════════════════════════════════════════════════
//  SYNC — dati dell'account sul cloud (Firestore)
//  Locale-first: l'app lavora SEMPRE sul localStorage; il cloud è uno
//  specchio per-utente (users/{uid}/app/dati). Se Firestore non è
//  raggiungibile o le regole non sono ancora pubblicate, tutto continua
//  a funzionare in locale e lo stato è visibile nel menu account.
//  Le regole da pubblicare sono nel file firestore.rules (vedi DA-FARE.md).
// ══════════════════════════════════════════════════════════

// Unione di due elenchi di documenti per id: vince chi ha `mod` più alto
// (a parità vince il locale: è il dispositivo in mano all'utente).
function mergeById(locale, remoto){
  const m=new Map();
  (remoto||[]).forEach(x=>{ if(x && x.id!=null) m.set(String(x.id), x); });
  (locale||[]).forEach(x=>{
    if(!x || x.id==null) return;
    const y=m.get(String(x.id));
    if(!y || (x.mod||0)>=(y.mod||0)) m.set(String(x.id), x);
  });
  return [...m.values()];
}
// Applica i tombstone: un documento eliminato resta eliminato, a meno che
// sia stato modificato DOPO l'eliminazione (mod più recente del tombstone).
function applicaTombstone(arr, dels){
  const m=new Map((dels||[]).map(t=>[String(t.id), t.ts||0]));
  return (arr||[]).filter(x=>{
    const ts=m.get(String(x.id));
    return !(ts!==undefined && ts>=(x.mod||0));
  });
}
// Unione dei tombstone (per id, ts più alto).
function mergeDel(a, b){
  const m=new Map();
  [...(a||[]),...(b||[])].forEach(t=>{
    if(!t || t.id==null) return;
    const y=m.get(String(t.id));
    if(!y || (t.ts||0)>(y.ts||0)) m.set(String(t.id), t);
  });
  return [...m.values()].slice(-300);
}

const Sync = {
  attivo:false, _timer:null, ultimo:null,

  _db(){
    try{ return (typeof firebase!=='undefined' && firebase.firestore) ? firebase.firestore() : null; }
    catch(e){ return null; }
  },
  _ref(){
    const db=this._db();
    if(!db || !currentUser) return null;
    return db.collection('users').doc(currentUser.uid).collection('app').doc('dati');
  },

  _setStato(s){
    const el=document.getElementById('syncStato');
    if(!el) return;
    const testi={
      ok: '☁️ Sincronizzato'+(this.ultimo?(' · '+this.ultimo.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})):''),
      lavoro: '☁️ Sincronizzazione…',
      regole: '⚠️ Cloud non attivo: pubblica le regole Firestore (vedi DA-FARE.md)',
      errore: '⚠️ Errore di sincronizzazione: riprovo al prossimo salvataggio',
      pieno: '⚠️ Dati troppo grandi per il cloud: esporta un backup',
      off: '📴 Solo su questo dispositivo'
    };
    el.textContent = testi[s] || testi.off;
  },

  // Avvio dopo il login: scarica il cloud, unisce, risale l'unione.
  avvia(){
    const ref=this._ref();
    if(!ref){ this.attivo=false; this._setStato('off'); return; }
    this._setStato('lavoro');
    const self=this;
    ref.get().then(function(snap){
      if(snap.exists){
        const dati=snap.data()||{};
        let remoto={};
        try{ remoto=JSON.parse(dati.json||'{}'); }catch(e){ remoto={}; }
        self._unisci(remoto, dati.aggiornato||0);
      }
      self.attivo=true;
      Abbo.refresh(); // stato abbonamento (se il gating è attivo)
      return self._push();
    }).catch(function(e){
      self.attivo=false;
      self._setStato(e && e.code==='permission-denied' ? 'regole' : 'errore');
    });
  },
  spegni(){
    this.attivo=false;
    clearTimeout(this._timer);
    this._setStato('off');
  },

  // Fusione cloud+locale: documenti uniti per id (nessuna perdita),
  // impostazioni con "vince il più recente" tra dispositivo e cloud.
  _unisci(remoto, aggiornatoCloud){
    const del={ prev: mergeDel(Store.loadDel().prev, (remoto.del||{}).prev) };
    preventivi = applicaTombstone(mergeById(preventivi, remoto.prev), del.prev);
    const cloudPiuRecente = (aggiornatoCloud||0) > Store.getMod();
    if(cloudPiuRecente){
      if(remoto.impresa && typeof remoto.impresa==='object') impresa=remoto.impresa;
      if(remoto.listino && typeof remoto.listino==='object') Store.saveListino(remoto.listino);
    }
    // contatore preventivi creati (per il piano gratuito): vale il massimo,
    // così cancellare documenti o cambiare dispositivo non azzera il conteggio
    if(remoto.stat && typeof remoto.stat==='object'){
      const st=Store._read('mv_stat',{prevCreati:0});
      st.prevCreati=Math.max(st.prevCreati||0, remoto.stat.prevCreati||0);
      Store._write('mv_stat', st);
    }
    Store.savePreventivi(preventivi);
    Store.saveImpresa(impresa);
    Store.saveDel(del);
    // aggiorna la UI con i dati fusi
    caricaImpresa();
    aggStats();
    const pl=document.getElementById('page-lista');
    if(pl && pl.classList.contains('active')) renderLista();
  },

  _push(){
    const ref=this._ref();
    if(!ref || !this.attivo) return Promise.resolve();
    const json=JSON.stringify({
      prev:preventivi, impresa, listino:Store.loadListino(),
      del:Store.loadDel(), stat:Store._read('mv_stat',{prevCreati:0})
    });
    if(json.length>900000){ this._setStato('pieno'); return Promise.resolve(); }
    const self=this;
    return ref.set({v:1, aggiornato:Date.now(), json}).then(function(){
      self.ultimo=new Date();
      self._setStato('ok');
    });
  },

  // Chiamata a ogni scrittura dello Store: spinge sul cloud con calma (3s),
  // così una raffica di modifiche diventa un solo salvataggio.
  schedule(){
    if(!this.attivo) return;
    clearTimeout(this._timer);
    const self=this;
    this._timer=setTimeout(function(){
      self._push().catch(function(e){
        self._setStato(e && e.code==='permission-denied' ? 'regole' : 'errore');
      });
    }, 3000);
  },

  // Bottone "Sincronizza ora" nel menu account: se la sync non è mai
  // partita (es. regole appena pubblicate) riprova da capo.
  ora(){
    const m=document.getElementById('accountMenu'); if(m) m.style.display='none';
    if(!this.attivo){ this.avvia(); return; }
    const self=this;
    Abbo.refresh();
    this._setStato('lavoro');
    this._push().catch(function(e){
      self._setStato(e && e.code==='permission-denied' ? 'regole' : 'errore');
    });
  }
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

// ══════════════════════════════════════════════════════════
//  STATO
// ══════════════════════════════════════════════════════════
let preventivi = Store.loadPreventivi();
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

function intestazionePDF(){
  const sottotitolo = 'Preventivo lavori';
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
function fmt(n){return'€ '+n.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}
// Numero documento "pulito" per il PDF (senza emoji iniziale): es. "P–2026/001"
function numDoc(n){ return String(n||'').replace(/^[^\p{L}\p{N}]+/u,'').trim(); }

// ══════════════════════════════════════════════════════════
//  MODAL PDF — sistema unificato senza window.open()
// ══════════════════════════════════════════════════════════
let _pdfOpen = false;
function apriPdfModal(htmlContenuto, titolo){
  _pdfPronto=null;
  const bi=document.getElementById('btnInvia'); if(bi){ bi.disabled=false; bi.textContent='📤 Invia'; }
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
  }
});
// ── INVIA: un PDF vero (html2pdf, caricato solo quando serve) condiviso con
// WhatsApp / email dal menu del telefono. In due tempi: prima si prepara il
// file, poi si condivide (su iPhone la condivisione deve partire da un tocco).
let _pdfPronto=null;
function caricaScript(src){
  return new Promise((ok,ko)=>{
    if([...document.scripts].some(s=>s.src===src)) return ok();
    const s=document.createElement('script'); s.src=src; s.onload=ok; s.onerror=ko; document.head.appendChild(s);
  });
}
function _nomeFilePdf(){
  const t=(document.getElementById('pdfModalTitolo').textContent||'Preventivo').trim();
  const cli=(typeof doc!=='undefined' && doc && doc.cliente && doc.cliente.nome) ? ' '+doc.cliente.nome : '';
  return (t+cli).replace(/[\\/:*?"<>|–]+/g,'-').replace(/\s+/g,' ').trim()+'.pdf';
}
function _condividiPdf(){
  const f=_pdfPronto; if(!f) return Promise.resolve();
  if(navigator.canShare && navigator.canShare({files:[f]})){
    return navigator.share({files:[f], title:f.name}).catch(e=>{ if(e && e.name==='NotAllowedError') throw e; });
  }
  const url=URL.createObjectURL(f), a=document.createElement('a');
  a.href=url; a.download=f.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  return Promise.resolve();
}
function inviaPDF(){
  const btn=document.getElementById('btnInvia');
  const nome=_nomeFilePdf();
  if(_pdfPronto && _pdfPronto.name===nome){
    _condividiPdf().catch(()=>{});
    return;
  }
  if(btn){ btn.disabled=true; btn.textContent='⏳ Preparo…'; }
  const fine=t=>{ if(btn){ btn.disabled=false; btn.textContent=t; } };
  caricaScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js').then(()=>{
    // contenitore fuori schermo; alla libreria si passa il foglio INTERNO, senza
    // posizionamento (altrimenti "fotografa" la zona fuori schermo: pagina bianca)
    const box=document.createElement('div');
    box.style.cssText='position:fixed;left:-10000px;top:0;width:720px;overflow:hidden';
    const foglio=document.createElement('div');
    foglio.style.cssText='-webkit-text-size-adjust:100%;text-size-adjust:100%;padding:0 6px;background:#fff;color:#111827;font-family:-apple-system,Arial,sans-serif;font-size:12px;line-height:1.45';
    foglio.innerHTML=document.getElementById('pdfModalContent').innerHTML;
    box.appendChild(foglio); document.body.appendChild(box);
    const yPrima=window.scrollY||0; try{ window.scrollTo(0,0); }catch(e){}
    const rimetti=()=>{ try{ window.scrollTo(0,yPrima); }catch(e){} };
    return svgInImmagini(foglio).then(()=>html2pdf().set({
      margin:[12,12,14,12], filename:nome,
      image:{type:'jpeg', quality:0.95},
      // scrollX/scrollY a 0: con la pagina scorsa, la "foto" partiva più in basso
      // (fascia bianca in cima e fondo del preventivo tagliato)
      html2canvas:{scale:2, backgroundColor:'#ffffff', scrollX:0, scrollY:0},
      jsPDF:{unit:'mm', format:'a4', orientation:'portrait'},
      pagebreak:{mode:['css','legacy'], avoid:['tr','.no-break','.firme']}
    }).from(foglio).outputPdf('blob')).then(blob=>{
      box.remove(); rimetti();
      _pdfPronto=new File([blob], nome, {type:'application/pdf'});
      fine('📤 Condividi');
      return _condividiPdf().catch(()=>{ /* serve un altro tocco: il bottone ora dice "Condividi" */ });
    }, e=>{ box.remove(); rimetti(); throw e; });
  }).catch(()=>{
    fine('📤 Invia');
    alert('Per creare il PDF da inviare serve internet.\nIn alternativa: Stampa → Salva come PDF.');
  });
}

// I disegni (pianta, infissi) diventano immagini della misura esatta prima della
// "foto" del foglio: su iPhone html2canvas disegnava gli SVG piccoli e fuori posto.
function svgInImmagini(radice){
  const svgs=[...radice.querySelectorAll('svg')];
  return Promise.all(svgs.map(svg=>new Promise(ok=>{
    const r=svg.getBoundingClientRect(), w=Math.max(1,Math.round(r.width)), h=Math.max(1,Math.round(r.height));
    const clone=svg.cloneNode(true);
    clone.setAttribute('width', w); clone.setAttribute('height', h);
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg'); clone.removeAttribute('style');
    const img=new Image();
    img.onload=()=>{
      try{
        const c=document.createElement('canvas'), k=3;
        c.width=w*k; c.height=h*k;
        const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height); g.drawImage(img,0,0,c.width,c.height);
        const out=new Image(); out.src=c.toDataURL('image/png');
        out.style.cssText=`display:block;width:${w}px;height:${h}px;margin:${svg.style.margin||'0'}`;
        out.onload=()=>{ svg.replaceWith(out); ok(); };
        out.onerror=()=>ok();
      }catch(e){ ok(); }
    };
    img.onerror=()=>ok();
    img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(clone));
  })));
}

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
// ══════════════════════════════════════════════════════════
//  DASHBOARD / ARCHIVIO
// ══════════════════════════════════════════════════════════
// Conteggi e filtri dei preventivi (pagina Preventivi). I vecchi non contano.
let filtroStato='tutti';
function aggStats(){
  const pl=document.getElementById('page-lista');
  if(pl && pl.classList.contains('active')) renderLista();
}
function setFiltro(f){ filtroStato=f; renderLista(); }
function renderLista(){
  const c=document.getElementById('listaContent');
  const validi=preventivi.filter(p=>p.v===2);
  const nVecchi=preventivi.length-validi.length;
  const conta=s=>validi.filter(p=>(p.stato||'bozza')===s).length;
  const FILTRI=[['tutti','Tutti',validi.length],['bozza','Bozze',conta('bozza')],['inviato','Inviati',conta('inviato')],['accettato','Accettati',conta('accettato')],['rifiutato','Rifiutati',conta('rifiutato')]];
  if(!FILTRI.some(f=>f[0]===filtroStato)) filtroStato='tutti';
  const scelti=validi.filter(p=>filtroStato==='tutti' || (p.stato||'bozza')===filtroStato).sort((x,y)=>(y.mod||y.id)-(x.mod||x.id));
  const valAcc=validi.filter(p=>p.stato==='accettato').reduce((s,p)=>s+(p.totale||0),0);
  c.innerHTML=
    (validi.length?`<div class="filtri">${FILTRI.filter(f=>f[0]==='tutti'||f[2]).map(f=>`<button class="filtro${filtroStato===f[0]?' on':''}" onclick="setFiltro('${f[0]}')">${f[1]} <b>${f[2]}</b></button>`).join('')}</div>`:'')+
    (filtroStato==='accettato'&&valAcc?`<p class="filtri-nota">Valore accettati: <b>€ ${valAcc.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}</b></p>`:'')+
    (scelti.length ? scelti.map(p=>prevItemHTML(p,false)).join('')
      : `<div class="empty"><div class="empty-icon">📋</div><p>${validi.length?'Nessun preventivo in questo stato.':'Nessun preventivo ancora.<br>Tocca "Nuovo" in basso per iniziare.'}</p></div>`)+
    (nVecchi?`<button class="btn btn-secondary btn-full" style="margin-top:12px;color:var(--red)" onclick="eliminaVecchi()">🗑 Elimina ${nVecchi===1?'il preventivo':'i '+nVecchi+' preventivi'} della vecchia versione</button>`:'');
}

function prevItemHTML(p,compact){
  const statoColors={bozza:'badge-gray',inviato:'badge-blue',accettato:'badge-green',rifiutato:'badge-red'};
  const statoStyle={
    bozza:'background:#F3F4F6;color:#374151;border-color:#E5E7EB',
    inviato:'background:var(--accent-lt);color:var(--accent);border-color:var(--accent)',
    accettato:'background:var(--green-lt);color:var(--green);border-color:var(--green)',
    rifiutato:'background:var(--red-lt);color:var(--red);border-color:var(--red)'
  };
  const id=escJs(p.id);
  const vecchio=p.v!==2;
  const nLoc=(p.locali||[]).length;
  const azioni=compact?'':(vecchio
    ? `<div style="display:flex;gap:6px;margin-top:10px;align-items:center;justify-content:space-between">
        <span style="font-size:12px;color:var(--sub)">Vecchia versione dell'app: non più apribile</span>
        <button class="btn btn-sm" style="background:var(--red-lt);color:var(--red);border:none" onclick="event.stopPropagation();elimina('${id}')">Elimina</button></div>`
    : `<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;align-items:center">
    <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();apriPrev('${id}')">✏️ Modifica</button>
    <button class="btn btn-success btn-sm" onclick="event.stopPropagation();pdfById('${id}')">⬇ PDF</button>
    <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();duplicaPrev('${id}')">⧉ Usa come modello</button>
    <label style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--sub);font-weight:600">Stato:
      <select class="status-select" style="${statoStyle[p.stato||'bozza']||statoStyle.bozza}" onclick="event.stopPropagation()" onchange="cambiaStato('${id}',this.value)">
        <option value="bozza" ${p.stato==='bozza'?'selected':''}>📝 Bozza</option>
        <option value="inviato" ${p.stato==='inviato'?'selected':''}>📤 Inviato</option>
        <option value="accettato" ${p.stato==='accettato'?'selected':''}>✅ Accettato</option>
        <option value="rifiutato" ${p.stato==='rifiutato'?'selected':''}>❌ Rifiutato</option>
      </select>
    </label>
    <button class="btn btn-sm" style="background:var(--red-lt);color:var(--red);border:none" onclick="event.stopPropagation();elimina('${id}')">✕</button>
  </div>`);
  return `<div class="prev-item${vecchio?' prev-vecchio':''}" role="button" tabindex="0" onclick="${!vecchio?`apriPrev('${id}')`:''}">
    <div class="prev-item-top">
      <div>
        <div class="prev-item-name">${esc(p.cliente?.nome||'')||'<span style="color:var(--sub)">Senza nome</span>'} ${esc(p.cliente?.cognome||'')}</div>
        <div class="prev-item-num">${esc(numDoc(p.numero))} · ${esc(p.data||'')}${vecchio?'':` · ${nLoc} ${nLoc===1?'locale':'locali'}`}</div>
      </div>
      <span class="badge ${statoColors[p.stato]||'badge-gray'}">${esc(p.stato||'bozza')}</span>
    </div>
    <div class="prev-item-bottom">
      <span class="prev-item-tot">€${(p.totale||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
      <span class="prev-item-info">${esc(p.cliente?.indirizzo||'')}</span>
    </div>
    ${azioni}
  </div>`;
}

function cambiaStato(id,stato){
  const p=preventivi.find(p=>String(p.id)===String(id));
  if(!p) return;
  p.stato=stato; p.mod=Date.now();
  if(doc && String(doc.id)===String(id)) doc.stato=stato;
  Store.savePreventivi(preventivi); aggStats();
}

// "Usa come modello": stessi locali, lavori e prezzi, cliente da riscrivere.
// Il nuovo preventivo si salva (e conta per il piano gratuito) quando si scrive il nome.
function duplicaPrev(id){
  if(!Abbo.puoCreare()){ Abbo.paywall(); return; }
  if(wzModello(id)) goPage('nuovo');
}

// Preventivi della versione a mestieri: non si aprono più, si eliminano in blocco.
function eliminaVecchi(){
  const vecchi=preventivi.filter(p=>p.v!==2);
  if(!vecchi.length) return;
  if(!confirm(`Eliminare ${vecchi.length} ${vecchi.length===1?'preventivo':'preventivi'} della vecchia versione?\nNon si possono recuperare.`)) return;
  vecchi.forEach(p=>Store.segnaEliminato('prev', p.id));
  preventivi=preventivi.filter(p=>p.v===2);
  Store.savePreventivi(preventivi);
  renderLista(); aggStats();
}
function elimina(id){
  if(!confirm('Eliminare questo preventivo?'))return;
  preventivi=preventivi.filter(p=>String(p.id)!==String(id));
  Store.savePreventivi(preventivi);
  Store.segnaEliminato('prev', id); // per la sync: eliminato anche sul cloud
  // Se era il preventivo aperto, si riparte da uno nuovo: altrimenti
  // l'auto-salvataggio lo farebbe "risorgere" al prossimo tocco.
  if(doc && String(id)===String(doc.id)) wzNuovo();
  renderLista(); aggStats();
}

// ══════════════════════════════════════════════════════════
//  BACKUP DATI (export / import JSON)
// ══════════════════════════════════════════════════════════
function esportaBackup(){
  const backup={
    versione: 3, // v3: preventivi a passi (locali con lavori, impianti, infissi)
    esportato: new Date().toISOString(),
    impresa: impresa,
    listino: Store.loadListino(),
    preventivi: preventivi
  };
  const msg=document.getElementById('backupMsg');
  try{
    const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`facile-preventivo-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    if(msg){ msg.textContent='✓ Backup esportato'; msg.style.color='var(--green)'; setTimeout(()=>{msg.textContent='';},3000); }
  }catch(e){
    if(msg){ msg.textContent='✕ Errore: '+e.message; msg.style.color='var(--red)'; }
  }
}

function importaBackup(file){
  if(!file) return;
  if(!confirm('L\'importazione sostituira tutti i dati attuali. Continuare?')) return;
  const reader=new FileReader();
  reader.onload=()=>{
    const msg=document.getElementById('backupMsg');
    try{
      const data=JSON.parse(reader.result);
      if(!data || typeof data!=='object') throw new Error('Formato non valido');
      if(Array.isArray(data.preventivi)) preventivi=data.preventivi;
      if(data.impresa && typeof data.impresa==='object') impresa=data.impresa;
      if(data.listino && typeof data.listino==='object') Store.saveListino(data.listino);
      Store.savePreventivi(preventivi);
      Store.saveImpresa(impresa);
      if(msg){ msg.textContent='✓ Backup ripristinato'; msg.style.color='var(--green)'; setTimeout(()=>{msg.textContent='';},3000); }
      caricaImpresa();
      aggStats();
      if(document.getElementById('page-lista').classList.contains('active')) renderLista();
    }catch(e){
      if(msg){ msg.textContent='✕ File non valido: '+e.message; msg.style.color='var(--red)'; }
    }
  };
  reader.readAsText(file);
}

// ══════════════════════════════════════════════════════════
//  ABBONAMENTO — Stripe via estensione Firebase "Run Payments with Stripe"
//  Modello: gratis fino a LIMITE_PREV_GRATIS preventivi, poi abbonamento
//  mensile o annuale.
//  Il blocco è SPENTO finché i price ID qui sotto restano vuoti: l'app
//  resta gratuita e identica. Quando l'estensione è installata e i prezzi
//  creati su Stripe, basta compilare STRIPE_PREZZI per attivare tutto.
// ══════════════════════════════════════════════════════════
const STRIPE_PREZZI = {
  mensile: '',  // price_...  (da Stripe → Prodotti → Facile Preventivo)
  annuale: ''   // price_...
};
const LIMITE_PREV_GRATIS = 3;

const Abbo = {
  _softMostrato:false,

  gatingAttivo(){ return !!(STRIPE_PREZZI.mensile || STRIPE_PREZZI.annuale); },
  // Conteggio doppio: per ACCOUNT (mv_stat, sincronizzato col cloud) e per
  // DISPOSITIVO (mv_stat_dev, che sopravvive al cambio account): creare un
  // secondo account sullo stesso telefono non azzera i preventivi gratuiti.
  usati(){
    const acc=(Store._read('mv_stat',{prevCreati:0}).prevCreati)||0;
    const dev=(Store._read('mv_stat_dev',{prevCreati:0}).prevCreati)||0;
    return Math.max(acc, dev);
  },
  rimasti(){ return Math.max(0, LIMITE_PREV_GRATIS - this.usati()); },
  attivo(){
    const s=Store._read('mv_abbo',{attivo:false,fine:0});
    return !!s.attivo && (!s.fine || s.fine > Date.now());
  },
  // Può creare un NUOVO preventivo? (quelli esistenti restano sempre
  // apribili, modificabili ed esportabili: i dati sono dell'utente)
  puoCreare(){
    return !this.gatingAttivo() || this.attivo() || this.usati() < LIMITE_PREV_GRATIS;
  },
  registraCreazione(){
    const st=Store._read('mv_stat',{prevCreati:0});
    st.prevCreati=(st.prevCreati||0)+1;
    Store._write('mv_stat', st);
    const sd=Store._read('mv_stat_dev',{prevCreati:0});
    sd.prevCreati=(sd.prevCreati||0)+1;
    Store._write('mv_stat_dev', sd);
    this.aggiornaCard();
  },

  // Stato abbonamento dal cloud (scritto dall'estensione Stripe).
  refresh(){
    const db=Sync._db();
    if(!db || !currentUser || !this.gatingAttivo()) return;
    const self=this;
    db.collection('customers').doc(currentUser.uid).collection('subscriptions')
      .where('status','in',['trialing','active']).get()
      .then(function(qs){
        let attivo=false, fine=0;
        qs.forEach(function(d){
          attivo=true;
          const p=(d.data()||{}).current_period_end;
          const t=(p && p.seconds) ? p.seconds*1000 : 0;
          if(t>fine) fine=t;
        });
        Store._write('mv_abbo',{attivo,fine});
        self.aggiornaCard();
      })
      .catch(function(){ /* estensione non ancora installata: ignora */ });
  },

  // Checkout Stripe: si crea un doc in checkout_sessions e l'estensione
  // risponde con l'URL della pagina di pagamento.
  checkout(tipo){
    const price=STRIPE_PREZZI[tipo];
    if(!price) return;
    const db=Sync._db();
    if(!db || !currentUser){ alert('Per abbonarti devi prima accedere con la tua email.'); return; }
    const btns=document.getElementById('abboBtns');
    if(btns) btns.style.opacity='.5';
    const ref=db.collection('customers').doc(currentUser.uid).collection('checkout_sessions').doc();
    ref.set({ price, mode:'subscription', allow_promotion_codes:true,
              success_url: location.href, cancel_url: location.href })
      .then(function(){
        ref.onSnapshot(function(snap){
          const d=snap.data()||{};
          if(d.error){ if(btns) btns.style.opacity=''; alert('Errore pagamento: '+d.error.message); }
          if(d.url) location.assign(d.url);
        });
      })
      .catch(function(e){
        if(btns) btns.style.opacity='';
        alert('Impossibile avviare il pagamento: '+(e && e.message ? e.message : e));
      });
  },

  paywall(){
    const m=document.getElementById('abboModal');
    if(!m) return;
    const u=document.getElementById('abboModalUsati');
    if(u) u.textContent=`Hai usato ${Math.min(this.usati(),LIMITE_PREV_GRATIS)} preventivi gratuiti su ${LIMITE_PREV_GRATIS}.`;
    m.style.display='block';
  },
  chiudiPaywall(){
    const m=document.getElementById('abboModal');
    if(m) m.style.display='none';
  },
  // Versione "gentile" per l'auto-salvataggio: mostra il paywall una sola
  // volta per sessione invece di riproporlo a ogni battitura.
  paywallSoft(){
    if(this._softMostrato) return;
    this._softMostrato=true;
    this.paywall();
  },

  // Card "Abbonamento" in Impostazioni: visibile solo a gating attivo.
  aggiornaCard(){
    const card=document.getElementById('abboCard');
    if(!card) return;
    card.style.display=this.gatingAttivo()?'':'none';
    const st=document.getElementById('abboStato');
    if(!st) return;
    if(this.attivo()){
      const s=Store._read('mv_abbo',{fine:0});
      st.textContent='✅ Abbonamento attivo'+(s.fine?(' · rinnovo '+new Date(s.fine).toLocaleDateString('it-IT')):'');
      const b=document.getElementById('abboBtns'); if(b) b.style.display='none';
    } else {
      st.textContent=`Piano gratuito: ${Math.min(this.usati(),LIMITE_PREV_GRATIS)}/${LIMITE_PREV_GRATIS} preventivi usati`+(this.rimasti()?` (${this.rimasti()} rimasti)`:' — limite raggiunto');
      const b=document.getElementById('abboBtns'); if(b) b.style.display='';
    }
  }
};

// ══════════════════════════════════════════════════════════
//  GUIDA AL PRIMO UTILIZZO
//  Tour a passi: tooltip "a riflettore" sugli elementi veri della UI
//  (spot con box-shadow gigante) + card con mockup illustrati.
//  Parte una volta sola per dispositivo (mv_guida); si rivede da
//  Impostazioni → Guida.
// ══════════════════════════════════════════════════════════
const GUIDA_PASSI=[
  { titolo:'Benvenuto in Facile Preventivo! 👋',
    testo:'In un minuto ti mostro come si lavora: locali, misure, lavori e un PDF pronto da inviare.',
    mock:'flusso' },
  { el:'wz', page:'nuovo', titolo:'1 · Scegli come partire',
    testo:'Disegna la pianta col dito, oppure scrivi le stanze in un elenco. Poi l\'app ti accompagna in tre passi, sempre gli stessi.' },
  { el:'tab-nuovo', page:'nuovo', titolo:'2 · Misure e lavori',
    testo:'Metti le misure (o prezza a corpo), poi spunti i lavori: le quantità (m² di pareti, soffitto, pavimento) le calcola l\'app.',
    mock:'preventivo' },
  { el:'tab-lista', page:'nuovo', titolo:'3 · Bozze e preventivi fatti',
    testo:'Qui ritrovi tutto, filtrato per stato (bozza, inviato, accettato, rifiutato). Ogni preventivo diventa un PDF da inviare con un tocco.',
    mock:'pdf' },
  { el:'tab-impostazioni', page:'nuovo', titolo:'4 · I dati della tua impresa',
    testo:'Nome, P.IVA e contatti finiscono nell\'intestazione dei PDF; qui c\'è anche il listino prezzi. Compilali prima del primo invio.' },
  { el:'pageMenuBtn', page:'nuovo', titolo:'5 · Dati al sicuro ☁️',
    testo:'Con l\'accesso, i documenti si sincronizzano sul cloud: li ritrovi su ogni dispositivo. Buon lavoro! 💪' }
];

// Mockup illustrativi (SVG inline, colori dell'app).
function mockGuida(tipo){
  const W=250,H=110;
  const scheda=(x,e,lbl)=>`
    <rect x="${x}" y="18" width="62" height="74" rx="8" fill="#fff" stroke="#E4E7EC" stroke-width="1.5"/>
    <text x="${x+31}" y="50" text-anchor="middle" font-size="20">${e}</text>
    <text x="${x+31}" y="80" text-anchor="middle" font-size="9" fill="#6B7280" font-weight="600">${lbl}</text>`;
  const freccia=(x)=>`<text x="${x}" y="60" text-anchor="middle" font-size="14" fill="#2563EB" font-weight="700">→</text>`;
  if(tipo==='flusso') return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${scheda(8,'🏠','Locali')}${freccia(85)}${scheda(94,'📐','Misure e lavori')}${freccia(171)}${scheda(180,'📄','PDF')}
  </svg>`;
  if(tipo==='preventivo') return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="30" y="8" width="190" height="94" rx="10" fill="#fff" stroke="#E4E7EC" stroke-width="1.5"/>
    <text x="44" y="30" font-size="12" font-weight="700" fill="#111827">Soggiorno</text>
    <text x="206" y="30" font-size="10" fill="#2563EB" font-weight="700" text-anchor="end">64,8 m² pareti</text>
    ${[0,1,2].map(i=>`
      <rect x="44" y="${40+i*18}" width="11" height="11" rx="3" fill="${i<2?'#2563EB':'#fff'}" stroke="#2563EB" stroke-width="1.3"/>
      ${i<2?`<text x="49.5" y="${49+i*18}" text-anchor="middle" font-size="8" fill="#fff" font-weight="700">✓</text>`:''}
      <rect x="62" y="${42+i*18}" width="${[96,72,84][i]}" height="7" rx="3.5" fill="#E4E7EC"/>`).join('')}
  </svg>`;
  // 'pdf'
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="85" y="6" width="80" height="98" rx="6" fill="#fff" stroke="#E4E7EC" stroke-width="1.5"/>
    <rect x="93" y="14" width="42" height="8" rx="3" fill="#2563EB"/>
    ${[0,1,2,3].map(i=>`<rect x="93" y="${30+i*11}" width="${[64,56,60,44][i]}" height="5" rx="2.5" fill="#E4E7EC"/>`).join('')}
    <rect x="93" y="78" width="64" height="10" rx="3" fill="#111827"/>
    <line x1="93" y1="97" x2="125" y2="97" stroke="#6B7280" stroke-width="1"/>
    <text x="109" y="94" text-anchor="middle" font-size="6" fill="#9CA3AF">firma</text>
    <text x="173" y="60" font-size="16">✅</text>
  </svg>`;
}

// Un passo è mostrabile se non ha target oppure se il target esiste e non è nascosto.
function _passoVisibile(p){
  if(!p.el) return true;
  const el=document.getElementById(p.el);
  return !!el && (!el.style || el.style.display!=='none');
}

const Guida={
  i:0, passi:GUIDA_PASSI, flag:'mv_guida',
  avvia(passi, flag){
    const lista = passi || GUIDA_PASSI;
    this.passi = lista.filter(_passoVisibile);
    if(!this.passi.length) this.passi = lista;
    this.flag = flag || 'mv_guida';
    this.i=0;
    if(lista===GUIDA_PASSI) goPage('nuovo');
    this._render();
  },
  chiudi(){
    const ov=document.getElementById('guidaOverlay');
    if(ov) ov.remove();
    Store.setGuidaVista(this.flag);
  },
  avanti(){
    this.i++;
    if(this.i>=this.passi.length) this.chiudi();
    else this._render();
  },
  _render(){
    const p=this.passi[this.i];
    if(p.page) goPage(p.page);
    let ov=document.getElementById('guidaOverlay');
    if(!ov){
      ov=document.createElement('div');
      ov.id='guidaOverlay';
      ov.innerHTML='<div id="guidaSpot"></div><div id="guidaCard"></div>';
      document.body.appendChild(ov);
    }
    const spot=document.getElementById('guidaSpot');
    const card=document.getElementById('guidaCard');
    const el=p.el?document.getElementById(p.el):null;
    // behavior:'instant' scavalca lo scroll-behavior:smooth del CSS: le
    // misure di spot e card vanno prese a scroll GIÀ fermo, non a metà corsa.
    if(el && el.scrollIntoView){ try{ el.scrollIntoView({block:'center', behavior:'instant'}); }catch(e){ try{ el.scrollIntoView(); }catch(e2){} } }
    const self=this;
    setTimeout(function(){
      if(!card) return;
      const ultimo=self.i===self.passi.length-1;
      card.innerHTML=`
        ${p.mock?`<div class="guida-mock">${mockGuida(p.mock)}</div>`:''}
        <div class="guida-titolo">${p.titolo}</div>
        <div class="guida-testo">${p.testo}</div>
        <div class="guida-footer">
          <div class="guida-dots">${self.passi.map((_,j)=>`<span class="guida-dot${j===self.i?' on':''}"></span>`).join('')}</div>
          <div class="guida-btns">
            <button class="btn btn-secondary btn-sm" onclick="Guida.chiudi()">Salta</button>
            <button class="btn btn-primary btn-sm" onclick="Guida.avanti()">${ultimo?'Fine ✓':(self.i===0?'Inizia →':'Avanti →')}</button>
          </div>
        </div>`;
      // posizione: sotto il target se c'è spazio, sopra altrimenti, centrata se
      // nessun target. In ogni caso CLAMP dentro il viewport: la card coi
      // bottoni non deve mai finire fuori schermo.
      card.style.visibility='hidden';
      setTimeout(function(){
        const ch=card.offsetHeight||230;
        const vh=(typeof window!=='undefined' && window.innerHeight)?window.innerHeight:640;
        // rect misurato ORA, a scroll assestato: vale sia per il riflettore
        // sia per la card (prima lo spot usava una misura piu' vecchia e
        // poteva restare fuori posto).
        const r2=(el && el.getBoundingClientRect)?el.getBoundingClientRect():null;
        if(spot){
          if(r2){
            spot.style.left=(r2.left-6)+'px'; spot.style.top=(r2.top-6)+'px';
            spot.style.width=(r2.width+12)+'px'; spot.style.height=(r2.height+12)+'px';
          } else {
            spot.style.left='50%'; spot.style.top='45%';
            spot.style.width='0px'; spot.style.height='0px';
          }
        }
        let top;
        if(!r2) top=(vh-ch)/2;
        else if(r2.bottom+12+ch < vh-12) top=r2.bottom+12;
        else top=r2.top-12-ch;
        top=Math.max(12, Math.min(top, vh-ch-12));
        card.style.top=top+'px';
        card.style.visibility='visible';
      },60);
    },120);
  }
};
// Primo avvio: mostra la guida una volta sola (dopo il login o, senza
// Firebase, appena l'app è visibile).
function avviaGuidaPrimoUso(){
  // Tutto dentro il timeout: initAuth gira in cima al file, prima che
  // Store (piu' sotto) sia inizializzato — qui fuori non si tocca nulla.
  setTimeout(function(){
    if(Store.getGuidaVista() || document.getElementById('guidaOverlay')) return;
    Guida.avvia();
  }, 600);
}

// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded',()=>{
  wzInit();
  wzNuovo();
  aggStats();
  caricaImpresa();
  Abbo.aggiornaCard();
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
