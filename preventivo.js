// ══════════════════════════════════════════════════════════
//  PREVENTIVO — il flusso in 3 passi
//  ① Locali (o Pianta) con le misure  ② Lavori  ③ Preventivo
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
  {id:'cs', nome:'Controsoffitto',         su:'soffitto'}
];
// Voci per tutto il cantiere (una volta sola, non per locale)
const VOCI_CANTIERE=[
  {nome:'Smaltimento macerie', p:250},
  {nome:'Pulizia finale di cantiere', p:150},
  {nome:'Trabattello / ponteggio', p:0},
  {nome:'Pratiche edilizie (CILA)', p:0}
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
function nuovoLocale(id, nome){ return {id, nome:nome||'', L:0, W:0, H:H_BASE, lav:{}, corpo:{}, imp:impVuoti(), inf:[], man:[], note:''}; }
function nuovoInfisso(tipo){ const d=TIPI_INF[tipo]||TIPI_INF.finestra; return {tipo:TIPI_INF[tipo]?tipo:'finestra', lung:d.lung, alt:d.alt, ante:d.ante, apr:'battente', prezzo:d.prezzo}; }
// Prezzi proposti: quelli base, sostituiti da quelli del listino dell'impresa.
function prezziListino(){
  const l=Store.loadListino(), p=Object.assign({}, PREZZI_BASE);
  LAVORI_STD.forEach(x=>{ if(Number.isFinite(l[x.id])) p[x.id]=l[x.id]; });
  return p;
}
// Un locale nuovo riceve i lavori scelti "in tutti i locali".
function conLavoriComuni(l, d){ Object.assign(l.lav, ((d&&d.tutti)||{}).lav||{}); return l; }
function nuovoDoc(){
  const ora=new Date();
  return {
    v:2, id:Date.now(), numero:nextNum(), data:ora.toLocaleDateString('it-IT'), dataISO:ora.toISOString(),
    stato:'bozza', mod:Date.now(), via:null,
    cliente:{nome:'', tel:'', email:'', indirizzo:''},
    locali:[], prezzi:prezziListino(), tutti:{lav:{}}, cantiere:[],
    sconto:0, iva:22, validita:30, totale:0
  };
}
// Un documento arrivato da backup/cloud può essere incompleto: lo si completa.
function normalizzaDoc(d){
  d.cliente=Object.assign({nome:'',tel:'',email:'',indirizzo:''}, d.cliente||{});
  d.prezzi=Object.assign({}, PREZZI_BASE, d.prezzi||{});
  d.tutti={lav:Object.assign({}, ((d.tutti||{}).lav)||{})};
  d.cantiere=(Array.isArray(d.cantiere)?d.cantiere:[]).map(x=>Object.assign({nome:'',q:1,u:'a corpo',p:0}, x||{}));
  // smaltimento macerie: prima era un lavoro per locale, ora è una voce del cantiere
  if((d.locali||[]).some(l=>l && l.lav && l.lav.sm)){
    if(!d.cantiere.some(x=>x.nome==='Smaltimento macerie')) d.cantiere.push({nome:'Smaltimento macerie', q:1, u:'a corpo', p:prNum((d.prezzi||{}).sm)||250});
    d.locali.forEach(l=>{ if(l && l.lav) delete l.lav.sm; });
  }
  if(d.tutti.lav.sm) delete d.tutti.lav.sm;
  d.locali=(Array.isArray(d.locali)?d.locali:[]).map((l,i)=>{
    const n=Object.assign(nuovoLocale(i), l||{});
    n.lav=Object.assign({}, n.lav||{});
    n.corpo=Object.assign({}, n.corpo||{});
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
  // stanze non rettangolari (dalla pianta): l.forma = {a: area/rettangolo, p: perimetro/rettangolo}
  const fa=(l.forma&&l.forma.a>0)?l.forma.a:1, fp=(l.forma&&l.forma.p>0)?l.forma.p:1;
  const H=l.H>0?l.H:H_BASE, per=2*(l.L+l.W)*fp, lordo=per*H, ded=Math.min(locAreaInfissi(l)+(Number(l.dedExtra)||0), lordo);
  return {pavimento:l.L*l.W*fa, soffitto:l.L*l.W*fa, pareti:lordo-ded, lordo, ded, perimetro:per};
}
const descInfisso=x=>`${APR[x.apr]||APR.battente}, ${x.ante} ${x.ante>1?'ante':'anta'}`;
const nomeInfisso=x=>`${(TIPI_INF[x.tipo]||TIPI_INF.finestra).lbl} ${Math.round(prNum(x.lung))}×${Math.round(prNum(x.alt))} mm`;
// Righe di un locale: {nome, nota, q, u, p, tot, inf?}
function locRighe(l, prezzi){
  const s=locSup(l), out=[];
  LAVORI_STD.forEach(x=>{
    if(!(l.lav||{})[x.id]) return;
    if(!s && x.su!=='corpo'){
      // locale senza misure: il lavoro si prezza a corpo (se manca il prezzo non entra)
      const p=prNum((l.corpo||{})[x.id]);
      if(p) out.push({nome:x.nome, q:1, u:'a corpo', p, tot:p});
      return;
    }
    const q= x.su==='corpo' ? 1 : s[x.su], p=prNum(prezzi[x.id]);
    out.push({nome:x.nome, q, u: x.su==='corpo'?'a corpo':'m²', su:x.su, p, tot:q*p});
  });
  IMPIANTI.forEach(k=>{
    const x=(l.imp||{})[k.id]; if(!x || !x.on) return;
    const p=prNum(x.p);
    out.push({nome:k.nome, nota:x.nota||'', q:1, u:'a corpo', p, tot:p});
  });
  (l.inf||[]).forEach(x=>{
    const p=prNum(x.prezzo);
    if(x.pid && !p) return;   // disegnato sulla pianta ma senza prezzo: conta solo per le superfici
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
// Voci del cantiere: {nome, q, u, p} come le lavorazioni a mano
function cantiereRighe(d){
  return (d.cantiere||[]).filter(x=>String(x.nome||'').trim()).map(x=>{
    const c=x.u==='a corpo', q=c?1:prNum(x.q), p=prNum(x.p);
    return {nome:x.nome, q, u:x.u||'a corpo', p, tot:q*p};
  });
}
const cantiereTot=d=>cantiereRighe(d).reduce((a,x)=>a+x.tot,0);
function docTotali(d){
  const sub=(d.locali||[]).reduce((a,l)=>a+locTot(l,d.prezzi||{}),0)+cantiereTot(d);
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

/* ══════════ PIANTA 2D (anteprima salvata da pianta.js) ══════════
   fase: 'pianta' | 'misure' | 'lavori' | 'pdf' */
function svgPianta(d, fase){
  const a=d && d.pianta && d.pianta.anteprima;
  if(!a || !a.muri || !a.muri.length) return '';
  const pdf=fase==='pdf';
  const [x0,y0,x1,y1]=a.box, S=Math.max(x1-x0,y1-y0,a.cell*6), pad=S*.04+a.cell;
  const vbA=[x0-pad,y0-pad,(x1-x0)+2*pad,(y1-y0)+2*pad].map(v=>+v.toFixed(1)), vb=vbA.join(' ');
  // misura in pixel esplicita: senza, chi trasforma la pagina in PDF (html2canvas)
  // può prendere la pianta a dimensione "naturale" e mostrarne solo un angolo
  let pxW=600, pxH=Math.max(60, Math.round(pxW*vbA[3]/vbA[2]));
  if(pdf){ const k=Math.min(440/vbA[2], 230/vbA[3]); pxW=Math.round(vbA[2]*k); pxH=Math.round(vbA[3]*k); }
  const sw=S/170, fs0=S/24;
  const locs=new Map((d.locali||[]).map(l=>[l.id,l]));
  let out=`<svg viewBox="${vb}" width="${pxW}" height="${pxH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pianta dei locali" style="${pdf?'display:block;max-width:100%;height:auto':'display:block;width:100%;height:auto;max-height:320px'}">`;
  (a.stanze||[]).forEach(st=>{
    const l=locs.get(st.locId);
    const s=l?locSup(l):null;
    let fill=pdf?'#EEF3FB':'#E1EBFB', riga2='', col2='#6B7280';
    if(!pdf && fase==='misure' && !s){ fill='#FEF3C7'; riga2='tocca per le misure'; col2='#B45309'; }
    else if(!pdf && fase==='lavori'){ const t=l?locTot(l,d.prezzi||{}):0; if(t>0) riga2=prEur(t); else { riga2='tocca per i lavori'; col2='#2563EB'; } }
    else if(s) riga2=`${prF1(s.pavimento)} m²`;
    out+=`<g${l&&!pdf?` data-room="${l.id}" style="cursor:pointer"`:''}>`+
      (st.rect||[]).map(r=>`<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="${fill}"/>`).join('');
    const nome=l ? (l.nome||'?') : '?';
    const fs=Math.min(fs0, st.w/Math.max(4,nome.length*.62+1), st.h/3.2);
    if(fs>S/90){
      out+=`<text x="${st.lx}" y="${st.ly-(riga2?fs*.35:0)}" font-size="${fs.toFixed(1)}" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="${l&&l.nome?'#111827':'#2563EB'}" font-family="-apple-system,Arial,sans-serif">${esc(nome)}</text>`;
      if(riga2) out+=`<text x="${st.lx}" y="${st.ly+fs*.85}" font-size="${(fs*.78).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="${col2}" font-family="-apple-system,Arial,sans-serif">${esc(riga2)}</text>`;
    }
    out+='</g>';
  });
  out+=`<path d="${a.muri.map(m=>`M${m[0]} ${m[1]}L${m[2]} ${m[3]}`).join('')}" stroke="#111827" stroke-width="${(sw*2.2).toFixed(2)}" stroke-linecap="round" fill="none"/>`;
  if(!pdf && (a.vani||[]).length) out+=`<path d="${a.vani.map(m=>`M${m[0]} ${m[1]}L${m[2]} ${m[3]}`).join('')}" stroke="#2563EB" stroke-width="${sw.toFixed(2)}" stroke-dasharray="${(sw*3).toFixed(1)} ${(sw*2.5).toFixed(1)}" fill="none"/>`;
  (a.quote||[]).forEach(q=>{
    const fq=(fs0*.8).toFixed(1), off=sw*3, col=q.d?'#6B7280':'#2563EB', peso=q.d?'500':'700';
    out+= q.o==='H' ? `<text x="${q.x}" y="${q.y-off}" font-size="${fq}" font-weight="${peso}" text-anchor="middle" fill="${col}" stroke="#fff" stroke-width="${(sw*1.4).toFixed(2)}" paint-order="stroke" font-family="-apple-system,Arial,sans-serif">${esc(q.txt)}</text>`
                    : `<text x="${q.x-off}" y="${q.y}" font-size="${fq}" font-weight="${peso}" text-anchor="middle" fill="${col}" stroke="#fff" stroke-width="${(sw*1.4).toFixed(2)}" paint-order="stroke" font-family="-apple-system,Arial,sans-serif" transform="rotate(-90 ${q.x-off} ${q.y})">${esc(q.txt)}</text>`;
  });
  (a.inf||[]).forEach(f=>{
    const h=f.half, hor=f.o==='H';
    const A= hor?[f.x-h,f.y]:[f.x,f.y-h], B= hor?[f.x+h,f.y]:[f.x,f.y+h];
    out+=`<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="${pdf?'#fff':'#F7F8FA'}" stroke-width="${(sw*3).toFixed(2)}"/>`;
    if(f.tipo==='porta'||f.tipo==='portafinestra'){
      const r=2*h, c=f.tipo==='porta'?'#111827':'#2563EB';
      out+= hor ? `<path d="M${A[0]} ${A[1]}L${A[0]} ${A[1]+r}M${A[0]+r} ${A[1]}A${r} ${r} 0 0 1 ${A[0]} ${A[1]+r}" stroke="${c}" stroke-width="${(sw*.8).toFixed(2)}" fill="none"/>`
                : `<path d="M${A[0]} ${A[1]}L${A[0]-r} ${A[1]}M${A[0]} ${A[1]+r}A${r} ${r} 0 0 1 ${A[0]-r} ${A[1]}" stroke="${c}" stroke-width="${(sw*.8).toFixed(2)}" fill="none"/>`;
    }
    if(f.tipo!=='porta'){
      const o=sw*1.1, c=f.tipo==='vano'?'#6B7280':'#2563EB';
      out+= hor ? `<path d="M${A[0]} ${A[1]-o}L${B[0]} ${B[1]-o}M${A[0]} ${A[1]+o}L${B[0]} ${B[1]+o}" stroke="${c}" stroke-width="${(sw*.8).toFixed(2)}"/>`
                : `<path d="M${A[0]-o} ${A[1]}L${B[0]-o} ${B[1]}M${A[0]+o} ${A[1]}L${B[0]+o} ${B[1]}" stroke="${c}" stroke-width="${(sw*.8).toFixed(2)}"/>`;
    }
  });
  return out+'</svg>';
}
const haPianta=d=>!!(d && d.pianta && d.pianta.anteprima && d.pianta.anteprima.muri && d.pianta.anteprima.muri.length);

/* ══════════ PDF ══════════ */
function buildPdfPrev(d){
  d=normalizzaDoc(JSON.parse(JSON.stringify(d)));
  const T=docTotali(d), c=d.cliente;
  const th='background:#111827;color:#fff;text-align:left;font-size:10.5px;padding:5px 7px';
  const td='padding:4px 7px;border-bottom:1px solid #E5E7EB;vertical-align:middle';
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
    return `<tbody class="no-break">${testa}${righe}${note}</tbody>`;   // un locale non si spezza tra due pagine
  }).join('') + (()=>{
    const rc=cantiereRighe(d); if(!rc.length) return '';
    return `<tbody class="no-break"><tr><td colspan="4" style="${td};background:#F3F4F6;font-weight:700">Per tutto il cantiere</td><td style="${td};background:#F3F4F6;${r};font-weight:700">${prEur(cantiereTot(d))}</td></tr>`+
      rc.map(x=>`<tr><td style="${td}">${esc(x.nome)}</td><td style="${td};${r}">${x.u==='a corpo'?'a corpo':prF2(x.q)+' '+esc(x.u)}</td><td style="${td};${r}">${prEur(x.p)}</td><td style="${td}"></td><td style="${td};${r}">${prEur(x.tot)}</td></tr>`).join('')+'</tbody>';
  })();
  const indir=[c.indirizzo, c.tel, c.email].filter(Boolean).map(esc).join(' · ');
  return `
  <div style="display:flex;justify-content:space-between;gap:16px;padding-bottom:10px;border-bottom:2px solid #111827">
    ${intestazionePDF()}
    <div style="text-align:right;font-size:11px;color:#6B7280;white-space:nowrap">
      <div style="font-size:14px;font-weight:800;color:#111827">${esc(numDoc(d.numero))}</div>
      <div>${esc(d.data||'')}</div><div>Valido ${d.validita} giorni</div>
    </div>
  </div>
  <div style="background:#F3F4F6;border-radius:8px;padding:8px 12px;margin:12px 0">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#6B7280">Cliente</div>
    <div style="font-size:15px;font-weight:700">${esc(c.nome||'')}</div>
    ${indir?`<div style="font-size:11.5px;color:#374151">${indir}</div>`:''}
  </div>
  ${haPianta(d)?`<div class="no-break"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#6B7280;margin:12px 0 6px">Pianta dei locali${d.pianta.inScala?'':' (schizzo non in scala)'}</div>
  <div style="text-align:center"><div style="display:inline-block;border:1px solid #E5E7EB;border-radius:6px;padding:8px;max-width:100%">${svgPianta(d,'pdf')}</div></div></div>`:''}
  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#6B7280;margin:12px 0 6px">Dettaglio lavori per locale</div>
  <table style="width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums">
    <thead><tr><th style="${th}">Lavorazione</th><th style="${th};${r}">Quantità</th><th style="${th};${r}">Prezzo</th><th style="${th};width:4px"></th><th style="${th};${r}">Importo</th></tr></thead>
    ${corpo || `<tbody><tr><td colspan="5" style="${td}">Nessuna lavorazione inserita.</td></tr></tbody>`}
  </table>
  <div class="no-break firme" style="padding-top:12px">
  <div style="margin:0 0 0 auto;width:min(270px,100%);font-size:12.5px;font-variant-numeric:tabular-nums">
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span>Subtotale</span><span>${prEur(T.sub)}</span></div>
    ${T.sc>0?`<div style="display:flex;justify-content:space-between;padding:3px 0"><span>Sconto ${prF2(d.sconto).replace(/,00$/,'')}%</span><span>− ${prEur(T.sc)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span>Imponibile</span><span>${prEur(T.imp)}</span></div>`:''}
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span>IVA ${d.iva}%</span><span>${prEur(T.iva)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:7px 0 0;margin-top:4px;border-top:2px solid #111827;font-size:16px;font-weight:800"><span>Totale</span><span>${prEur(T.tot)}</span></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:34px">
    <div style="border-top:1px solid #111827;padding-top:4px;text-align:center;color:#6B7280;font-size:10.5px">Firma cliente per accettazione</div>
    <div style="border-top:1px solid #111827;padding-top:4px;text-align:center;color:#6B7280;font-size:10.5px">Firma impresa</div>
  </div>
  </div>`;
}

/* ══════════ EDITOR ══════════
   0 = cliente · 1 = Locali (o Pianta) con le misure · 2 = Lavori · 3 = Preventivo */
let doc=null, wzStep=0, wzSel=null, _wzSaveT=null, _wzToastT=null, _wzMisPrima=null;
const passiLbl=()=>[doc&&doc.via==='disegno'?'Pianta':'Locali','Lavori','Preventivo'];

function wzEl(id){ return document.getElementById(id); }
function wzToast(msg){
  const t=wzEl('wzToast'); if(!t) return;
  t.textContent=msg; t.style.display='block';
  clearTimeout(_wzToastT); _wzToastT=setTimeout(()=>{ t.style.display='none'; }, msg.length>80?6000:2800);
}
function wzNuovo(){ doc=nuovoDoc(); wzStep=0; wzSel=null; wzChiudiScheda(true); wzRender(); }
function wzApri(id){
  const p=preventivi.find(x=>String(x.id)===String(id)); if(!p) return false;
  if(p.v!==2){ alert('Questo preventivo è stato creato con la vecchia versione dell\'app e non si può più aprire. Puoi eliminarlo dall\'Archivio.'); return false; }
  doc=normalizzaDoc(JSON.parse(JSON.stringify(p)));
  const conLavori=doc.locali.some(l=>locRighe(l,doc.prezzi).length) || cantiereRighe(doc).length;
  wzSel=null; wzStep= !doc.locali.length ? 1 : (conLavori ? 3 : 2);
  wzRender();
  return true;
}
// Salvataggio: basta il nome del cliente. Un nuovo documento conta per il piano gratuito.
function wzSalvaOra(){
  clearTimeout(_wzSaveT);
  if(!doc || !(String(doc.cliente.nome||'').trim() || doc.locali.length || doc.cantiere.length)) return false;
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
  const s=wzEl('wzSalvato'); if(s && doc && (doc.cliente.nome || doc.locali.length)) s.textContent='Salvataggio…';
  clearTimeout(_wzSaveT); _wzSaveT=setTimeout(wzSalvaOra, 700);
}
// Il prezzo di un lavoro più usato diventa quello proposto nei prossimi preventivi.
function wzAggiornaListino(id, v){ const l=Store.loadListino(); l[id]=v; Store.saveListino(l); }
function wzSetPrezzo(id, v){ if(!doc) return; doc.prezzi[id]=v; wzAggiornaListino(id, v); }

/* ── schermate ── */
function wzRender(){
  const root=wzEl('wz'); if(!root) return;
  if(!doc) doc=nuovoDoc();
  const pt=wzEl('pageTitle'), pn=wzEl('page-nuovo');
  if(pt && pn && pn.classList.contains('active')) pt.textContent= wzStep ? 'Preventivo' : 'Nuovo';
  if(wzStep===0){
    // pagina iniziale: solo le due scelte
    root.innerHTML=`<div class="wz-start" id="wzStart">
      <button type="button" class="wz-big" data-a="disegno"><span class="wz-big-ico">${icoPianta()}</span><b>Disegna la pianta</b></button>
      <button type="button" class="wz-big" data-a="manuale"><span class="wz-big-ico">${icoElenco()}</span><b>Senza disegno</b></button>
    </div>`;
    root.classList.add('wz-root-start');
    return;
  }
  root.classList.remove('wz-root-start');
  const salvato=preventivi.some(p=>String(p.id)===String(doc.id));
  const nome=String(doc.cliente.nome||'').trim();
  const indietro= wzStep===2 ? (doc.via==='disegno'?'← Pianta':'← Locali') : (wzStep===3 ? '← Lavori' : '');
  root.innerHTML=`
    <div class="wz-head">
      <button type="button" class="wz-head-t" data-a="cliente" aria-label="Dati del cliente"><b>${nome?esc(nome):'Senza nome'}</b>
        <span>${esc(numDoc(doc.numero))} · <span id="wzSalvato">${salvato?'Salvato':'Non ancora salvato'}</span> · <u>${nome?'cliente':'scrivi il cliente'}</u></span></button>
    </div>
    <nav class="wz-steps">${passiLbl().map((p,i)=>`<button type="button" class="wz-st${i+1<wzStep?' fatto':''}${i+1===wzStep?' ora':''}" data-step="${i+1}"><i></i><span>${i+1} · ${p}</span></button>`).join('')}</nav>
    <div class="wz-screen">${wzSchermata()}</div>
    <div class="wz-cta">
      ${indietro?`<button type="button" class="wz-back" data-a="indietro" aria-label="Torna al passo prima">${indietro}</button>`:''}
      <div class="wz-cta-info">${wzCtaInfo()}</div>
      <button type="button" class="wz-primary" data-a="avanti">${['Avanti: lavori','Avanti: preventivo','Crea il PDF'][wzStep-1]}</button></div>`;
  // spunte "in tutti i locali" a metà (solo alcune stanze)
  root.querySelectorAll('[data-tutti][data-meta="1"]').forEach(c=>{ c.indeterminate=true; });
}
function wzCtaInfo(){
  const n=doc.locali.length, mis=doc.locali.filter(locMisurato).length, T=docTotali(doc);
  return [
    `<b>${n} ${n===1?'locale':'locali'}</b>${mis} di ${n} misurati`,
    `<b>${prEur(T.sub)}</b>lavori, IVA esclusa`,
    `<b>${prEur(T.tot)}</b>totale IVA inclusa`
  ][wzStep-1];
}
const chev='<svg class="wz-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
function wzSchermata(){
  const pianta=doc.via==='disegno';
  if(wzStep===1 && pianta){
    const svg=svgPianta(doc,'misure');
    const daMis=doc.locali.filter(l=>!locMisurato(l)).length;
    return `
    <h2 class="wz-h2">La pianta</h2>
    <p class="wz-lead">${svg?(daMis?`Tocca le stanze in arancione per nome e misure (${daMis} senza misure: se non le metti, i loro lavori vanno a corpo).`:`Tutte le stanze hanno le misure${doc.pianta&&doc.pianta.inScala?' · pianta in scala':''}.`):'Disegna col dito: ogni stanza chiusa diventa un locale del preventivo.'}</p>
    ${svg?`<div class="wz-plan">${svg}</div>`:`<button type="button" class="wz-plan wz-plan-vuota" data-a="disegna">${icoPianta()}<span>Foglio bianco: tocca per disegnare</span></button>`}
    <button type="button" class="${svg?'wz-ghost wz-full':'wz-primary wz-full'}" data-a="disegna">${svg?'✏️ Modifica la pianta':'Disegna la pianta'}</button>
    <div class="wz-rows">${doc.locali.map(l=>{ const s=locSup(l); return `
      <div class="wz-editrow"><button type="button" class="wz-row" data-room="${l.id}">
        <span class="n">${esc(l.nome||'Senza nome')}</span>
        <span class="d">${l.inPianta===false?'Non nella pianta':(s?`${prF2(l.L)} × ${prF2(l.W)} · h ${prF2(l.H)} · pareti ${prF1(s.pareti)} m²`:'Senza misure')}</span>
        <span class="v">${s?`${prF1(s.pavimento)} m²`:'<span class="wz-pill todo">da misurare</span>'}</span>${chev}</button>
        ${l.inPianta===false?`<button type="button" class="wz-del" data-dellocale="${l.id}" aria-label="Elimina ${esc(l.nome)}">×</button>`:''}</div>`; }).join('')}</div>
    <button type="button" class="wz-add" data-a="addlocale">+ Locale fuori pianta (es. scale, esterno)</button>
    ${svg?'<button type="button" class="wz-link" data-a="togli-pianta">Togli la pianta e continua senza disegno</button>':''}`;
  }
  if(wzStep===1) return `
    <h2 class="wz-h2">Locali e misure</h2>
    <p class="wz-lead">Tocca un nome per aggiungere il locale, poi scrivi le misure in metri. Le misure sono facoltative: senza, i lavori si prezzano a corpo.</p>
    <div class="wz-chips">${['Lavori generali'].concat(NOMI_LOCALI).map(n=>`<button type="button" class="wz-chip" data-addnome="${esc(n)}">+ ${esc(n)}</button>`).join('')}</div>
    <div class="wz-rows">${doc.locali.map(l=>{ const s=locSup(l); return `
      <div class="wz-loc">
        <div class="wz-editrow"><input class="wz-input wz-loc-n" data-nome="${l.id}" value="${esc(l.nome)}" placeholder="Nome del locale" aria-label="Nome locale" enterkeyhint="next">
          <button type="button" class="wz-del" data-dellocale="${l.id}" aria-label="Elimina ${esc(l.nome)}">×</button></div>
        <div class="wz-loc-m">
          <label><span>Lungh.</span><input class="wz-input" inputmode="decimal" enterkeyhint="next" data-mis="L" data-id="${l.id}" value="${prIn(l.L)}" placeholder="4,20"></label>
          <label><span>Largh.</span><input class="wz-input" inputmode="decimal" enterkeyhint="next" data-mis="W" data-id="${l.id}" value="${prIn(l.W)}" placeholder="3,60"></label>
          <label><span>Altezza</span><input class="wz-input" inputmode="decimal" enterkeyhint="next" data-mis="H" data-id="${l.id}" value="${prIn(l.H||H_BASE)}"></label>
          <b class="wz-loc-mq" data-mq="${l.id}">${s?prF1(s.pavimento)+' m²':'—'}</b>
        </div>
      </div>`; }).join('')}
      ${doc.locali.length?'':'<p class="wz-empty">Nessun locale ancora: tocca un nome qui sopra.</p>'}
    </div>
    <button type="button" class="wz-add" data-a="addlocale">+ Altro locale</button>
    <button type="button" class="wz-ghost wz-full" data-a="aggiungi-pianta">${icoPianta()} Disegna la pianta di questi locali</button>`;
  if(wzStep===2){
    const n=doc.locali.length;
    const comuni=LAVORI_STD.map(x=>{
      const con=doc.locali.filter(l=>l.lav[x.id]), tutti=n && con.length===n, meta=con.length>0 && !tutti;
      return `<label class="wz-lav${tutti?' on':''}">
        <input type="checkbox" data-tutti="${x.id}" data-meta="${meta?1:0}"${tutti?' checked':''}>
        <span class="ln-n">${x.nome}</span>
        <span class="ln-q" data-tq="${x.id}">${wzQTutti(x)}</span>
        <span class="ln-p"><input inputmode="decimal" data-prezzo="${x.id}" value="${prIn(prNum(doc.prezzi[x.id]))}" aria-label="Prezzo ${x.nome}"><small>${x.su==='corpo'?'€ a corpo':'€ al m²'}</small></span>
      </label>`;
    }).join('');
    return `
    <h2 class="wz-h2">Lavori</h2>
    <div class="wz-sec">In tutti i locali <small>spunta una volta, vale per ogni stanza</small></div>
    <div class="wz-rows">${n?comuni:'<p class="wz-empty">Aggiungi prima i locali.</p>'}</div>
    <div class="wz-sec">Stanza per stanza <small>impianti, infissi, extra o eccezioni</small></div>
    ${pianta&&haPianta(doc)?`<div class="wz-plan">${svgPianta(doc,'lavori')}</div>`:''}
    <div class="wz-rows">${doc.locali.map(l=>{ const t=locTot(l,doc.prezzi), dd=wzDiff(l); return `
      <button type="button" class="wz-row" data-room="${l.id}">
        <span class="n">${esc(l.nome||'Senza nome')}</span>
        <span class="d">${locMisurato(l)?'':'<span class="wz-pill todo">a corpo</span> '}${dd?esc(dd):(locMisurato(l)?'Solo i lavori comuni':'')}</span>
        <span class="v">${t?prEur(t):'—'}</span>${chev}</button>`; }).join('')}</div>
    <div class="wz-sec">Per tutto il cantiere <small>una volta sola, non per locale</small></div>
    <div class="wz-rows">${doc.cantiere.map((x,i)=>`
      <div class="wz-man">
        <input class="sm nm" data-gen="${i}" data-k="nome" value="${esc(x.nome)}" placeholder="Es. Smaltimento macerie" aria-label="Descrizione">
        <label class="f"><span>Quantità</span><input class="sm" inputmode="decimal" data-gen="${i}" data-k="q" value="${x.u==='a corpo'?'':prIn(prNum(x.q))}"${x.u==='a corpo'?' disabled placeholder="—"':''}></label>
        <label class="f"><span>Unità</span><select class="sm" data-gen="${i}" data-k="u">${UNITA.map(u=>`<option${u===x.u?' selected':''}>${u}</option>`).join('')}</select></label>
        <label class="f"><span>Prezzo €</span><input class="sm" inputmode="decimal" data-gen="${i}" data-k="p" value="${prIn(prNum(x.p))}"></label>
        <button type="button" class="wz-del" data-delgen="${i}" aria-label="Elimina voce">×</button>
      </div>`).join('')}
      <div class="wz-chips">${VOCI_CANTIERE.filter(v=>!doc.cantiere.some(x=>x.nome===v.nome)).map(v=>`<button type="button" class="wz-chip" data-addgen="${esc(v.nome)}">+ ${esc(v.nome)}</button>`).join('')}<button type="button" class="wz-chip" data-addgen="">+ Altra voce</button></div>
    </div>
    ${pianta?'<button type="button" class="wz-ghost wz-full" data-a="torna-pianta">✏️ Modifica la pianta o le misure</button>':''}`;
  }
  // passo 3: riepilogo
  const T=docTotali(doc);
  const blocchi=doc.locali.map(l=>{
    const rr=locRighe(l,doc.prezzi); if(!rr.length) return '';
    return `<div class="wz-sum-room"><h3>${esc(l.nome||'Locale')}<span>${prEur(locTot(l,doc.prezzi))}</span></h3>${rr.map(x=>`
      <div class="wz-ln"><span>${esc(x.nome)}</span><span class="t">${prEur(x.tot)}</span>
      <span class="q">${esc(x.inf?'1 pz · '+x.nota:qtaTesto(x)+(x.nota?' · '+x.nota:''))}${(x.u!=='a corpo'&&!x.inf)?' × '+prEur(x.p):''}</span></div>`).join('')}</div>`;
  }).join('');
  const rc=cantiereRighe(doc);
  const blocCant= rc.length ? `<div class="wz-sum-room"><h3>Per tutto il cantiere<span>${prEur(cantiereTot(doc))}</span></h3>${rc.map(x=>`
      <div class="wz-ln"><span>${esc(x.nome)}</span><span class="t">${prEur(x.tot)}</span>
      <span class="q">${x.u==='a corpo'?'a corpo':esc(prF2(x.q)+' '+x.u)+' × '+prEur(x.p)}</span></div>`).join('')}</div>` : '';
  const senzaImpresa= typeof impresa!=='undefined' && !String((impresa||{}).nome||'').trim();
  const STATI={bozza:'📝 Bozza', inviato:'📤 Inviato', accettato:'✅ Accettato', rifiutato:'❌ Rifiutato'};
  return `
    <h2 class="wz-h2">Il preventivo</h2>
    ${String(doc.cliente.nome||'').trim()?'':`<div class="wz-field"><label class="wz-lbl" for="wzNome3">Cliente <span style="text-transform:none;letter-spacing:0;font-weight:500">· serve per il PDF</span></label>
      <input class="wz-input" id="wzNome3" data-cli="nome" placeholder="Nome e cognome" autocomplete="off"></div>`}
    ${senzaImpresa?`<div class="wz-nota">Il PDF uscirà senza il nome della tua impresa. <button type="button" class="wz-link-in" data-a="impresa">Completa i dati impresa →</button></div>`:''}
    <div class="wz-sum">${(blocchi+blocCant)||'<div class="wz-sum-room"><p class="wz-empty">Nessuna lavorazione ancora. Torna al passo Lavori.</p></div>'}</div>
    <div class="wz-tot">
      <div class="r"><span>Subtotale lavori</span><span>${prEur(T.sub)}</span></div>
      <div class="r"><label for="wzSconto">Sconto %</label><input class="wz-mini" id="wzSconto" data-doc="sconto" inputmode="decimal" value="${doc.sconto?prIn(doc.sconto):''}" placeholder="0"></div>
      <div class="r"><label for="wzIva">IVA</label><select class="wz-mini" id="wzIva" data-doc="iva">${[22,10,4,0].map(v=>`<option value="${v}"${Number(doc.iva)===v?' selected':''}>${v}%${v===10?' ristrutturazione':''}</option>`).join('')}</select></div>
      <div class="r"><span>IVA</span><span id="wzIvaVal">${prEur(T.iva)}</span></div>
      <div class="r"><label for="wzVal">Validità</label><select class="wz-mini" id="wzVal" data-doc="validita">${[30,60,90].map(v=>`<option value="${v}"${doc.validita===v?' selected':''}>${v} giorni</option>`).join('')}</select></div>
      <div class="r"><label for="wzStato">Stato</label><select class="wz-mini" id="wzStato" data-doc="stato">${Object.keys(STATI).map(k=>`<option value="${k}"${(doc.stato||'bozza')===k?' selected':''}>${STATI[k]}</option>`).join('')}</select></div>
      <div class="r big"><span>Totale</span><span id="wzTotVal">${prEur(T.tot)}</span></div>
    </div>
    `;
}
// Quantità complessiva di un lavoro comune (sui locali che lo hanno, o su tutti se nessuno).
function wzQTutti(x){
  if(x.su==='corpo'){ const k=doc.locali.filter(l=>l.lav[x.id]).length; return k?`a corpo · in ${k} ${k===1?'locale':'locali'}`:'a corpo, per locale'; }
  const con=doc.locali.filter(l=>l.lav[x.id]), base=con.length?con:doc.locali;
  const q=base.reduce((a,l)=>{ const s=locSup(l); return a+(s?s[x.su]:0); },0);
  const senza=base.filter(l=>!locMisurato(l)).length;
  return `${prF1(q)} ${SU_LBL[x.su]}${con.length&&con.length<doc.locali.length?` · in ${con.length} di ${doc.locali.length}`:''}${senza?` · ${senza} senza misure`:''}`;
}
// Cosa ha di diverso un locale rispetto ai lavori comuni.
function wzDiff(l){
  const piu=[], meno=[];
  LAVORI_STD.forEach(x=>{ const c=!!doc.tutti.lav[x.id], on=!!l.lav[x.id]; if(on && !c) piu.push(x.nome); if(!on && c) meno.push(x.nome); });
  IMPIANTI.forEach(k=>{ if(l.imp[k.id].on) piu.push(k.nome); });
  l.inf.forEach(x=>{ if(!x.pid || prNum(x.prezzo)) piu.push((TIPI_INF[x.tipo]||TIPI_INF.finestra).lbl); });
  l.man.forEach(x=>{ if(String(x.nome||'').trim()) piu.push(x.nome); });
  return [piu.length?'+ '+piu.join(', '):'', meno.length?'senza '+meno.join(', ').toLowerCase():''].filter(Boolean).join(' · ');
}
function icoPianta(){ return `<svg width="44" height="34" viewBox="0 0 44 34" aria-hidden="true"><rect x="2" y="2" width="40" height="30" fill="#DBEAFE" stroke="#111827" stroke-width="2.4"/><path d="M22 2v30M2 17h20M22 14h20" fill="none" stroke="#111827" stroke-width="2.4"/></svg>`; }
function icoElenco(){ return `<svg width="40" height="32" viewBox="0 0 40 32" aria-hidden="true">${[4,14,24].map(y=>`<rect x="2" y="${y}" width="6" height="5" rx="1.5" fill="#2563EB"/><rect x="12" y="${y}" width="26" height="5" rx="2.5" fill="#E4E7EC"/>`).join('')}</svg>`; }

/* ── azioni della pagina ── */
function wzVai(step){
  wzStep=Math.max(0,Math.min(3,step)); wzRender();
  try{ window.scrollTo(0,0); }catch(e){}
  if(wzStep===2 && !Store.loadListino()._ok) wzApriListino(true);
}
function wzAvanti(){
  if(wzStep===1 && !doc.locali.length){ wzToast(doc.via==='disegno'?'Disegna almeno una stanza chiusa':'Aggiungi almeno un locale'); return; }
  if(wzStep===1){ const m=doc.locali.filter(l=>!locMisurato(l)).length; if(m) wzToast(`${m} ${m===1?'locale':'locali'} senza misure: le metti anche dopo`); }
  if(wzStep<3){ wzVai(wzStep+1); return; }
  wzPdf();
}
function wzIndietro(){ wzSalvaOra(); wzVai(Math.max(1,wzStep-1)); }
function wzPdf(){
  if(!String(doc.cliente.nome||'').trim()){
    wzToast('Scrivi il nome del cliente per creare il PDF');
    if(wzStep!==3) wzVai(3);
    const n=wzEl('wzNome3'); if(n) n.focus();
    return;
  }
  wzSalvaOra();
  apriPdfModal(buildPdfPrev(doc), 'Preventivo '+numDoc(doc.numero));
}
function wzInizia(via){
  doc.via=via; wzVai(1);
  if(via==='disegno' && !haPianta(doc)) wzDisegna();
}
function wzDisegna(){
  if(typeof Pianta==='undefined') return;
  const t=wzEl('wzToast'); if(t) t.style.display='none';
  Pianta.apri(doc, { cambio:()=>wzSalva(), fine:()=>{
    wzSalvaOra();
    const pronta=doc.locali.length && doc.locali.every(l=>String(l.nome||'').trim() && locMisurato(l));
    if(pronta && wzStep<2){ wzVai(2); wzToast('Pianta completa: ora scegli i lavori'); }
    else wzRender();
  } });
}
// "Usa come modello": stessi locali, lavori e prezzi; cliente nuovo da scrivere.
function wzModello(id){
  const p=preventivi.find(x=>String(x.id)===String(id)); if(!p || p.v!==2) return false;
  const ora=new Date();
  doc=normalizzaDoc(JSON.parse(JSON.stringify(p)));
  Object.assign(doc, {id:Date.now(), numero:nextNum(), data:ora.toLocaleDateString('it-IT'), dataISO:ora.toISOString(), stato:'bozza', mod:Date.now(), totale:0});
  doc.cliente={nome:'', tel:'', email:'', indirizzo:''};
  wzSel=null; wzStep=1; wzRender();
  setTimeout(wzApriCliente, 0);
  return true;
}
// Da pianta a elenco: i locali restano; le porte/finestre disegnate senza prezzo spariscono,
// quelle con un prezzo diventano infissi normali.
function wzTogliPianta(){
  doc.via='manuale'; doc.pianta=null;
  doc.locali.forEach(l=>{
    l.inf=l.inf.filter(x=>!x.pid || prNum(x.prezzo)).map(x=>{ const y=Object.assign({},x); delete y.pid; return y; });
    delete l.daPianta; delete l.inPianta; l.dedExtra=0;
    if(!String(l.nome||'').trim()) l.nome='Locale';
  });
  wzSalva(); wzRender();
}
function wzAddLocale(nome){
  const id=doc.locali.length ? Math.max(...doc.locali.map(l=>l.id))+1 : 1;
  let n=nome||'Locale '+(doc.locali.length+1);
  if(nome){ const stessi=doc.locali.filter(l=>l.nome===nome || l.nome.startsWith(nome+' ')).length; if(stessi) n=nome+' '+(stessi+1); }
  doc.locali.push(conLavoriComuni(nuovoLocale(id, n), doc)); wzSalva(); wzRender();
  // si scrivono subito le misure (o il nome, se è un locale "libero")
  const sel= nome ? `[data-mis="L"][data-id="${id}"]` : `[data-nome="${id}"]`;
  const u=document.querySelector(sel); if(u){ u.focus(); if(!nome && u.select) u.select(); }
}

function wzClick(e){
  const t=e.target;
  const st=t.closest('[data-step]'); if(st){ wzSalvaOra(); wzVai(+st.dataset.step); return; }
  const room=t.closest('[data-room]'); if(room){ wzApriScheda(+room.dataset.room); return; }
  const an=t.closest('[data-addnome]'); if(an){ wzAddLocale(an.dataset.addnome); return; }
  const ag=t.closest('[data-addgen]');
  if(ag){
    const v=VOCI_CANTIERE.find(x=>x.nome===ag.dataset.addgen);
    doc.cantiere.push({nome:ag.dataset.addgen, q:1, u:'a corpo', p:v?v.p:0}); wzSalva(); wzRender();
    const ins=document.querySelectorAll(v?'[data-gen][data-k="p"]':'[data-gen][data-k="nome"]'); const u=ins[ins.length-1]; if(u){ u.focus(); u.select&&u.select(); }
    return;
  }
  const dg=t.closest('[data-delgen]'); if(dg){ doc.cantiere.splice(+dg.dataset.delgen,1); wzSalva(); wzRender(); return; }
  const dl=t.closest('[data-dellocale]');
  if(dl){
    const l=doc.locali.find(x=>x.id===+dl.dataset.dellocale);
    const pieno=l && (locMisurato(l) || l.man.length || l.inf.length || l.imp.el.on || l.imp.id.on);
    if(pieno && !confirm(`Eliminare "${l.nome}" con le sue misure e lavori?`)) return;
    doc.locali=doc.locali.filter(x=>x.id!==+dl.dataset.dellocale); wzSalva(); wzRender(); return;
  }
  const a=t.closest('[data-a]'); if(!a) return;
  const act=a.dataset.a;
  if(act==='manuale') wzInizia('manuale');
  else if(act==='disegno') wzInizia('disegno');
  else if(act==='disegna') wzDisegna();
  else if(act==='torna-pianta') wzVai(1);
  else if(act==='impresa'){ wzSalvaOra(); if(typeof goPage==='function') goPage('impostazioni'); }
  else if(act==='aggiungi-pianta'){ doc.via='disegno'; wzSalva(); wzRender(); wzDisegna(); }
  else if(act==='togli-pianta'){
    if(!confirm('Togliere la pianta?\nI locali restano, con le loro misure e i lavori.')) return;
    wzTogliPianta(); wzToast('Pianta tolta: i locali restano');
  }
  else if(act==='avanti') wzAvanti();
  else if(act==='indietro') wzIndietro();
  else if(act==='addlocale') wzAddLocale();
  else if(act==='cliente') wzApriCliente();
}
function wzInput(e){
  const t=e.target, d=t.dataset;
  if(d.cli){ wzSetCliente(d.cli, t.value); return; }
  if(d.nome){ const l=doc.locali.find(x=>x.id===+d.nome); if(l){ l.nome=t.value; wzSalva(); } return; }
  if(d.mis){
    const l=doc.locali.find(x=>x.id===+d.id); if(!l) return;
    l[d.mis]= d.mis==='H' ? (prNum(t.value)||H_BASE) : prNum(t.value);
    const s=locSup(l), mq=document.querySelector(`[data-mq="${l.id}"]`); if(mq) mq.textContent= s?prF1(s.pavimento)+' m²':'—';
    const ci=document.querySelector('.wz-cta-info'); if(ci) ci.innerHTML=wzCtaInfo();
    wzSalva(); return;
  }
  if(d.prezzo){
    wzSetPrezzo(d.prezzo, prNum(t.value));
    const x=LAVORI_STD.find(v=>v.id===d.prezzo), q=document.querySelector(`[data-tq="${d.prezzo}"]`); if(x && q) q.textContent=wzQTutti(x);
    const ci=document.querySelector('.wz-cta-info'); if(ci) ci.innerHTML=wzCtaInfo();
    wzSalva(); return;
  }
  if(d.gen!==undefined && t.tagName==='INPUT'){
    const x=doc.cantiere[+d.gen]; if(!x) return;
    x[d.k]= d.k==='nome' ? t.value : prNum(t.value);
    const ci=document.querySelector('.wz-cta-info'); if(ci) ci.innerHTML=wzCtaInfo();
    wzSalva(); return;
  }
  if(d.doc==='sconto'){ doc.sconto=Math.min(100,prNum(t.value)); wzAggTotali(); wzSalva(); }
}
// Tasto "Avanti" della tastiera: alla casella successiva.
function wzKeydown(e){
  if(e.key!=='Enter' || !e.target.matches || !e.target.matches('.wz-loc input')) return;
  e.preventDefault();
  const tutti=[...document.querySelectorAll('.wz-loc input')], i=tutti.indexOf(e.target);
  if(i>=0 && i<tutti.length-1) tutti[i+1].focus(); else e.target.blur();
}
// Aggiorna i totali sul posto (un ridisegno completo mangerebbe il tocco su "Crea il PDF").
function wzAggTotali(){
  const T=docTotali(doc);
  const iv=wzEl('wzIvaVal'); if(iv) iv.textContent=prEur(T.iva);
  const tv=wzEl('wzTotVal'); if(tv) tv.textContent=prEur(T.tot);
  const ci=document.querySelector('.wz-cta-info'); if(ci) ci.innerHTML=wzCtaInfo();
}
function wzChange(e){
  const t=e.target, d=t.dataset;
  if(d.tutti){
    const id=d.tutti, on=t.checked;
    doc.locali.forEach(l=>{ l.lav[id]=on; });
    if(on) doc.tutti.lav[id]=true; else delete doc.tutti.lav[id];
    wzSalva(); wzRender(); return;
  }
  if(d.gen!==undefined && d.k==='u'){ const x=doc.cantiere[+d.gen]; if(x){ x.u=t.value; wzSalva(); wzRender(); } return; }
  if(d.doc==='iva'){ doc.iva=parseFloat(t.value)||0; wzAggTotali(); wzSalva(); }
  else if(d.doc==='validita'){ doc.validita=parseInt(t.value,10)||30; wzSalva(); }
  else if(d.doc==='stato'){ doc.stato=t.value; wzSalva(); }
}

/* ── misure: coerenti con la pianta (tolleranza 0,5 m) ── */
// null se va bene; altrimenti il messaggio (errore, o dubbio non confermato)
function wzControllaPianta(l, L, W){
  if(!(doc.via==='disegno' && l.inPianta && typeof Pianta!=='undefined' && Pianta.controllaLocale)) return null;
  const ck=Pianta.controllaLocale(doc, l.id, L, W);
  if(ck.errore) return ck.errore;
  if(ck.dubbio && !confirm(ck.dubbio)) return 'Misura non salvata';
  return null;
}
/* ── misure: la pianta si mette in scala quando tutte le stanze le hanno ── */
function wzDopoMisure(l, cambiate){
  if(!(doc.via==='disegno' && haPianta(doc) && l.inPianta && typeof Pianta!=='undefined')) return null;
  if(cambiate) doc.pianta.inScala=false;
  const compilate=Pianta.compila ? Pianta.compila(doc) : [];
  const daMisurare=doc.locali.filter(x=>x.inPianta && !locMisurato(x)).length;
  if(daMisurare || doc.pianta.inScala) return compilate.length ? `Misure ricavate anche per: ${compilate.join(', ')}` : null;
  const r=Pianta.scala(doc);
  if(r.esito!=='ok') return null;
  return r.avvisi.length ? 'Pianta in scala, ma alcune misure non tornano: controllale nel disegno' : 'Tutte le misure ci sono: pianta messa in scala';
}

/* ── scheda di un locale (misure o lavori) ── */
function wzLoc(){ return doc && doc.locali.find(x=>x.id===wzSel); }
function wzApriScheda(id){
  wzSel=id; const l=wzLoc(); if(!l) return;
  _wzMisPrima=[l.L,l.W,l.H].join('|');
  if(wzStep===2) wzDisegnaLavori(); else wzDisegnaMisure();
  wzEl('wzSheetBg').style.display='flex';
  document.body.style.overflow='hidden';
}
function wzChiudiScheda(silenzioso){
  const bg=wzEl('wzSheetBg'); if(bg) bg.style.display='none';
  document.body.style.overflow='';
  const l=wzLoc(); let msg=null; _wzCliente=false;
  // misure cambiate dalla scheda lavori: stesso controllo della scheda misure
  if(l && wzStep===2 && _wzMisPrima!==null && _wzMisPrima!==[l.L,l.W,l.H].join('|')) msg=wzDopoMisure(l, true);
  wzSel=null; _wzMisPrima=null;
  if(!silenzioso){ wzRender(); if(msg) wzToast(msg); }
}
function wzKv(s){
  return s ? `<div><span>Pavimento</span><b>${prF2(s.pavimento)} m²</b></div><div><span>Pareti${s.ded>0?' nette':''}</span><b>${prF2(s.pareti)} m²</b></div><div><span>Soffitto</span><b>${prF2(s.soffitto)} m²</b></div>`
           : `<div class="warn" style="grid-column:1/-1"><span>Superfici</span><b>Compaiono appena inserisci lunghezza e larghezza</b></div>`;
}
function wzDims(l, pre){
  return `<div class="wz-dims">
      <label class="wz-field"><span class="wz-lbl">Lungh.${l.inPianta?' ↔':''} m</span><input class="wz-input" id="${pre}L" data-smis="L" inputmode="decimal" value="${prIn(l.L)}" placeholder="4,20"></label>
      <label class="wz-field"><span class="wz-lbl">Largh.${l.inPianta?' ↕':''} m</span><input class="wz-input" id="${pre}W" data-smis="W" inputmode="decimal" value="${prIn(l.W)}" placeholder="3,60"></label>
      <label class="wz-field"><span class="wz-lbl">Altezza m</span><input class="wz-input" id="${pre}H" data-smis="H" inputmode="decimal" value="${prIn(l.H||H_BASE)}"></label>
    </div>`;
}
function wzDisegnaMisure(){
  const l=wzLoc();
  wzEl('wzSheet').innerHTML=`
    <div class="wz-sh-head"><input class="wz-sh-title" data-sh-nome value="${esc(l.nome)}" placeholder="Nome della stanza" aria-label="Nome del locale"><button type="button" class="wz-x" data-sh="close" aria-label="Chiudi">×</button></div>
    <div class="wz-chips">${NOMI_LOCALI.slice(0,8).map(n=>`<button type="button" class="wz-chip${l.nome===n?' on':''}" data-sh="nome" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>
    ${wzDims(l,'m')}
    <div class="wz-kv" id="mKv">${wzKv(locSup(l))}</div>
    <div class="wz-sh-foot"><button type="button" class="wz-ghost" data-sh="close">Annulla</button><button type="button" class="wz-primary" data-sh="salva-mis">Salva misure</button></div>`;
}
const aCorpoQui=(l,x)=>x.su!=='corpo' && !locSup(l);
function wzQLav(l,x){
  const s=locSup(l), on=!!l.lav[x.id];
  if(aCorpoQui(l,x)){ const p=prNum(l.corpo[x.id]); return 'senza misure: prezzo a corpo'+(on&&p?` → ${prEur(p)}`:(on?' · scrivi l\'importo':'')); }
  const q= x.su==='corpo' ? 1 : s[x.su];
  return (x.su==='corpo' ? 'a corpo' : `${prF2(q)} ${SU_LBL[x.su]}`) + (on && q ? ` → ${prEur(q*prNum(doc.prezzi[x.id]))}` : '');
}
function wzPrezzoLav(l,x){
  if(aCorpoQui(l,x)) return `<input inputmode="decimal" data-corpo="${x.id}" value="${prIn(prNum(l.corpo[x.id]))}" placeholder="0" aria-label="Importo a corpo ${x.nome}"><small>€ a corpo</small>`;
  return `<input inputmode="decimal" data-prezzo="${x.id}" value="${prIn(prNum(doc.prezzi[x.id]))}" aria-label="Prezzo ${x.nome}"><small>${x.su==='corpo'?'€ a corpo':'€ al m²'}</small>`;
}
function wzDisegnaLavori(){
  const l=wzLoc(), s=locSup(l);
  const opt=(o,v)=>Object.keys(o).map(k=>`<option value="${k}"${k===v?' selected':''}>${typeof o[k]==='string'?o[k]:o[k].lbl}</option>`).join('');
  wzEl('wzSheet').innerHTML=`
    <div class="wz-sh-head"><h3>${esc(l.nome||'Senza nome')}</h3><button type="button" class="wz-x" data-sh="close" aria-label="Chiudi">×</button></div>
    ${wzDims(l,'s')}
    <div class="wz-kv" id="lavKv">${wzKv(s)}</div>

    ${s?'':'<p class="wz-nota">Senza misure: scrivi per ogni lavoro l\'importo a corpo. Se più avanti metti le misure, il prezzo torna al m².</p>'}
    <div class="wz-sec">Lavori più usati <small>quelli "in tutti" sono già spuntati</small></div>
    <div class="wz-rows">${LAVORI_STD.map(x=>{ const on=!!l.lav[x.id], com=!!doc.tutti.lav[x.id]; return `
      <label class="wz-lav${on?' on':''}">
        <input type="checkbox" data-lav="${x.id}"${on?' checked':''}>
        <span class="ln-n">${x.nome}${com?` <em class="wz-com">${on?'in tutti':'tolto qui'}</em>`:''}</span>
        <span class="ln-q${(!s&&x.su!=='corpo')?' warn':''}" data-q="${x.id}">${wzQLav(l,x)}</span>
        <span class="ln-p">${wzPrezzoLav(l,x)}</span>
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
    <div class="wz-rows">${l.inf.map((x,i)=>{ const dis=x.pid?' disabled':''; return `
      <div class="wz-inf">
        <div class="dw" data-dw="${i}">${disegnoInfisso(x,96,110)}${x.pid?`<span class="wz-dalp">dalla pianta${prNum(x.prezzo)?'':' · senza prezzo non va nel preventivo'}</span>`:''}</div>
        <div class="g">
          <label class="f" style="grid-column:1/-1"><span>Tipo</span><select class="sm" data-inf="${i}" data-k="tipo"${dis}>${opt(TIPI_INF,x.tipo)}</select></label>
          <label class="f"><span>Largh. mm</span><input class="sm" inputmode="numeric" data-inf="${i}" data-k="lung" value="${esc(x.lung)}"${dis}></label>
          <label class="f"><span>Alt. mm</span><input class="sm" inputmode="numeric" data-inf="${i}" data-k="alt" value="${esc(x.alt)}"${dis}></label>
          <label class="f"><span>Ante</span><select class="sm" data-inf="${i}" data-k="ante">${[1,2,3,4].map(n=>`<option${n===+x.ante?' selected':''}>${n}</option>`).join('')}</select></label>
          <label class="f"><span>Apertura</span><select class="sm" data-inf="${i}" data-k="apr">${opt(APR,x.apr)}</select></label>
          <div class="w2"><label class="f"><span>Prezzo €</span><input class="sm" inputmode="decimal" data-inf="${i}" data-k="prezzo" value="${prIn(prNum(x.prezzo))}"></label>
            ${x.pid?'':`<button type="button" class="wz-del" data-sh="del-inf" data-i="${i}" aria-label="Elimina infisso">×</button>`}</div>
        </div>
      </div>`; }).join('')}
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

    <div class="wz-sh-foot"><span></span><b id="lavTot">Totale locale ${prEur(locTot(l,doc.prezzi))}</b></div>
    <button type="button" class="wz-primary wz-full" data-sh="close">Fatto</button>`;
}
function wzAggLavori(){
  const l=wzLoc(); if(!l) return;
  const kv=wzEl('lavKv'); if(kv) kv.innerHTML=wzKv(locSup(l));
  LAVORI_STD.forEach(x=>{ const el=document.querySelector(`[data-q="${x.id}"]`); if(el) el.textContent=wzQLav(l,x); });
  l.inf.forEach((x,i)=>{ const el=document.querySelector(`[data-dw="${i}"]`); if(el) el.innerHTML=disegnoInfisso(x,96,110); });
  const t=wzEl('lavTot'); if(t) t.textContent='Totale locale '+prEur(locTot(l,doc.prezzi));
}

/* ── listino: i prezzi dell'impresa, chiesti una volta sola ── */
let _wzListino=false;
function wzApriListino(primaVolta){
  const lst=prezziListino();
  _wzListino=true; wzSel=null;
  wzEl('wzSheet').innerHTML=`
    <div class="wz-sh-head"><h3>I tuoi prezzi</h3><button type="button" class="wz-x" data-sh="close-listino" aria-label="Chiudi">×</button></div>
    <p class="wz-lead">${primaVolta?'Prima di iniziare: controlla i prezzi dei lavori più usati. Li ritrovi in ogni preventivo e puoi sempre cambiarli.':'Prezzi proposti nei nuovi preventivi. Si aggiornano anche quando li cambi dentro un preventivo.'}</p>
    <div class="wz-rows">${LAVORI_STD.map(x=>`
      <label class="wz-lav on wz-lst">
        <span class="ln-n">${x.nome}</span>
        <span class="ln-q">${x.su==='corpo'?'a corpo, per locale':SU_LBL[x.su]}</span>
        <span class="ln-p"><input inputmode="decimal" data-lst="${x.id}" value="${prIn(prNum(lst[x.id]))}" aria-label="Prezzo ${x.nome}"><small>${x.su==='corpo'?'€ a corpo':'€ al m²'}</small></span>
      </label>`).join('')}</div>
    <button type="button" class="wz-primary wz-full" data-sh="salva-listino">Salva i miei prezzi</button>`;
  wzEl('wzSheetBg').style.display='flex';
  document.body.style.overflow='hidden';
}
function wzSalvaListino(){
  const l=Store.loadListino();
  document.querySelectorAll('[data-lst]').forEach(inp=>{
    const v=prNum(inp.value); l[inp.dataset.lst]=v;
    if(doc && !preventivi.some(p=>String(p.id)===String(doc.id) && p.stato!=='bozza')) doc.prezzi[inp.dataset.lst]=v;
  });
  l._ok=1; Store.saveListino(l);
  _wzListino=false; wzChiudiScheda(true);
  if(doc && wzStep) { wzSalva(); wzRender(); }
  wzToast('Prezzi salvati');
}

/* ── scheda del cliente (quando vuoi: in alto, o all'ultimo passo) ── */
let _wzCliente=false;
function wzSetCliente(k, v){
  doc.cliente[k]=v;
  if(k==='nome'){ const b=document.querySelector('.wz-head-t b'); if(b) b.textContent=String(v).trim()||'Senza nome'; }
  wzSalva();
}
function wzApriCliente(){
  const c=doc.cliente; _wzCliente=true; wzSel=null;
  wzEl('wzSheet').innerHTML=`
    <div class="wz-sh-head"><h3>Cliente</h3><button type="button" class="wz-x" data-sh="close" aria-label="Chiudi">×</button></div>
    <div class="wz-field"><label class="wz-lbl" for="wzNome">Nome e cognome</label><input class="wz-input" id="wzNome" data-cli="nome" value="${esc(c.nome)}" autocomplete="off"></div>
    <div class="wz-field"><label class="wz-lbl" for="wzInd">Indirizzo dei lavori</label><input class="wz-input" id="wzInd" data-cli="indirizzo" value="${esc(c.indirizzo)}" placeholder="Via, numero, città"></div>
    <div class="wz-row2">
      <div class="wz-field"><label class="wz-lbl" for="wzTel">Telefono</label><input class="wz-input" id="wzTel" type="tel" data-cli="tel" value="${esc(c.tel)}"></div>
      <div class="wz-field"><label class="wz-lbl" for="wzMail">Email</label><input class="wz-input" id="wzMail" type="email" data-cli="email" value="${esc(c.email)}"></div>
    </div>
    <button type="button" class="wz-primary wz-full" data-sh="close">Fatto</button>`;
  wzEl('wzSheetBg').style.display='flex';
  document.body.style.overflow='hidden';
  const n=wzEl('wzNome'); if(n && !c.nome) setTimeout(()=>n.focus(),50);
}

/* ── eventi della scheda ── */
function wzSheetInput(e){
  const t=e.target, d=t.dataset;
  if(d.lst) return;
  if(d.cli){ wzSetCliente(d.cli, t.value); return; }
  const l=wzLoc(); if(!l) return;
  if(d.smis){
    const pre=t.id.charAt(0);
    const nuovo={L:prNum(wzEl(pre+'L').value), W:prNum(wzEl(pre+'W').value), H:prNum(wzEl(pre+'H').value)||H_BASE};
    if(pre==='m'){ const kv=wzEl('mKv'); if(kv) kv.innerHTML=wzKv(locSup(Object.assign({}, l, nuovo))); return; }
    const prima=!!locSup(l);
    Object.assign(l, nuovo); wzSalva();
    if(prima!==!!locSup(l)){ wzDisegnaLavori(); const el=wzEl(t.id); if(el){ el.focus(); const v=el.value; el.value=''; el.value=v; } return; }
    wzAggLavori(); return;   // scheda lavori: le misure valgono subito
  }
  if(d.shNome!==undefined){ l.nome=t.value; wzSalva(); return; }
  if(d.prezzo) wzSetPrezzo(d.prezzo, prNum(t.value));
  else if(d.corpo) l.corpo[d.corpo]=prNum(t.value);
  else if(d.impP) l.imp[d.impP].p=prNum(t.value);
  else if(d.impN) l.imp[d.impN].nota=t.value;
  else if(d.inf!==undefined && t.tagName==='INPUT') l.inf[+d.inf][d.k]= d.k==='prezzo' ? prNum(t.value) : (parseInt(t.value,10)||0);
  else if(d.man!==undefined && t.tagName==='INPUT') l.man[+d.man][d.k]= d.k==='nome' ? t.value : prNum(t.value);
  else if(d.note!==undefined) l.note=t.value;
  else return;
  wzAggLavori(); wzSalva();
}
function wzSheetChange(e){
  const l=wzLoc(); if(!l || wzStep!==2) return;
  const t=e.target, d=t.dataset;
  if(d.smis){
    const errore=wzControllaPianta(l, l.L, l.W);
    if(errore){
      const pr=String(_wzMisPrima||'').split('|').map(Number);
      l.L=pr[0]||0; l.W=pr[1]||0; l.H=pr[2]||H_BASE;
      ['L','W','H'].forEach(k=>{ const el=wzEl('s'+k); if(el) el.value=prIn(l[k]); });
      wzAggLavori(); wzSalva(); wzToast(errore);
    }
    return;
  }
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
  const act=a.dataset.sh;
  if(act==='salva-listino') return wzSalvaListino();
  if(act==='close-listino'){ const l=Store.loadListino(); l._ok=1; Store.saveListino(l); _wzListino=false; return wzChiudiScheda(true); }
  if(act==='close') return wzChiudiScheda();
  const l=wzLoc(); if(!l) return;
  if(act==='nome'){
    l.nome=a.dataset.n; const ti=document.querySelector('.wz-sh-title'); if(ti) ti.value=l.nome;
    document.querySelectorAll('.wz-sheet .wz-chip').forEach(c=>c.classList.toggle('on', c===a));
    wzSalva(); const L=wzEl('mL'); if(L && !L.value) L.focus(); return;
  }
  if(act==='salva-mis'){
    const nL=prNum(wzEl('mL').value), nW=prNum(wzEl('mW').value), cambiate= nL!==l.L || nW!==l.W;
    const errore=wzControllaPianta(l, nL, nW);
    if(errore){ wzToast(errore); return; }
    l.L=nL; l.W=nW; l.H=prNum(wzEl('mH').value)||H_BASE;
    const msg=wzDopoMisure(l, cambiate);
    _wzMisPrima=null; wzSalva(); wzChiudiScheda();
    const restano=doc.locali.filter(x=>!locMisurato(x)).length;
    wzToast(msg || (locMisurato(l) ? (restano?`Misure salvate · ${restano} da misurare`:'Tutti i locali sono misurati') : 'Mancano lunghezza e larghezza'));
    return;
  }
  if(act==='add-inf'){ l.inf.push(nuovoInfisso('finestra')); wzSalva(); wzDisegnaLavori(); return; }
  if(act==='del-inf'){ l.inf.splice(+a.dataset.i,1); wzSalva(); wzDisegnaLavori(); return; }
  if(act==='add-man'){
    l.man.push({nome:'', q:0, u:'m²', p:0}); wzDisegnaLavori();
    const ins=document.querySelectorAll('.wz-man .nm'); const u=ins[ins.length-1]; if(u) u.focus(); return;
  }
  if(act==='del-man'){ l.man.splice(+a.dataset.i,1); wzSalva(); wzDisegnaLavori(); return; }
}

/* ── collegamento agli eventi (una volta sola) ── */
function wzInit(){
  const root=wzEl('wz'), sh=wzEl('wzSheet'), bg=wzEl('wzSheetBg');
  if(!root || root._wz) return; root._wz=true;
  root.addEventListener('click', wzClick);
  root.addEventListener('input', wzInput);
  root.addEventListener('change', wzChange);
  root.addEventListener('keydown', wzKeydown);
  if(sh){ sh.addEventListener('click', wzSheetClick); sh.addEventListener('input', wzSheetInput); sh.addEventListener('change', wzSheetChange); }
  if(bg) bg.addEventListener('click', e=>{ if(e.target===bg){ if(_wzListino) wzSheetClick({target:{closest:()=>({dataset:{sh:'close-listino'}})}}); else wzChiudiScheda(); } });
  // scheda misure: Invio (anche dal laser) passa alla casella dopo, poi salva
  if(sh) sh.addEventListener('keydown', e=>{
    if(e.key!=='Enter' || !e.target.id) return;
    const dopo={mL:'mW', mW:'mH', sL:'sW', sW:'sH'}[e.target.id];
    if(dopo){ e.preventDefault(); const n=wzEl(dopo); if(n){ n.focus(); n.select&&n.select(); } }
    else if(e.target.id==='mH'){ e.preventDefault(); const b=document.querySelector('[data-sh="salva-mis"]'); if(b) b.click(); }
  });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && bg && bg.style.display==='flex'){ if(_wzListino) wzSalvaListino(); else wzChiudiScheda(); } });
}
