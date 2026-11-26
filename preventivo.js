// ══════════════════════════════════════════════════════════
//  PREVENTIVO — il flusso in 4 passi
//  ① Locali (o Pianta, in arrivo)  ② Misure  ③ Lavori  ④ Preventivo
//  Un locale, una scheda: al passo Misure chiede le misure, al passo
//  Lavori chiede le lavorazioni. Le quantità arrivano dalle misure.
//  Documento v2:
//   {v:2, id, numero, data, dataISO, stato, mod, via,
//    cliente:{nome,tel,email,indirizzo},
//    locali:[{id,nome,L,W,H, lav:{id:true}, imp:{el:{on,p,nota},id:{…}},
//             inf:[{tipo,lung,alt,ante,apr,prezzo}], man:[{nome,q,u,p}], note}],
//    prezzi:{idLavoro:€}, sconto, iva, validita, totale}
// ══════════════════════════════════════════════════════════

/* ── lavori più usati: ognuno sa su quale superficie si applica ── */
const LAVORI_STD=[
  {id:'dp', nome:'Demolizione pavimento',  su:'pavimento'},
  {id:'ms', nome:'Massetto',               su:'pavimento'},
  {id:'pp', nome:'Posa pavimento',         su:'pavimento'},
  {id:'ir', nome:'Intonaco e rasatura',    su:'pareti'},
  {id:'tp', nome:'Tinteggiatura pareti',   su:'pareti'},
  {id:'ts', nome:'Tinteggiatura soffitto', su:'soffitto'},
  {id:'cs', nome:'Controsoffitto',         su:'soffitto'},
  {id:'sm', nome:'Smaltimento macerie',    su:'corpo'}
];
const PREZZI_BASE={dp:12, ms:18, pp:30, ir:22, tp:6.5, ts:7, cs:35, sm:250};
const SU_LBL={pareti:'m² di pareti', soffitto:'m² di soffitto', pavimento:'m² di pavimento', corpo:'a corpo'};
const IMPIANTI=[
  {id:'el', nome:'Impianto elettrico', es:'es. 6 punti luce, 4 prese, 1 punto TV'},
  {id:'id', nome:'Impianto idraulico', es:'es. 5 punti acqua, spostamento scarichi'}
];
const TIPI_INF={
  finestra:      {lbl:'Finestra',      lung:1200, alt:1400, ante:2, prezzo:650},
  portafinestra: {lbl:'Portafinestra', lung:1400, alt:2300, ante:2, prezzo:950},
  porta:         {lbl:'Porta interna', lung:800,  alt:2100, ante:1, prezzo:380}
};
const APR={battente:'Battente', ribalta:'Anta-ribalta', scorrevole:'Scorrevole', fissa:'Fissa'};
const UNITA=['m²','ml','pz','a corpo'];
const NOMI_LOCALI=['Soggiorno','Cucina','Camera','Cameretta','Bagno','Corridoio','Ingresso','Ripostiglio','Studio','Lavanderia'];
const H_BASE=2.7;

/* ── numeri ── */
function prNum(v){ const n=parseFloat(String(v==null?'':v).replace(',','.')); return Number.isFinite(n)&&n>0?n:0; }
const prF2=n=>(Number(n)||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});
const prF1=n=>(Number(n)||0).toLocaleString('it-IT',{minimumFractionDigits:1,maximumFractionDigits:1});
const prEur=n=>'€ '+prF2(n);
const prIn=v=> v>0 ? String(Math.round(v*100)/100).replace('.',',') : '';

/* ── modello ── */
function impVuoti(){ return {el:{on:false,p:0,nota:''}, id:{on:false,p:0,nota:''}}; }
function nuovoLocale(id, nome){ return {id, nome:nome||'', L:0, W:0, H:H_BASE, lav:{}, imp:impVuoti(), inf:[], man:[], note:''}; }
function nuovoInfisso(tipo){ const d=TIPI_INF[tipo]||TIPI_INF.finestra; return {tipo:TIPI_INF[tipo]?tipo:'finestra', lung:d.lung, alt:d.alt, ante:d.ante, apr:'battente', prezzo:d.prezzo}; }
function nuovoDoc(){
  const ora=new Date();
  return {
    v:2, id:Date.now(), numero:nextNum(), data:ora.toLocaleDateString('it-IT'), dataISO:ora.toISOString(),
    stato:'bozza', mod:Date.now(), via:null,
    cliente:{nome:'', tel:'', email:'', indirizzo:''},
    locali:[], prezzi:Object.assign({}, PREZZI_BASE, Store.loadListino()),
    sconto:0, iva:22, validita:30, totale:0
  };
}
// Un documento arrivato da backup/cloud può essere incompleto: lo si completa.
function normalizzaDoc(d){
  d.cliente=Object.assign({nome:'',tel:'',email:'',indirizzo:''}, d.cliente||{});
  d.prezzi=Object.assign({}, PREZZI_BASE, d.prezzi||{});
  d.locali=(Array.isArray(d.locali)?d.locali:[]).map((l,i)=>{
    const n=Object.assign(nuovoLocale(i), l||{});
    n.lav=Object.assign({}, n.lav||{});
    n.imp=Object.assign(impVuoti(), n.imp||{});
    IMPIANTI.forEach(k=>{ n.imp[k.id]=Object.assign({on:false,p:0,nota:''}, n.imp[k.id]||{}); });
    n.inf=(Array.isArray(n.inf)?n.inf:[]).map(x=>Object.assign(nuovoInfisso(x&&x.tipo), x||{}));
    n.man=(Array.isArray(n.man)?n.man:[]).map(x=>Object.assign({nome:'',q:0,u:'m²',p:0}, x||{}));
    return n;
  });
  if(!Number.isFinite(d.sconto)) d.sconto=prNum(d.sconto);
  if(!Number.isFinite(d.iva)) d.iva=22;
  d.validita=parseInt(d.validita,10)||30;
  return d;
}

/* ── calcoli (puri: usati da editor, PDF e test) ── */
const locMisurato=l=>l.L>0 && l.W>0;
const locAreaInfissi=l=>(l.inf||[]).reduce((a,x)=>a+prNum(x.lung)*prNum(x.alt)/1e6,0);
function locSup(l){
  if(!locMisurato(l)) return null;
  const H=l.H>0?l.H:H_BASE, lordo=2*(l.L+l.W)*H, ded=Math.min(locAreaInfissi(l), lordo);
  return {pavimento:l.L*l.W, soffitto:l.L*l.W, pareti:lordo-ded, lordo, ded, perimetro:2*(l.L+l.W)};
}
const descInfisso=x=>`${APR[x.apr]||APR.battente}, ${x.ante} ${x.ante>1?'ante':'anta'}`;
const nomeInfisso=x=>`${(TIPI_INF[x.tipo]||TIPI_INF.finestra).lbl} ${Math.round(prNum(x.lung))}×${Math.round(prNum(x.alt))} mm`;
// Righe di un locale: {nome, nota, q, u, p, tot, inf?}
function locRighe(l, prezzi){
  const s=locSup(l), out=[];
  LAVORI_STD.forEach(x=>{
    if(!(l.lav||{})[x.id]) return;
    const q= x.su==='corpo' ? 1 : (s ? s[x.su] : 0), p=prNum(prezzi[x.id]);
    out.push({nome:x.nome, q, u: x.su==='corpo'?'a corpo':'m²', su:x.su, p, tot:q*p});
  });
  IMPIANTI.forEach(k=>{
    const x=(l.imp||{})[k.id]; if(!x || !x.on) return;
    const p=prNum(x.p);
    out.push({nome:k.nome, nota:x.nota||'', q:1, u:'a corpo', p, tot:p});
  });
  (l.inf||[]).forEach(x=>{
    const p=prNum(x.prezzo);
    out.push({nome:nomeInfisso(x), nota:descInfisso(x), q:1, u:'pz', p, tot:p, inf:x});
  });
  (l.man||[]).forEach(x=>{
    if(!String(x.nome||'').trim()) return;
    const c=x.u==='a corpo', q=c?1:prNum(x.q), p=prNum(x.p);
    out.push({nome:x.nome, q, u:x.u, p, tot:q*p});
  });
  return out;
}
const locTot=(l,prezzi)=>locRighe(l,prezzi).reduce((a,x)=>a+x.tot,0);
function docTotali(d){
  const sub=(d.locali||[]).reduce((a,l)=>a+locTot(l,d.prezzi||{}),0);
  const sc=sub*Math.min(100,prNum(d.sconto))/100, imp=sub-sc, iva=imp*(Number(d.iva)||0)/100;
  return {sub, sc, imp, iva, tot:imp+iva};
}
const qtaTesto=r=> r.u==='a corpo' ? 'a corpo' : (r.su ? `${prF2(r.q)} ${SU_LBL[r.su]}` : `${prF2(r.q)} ${r.u}`);

/* ── disegno tecnico degli infissi (prospetto, vista interna) ──
   la "V" tratteggiata ha il vertice sul lato cerniere; vasistas: cerniere in
   basso; anta-ribalta: entrambi; scorrevole: freccia; fissa: niente */
function apertureInfisso(x){
  const n=Math.min(Math.max(parseInt(x.ante,10)||1,1),4);
  if(x.apr==='fissa') return Array(n).fill('fissa');
  if(x.apr==='scorrevole') return n===1 ? ['scorrevole-dx'] : Array.from({length:n},(_,i)=>i%2?'scorrevole-sx':'fissa');
  let a= n===1?['battente-dx'] : n===2?['battente-sx','battente-dx'] : n===3?['battente-sx','fissa','battente-dx'] : ['battente-sx','fissa','fissa','battente-dx'];
  if(x.apr==='ribalta') a=a.map(v=>v.replace('battente','ribalta'));
  return a;
}
function simboloApertura(tipo,x,y,w,h){
  const tratt=`stroke="#2563EB" stroke-width="1.3" stroke-dasharray="5 3" fill="none" stroke-linejoin="round"`;
  const pieno=`stroke="#2563EB" stroke-width="1.6" fill="none"`;
  const man=(cx,cy)=>`<circle cx="${cx}" cy="${cy}" r="2.4" fill="#111827"/>`;
  const bDx=`<path d="M ${x} ${y} L ${x+w} ${y+h/2} L ${x} ${y+h}" ${tratt}/>`+man(x+4,y+h/2);
  const bSx=`<path d="M ${x+w} ${y} L ${x} ${y+h/2} L ${x+w} ${y+h}" ${tratt}/>`+man(x+w-4,y+h/2);
  const vas=`<path d="M ${x} ${y} L ${x+w/2} ${y+h} L ${x+w} ${y}" ${tratt}/>`;
  const fDx=`<line x1="${x+w*.22}" y1="${y+h/2}" x2="${x+w*.78}" y2="${y+h/2}" ${pieno}/><path d="M ${x+w*.78} ${y+h/2} l -7 -4.5 v 9 z" fill="#2563EB"/>`;
  const fSx=`<line x1="${x+w*.78}" y1="${y+h/2}" x2="${x+w*.22}" y2="${y+h/2}" ${pieno}/><path d="M ${x+w*.22} ${y+h/2} l 7 -4.5 v 9 z" fill="#2563EB"/>`;
  return {'battente-dx':bDx,'battente-sx':bSx,'vasistas':vas,'ribalta-dx':bDx+vas,'ribalta-sx':bSx+vas,'scorrevole-dx':fDx,'scorrevole-sx':fSx}[tipo]||'';
}
function disegnoInfisso(s, maxW, maxH){
  maxW=maxW||110; maxH=maxH||110;
  const L=Math.max(prNum(s.lung),100), H=Math.max(prNum(s.alt),100), Q=24;
  const sc=Math.min((maxW-Q-4)/L,(maxH-Q-4)/H), w=L*sc, h=H*sc, x0=2, y0=2;
  const W=Math.ceil(w+Q+6), Vh=Math.ceil(h+Q+6), t=Math.max(Math.min(60*sc,9),2.5);
  const ap=apertureInfisso(s), n=ap.length, ax=x0+t, ay=y0+t, aw=(w-2*t)/n, ah=h-2*t;
  let ante='';
  for(let i=0;i<n;i++) ante+=`<rect x="${(ax+i*aw).toFixed(1)}" y="${ay.toFixed(1)}" width="${aw.toFixed(1)}" height="${ah.toFixed(1)}" fill="#EFF6FF" stroke="#111827" stroke-width="1"/>`;
  for(let i=0;i<n;i++) ante+=simboloApertura(ap[i], ax+i*aw, ay, aw, ah);
  const qy=y0+h+12, qx=x0+w+12, ln='stroke="#6B7280" stroke-width=".8"';
  return `<svg viewBox="0 0 ${W} ${Vh}" width="${W}" height="${Vh}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(nomeInfisso(s))}">`+
    `<rect x="${x0}" y="${y0}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="#fff" stroke="#111827" stroke-width="1.6"/>${ante}`+
    `<line x1="${x0}" y1="${qy}" x2="${x0+w}" y2="${qy}" ${ln}/><line x1="${x0}" y1="${qy-3.5}" x2="${x0}" y2="${qy+3.5}" ${ln}/><line x1="${x0+w}" y1="${qy-3.5}" x2="${x0+w}" y2="${qy+3.5}" ${ln}/>`+
    `<text x="${x0+w/2}" y="${qy+9.5}" text-anchor="middle" font-size="8.5" fill="#374151">${Math.round(L)}</text>`+
    `<line x1="${qx}" y1="${y0}" x2="${qx}" y2="${y0+h}" ${ln}/><line x1="${qx-3.5}" y1="${y0}" x2="${qx+3.5}" y2="${y0}" ${ln}/><line x1="${qx-3.5}" y1="${y0+h}" x2="${qx+3.5}" y2="${y0+h}" ${ln}/>`+
    `<text x="${qx+8}" y="${y0+h/2}" text-anchor="middle" font-size="8.5" fill="#374151" transform="rotate(-90 ${qx+8} ${y0+h/2})">${Math.round(H)}</text></svg>`;
}

/* ══════════ PDF ══════════ */
function buildPdfPrev(d){
  d=normalizzaDoc(JSON.parse(JSON.stringify(d)));
  const T=docTotali(d), c=d.cliente;
  const th='background:#111827;color:#fff;text-align:left;font-size:10.5px;padding:6px 7px';
  const td='padding:6px 7px;border-bottom:1px solid #E5E7EB;vertical-align:middle';
  const r='text-align:right;white-space:nowrap';
  const corpo=d.locali.map(l=>{
    const rr=locRighe(l,d.prezzi);
    if(!rr.length && !String(l.note||'').trim()) return '';
    const s=locSup(l);
    const testa=`<tr class="no-break"><td colspan="4" style="${td};background:#F3F4F6;font-weight:700">${esc(l.nome||'Locale')}`+
      (s?` <span style="font-weight:400;color:#6B7280">· ${prF2(l.L)} × ${prF2(l.W)} m, h ${prF2(l.H>0?l.H:H_BASE)} · pavimento ${prF1(s.pavimento)} m², pareti ${prF1(s.pareti)} m²</span>`:'')+
      `</td><td style="${td};background:#F3F4F6;${r};font-weight:700">${prEur(locTot(l,d.prezzi))}</td></tr>`;
    const righe=rr.map(x=>`<tr>`+
      `<td style="${td}"><div style="display:flex;gap:8px;align-items:center">${x.inf?`<span style="flex:0 0 50px;width:50px;display:inline-block">${disegnoInfisso(x.inf,90,90).replace('<svg ','<svg style="display:block;width:100%;height:auto" ')}</span>`:''}`+
        `<span>${esc(x.nome)}${x.nota?`<br><span style="color:#6B7280;font-size:10.5px">${esc(x.nota)}</span>`:''}</span></div></td>`+
      `<td style="${td};${r}">${x.u==='a corpo'?'a corpo':(x.u==='pz'&&Number.isInteger(x.q)?x.q:prF2(x.q))+' '+esc(x.u)}</td>`+
      `<td style="${td};${r}">${prEur(x.p)}</td><td style="${td}"></td>`+
      `<td style="${td};${r}">${prEur(x.tot)}</td></tr>`).join('');
    const note=String(l.note||'').trim() ? `<tr><td colspan="5" style="${td};color:#374151;font-style:italic">Note: ${esc(l.note)}</td></tr>` : '';
    return testa+righe+note;
  }).join('');
  const indir=[c.indirizzo, c.tel, c.email].filter(Boolean).map(esc).join(' · ');
  return `
  <div style="display:flex;justify-content:space-between;gap:16px;padding-bottom:12px;border-bottom:2px solid #111827">
    ${intestazionePDF('preventivo')}
    <div style="text-align:right;font-size:11px;color:#6B7280;white-space:nowrap">
      <div style="font-size:14px;font-weight:800;color:#111827">${esc(numDoc(d.numero))}</div>
      <div>${esc(d.data||'')}</div><div>Valido ${d.validita} giorni</div>
    </div>
  </div>
  <div style="background:#F3F4F6;border-radius:8px;padding:10px 12px;margin:14px 0">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#6B7280">Cliente</div>
    <div style="font-size:15px;font-weight:700">${esc(c.nome||'')}</div>
    ${indir?`<div style="font-size:11.5px;color:#374151">${indir}</div>`:''}
  </div>
  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#6B7280;margin:14px 0 6px">Dettaglio lavori per locale</div>
  <table style="width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums">
    <thead><tr><th style="${th}">Lavorazione</th><th style="${th};${r}">Quantità</th><th style="${th};${r}">Prezzo</th><th style="${th};width:4px"></th><th style="${th};${r}">Importo</th></tr></thead>
    <tbody>${corpo || `<tr><td colspan="5" style="${td}">Nessuna lavorazione inserita.</td></tr>`}</tbody>
  </table>
  <div class="no-break" style="margin:14px 0 0 auto;width:min(270px,100%);font-size:12.5px;font-variant-numeric:tabular-nums">
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span>Subtotale</span><span>${prEur(T.sub)}</span></div>
    ${T.sc>0?`<div style="display:flex;justify-content:space-between;padding:3px 0"><span>Sconto ${prF2(d.sconto).replace(/,00$/,'')}%</span><span>− ${prEur(T.sc)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span>Imponibile</span><span>${prEur(T.imp)}</span></div>`:''}
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span>IVA ${d.iva}%</span><span>${prEur(T.iva)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:7px 0 0;margin-top:4px;border-top:2px solid #111827;font-size:16px;font-weight:800"><span>Totale</span><span>${prEur(T.tot)}</span></div>
  </div>
  <div class="firme" style="display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:40px">
    <div style="border-top:1px solid #111827;padding-top:4px;text-align:center;color:#6B7280;font-size:10.5px">Firma cliente per accettazione</div>
    <div style="border-top:1px solid #111827;padding-top:4px;text-align:center;color:#6B7280;font-size:10.5px">Firma impresa</div>
  </div>`;
}

/* ══════════ EDITOR ══════════ */
let doc=null, wzStep=0, wzSel=null, _wzSaveT=null, _wzToastT=null;
const PASSI_LBL=['Locali','Misure','Lavori','Preventivo'];

function wzEl(id){ return document.getElementById(id); }
function wzToast(msg){
  const t=wzEl('wzToast'); if(!t) return;
  t.textContent=msg; t.style.display='block';
  clearTimeout(_wzToastT); _wzToastT=setTimeout(()=>{ t.style.display='none'; }, 2600);
}
function wzNuovo(){ doc=nuovoDoc(); wzStep=0; wzSel=null; wzChiudiScheda(true); wzRender(); }
function wzApri(id){
  const p=preventivi.find(x=>String(x.id)===String(id)); if(!p) return false;
  if(p.v!==2){ alert('Questo preventivo è stato creato con la vecchia versione dell\'app e non si può più aprire. Puoi eliminarlo dall\'Archivio.'); return false; }
  doc=normalizzaDoc(JSON.parse(JSON.stringify(p)));
  wzSel=null; wzStep= doc.locali.length ? 4 : 1;
  wzRender();
  return true;
}
// Salvataggio: basta il nome del cliente. Un nuovo documento conta per il piano gratuito.
function wzSalvaOra(){
  clearTimeout(_wzSaveT);
  if(!doc || !String(doc.cliente.nome||'').trim()) return false;
  doc.mod=Date.now(); doc.totale=docTotali(doc).tot;
  const copia=JSON.parse(JSON.stringify(doc));
  const i=preventivi.findIndex(p=>String(p.id)===String(doc.id));
  if(i<0){
    if(!Abbo.puoCreare()){ Abbo.paywallSoft(); return false; }
    preventivi.push(copia); Abbo.registraCreazione();
  } else preventivi[i]=copia;
  Store.savePreventivi(preventivi);
  const s=wzEl('wzSalvato'); if(s) s.textContent='Salvato';
  return true;
}
function wzSalva(){
  const s=wzEl('wzSalvato'); if(s && doc && doc.cliente.nome) s.textContent='Salvataggio…';
  clearTimeout(_wzSaveT); _wzSaveT=setTimeout(wzSalvaOra, 700);
}
// Il prezzo di un lavoro più usato diventa quello proposto nei prossimi preventivi.
function wzAggiornaListino(id, v){ const l=Store.loadListino(); l[id]=v; Store.saveListino(l); }

/* ── schermate ── */
function wzRender(){
  const root=wzEl('wz'); if(!root) return;
  if(!doc) doc=nuovoDoc();
  const inizio=wzStep===0;
  const salvato=preventivi.some(p=>String(p.id)===String(doc.id));
  root.innerHTML=`
    <div class="wz-head">
      <button type="button" class="wz-head-t" data-a="cliente" aria-label="Dati del cliente"><b>${inizio?(doc.via?esc(doc.cliente.nome||'Cliente'):'Nuovo preventivo'):esc(doc.cliente.nome||'Senza nome')}</b>
        <span>${esc(numDoc(doc.numero))} · <span id="wzSalvato">${salvato?'Salvato':(doc.cliente.nome?'':'Non ancora salvato')}</span>${inizio?'':' · <u>cliente</u>'}</span></button>
      ${inizio?'':'<button type="button" class="wz-ghost-sm" data-a="nuovo">+ Nuovo</button>'}
    </div>
    ${inizio?'':`<nav class="wz-steps">${PASSI_LBL.map((p,i)=>`<button type="button" class="wz-st${i+1<wzStep?' fatto':''}${i+1===wzStep?' ora':''}" data-step="${i+1}"><i></i><span>${p}</span></button>`).join('')}</nav>`}
    <div class="wz-screen">${wzSchermata()}</div>
    ${inizio?'':`<div class="wz-cta"><div class="wz-cta-info">${wzCtaInfo()}</div>
      <button type="button" class="wz-primary" data-a="avanti">${['Avanti: misure','Avanti: lavori','Avanti: preventivo','Crea il PDF'][wzStep-1]}</button></div>`}`;
}
function wzCtaInfo(){
  const n=doc.locali.length, mis=doc.locali.filter(locMisurato).length;
  const conLav=doc.locali.filter(l=>locRighe(l,doc.prezzi).length).length, T=docTotali(doc);
  return [
    `<b>${n} ${n===1?'locale':'locali'}</b>nel preventivo`,
    `<b>${mis} di ${n}</b>locali misurati`,
    `<b>${prEur(T.sub)}</b>${conLav} di ${n} locali con lavori`,
    `<b>${prEur(T.tot)}</b>totale IVA inclusa`
  ][wzStep-1];
}
const chev='<svg class="wz-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
function wzSchermata(){
  const c=doc.cliente;
  if(wzStep===0) return `
    <div class="wz-field"><label class="wz-lbl" for="wzNome">Cliente</label>
      <input class="wz-input" id="wzNome" data-cli="nome" value="${esc(c.nome)}" placeholder="Nome e cognome" autocomplete="off"></div>
    <details class="wz-details"${(c.tel||c.email||c.indirizzo)?' open':''}><summary>Indirizzo e contatti (facoltativi)</summary>
      <div class="wz-field"><label class="wz-lbl" for="wzInd">Indirizzo dei lavori</label><input class="wz-input" id="wzInd" data-cli="indirizzo" value="${esc(c.indirizzo)}" placeholder="Via, numero, città"></div>
      <div class="wz-row2">
        <div class="wz-field"><label class="wz-lbl" for="wzTel">Telefono</label><input class="wz-input" id="wzTel" type="tel" data-cli="tel" value="${esc(c.tel)}"></div>
        <div class="wz-field"><label class="wz-lbl" for="wzMail">Email</label><input class="wz-input" id="wzMail" type="email" data-cli="email" value="${esc(c.email)}"></div>
      </div>
    </details>
    ${doc.via ? `<button type="button" class="wz-primary wz-full" data-a="continua">Continua il preventivo →</button>` : `
    <h2 class="wz-h2">Come vuoi partire?</h2>
    <button type="button" class="wz-pick" disabled>
      <span class="wz-ico">${icoPianta()}</span>
      <b>Disegna la pianta <span class="wz-tag">in arrivo</span></b>
      <span>Schizzi le stanze col dito, l'app trova i locali e calcola i m².</span>
    </button>
    <button type="button" class="wz-pick main" data-a="manuale">
      <span class="wz-ico">${icoElenco()}</span>
      <b>Scrivi i locali</b>
      <span>Elenchi le stanze, poi misure e lavori stanza per stanza.</span>
    </button>`}`;
  if(wzStep===1) return `
    <h2 class="wz-h2">Quali locali ci sono?</h2>
    <p class="wz-lead">Tocca un nome per aggiungerlo, o scrivine uno tuo. Le misure le metti al passo dopo.</p>
    <div class="wz-chips">${NOMI_LOCALI.map(n=>`<button type="button" class="wz-chip" data-addnome="${esc(n)}">+ ${esc(n)}</button>`).join('')}</div>
    <div class="wz-rows">${doc.locali.map(l=>`
      <div class="wz-editrow"><input class="wz-input" data-nome="${l.id}" value="${esc(l.nome)}" placeholder="Nome del locale" aria-label="Nome locale">
        <button type="button" class="wz-del" data-dellocale="${l.id}" aria-label="Elimina ${esc(l.nome)}">×</button></div>`).join('')}
      ${doc.locali.length?'':'<p class="wz-empty">Nessun locale ancora.</p>'}
    </div>
    <button type="button" class="wz-add" data-a="addlocale">+ Altro locale</button>`;
  if(wzStep===2){
    const mis=doc.locali.filter(locMisurato).length;
    return `
    <h2 class="wz-h2">Misure dei locali</h2>
    <p class="wz-lead">Tocca un locale e scrivi lunghezza, larghezza e altezza. ${mis} di ${doc.locali.length} misurati.</p>
    <div class="wz-rows">${doc.locali.map(l=>{ const s=locSup(l); return `
      <button type="button" class="wz-row" data-room="${l.id}">
        <span class="n">${esc(l.nome||'Locale')}</span>
        <span class="d">${s?`${prF2(l.L)} × ${prF2(l.W)} · h ${prF2(l.H)} · pareti ${prF1(s.pareti)} m²`:'Senza misure'}</span>
        <span class="v">${s?`${prF1(s.pavimento)} m²`:'<span class="wz-pill todo">da misurare</span>'}</span>${chev}</button>`; }).join('')}
      ${doc.locali.length?'':'<p class="wz-empty">Aggiungi prima i locali al passo 1.</p>'}</div>`;
  }
  if(wzStep===3) return `
    <h2 class="wz-h2">Lavori per locale</h2>
    <p class="wz-lead">Tocca un locale: spunta i lavori più usati (la quantità arriva dalle misure), aggiungi impianti, infissi o lavorazioni scritte a mano.</p>
    <div class="wz-rows">${doc.locali.map(l=>{ const rr=locRighe(l,doc.prezzi); return `
      <button type="button" class="wz-row" data-room="${l.id}">
        <span class="n">${esc(l.nome||'Locale')}</span>
        <span class="d">${rr.length?esc(rr.map(x=>x.inf?(TIPI_INF[x.inf.tipo]||TIPI_INF.finestra).lbl:x.nome).join(', ')):'Nessuna lavorazione'}</span>
        <span class="v">${rr.length?prEur(locTot(l,doc.prezzi)):'<span class="wz-pill todo">da fare</span>'}</span>${chev}</button>`; }).join('')}
      ${doc.locali.length?'':'<p class="wz-empty">Aggiungi prima i locali al passo 1.</p>'}</div>`;
  // passo 4: riepilogo
  const T=docTotali(doc);
  const blocchi=doc.locali.map(l=>{
    const rr=locRighe(l,doc.prezzi); if(!rr.length) return '';
    return `<div class="wz-sum-room"><h3>${esc(l.nome||'Locale')}<span>${prEur(locTot(l,doc.prezzi))}</span></h3>${rr.map(x=>`
      <div class="wz-ln"><span>${esc(x.nome)}</span><span class="t">${prEur(x.tot)}</span>
      <span class="q">${esc(x.inf?'1 pz · '+x.nota:qtaTesto(x)+(x.nota?' · '+x.nota:''))}${(x.u!=='a corpo'&&!x.inf)?' × '+prEur(x.p):''}</span></div>`).join('')}</div>`;
  }).join('');
  return `
    <h2 class="wz-h2">Il preventivo</h2>
    <div class="wz-sum">${blocchi||'<div class="wz-sum-room"><p class="wz-empty">Nessuna lavorazione ancora. Torna al passo Lavori.</p></div>'}</div>
    <div class="wz-tot">
      <div class="r"><span>Subtotale lavori</span><span>${prEur(T.sub)}</span></div>
      <div class="r"><label for="wzSconto">Sconto %</label><input class="wz-mini" id="wzSconto" data-doc="sconto" inputmode="decimal" value="${doc.sconto?prIn(doc.sconto):''}" placeholder="0"></div>
      <div class="r"><label for="wzIva">IVA</label><select class="wz-mini" id="wzIva" data-doc="iva">${[22,10,4,0].map(v=>`<option value="${v}"${Number(doc.iva)===v?' selected':''}>${v}%${v===10?' ristrutturazione':''}</option>`).join('')}</select></div>
      <div class="r"><span>IVA</span><span id="wzIvaVal">${prEur(T.iva)}</span></div>
      <div class="r"><label for="wzVal">Validità</label><select class="wz-mini" id="wzVal" data-doc="validita">${[30,60,90].map(v=>`<option value="${v}"${doc.validita===v?' selected':''}>${v} giorni</option>`).join('')}</select></div>
      <div class="r big"><span>Totale</span><span id="wzTotVal">${prEur(T.tot)}</span></div>
    </div>
    ${String(doc.cliente.nome||'').trim()?'':'<p class="wz-warn">Manca il nome del cliente: tocca in alto per scriverlo.</p>'}`;
}
function icoPianta(){ return `<svg width="44" height="34" viewBox="0 0 44 34" aria-hidden="true"><rect x="2" y="2" width="40" height="30" fill="#DBEAFE" stroke="#111827" stroke-width="2.4"/><path d="M22 2v30M2 17h20M22 14h20" fill="none" stroke="#111827" stroke-width="2.4"/></svg>`; }
function icoElenco(){ return `<svg width="40" height="32" viewBox="0 0 40 32" aria-hidden="true">${[4,14,24].map(y=>`<rect x="2" y="${y}" width="6" height="5" rx="1.5" fill="#2563EB"/><rect x="12" y="${y}" width="26" height="5" rx="2.5" fill="#E4E7EC"/>`).join('')}</svg>`; }

/* ── azioni della pagina ── */
function wzVai(step){
  wzStep=Math.max(1,Math.min(4,step)); wzRender();
  try{ window.scrollTo(0,0); }catch(e){}
}
function wzAvanti(){
  if(wzStep===1 && !doc.locali.length){ wzToast('Aggiungi almeno un locale'); return; }
  if(wzStep===2){ const m=doc.locali.filter(l=>!locMisurato(l)).length; if(m) wzToast(`${m} ${m===1?'locale':'locali'} senza misure: puoi completarle dopo`); }
  if(wzStep<4){ wzVai(wzStep+1); return; }
  wzPdf();
}
function wzPdf(){
  if(!String(doc.cliente.nome||'').trim()){ wzToast('Manca il nome del cliente'); return; }
  wzSalvaOra();
  apriPdfModal(buildPdfPrev(doc), 'Preventivo '+numDoc(doc.numero));
}
function wzInizia(via){
  if(!String(doc.cliente.nome||'').trim()){ wzToast('Scrivi prima il nome del cliente'); const n=wzEl('wzNome'); if(n) n.focus(); return; }
  doc.via=via; wzSalva(); wzVai(1);
}
function wzAddLocale(nome){
  const id=doc.locali.length ? Math.max(...doc.locali.map(l=>l.id))+1 : 1;
  let n=nome||'Locale '+(doc.locali.length+1);
  if(nome){ const stessi=doc.locali.filter(l=>l.nome===nome || l.nome.startsWith(nome+' ')).length; if(stessi) n=nome+' '+(stessi+1); }
  doc.locali.push(nuovoLocale(id, n)); wzSalva(); wzRender();
  if(!nome){ const ins=document.querySelectorAll('[data-nome]'); const u=ins[ins.length-1]; if(u){ u.focus(); u.select && u.select(); } }
}

function wzClick(e){
  const t=e.target;
  const st=t.closest('[data-step]'); if(st){ wzVai(+st.dataset.step); return; }
  const room=t.closest('[data-room]'); if(room){ wzApriScheda(+room.dataset.room); return; }
  const an=t.closest('[data-addnome]'); if(an){ wzAddLocale(an.dataset.addnome); return; }
  const dl=t.closest('[data-dellocale]');
  if(dl){
    const l=doc.locali.find(x=>x.id===+dl.dataset.dellocale);
    const pieno=l && (locMisurato(l) || locRighe(l,doc.prezzi).length);
    if(pieno && !confirm(`Eliminare "${l.nome}" con le sue misure e lavori?`)) return;
    doc.locali=doc.locali.filter(x=>x.id!==+dl.dataset.dellocale); wzSalva(); wzRender(); return;
  }
  const a=t.closest('[data-a]'); if(!a) return;
  const act=a.dataset.a;
  if(act==='manuale') wzInizia('manuale');
  else if(act==='avanti') wzAvanti();
  else if(act==='addlocale') wzAddLocale();
  else if(act==='cliente'){ if(wzStep){ wzStep=0; wzRender(); const n=wzEl('wzNome'); if(n) n.focus(); } }
  else if(act==='continua') wzInizia(doc.via||'manuale');
  else if(act==='nuovo'){ wzSalvaOra(); wzNuovo(); try{ window.scrollTo(0,0); }catch(e2){} }
}
function wzInput(e){
  const t=e.target, d=t.dataset;
  if(d.cli){
    doc.cliente[d.cli]=t.value;
    if(d.cli==='nome'){ const b=document.querySelector('.wz-head-t b'); if(b && wzStep) b.textContent=t.value||'Senza nome'; }
    wzSalva(); return;
  }
  if(d.nome){ const l=doc.locali.find(x=>x.id===+d.nome); if(l){ l.nome=t.value; wzSalva(); } return; }
  if(d.doc==='sconto'){ doc.sconto=Math.min(100,prNum(t.value)); wzAggTotali(); wzSalva(); }
}
// Aggiorna i totali sul posto (un ridisegno completo mangerebbe il tocco su "Crea il PDF").
function wzAggTotali(){
  const T=docTotali(doc);
  const iv=wzEl('wzIvaVal'); if(iv) iv.textContent=prEur(T.iva);
  const tv=wzEl('wzTotVal'); if(tv) tv.textContent=prEur(T.tot);
  const ci=document.querySelector('.wz-cta-info'); if(ci) ci.innerHTML=wzCtaInfo();
}
function wzChange(e){
  const d=e.target.dataset;
  if(d.doc==='iva'){ doc.iva=parseFloat(e.target.value)||0; wzAggTotali(); wzSalva(); }
  else if(d.doc==='validita'){ doc.validita=parseInt(e.target.value,10)||30; wzSalva(); }
}

/* ── scheda di un locale (misure o lavori) ── */
function wzLoc(){ return doc && doc.locali.find(x=>x.id===wzSel); }
function wzApriScheda(id){
  wzSel=id; const l=wzLoc(); if(!l) return;
  if(wzStep===3) wzDisegnaLavori(); else wzDisegnaMisure();
  wzEl('wzSheetBg').style.display='flex';
  document.body.style.overflow='hidden';
}
function wzChiudiScheda(silenzioso){
  const bg=wzEl('wzSheetBg'); if(bg) bg.style.display='none';
  document.body.style.overflow='';
  wzSel=null;
  if(!silenzioso) wzRender();
}
function wzKv(s){
  return s ? `<div><span>Pavimento</span><b>${prF2(s.pavimento)} m²</b></div><div><span>Pareti${s.ded>0?' nette':''}</span><b>${prF2(s.pareti)} m²</b></div><div><span>Soffitto</span><b>${prF2(s.soffitto)} m²</b></div>`
           : `<div class="warn" style="grid-column:1/-1"><span>Superfici</span><b>Compaiono appena inserisci lunghezza e larghezza</b></div>`;
}
function wzDisegnaMisure(){
  const l=wzLoc();
  wzEl('wzSheet').innerHTML=`
    <div class="wz-sh-head"><input class="wz-sh-title" data-sh-nome value="${esc(l.nome)}" aria-label="Nome del locale"><button type="button" class="wz-x" data-sh="close" aria-label="Chiudi">×</button></div>
    <div class="wz-dims">
      <label class="wz-field"><span class="wz-lbl">Lungh. m</span><input class="wz-input" id="mL" inputmode="decimal" value="${prIn(l.L)}" placeholder="4,20"></label>
      <label class="wz-field"><span class="wz-lbl">Largh. m</span><input class="wz-input" id="mW" inputmode="decimal" value="${prIn(l.W)}" placeholder="3,60"></label>
      <label class="wz-field"><span class="wz-lbl">Altezza m</span><input class="wz-input" id="mH" inputmode="decimal" value="${prIn(l.H||H_BASE)}"></label>
    </div>
    <div class="wz-kv" id="mKv">${wzKv(locSup(l))}</div>
    <div class="wz-sh-foot"><button type="button" class="wz-ghost" data-sh="close">Annulla</button><button type="button" class="wz-primary" data-sh="salva-mis">Salva misure</button></div>`;
}
function wzQLav(l,x){
  const s=locSup(l), on=!!l.lav[x.id], q= x.su==='corpo' ? 1 : (s ? s[x.su] : 0);
  return (x.su==='corpo' ? 'a corpo' : (s ? `${prF2(q)} ${SU_LBL[x.su]}` : 'mancano le misure')) + (on && q ? ` → ${prEur(q*prNum(doc.prezzi[x.id]))}` : '');
}
function wzDisegnaLavori(){
  const l=wzLoc(), s=locSup(l);
  const opt=(o,v)=>Object.keys(o).map(k=>`<option value="${k}"${k===v?' selected':''}>${typeof o[k]==='string'?o[k]:o[k].lbl}</option>`).join('');
  wzEl('wzSheet').innerHTML=`
    <div class="wz-sh-head"><h3>${esc(l.nome||'Locale')}</h3><button type="button" class="wz-x" data-sh="close" aria-label="Chiudi">×</button></div>
    <div class="wz-kv" id="lavKv">${wzKv(s)}</div>

    <div class="wz-sec">Lavori più usati <small>prezzo al m²</small></div>
    <div class="wz-rows">${LAVORI_STD.map(x=>{ const on=!!l.lav[x.id]; return `
      <label class="wz-lav${on?' on':''}">
        <input type="checkbox" data-lav="${x.id}"${on?' checked':''}>
        <span class="ln-n">${x.nome}</span>
        <span class="ln-q${(!s&&x.su!=='corpo')?' warn':''}" data-q="${x.id}">${wzQLav(l,x)}</span>
        <span class="ln-p"><input inputmode="decimal" data-prezzo="${x.id}" value="${prIn(prNum(doc.prezzi[x.id]))}" aria-label="Prezzo ${x.nome}"><small>${x.su==='corpo'?'€ a corpo':'€ al m²'}</small></span>
      </label>`; }).join('')}</div>

    <div class="wz-sec">Impianti <small>a corpo</small></div>
    <div class="wz-rows">${IMPIANTI.map(k=>{ const x=l.imp[k.id]; return `
      <div class="wz-lav${x.on?' on':''}">
        <input type="checkbox" id="imp-${k.id}" data-imp="${k.id}"${x.on?' checked':''}>
        <label class="ln-n" for="imp-${k.id}">${k.nome}</label>
        <span class="ln-q">${x.on?'dettagli facoltativi qui sotto':'tocca per aggiungere'}</span>
        <span class="ln-p"><input inputmode="decimal" data-imp-p="${k.id}" value="${prIn(prNum(x.p))}" placeholder="0,00" aria-label="Prezzo ${k.nome}"><small>€ a corpo</small></span>
        ${x.on?`<input class="nota" data-imp-n="${k.id}" value="${esc(x.nota)}" placeholder="${k.es}" aria-label="Dettagli ${k.nome}">`:''}
      </div>`; }).join('')}</div>

    <div class="wz-sec">Infissi <small>tolti dalle pareti</small></div>
    <div class="wz-rows">${l.inf.map((x,i)=>`
      <div class="wz-inf">
        <div class="dw" data-dw="${i}">${disegnoInfisso(x,96,110)}</div>
        <div class="g">
          <label class="f" style="grid-column:1/-1"><span>Tipo</span><select class="sm" data-inf="${i}" data-k="tipo">${opt(TIPI_INF,x.tipo)}</select></label>
          <label class="f"><span>Largh. mm</span><input class="sm" inputmode="numeric" data-inf="${i}" data-k="lung" value="${esc(x.lung)}"></label>
          <label class="f"><span>Alt. mm</span><input class="sm" inputmode="numeric" data-inf="${i}" data-k="alt" value="${esc(x.alt)}"></label>
          <label class="f"><span>Ante</span><select class="sm" data-inf="${i}" data-k="ante">${[1,2,3,4].map(n=>`<option${n===+x.ante?' selected':''}>${n}</option>`).join('')}</select></label>
          <label class="f"><span>Apertura</span><select class="sm" data-inf="${i}" data-k="apr">${opt(APR,x.apr)}</select></label>
          <div class="w2"><label class="f"><span>Prezzo €</span><input class="sm" inputmode="decimal" data-inf="${i}" data-k="prezzo" value="${prIn(prNum(x.prezzo))}"></label>
            <button type="button" class="wz-del" data-sh="del-inf" data-i="${i}" aria-label="Elimina infisso">×</button></div>
        </div>
      </div>`).join('')}
      <button type="button" class="wz-add" data-sh="add-inf">+ Aggiungi infisso</button></div>

    <div class="wz-sec">Altre lavorazioni <small>scritte a mano</small></div>
    <div class="wz-rows">${l.man.map((x,i)=>`
      <div class="wz-man">
        <input class="sm nm" data-man="${i}" data-k="nome" value="${esc(x.nome)}" placeholder="Es. Posa rivestimento bagno" aria-label="Descrizione">
        <label class="f"><span>Quantità</span><input class="sm" inputmode="decimal" data-man="${i}" data-k="q" value="${x.u==='a corpo'?'':prIn(prNum(x.q))}"${x.u==='a corpo'?' disabled placeholder="—"':''}></label>
        <label class="f"><span>Unità</span><select class="sm" data-man="${i}" data-k="u">${UNITA.map(u=>`<option${u===x.u?' selected':''}>${u}</option>`).join('')}</select></label>
        <label class="f"><span>Prezzo €</span><input class="sm" inputmode="decimal" data-man="${i}" data-k="p" value="${prIn(prNum(x.p))}"></label>
        <button type="button" class="wz-del" data-sh="del-man" data-i="${i}" aria-label="Elimina lavorazione">×</button>
      </div>`).join('')}
      <button type="button" class="wz-add" data-sh="add-man">+ Scrivi una lavorazione</button></div>

    <div class="wz-sec">Note del locale <small>vanno nel PDF</small></div>
    <textarea class="wz-input wz-note" data-note rows="2" placeholder="Es. pareti con umidità, piastrelle scelte dal cliente…">${esc(l.note||'')}</textarea>

    <div class="wz-sh-foot"><button type="button" class="wz-ghost" data-sh="copia">Copia su tutti i locali</button><b id="lavTot">Totale locale ${prEur(locTot(l,doc.prezzi))}</b></div>
    <button type="button" class="wz-primary wz-full" data-sh="close">Fatto</button>`;
}
function wzAggLavori(){
  const l=wzLoc(); if(!l) return;
  const kv=wzEl('lavKv'); if(kv) kv.innerHTML=wzKv(locSup(l));
  LAVORI_STD.forEach(x=>{ const el=document.querySelector(`[data-q="${x.id}"]`); if(el) el.textContent=wzQLav(l,x); });
  l.inf.forEach((x,i)=>{ const el=document.querySelector(`[data-dw="${i}"]`); if(el) el.innerHTML=disegnoInfisso(x,96,110); });
  const t=wzEl('lavTot'); if(t) t.textContent='Totale locale '+prEur(locTot(l,doc.prezzi));
}
function wzSheetInput(e){
  const l=wzLoc(); if(!l) return;
  const t=e.target, d=t.dataset;
  if(t.id==='mL'||t.id==='mW'||t.id==='mH'){
    const kv=wzEl('mKv'); if(kv) kv.innerHTML=wzKv(locSup({L:prNum(wzEl('mL').value), W:prNum(wzEl('mW').value), H:prNum(wzEl('mH').value)||H_BASE, inf:l.inf}));
    return;
  }
  if(d.shNome!==undefined){ l.nome=t.value; wzSalva(); return; }
  if(d.prezzo){ doc.prezzi[d.prezzo]=prNum(t.value); wzAggiornaListino(d.prezzo, doc.prezzi[d.prezzo]); }
  else if(d.impP) l.imp[d.impP].p=prNum(t.value);
  else if(d.impN) l.imp[d.impN].nota=t.value;
  else if(d.inf!==undefined && t.tagName==='INPUT') l.inf[+d.inf][d.k]= d.k==='prezzo' ? prNum(t.value) : (parseInt(t.value,10)||0);
  else if(d.man!==undefined && t.tagName==='INPUT') l.man[+d.man][d.k]= d.k==='nome' ? t.value : prNum(t.value);
  else if(d.note!==undefined) l.note=t.value;
  else return;
  wzAggLavori(); wzSalva();
}
function wzSheetChange(e){
  const l=wzLoc(); if(!l || wzStep!==3) return;
  const t=e.target, d=t.dataset;
  if(d.lav) l.lav[d.lav]=t.checked;
  else if(d.imp) l.imp[d.imp].on=t.checked;
  else if(d.inf!==undefined && t.tagName==='SELECT'){
    const i=+d.inf, x=l.inf[i];
    if(d.k==='tipo') l.inf[i]=Object.assign(nuovoInfisso(t.value),{apr:x.apr});
    else if(d.k==='ante') x.ante=parseInt(t.value,10)||1; else x.apr=t.value;
  }
  else if(d.man!==undefined && d.k==='u') l.man[+d.man].u=t.value;
  else return;
  wzSalva(); wzDisegnaLavori();
}
function wzSheetClick(e){
  const a=e.target.closest('[data-sh]'); if(!a) return;
  const l=wzLoc(), act=a.dataset.sh;
  if(act==='close') return wzChiudiScheda();
  if(!l) return;
  if(act==='salva-mis'){
    l.L=prNum(wzEl('mL').value); l.W=prNum(wzEl('mW').value); l.H=prNum(wzEl('mH').value)||H_BASE;
    wzSalva(); wzChiudiScheda();
    const restano=doc.locali.filter(x=>!locMisurato(x)).length;
    wzToast(locMisurato(l) ? (restano?`Misure salvate · ${restano} da misurare`:'Tutti i locali sono misurati') : 'Mancano lunghezza e larghezza');
    return;
  }
  if(act==='add-inf'){ l.inf.push(nuovoInfisso('finestra')); wzSalva(); wzDisegnaLavori(); return; }
  if(act==='del-inf'){ l.inf.splice(+a.dataset.i,1); wzSalva(); wzDisegnaLavori(); return; }
  if(act==='add-man'){
    l.man.push({nome:'', q:0, u:'m²', p:0}); wzDisegnaLavori();
    const ins=document.querySelectorAll('.wz-man .nm'); const u=ins[ins.length-1]; if(u) u.focus(); return;
  }
  if(act==='del-man'){ l.man.splice(+a.dataset.i,1); wzSalva(); wzDisegnaLavori(); return; }
  if(act==='copia'){
    doc.locali.forEach(x=>{
      if(x===l) return;
      x.lav=Object.assign({}, l.lav);
      x.imp=JSON.parse(JSON.stringify(l.imp));
      x.man=l.man.filter(m=>String(m.nome||'').trim()).map(m=>Object.assign({}, m));
    });
    wzSalva(); wzChiudiScheda(); wzToast('Lavori e impianti copiati su tutti i locali (gli infissi no)');
  }
}

/* ── collegamento agli eventi (una volta sola) ── */
function wzInit(){
  const root=wzEl('wz'), sh=wzEl('wzSheet'), bg=wzEl('wzSheetBg');
  if(!root || root._wz) return; root._wz=true;
  root.addEventListener('click', wzClick);
  root.addEventListener('input', wzInput);
  root.addEventListener('change', wzChange);
  if(sh){ sh.addEventListener('click', wzSheetClick); sh.addEventListener('input', wzSheetInput); sh.addEventListener('change', wzSheetChange); }
  if(bg) bg.addEventListener('click', e=>{ if(e.target===bg) wzChiudiScheda(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && bg && bg.style.display==='flex') wzChiudiScheda(); });
}
