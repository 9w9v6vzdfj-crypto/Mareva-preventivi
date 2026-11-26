// ══════════════════════════════════════════════════════════
//  PIANTA — foglio di disegno a tutto schermo (dallo Schizzo Locali)
//  Linee col dito raddrizzate, stanze riconosciute da sole, misure, porte e
//  finestre, messa in scala, vista 3D. Il disegno vive in doc.pianta; nome e
//  misure di ogni stanza sono quelli del suo locale nel preventivo.
// ══════════════════════════════════════════════════════════
const Pianta=(function(){
  'use strict';
  const CELL = 12;                 // passo della griglia nel foglio (unità del disegno)
  const PPM = CELL*20;             // dopo "Metti in scala": 1 metro = 20 quadretti (1 quadretto = 5 cm)
  const NOMI = ['Soggiorno','Cucina','Camera','Cameretta','Bagno','Corridoio','Ingresso','Ripostiglio','Studio','Lavanderia'];
  const KEY_HELP = 'mv_pianta_help';

  const cv=document.getElementById('cv'), ctx=cv.getContext ? cv.getContext('2d') : null;
  const ov=document.getElementById('piantaOv');
  const $=id=>document.getElementById(id);
  const rowsEl=$('rows'), totalsEl=$('totals'), toastEl=$('toast');

  let W=0, H=0, dpr=1;
  let view={s:1, tx:0, ty:0};       // schermo = foglio × s + t
  let walls=[];                     // pareti dritte {x1,y1,x2,y2} nelle unità del foglio
  let roomsData=[];                 // collegamento stanza → locale del preventivo: {anchor:{gx,gy}, locId}
  let docRef=null, alChiudere=null, aperto=false;   // preventivo collegato
  let regions=[], grid=null;        // locali chiusi trovati sul foglio
  let hist=[], fut=[];              // stati precedenti (Annulla) e annullati (Ripeti)
  let inScala=false;                // il disegno rispecchia le misure inserite
  let chiudiAperture=true;          // vani porta tra spallette = chiusura del locale
  let virtuali=[];                  // chiusure "virtuali" dei vani (tratteggio)
  let angoli=[];                    // angoli quasi chiusi, completati in automatico
  let infissi=[];                   // porte e finestre: {x,y,o,tipo,w,h,sill} (x,y sul muro; w,h,sill in metri)
  let troppoGrande=false;           // disegno troppo esteso per cercare i locali
  let avvisi=[];                    // misure che non tornano dopo la messa in scala
  let mode='draw';
  const ptrs=new Map();
  let drawing=null, gesture=null, gestureLock=false, erasing=null, panning=null;
  let ghost=null, lastTap=null, selRegion=-1, cursor=null, needDraw=false;
  let selWall=-1, flash=null, magnete=null;   // muro toccato, stanze appena chiuse, aggancio sotto il dito

  /* ── utilità ── */
  const f2=n=>n.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});
  const f1=n=>n.toLocaleString('it-IT',{minimumFractionDigits:1,maximumFractionDigits:1});
  const num=v=>{ const n=parseFloat(String(v||'').replace(',','.')); return Number.isFinite(n)&&n>0 ? n : 0; };
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const gs=v=>Math.round(v/CELL)*CELL;
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const pathLen=p=>{ let s=0; for(let i=1;i<p.length;i++) s+=dist(p[i-1],p[i]); return s; };
  const norm=(a,b)=>({x1:Math.min(a.x,b.x), y1:Math.min(a.y,b.y), x2:Math.max(a.x,b.x), y2:Math.max(a.y,b.y)});
  const toWorld=p=>({x:(p.x-view.tx)/view.s, y:(p.y-view.ty)/view.s});
  const toScreen=p=>({x:p.x*view.s+view.tx, y:p.y*view.s+view.ty});
  function requestDraw(){ if(!needDraw){ needDraw=true; requestAnimationFrame(draw); } }

  /* ── il disegno vive nel preventivo (doc.pianta); i dati delle stanze nei suoi locali ── */
  const locDi=id=>docRef && docRef.locali.find(l=>l.id===id);
  let saveT=null;
  function saveSoon(){ clearTimeout(saveT); saveT=setTimeout(esporta, 250); }
  function carica(d){
    docRef=d;
    const p=(d && d.pianta) || {};
    walls=(Array.isArray(p.walls)?p.walls:[]).filter(w=>w && [w.x1,w.y1,w.x2,w.y2].every(Number.isFinite));
    roomsData=(Array.isArray(p.rooms)?p.rooms:[]).filter(r=>r && r.anchor).map(r=>({anchor:{gx:r.anchor.gx, gy:r.anchor.gy}, locId:r.locId}));
    infissi=(Array.isArray(p.infissi)?p.infissi:[]).map(f=>Object.assign({}, f));
    infissi.forEach(f=>{ if(!f.id) f.id=nuovoIdInf(); });
    inScala=!!p.inScala; chiudiAperture= p.chiudiAperture!==false;
    view=(p.view && [p.view.s,p.view.tx,p.view.ty].every(Number.isFinite)) ? Object.assign({},p.view) : {s:1,tx:0,ty:0};
    avvisi=[]; hist=[]; fut=[];
  }
  const nuovoIdInf=()=>'f'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  // Ogni stanza chiusa è un locale del preventivo: le nuove lo diventano subito,
  // quelle sparite (muri cancellati) lasciano il locale solo se ha già dei dati.
  function collegaLocali(){
    if(!docRef) return;
    const usati=new Set();
    regions.forEach(r=>{
      if(r.data && locDi(r.data.locId)){ usati.add(r.data.locId); return; }
      const id=docRef.locali.length ? Math.max(...docRef.locali.map(l=>l.id))+1 : 1;
      const l=conLavoriComuni(nuovoLocale(id,''), docRef); l.daPianta=true;
      docRef.locali.push(l);
      const d={anchor:{gx:r.lc.gx, gy:r.lc.gy}, locId:id};
      roomsData=roomsData.filter(x=>!(x.anchor.gx===d.anchor.gx && x.anchor.gy===d.anchor.gy));
      roomsData.push(d); r.data=vista(d); usati.add(id);
    });
    roomsData=roomsData.filter(d=>usati.has(d.locId) && regions.some(r=>r.data && r.data.ref===d));
    docRef.locali=docRef.locali.filter(l=>usati.has(l.id) || !l.daPianta || locMisurato(l) || locRighe(l,docRef.prezzi).length || String(l.note||'').trim());
    docRef.locali.forEach(l=>{ l.inPianta=usati.has(l.id); });
    // ordine dei locali = ordine delle stanze sulla pianta (dall'alto a sinistra)
    const ord=new Map(regions.map((r,i)=>[r.data && r.data.locId, i]));
    docRef.locali.sort((a,b)=>(ord.has(a.id)?ord.get(a.id):1e6)-(ord.has(b.id)?ord.get(b.id):1e6));
    // porte e finestre disegnate → infissi del locale, senza prezzo: entrano nei lavori solo se
    // nel preventivo gli si dà un prezzo (prezzo e aperture scelti lì restano)
    const TIPO={porta:'porta', finestra:'finestra', portafinestra:'portafinestra'};
    docRef.locali.forEach(l=>{ l.dedExtra=0; });
    const vivi=new Set();
    infissi.forEach(f=>{
      if(!muroDi(f)) return;
      const lati=latiInfisso(f).map(ri=>regions[ri].data && locDi(regions[ri].data.locId)).filter(Boolean);
      if(!lati.length) return;
      const area=f.w*f.h;
      if(!TIPO[f.tipo]){ lati.forEach(l=>{ l.dedExtra+=area; }); return; }   // vano: solo superficie
      const own=lati[0]; vivi.add(f.id);
      lati.slice(1).forEach(l=>{ l.dedExtra+=area; });
      docRef.locali.forEach(l=>{ if(l!==own) l.inf=l.inf.filter(x=>x.pid!==f.id); });
      let x=own.inf.find(x=>x.pid===f.id);
      if(!x){ x=nuovoInfisso(TIPO[f.tipo]); x.pid=f.id; x.prezzo=0; own.inf.push(x); }
      if(x.tipo!==TIPO[f.tipo]){ const n=nuovoInfisso(TIPO[f.tipo]); x.tipo=n.tipo; x.ante=n.ante; }
      x.lung=Math.round(f.w*1000); x.alt=Math.round(f.h*1000);
    });
    docRef.locali.forEach(l=>{ l.inf=l.inf.filter(x=>!x.pid || vivi.has(x.pid)); l.dedExtra=Math.round(l.dedExtra*1e4)/1e4; });
  }
  function esporta(){
    clearTimeout(saveT);
    if(!docRef) return;
    collegaLocali();
    docRef.pianta={walls, rooms:roomsData, infissi, inScala, chiudiAperture, view, anteprima:anteprima()};
    if(alChiudere && alChiudere.cambio) alChiudere.cambio();
  }
  // Disegno "da stampa": muri, stanze come rettangoli (righe di quadretti unite), infissi.
  function anteprima(){
    const tutti=walls.concat(angoli);
    if(!tutti.length) return null;
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const w of tutti){ x0=Math.min(x0,w.x1); y0=Math.min(y0,w.y1); x1=Math.max(x1,w.x2); y1=Math.max(y1,w.y2); }
    const stanze=regions.map((r,i)=>{
      const rs=(grid?grid.runs:[]).filter(u=>u.r===i).sort((a,b)=>(a.x-b.x)||(a.w-b.w)||(a.y-b.y));
      const rect=[];
      for(const u of rs){
        const p=rect[rect.length-1];
        if(p && p[0]===u.x && p[2]===u.w && p[1]+p[3]===u.y) p[3]+=CELL; else rect.push([u.x,u.y,u.w,CELL]);
      }
      return {locId:r.data?r.data.locId:null, rect, lx:(r.lc.gx+.5)*CELL, ly:(r.lc.gy+.5)*CELL,
              w:(r.maxx-r.minx+1)*CELL, h:(r.maxy-r.miny+1)*CELL};
    });
    const K=metriPerUnita();
    const inf=infissi.filter(f=>muroDi(f)).map(f=>({tipo:f.tipo, o:f.o, x:f.x, y:f.y, half:f.w/2/K}));
    return {box:[x0,y0,x1,y1], muri:tutti.map(w=>[w.x1,w.y1,w.x2,w.y2]), vani:virtuali.map(w=>[w.x1,w.y1,w.x2,w.y2]), stanze, inf, inScala, cell:CELL};
  }

  /* ── annulla ── */
  const stato=()=>JSON.stringify({walls, roomsData, inScala, infissi,
    locs: docRef ? docRef.locali.filter(l=>l.daPianta||l.inPianta).map(l=>({id:l.id, nome:l.nome, L:l.L, W:l.W, H:l.H, daPianta:!!l.daPianta})) : []});
  function bottoniStoria(){ $('btnUndo').disabled=!hist.length; $('btnRedo').disabled=!fut.length; }
  function snapshot(){
    hist.push(stato());
    if(hist.length>60) hist.shift();
    fut=[]; bottoniStoria();
  }
  function ripristina(str){
    const s=JSON.parse(str);
    chiudiNomi();
    walls=s.walls; roomsData=s.roomsData; inScala=!!s.inScala; infissi=s.infissi||[]; avvisi=[];
    if(docRef) (s.locs||[]).forEach(x=>{
      let l=locDi(x.id);
      if(!l){ l=nuovoLocale(x.id, x.nome); l.daPianta=x.daPianta; docRef.locali.push(l); }
      l.nome=x.nome; l.L=x.L; l.W=x.W; l.H=x.H;
    });
    chiudiPop(); bottoniStoria(); aggiorna();
  }
  function undo(){
    if(!hist.length){ toast('Niente da annullare'); return; }
    fut.push(stato()); ripristina(hist.pop()); toast('Annullato', 1000);
  }
  function redo(){
    if(!fut.length){ toast('Niente da ripetere'); return; }
    hist.push(stato()); ripristina(fut.pop()); toast('Ripetuto', 1000);
  }

  /* ── semplificazione del tratto (Ramer–Douglas–Peucker) ── */
  function perp(p,a,b){
    const dx=b.x-a.x, dy=b.y-a.y, L=Math.hypot(dx,dy);
    if(L<1e-6) return dist(p,a);
    return Math.abs(dy*p.x-dx*p.y+b.x*a.y-b.y*a.x)/L;
  }
  function rdp(pts,eps){
    if(pts.length<3) return pts.slice();
    let dmax=0, idx=0; const a=pts[0], b=pts[pts.length-1];
    for(let i=1;i<pts.length-1;i++){ const d=perp(pts[i],a,b); if(d>dmax){ dmax=d; idx=i; } }
    if(dmax>eps){ const l=rdp(pts.slice(0,idx+1),eps), r=rdp(pts.slice(idx),eps); return l.slice(0,-1).concat(r); }
    return [a,b];
  }

  /* ── aggancio alle pareti esistenti (soglie in pixel di schermo) ── */
  function snapCoord(g, tol){
    // 1° tentativo: pareti parallele vicine e affiancate; 2° tentativo: pareti sulla
    // stessa linea anche se lontane (allineamento, es. spallette di un vano porta)
    for(const vicino of [true,false]){
      let best=null, bd=tol;
      for(const w of walls){
        if(g.o==='H' && w.y1===w.y2){
          if(vicino && (w.x2<g.mn-tol || w.x1>g.mx+tol)) continue;
          const d=Math.abs(w.y1-g.c); if(d<bd){ bd=d; best=w.y1; }
        } else if(g.o==='V' && w.x1===w.x2){
          if(vicino && (w.y2<g.mn-tol || w.y1>g.mx+tol)) continue;
          const d=Math.abs(w.x1-g.c); if(d<bd){ bd=d; best=w.x1; }
        }
      }
      if(best!==null) return best;
    }
    return gs(g.c);
  }

  /* ── VANI PORTA E SPALLETTE ──
     Un'estremità "libera" (che non tocca altre pareti) è una spalletta.
     - Due spallette una di fronte all'altra, sulla stessa linea o quasi: il vano
       tra loro chiude il locale.
     - Una spalletta da sola si prolunga fino alla parete che ha davanti, se il
       varco è più corto della spalletta stessa.
     Le chiusure sono "virtuali": servono a riconoscere i locali e si vedono tratteggiate. */
  function contiene(w,p){
    return w.x1===w.x2 ? (p.x===w.x1 && p.y>=w.y1 && p.y<=w.y2)
                       : (p.y===w.y1 && p.x>=w.x1 && p.x<=w.x2);
  }
  function aperture(){
    const TOL=CELL*4;
    const liberi=[];
    walls.forEach((w,i)=>{
      const hor=w.y1===w.y2, len=hor?w.x2-w.x1:w.y2-w.y1;
      [{p:{x:w.x1,y:w.y1}, d:hor?{x:-1,y:0}:{x:0,y:-1}}, {p:{x:w.x2,y:w.y2}, d:hor?{x:1,y:0}:{x:0,y:1}}].forEach(e=>{
        if(!walls.some((o,j)=>j!==i && contiene(o,e.p))) liberi.push({p:e.p, d:e.d, len});
      });
    });
    const usati=new Set(), out=[], angoli=[];
    // 0) ANGOLI QUASI CHIUSI: un'estremità orizzontale e una verticale vicine
    //    (le linee spesse sembrano toccarsi anche quando c'è un piccolo varco)
    const TOLA=CELL*3;
    liberi.forEach((a,ia)=>{
      if(usati.has(ia)) return;
      let best=-1, bd=Infinity;
      liberi.forEach((b,ib)=>{
        if(ib===ia || usati.has(ib)) return;
        const aH=a.d.y===0, bH=b.d.y===0; if(aH===bH) return;
        const H=aH?a:b, V=aH?b:a;
        const dh=Math.abs(V.p.x-H.p.x), dv=Math.abs(H.p.y-V.p.y);
        if(dh>TOLA || dv>TOLA) return;
        if(dh+dv<bd){ bd=dh+dv; best=ib; }
      });
      if(best<0) return;
      usati.add(ia); usati.add(best);
      const b=liberi[best], H=a.d.y===0?a:b, V=a.d.y===0?b:a, k={x:V.p.x, y:H.p.y};
      angoli.push(norm(H.p,k), norm(k,V.p));
    });
    liberi.forEach((a,ia)=>{
      if(usati.has(ia)) return;
      const ver=a.d.x===0;
      let best=-1, bg=Infinity;
      liberi.forEach((b,ib)=>{
        if(ib===ia || usati.has(ib)) return;
        if(a.d.x!==-b.d.x || a.d.y!==-b.d.y) return;
        const gap= ver ? (b.p.y-a.p.y)*a.d.y : (b.p.x-a.p.x)*a.d.x;
        const off= ver ? Math.abs(b.p.x-a.p.x) : Math.abs(b.p.y-a.p.y);
        if(gap<=0 || off>TOL || gap>=bg) return;
        const lo= ver?Math.min(a.p.y,b.p.y):Math.min(a.p.x,b.p.x), hi= ver?Math.max(a.p.y,b.p.y):Math.max(a.p.x,b.p.x);
        const c0= ver?Math.min(a.p.x,b.p.x):Math.min(a.p.y,b.p.y), c1= ver?Math.max(a.p.x,b.p.x):Math.max(a.p.y,b.p.y);
        const traversa=walls.some(w=> ver
          ? (w.y1===w.y2 && w.y1>lo && w.y1<hi && w.x1<=c1 && w.x2>=c0)
          : (w.x1===w.x2 && w.x1>lo && w.x1<hi && w.y1<=c1 && w.y2>=c0));
        if(traversa) return;
        best=ib; bg=gap;
      });
      if(best<0) return;
      usati.add(ia); usati.add(best);
      const b=liberi[best];
      if(ver){
        if(a.p.x===b.p.x) out.push(norm(a.p,b.p));
        else { const m=gs((a.p.y+b.p.y)/2); out.push(norm(a.p,{x:a.p.x,y:m}), norm({x:a.p.x,y:m},{x:b.p.x,y:m}), norm({x:b.p.x,y:m},b.p)); }
      } else {
        if(a.p.y===b.p.y) out.push(norm(a.p,b.p));
        else { const m=gs((a.p.x+b.p.x)/2); out.push(norm(a.p,{x:m,y:a.p.y}), norm({x:m,y:a.p.y},{x:m,y:b.p.y}), norm({x:m,y:b.p.y},b.p)); }
      }
    });
    liberi.forEach((a,ia)=>{
      if(usati.has(ia)) return;
      let hit=null, bd=Infinity;
      for(const w of walls){
        if(a.d.x===0){
          if(w.y1!==w.y2 || a.p.x<w.x1 || a.p.x>w.x2) continue;
          const g=(w.y1-a.p.y)*a.d.y; if(g>0 && g<bd){ bd=g; hit={x:a.p.x, y:w.y1}; }
        } else {
          if(w.x1!==w.x2 || a.p.y<w.y1 || a.p.y>w.y2) continue;
          const g=(w.x1-a.p.x)*a.d.x; if(g>0 && g<bd){ bd=g; hit={x:w.x1, y:a.p.y}; }
        }
      }
      if(hit && bd<=a.len) out.push(norm(a.p,hit));
    });
    const ok=w=>w.x1!==w.x2 || w.y1!==w.y2;
    return {porte:out.filter(ok), angoli:angoli.filter(ok)};
  }
  function snapEnd(p, o, tol){
    let best=null, bd=tol;
    for(const w of walls){
      if(o==='H' && w.x1===w.x2 && p.y>=w.y1-CELL/2 && p.y<=w.y2+CELL/2){
        const d=Math.abs(w.x1-p.x); if(d<bd){ bd=d; best={x:w.x1, y:p.y}; }
      } else if(o==='V' && w.y1===w.y2 && p.x>=w.x1-CELL/2 && p.x<=w.x2+CELL/2){
        const d=Math.abs(w.y1-p.y); if(d<bd){ bd=d; best={x:p.x, y:w.y1}; }
      }
    }
    return best||p;
  }
  const isect=(a,b)=> a.o==='H' ? {x:b.c, y:a.c} : {x:a.c, y:b.c};

  /* ── dallo schizzo a pareti dritte ── */
  function correggi(raw){
    const s=view.s;
    const simp=rdp(raw, 9/s);
    if(simp.length<2) return [];
    const segs=[];
    for(let i=0;i<simp.length-1;i++){
      const a=simp[i], b=simp[i+1], dx=b.x-a.x, dy=b.y-a.y;
      segs.push({a,b,len:Math.hypot(dx,dy),o:Math.abs(dx)>=Math.abs(dy)?'H':'V'});
    }
    for(let i=0;i<segs.length;i++) if(segs[i].len*s<16 && segs.length>1) segs[i].o = i>0 ? segs[i-1].o : segs[i+1].o;
    let m=[];
    for(const sg of segs){ const last=m[m.length-1]; if(last && last.o===sg.o) last.parts.push(sg); else m.push({o:sg.o, parts:[sg]}); }
    m.forEach(g=>{
      let sw=0, sc=0, mn=Infinity, mx=-Infinity;
      for(const p of g.parts){
        const w=p.len||1, c= g.o==='H' ? (p.a.y+p.b.y)/2 : (p.a.x+p.b.x)/2;
        sw+=w; sc+=c*w;
        const e1= g.o==='H'?p.a.x:p.a.y, e2= g.o==='H'?p.b.x:p.b.y;
        mn=Math.min(mn,e1,e2); mx=Math.max(mx,e1,e2);
      }
      g.c=sc/sw; g.mn=mn; g.mx=mx;
    });
    const start=raw[0], end=raw[raw.length-1], tot=pathLen(raw);
    const closed = tot*s>90 && m.length>=2 && dist(start,end)*s < Math.max(30, 0.12*tot*s);
    if(closed){
      if(m.length>1 && m[0].o===m[m.length-1].o){
        const f=m[0], l=m.pop(), wf=(f.mx-f.mn)||1, wl=(l.mx-l.mn)||1;
        f.c=(f.c*wf+l.c*wl)/(wf+wl); f.mn=Math.min(f.mn,l.mn); f.mx=Math.max(f.mx,l.mx);
      }
      if(m.length<4){
        let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
        raw.forEach(p=>{ x0=Math.min(x0,p.x); y0=Math.min(y0,p.y); x1=Math.max(x1,p.x); y1=Math.max(y1,p.y); });
        m=[{o:'H',c:y0,mn:x0,mx:x1},{o:'V',c:x1,mn:y0,mx:y1},{o:'H',c:y1,mn:x0,mx:x1},{o:'V',c:x0,mn:y0,mx:y1}];
      }
    }
    const tolPar=Math.max(CELL*1.2, 20/s), tolEnd=Math.max(CELL*1.5, 24/s);
    m.forEach(g=>{ g.c=snapCoord(g, tolPar); });
    let P=[];
    if(closed){
      const n=m.length;
      for(let i=0;i<n;i++) P.push(isect(m[(i-1+n)%n], m[i]));
      P.push(P[0]);
    } else {
      const n=m.length, g0=m[0], gl=m[n-1];
      P.push(g0.o==='H' ? {x:start.x, y:g0.c} : {x:g0.c, y:start.y});
      for(let i=1;i<n;i++) P.push(isect(m[i-1], m[i]));
      P.push(gl.o==='H' ? {x:end.x, y:gl.c} : {x:gl.c, y:end.y});
      P[0]=snapEnd(P[0], g0.o, tolEnd);
      P[P.length-1]=snapEnd(P[P.length-1], gl.o, tolEnd);
    }
    P=P.map(p=>({x:gs(p.x), y:gs(p.y)}));
    const out=[];
    for(let i=0;i<P.length-1;i++){
      const a=P[i], b=P[i+1];
      if(a.x===b.x && a.y===b.y) continue;
      if(a.x!==b.x && a.y!==b.y) continue;
      out.push(norm(a,b));
    }
    // un tratto troppo corto (tocco strisciato) non diventa una parete
    const lungh=out.reduce((t,w)=>t+(w.x2-w.x1)+(w.y2-w.y1),0);
    return lungh>=CELL*2 ? out : [];
  }

  /* ── pareti spezzate agli incroci (gomma precisa) e senza doppioni ── */
  function sistemaPareti(list){
    const out=[];
    for(const w of list){
      const hor=w.y1===w.y2, cuts=[];
      for(const o of list){
        if(o===w) continue;
        if(hor){
          if(o.x1===o.x2){ if(o.x1>w.x1 && o.x1<w.x2 && w.y1>=o.y1 && w.y1<=o.y2) cuts.push(o.x1); }
          else if(o.y1===w.y1){ [o.x1,o.x2].forEach(v=>{ if(v>w.x1 && v<w.x2) cuts.push(v); }); }
        } else {
          if(o.y1===o.y2){ if(o.y1>w.y1 && o.y1<w.y2 && w.x1>=o.x1 && w.x1<=o.x2) cuts.push(o.y1); }
          else if(o.x1===w.x1){ [o.y1,o.y2].forEach(v=>{ if(v>w.y1 && v<w.y2) cuts.push(v); }); }
        }
      }
      const c=[...new Set(cuts)].sort((a,b)=>a-b).concat([hor?w.x2:w.y2]);
      let prev=hor?w.x1:w.y1;
      for(const v of c){ if(v>prev) out.push(hor?{x1:prev,y1:w.y1,x2:v,y2:w.y1}:{x1:w.x1,y1:prev,x2:w.x1,y2:v}); prev=v; }
    }
    const seen=new Set();
    return out.filter(w=>{ const k=w.x1+','+w.y1+','+w.x2+','+w.y2; if(seen.has(k)) return false; seen.add(k); return true; });
  }

  /* ── riconoscimento dei locali (zone chiuse), su una griglia che segue il disegno ── */
  function ricalcola(){
    regions=[]; grid=null; troppoGrande=false;
    const ap = walls.length ? aperture() : {porte:[], angoli:[]};
    angoli = ap.angoli;                       // gli angoli quasi chiusi si chiudono sempre
    virtuali = chiudiAperture ? ap.porte : [];
    if(!walls.length) return;
    const tutte=walls.concat(angoli, virtuali);
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const w of tutte){ x0=Math.min(x0,w.x1); y0=Math.min(y0,w.y1); x1=Math.max(x1,w.x2); y1=Math.max(y1,w.y2); }
    const gx0=Math.floor(x0/CELL)-1, gy0=Math.floor(y0/CELL)-1;
    const cols=Math.ceil(x1/CELL)+1-gx0, rows=Math.ceil(y1/CELL)+1-gy0;
    if(cols*rows>2500000){ troppoGrande=true; return; }
    const n=cols*rows;
    const hB=new Uint8Array((rows+1)*cols), vB=new Uint8Array(rows*(cols+1));
    for(const w of tutte){
      if(w.y1===w.y2){
        const ly=Math.round(w.y1/CELL)-gy0;
        for(let gx=Math.round(w.x1/CELL)-gx0; gx<Math.round(w.x2/CELL)-gx0; gx++) hB[ly*cols+gx]=1;
      } else {
        const lx=Math.round(w.x1/CELL)-gx0;
        for(let gy=Math.round(w.y1/CELL)-gy0; gy<Math.round(w.y2/CELL)-gy0; gy++) vB[gy*(cols+1)+lx]=1;
      }
    }
    const seen=new Int32Array(n).fill(-1), q=new Int32Array(n), found=[];
    for(let s=0;s<n;s++){
      if(seen[s]!==-1) continue;
      const id=found.length; let head=0, tail=0; q[tail++]=s; seen[s]=id;
      const cells=[]; let outside=false, sx=0, sy=0, minx=1e9, miny=1e9, maxx=-1, maxy=-1;
      while(head<tail){
        const c=q[head++], gx=c%cols, gy=(c/cols)|0;
        cells.push(c); sx+=gx; sy+=gy;
        if(gx<minx)minx=gx; if(gx>maxx)maxx=gx; if(gy<miny)miny=gy; if(gy>maxy)maxy=gy;
        if(gx===0||gy===0||gx===cols-1||gy===rows-1) outside=true;
        if(gx+1<cols && !vB[gy*(cols+1)+gx+1] && seen[c+1]===-1){ seen[c+1]=id; q[tail++]=c+1; }
        if(gx>0 && !vB[gy*(cols+1)+gx] && seen[c-1]===-1){ seen[c-1]=id; q[tail++]=c-1; }
        if(gy+1<rows && !hB[(gy+1)*cols+gx] && seen[c+cols]===-1){ seen[c+cols]=id; q[tail++]=c+cols; }
        if(gy>0 && !hB[gy*cols+gx] && seen[c-cols]===-1){ seen[c-cols]=id; q[tail++]=c-cols; }
      }
      found.push({cells, outside, cx:sx/cells.length, cy:sy/cells.length, minx, miny, maxx, maxy});
    }
    const keep=[]; found.forEach((r,i)=>{ if(!r.outside && r.cells.length>=6) keep.push(i); });
    keep.sort((a,b)=>(found[a].miny-found[b].miny)||(found[a].minx-found[b].minx));
    const map=new Int32Array(found.length).fill(-1);
    keep.forEach((fi,ri)=>{ map[fi]=ri; });
    regions=keep.map(fi=>found[fi]);
    const cellRegion=new Int32Array(n);
    for(let c=0;c<n;c++) cellRegion[c]=map[seen[c]];
    // campiture precalcolate a strisce (il disegno resta fluido anche con piante grandi)
    const runs=[];
    for(let gy=0;gy<rows;gy++){
      let gx=0;
      while(gx<cols){
        const r=cellRegion[gy*cols+gx];
        if(r<0){ gx++; continue; }
        let e=gx; while(e<cols && cellRegion[gy*cols+e]===r) e++;
        runs.push({x:(gx+gx0)*CELL, y:(gy+gy0)*CELL, w:(e-gx)*CELL, r});
        gx=e;
      }
    }
    grid={gx0, gy0, cols, rows, cellRegion, runs};
    regions.forEach(r=>{
      let best=r.cells[0], bd=Infinity;
      for(const c of r.cells){ const d=(c%cols-r.cx)**2+(((c/cols)|0)-r.cy)**2; if(d<bd){ bd=d; best=c; } }
      r.lc={gx:best%cols+gx0, gy:((best/cols)|0)+gy0};
      r.data=null;
    });
    for(const d of roomsData){
      const lx=d.anchor.gx-gx0, ly=d.anchor.gy-gy0;
      if(lx<0||ly<0||lx>=cols||ly>=rows || !locDi(d.locId)) continue;
      const ri=cellRegion[ly*cols+lx];
      if(ri>=0 && !regions[ri].data) regions[ri].data=vista(d);
    }
    // porte e finestre: la loro superficie si toglie dalle pareti dei locali su
    // ciascun lato del muro (una porta tra due stanze conta per entrambe)
    regions.forEach(r=>{ r.ded=0; r.nInf=0; });
    for(const f of infissi){
      if(!muroDi(f)) continue;
      for(const ri of latiInfisso(f)){ regions[ri].ded+=f.w*f.h; regions[ri].nInf++; }
    }
  }
  function regionAt(wp){
    if(!grid) return -1;
    const lx=Math.floor(wp.x/CELL)-grid.gx0, ly=Math.floor(wp.y/CELL)-grid.gy0;
    if(lx<0||ly<0||lx>=grid.cols||ly>=grid.rows) return -1;
    return grid.cellRegion[ly*grid.cols+lx];
  }

  /* ── calcoli ── */
  const misurato=d=>!!d && d.L>0 && d.W>0;
  // i dati di una stanza sono quelli del suo locale nel preventivo
  function vista(d){ const l=locDi(d.locId)||{}; return {ref:d, locId:d.locId, name:l.nome||'', L:l.L||0, W:l.W||0, H:l.H||0}; }
  // r (facoltativo) = il locale sul foglio: serve per togliere porte e finestre
  function calcola(d, r){
    const L=d.L, Wd=d.W, Hh=d.H>0?d.H:2.7;
    const floor=L*Wd, lordo=2*(L+Wd)*Hh, per=2*(L+Wd);
    const ded=Math.min(lordo, r && r.ded ? r.ded : 0), walls=lordo-ded;
    return {floor, ceil:floor, walls, lordo, ded, per};
  }

  /* ── porte e finestre: supporto ── */
  const TIPI={
    porta:         {lbl:'Porta',          w:.80, h:2.10, s:0},
    finestra:      {lbl:'Finestra',       w:1.20, h:1.40, s:.90},
    portafinestra: {lbl:'Portafinestra',  w:1.40, h:2.30, s:0},
    vano:          {lbl:'Vano / nicchia', w:1.00, h:1.00, s:1.00}
  };
  function muroDi(f){
    return walls.concat(angoli).find(w=> (f.o==='H' ? w.y1===w.y2 : w.x1===w.x2) && contiene(w,{x:f.x, y:f.y})) || null;
  }
  function latiInfisso(f){
    const o=CELL*.5;
    const pts= f.o==='H' ? [{x:f.x,y:f.y-o},{x:f.x,y:f.y+o}] : [{x:f.x-o,y:f.y},{x:f.x+o,y:f.y}];
    return [...new Set(pts.map(regionAt).filter(i=>i>=0))];
  }
  // metri per unità del foglio: esatti dopo "Metti in scala", altrimenti ricavati
  // dai locali misurati (serve solo per disegnare porte, finestre e il 3D)
  function metriPerUnita(){
    if(inScala) return 1/PPM;
    let num=0, den=0;
    for(const r of regions){
      const d=r.data; if(!misurato(d)) continue;
      num+=Math.sqrt((d.L*d.W)/(r.cells.length*CELL*CELL))*r.cells.length; den+=r.cells.length;
    }
    return den ? num/den : 1/(CELL*4);
  }
  function altezzaMuri(){
    const hs=regions.map(r=>r.data && r.data.H>0 ? r.data.H : 0).filter(Boolean);
    return hs.length ? Math.max(...hs) : 2.7;
  }
  const nomeLocale=(r,i)=>(r.data && r.data.name) || ('Locale '+(i+1));

  /* ── METTI IN SCALA ──
     Ogni parete sta su una "linea" verticale (x) o orizzontale (y) della pianta.
     Le misure dicono quanto devono distare tra loro le linee che chiudono ogni locale
     (lunghezza ↔ in orizzontale, larghezza ↕ in verticale). Si cercano le distanze che
     rispettano tutte le misure (minimi quadrati); i tratti senza misure mantengono le
     proporzioni dello schizzo. Poi ogni parete viene spostata sulla sua linea nuova. */
  function gauss(M,b){
    const n=b.length, A=M.map((row,i)=>[...row, b[i]]);
    for(let c=0;c<n;c++){
      let p=c; for(let r=c+1;r<n;r++) if(Math.abs(A[r][c])>Math.abs(A[p][c])) p=r;
      if(Math.abs(A[p][c])<1e-12) return null;
      [A[c],A[p]]=[A[p],A[c]];
      for(let r=0;r<n;r++){
        if(r===c) continue;
        const f=A[r][c]/A[c][c]; if(!f) continue;
        for(let k=c;k<=n;k++) A[r][k]-=f*A[c][k];
      }
    }
    return A.map((row,i)=>row[n]/row[i]);
  }
  function risolvi(L, vincoli){
    const n=L.length-1;
    if(n<1) return L.map(()=>0);
    const orig=[]; for(let i=0;i<n;i++) orig.push(L[i+1]-L[i]);
    const rapp=vincoli.map(c=>c.val/(L[c.b]-L[c.a])).sort((a,b)=>a-b);
    const s= rapp.length ? rapp[rapp.length>>1] : 1/PPM;   // metri per unità dello schizzo
    const lam=.02;
    const M=Array.from({length:n},()=>new Array(n).fill(0)), rhs=new Array(n).fill(0);
    for(let i=0;i<n;i++){ M[i][i]+=lam; rhs[i]+=lam*s*orig[i]; }
    for(const c of vincoli){
      for(let i=c.a;i<c.b;i++){ rhs[i]+=c.val; for(let j=c.a;j<c.b;j++) M[i][j]+=1; }
    }
    const g=gauss(M,rhs); if(!g) return null;
    const cum=[0]; for(let i=0;i<n;i++) cum.push(cum[i]+Math.max(.05, g[i]));
    const P=cum.map(c=>Math.round(c*PPM/CELL)*CELL);
    for(let i=1;i<P.length;i++) if(P[i]<=P[i-1]) P[i]=P[i-1]+CELL;
    return P;
  }
  function mappa(L, P){
    return v=>{
      const i=L.indexOf(v); if(i>=0) return P[i];
      if(v<L[0]) return P[0]-(L[0]-v)*(P[P.length-1]-P[0])/((L[L.length-1]-L[0])||1);
      if(v>L[L.length-1]) return P[P.length-1]+(v-L[L.length-1])*(P[P.length-1]-P[0])/((L[L.length-1]-L[0])||1);
      let k=0; while(k<L.length-2 && !(v>L[k] && v<L[k+1])) k++;
      return P[k]+(v-L[k])*(P[k+1]-P[k])/(L[k+1]-L[k]);
    };
  }
  // Cuore della messa in scala (senza schermo: lo usa anche il preventivo).
  function scalaCore(){
    const misurati=regions.filter(r=>misurato(r.data));
    if(!misurati.length) return 'nessuna';
    const X=[...new Set(walls.flatMap(w=>[w.x1,w.x2]))].sort((a,b)=>a-b);
    const Y=[...new Set(walls.flatMap(w=>[w.y1,w.y2]))].sort((a,b)=>a-b);
    const vx=[], vy=[];
    for(const r of misurati){
      const xa=(r.minx+grid.gx0)*CELL, xb=(r.maxx+1+grid.gx0)*CELL;
      const ya=(r.miny+grid.gy0)*CELL, yb=(r.maxy+1+grid.gy0)*CELL;
      const ia=X.indexOf(xa), ib=X.indexOf(xb), ja=Y.indexOf(ya), jb=Y.indexOf(yb);
      if(ia>=0 && ib>ia) vx.push({a:ia, b:ib, val:r.data.L});
      if(ja>=0 && jb>ja) vy.push({a:ja, b:jb, val:r.data.W});
    }
    const PX=risolvi(X,vx), PY=risolvi(Y,vy);
    if(!PX || !PY) return 'errore';
    const mx=mappa(X,PX), my=mappa(Y,PY);
    walls=sistemaPareti(walls.map(w=>norm({x:mx(w.x1), y:my(w.y1)}, {x:mx(w.x2), y:my(w.y2)}))
      .filter(w=>w.x1!==w.x2 || w.y1!==w.y2));
    roomsData.forEach(d=>{
      d.anchor={gx:Math.floor(mx((d.anchor.gx+.5)*CELL)/CELL), gy:Math.floor(my((d.anchor.gy+.5)*CELL)/CELL)};
    });
    infissi.forEach(f=>{ f.x=mx(f.x); f.y=my(f.y); });
    inScala=true;
    ricalcola();
    // controllo: ogni locale misurato ha davvero le sue misure nel disegno?
    avvisi=[];
    regions.forEach((r,i)=>{
      const d=r.data; if(!misurato(d)) return;
      const Ld=(r.maxx-r.minx+1)*CELL/PPM, Wd=(r.maxy-r.miny+1)*CELL/PPM;
      if(Math.abs(Ld-d.L)>.06) avvisi.push(`${nomeLocale(r,i)}: lunghezza ${f2(d.L)} m, nel disegno ${f2(Ld)} m`);
      if(Math.abs(Wd-d.W)>.06) avvisi.push(`${nomeLocale(r,i)}: larghezza ${f2(d.W)} m, nel disegno ${f2(Wd)} m`);
    });
    return 'ok';
  }
  function mettiInScala(){
    chiudiMenu();
    if(!regions.some(r=>misurato(r.data))){ toast('Prima inserisci le misure di almeno un locale'); return; }
    const prima=stato();
    const esito=scalaCore();
    if(esito!=='ok'){ toast('Non riesco a mettere in scala questo disegno'); return; }
    hist.push(prima); if(hist.length>60) hist.shift(); fut=[]; bottoniStoria();
    renderPanel(); saveSoon();
    if(!avvisi.length) apriCassetto(false);
    inquadra(true);
    if(vista3D()) costruisci3D(true);
    toast(avvisi.length ? 'In scala, ma alcune misure non tornano: vedi sotto' : 'Disegno in scala con le tue misure', 3200);
  }

  /* ── disegno ── */
  function tok(){
    const cs=getComputedStyle(ov), g=k=>cs.getPropertyValue(k).trim();
    return {paper:g('--paper'), grid:g('--grid'), gridS:g('--grid-strong'), ink:g('--ink'), pencil:g('--pencil'),
            accent:g('--accent'), room:g('--room'), roomSel:g('--room-sel'), muted:g('--muted'), danger:g('--danger')};
  }
  function linee(step, color){
    if(step<8) return;
    ctx.strokeStyle=color; ctx.lineWidth=1; ctx.beginPath();
    const i0=Math.floor(-view.tx/step), j0=Math.floor(-view.ty/step);
    for(let i=i0; i*step+view.tx<=W; i++){ const x=Math.round(i*step+view.tx)+.5; ctx.moveTo(x,0); ctx.lineTo(x,H); }
    for(let j=j0; j*step+view.ty<=H; j++){ const y=Math.round(j*step+view.ty)+.5; ctx.moveTo(0,y); ctx.lineTo(W,y); }
    ctx.stroke();
  }
  // la carta millimetrata si adatta allo zoom: si vedono sempre due livelli di righe
  // (in scala: 5 cm, 25 cm, 1 m, 5 m, 25 m)
  function griglia(t){
    const lv=[1,5,20,100,500,2500];
    let i=0; while(i<lv.length-1 && CELL*lv[i]*view.s<8) i++;
    linee(CELL*lv[i]*view.s, t.grid);
    if(i+1<lv.length) linee(CELL*lv[i+1]*view.s, t.gridS);
  }
  function draw(){
    needDraw=false;
    const t=tok(), now=performance.now(), s=view.s;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle=t.paper; ctx.fillRect(0,0,W,H);
    griglia(t);
    // livello del foglio
    ctx.setTransform(dpr*s,0,0,dpr*s,dpr*view.tx,dpr*view.ty);
    if(grid){
      // un unico tracciato per colore: niente sovrapposizioni, quindi niente righine
      for(const sel of [false,true]){
        ctx.beginPath();
        for(const run of grid.runs) if((run.r===selRegion)===sel) ctx.rect(run.x, run.y, run.w, CELL);
        ctx.fillStyle= sel ? t.roomSel : t.room;
        ctx.fill();
      }
      // stanze appena chiuse: si accendono e si spengono
      if(flash){
        const k=Math.min(1,(now-flash.t0)/900);
        ctx.globalAlpha=.55*(1-k)*(k<.15?k/.15:1);
        ctx.beginPath();
        for(const run of grid.runs) if(flash.ids.has(run.r)) ctx.rect(run.x, run.y, run.w, CELL);
        ctx.fillStyle=t.accent; ctx.fill(); ctx.globalAlpha=1;
        if(k>=1) flash=null; else requestDraw();
      }
    }
    ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.strokeStyle=t.ink; ctx.lineWidth=5/s; ctx.beginPath();
    for(const w of walls){ ctx.moveTo(w.x1,w.y1); ctx.lineTo(w.x2,w.y2); }
    for(const w of angoli){ ctx.moveTo(w.x1,w.y1); ctx.lineTo(w.x2,w.y2); }
    ctx.stroke();
    if(walls[selWall]){
      const w=walls[selWall];
      ctx.strokeStyle=t.accent; ctx.lineWidth=9/s; ctx.beginPath(); ctx.moveTo(w.x1,w.y1); ctx.lineTo(w.x2,w.y2); ctx.stroke();
    }
    // vani porta considerati chiusi: tratteggio
    if(virtuali.length){
      ctx.strokeStyle=t.accent; ctx.lineWidth=2/s; ctx.lineCap='butt'; ctx.setLineDash([6/s,5/s]); ctx.beginPath();
      for(const w of virtuali){ ctx.moveTo(w.x1,w.y1); ctx.lineTo(w.x2,w.y2); }
      ctx.stroke(); ctx.setLineDash([]); ctx.lineCap='round';
    }
    // porte e finestre in pianta: la porta con l'arco di apertura, la finestra con la doppia linea
    if(infissi.length){
      const K=metriPerUnita();
      ctx.lineCap='butt';
      for(const f of infissi){
        const w=muroDi(f); if(!w) continue;
        const half=f.w/2/K, hor=f.o==='H';
        const a= hor ? {x:f.x-half, y:f.y} : {x:f.x, y:f.y-half};
        const b= hor ? {x:f.x+half, y:f.y} : {x:f.x, y:f.y+half};
        ctx.strokeStyle=t.paper; ctx.lineWidth=7/s; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        if(f.tipo==='porta' || f.tipo==='portafinestra'){
          const r=2*half;
          ctx.strokeStyle= f.tipo==='porta' ? t.ink : t.accent; ctx.lineWidth=1.5/s; ctx.beginPath();
          if(hor){ ctx.moveTo(a.x,a.y); ctx.lineTo(a.x,a.y+r); ctx.moveTo(a.x+r,a.y); ctx.arc(a.x,a.y,r,0,Math.PI/2); }
          else   { ctx.moveTo(a.x,a.y); ctx.lineTo(a.x-r,a.y); ctx.moveTo(a.x,a.y+r); ctx.arc(a.x,a.y,r,Math.PI/2,Math.PI); }
          ctx.stroke();
        }
        if(f.tipo!=='porta'){
          const o=2/s;
          ctx.strokeStyle= f.tipo==='vano' ? t.muted : t.accent; ctx.lineWidth=1.5/s; ctx.beginPath();
          if(hor){ ctx.moveTo(a.x,a.y-o); ctx.lineTo(b.x,b.y-o); ctx.moveTo(a.x,a.y+o); ctx.lineTo(b.x,b.y+o); }
          else   { ctx.moveTo(a.x-o,a.y); ctx.lineTo(b.x-o,b.y); ctx.moveTo(a.x+o,a.y); ctx.lineTo(b.x+o,b.y); }
          ctx.stroke();
        }
      }
      ctx.lineCap='round';
    }
    if(ghost){
      const k=Math.min(1,(now-ghost.t0)/500);
      ctx.globalAlpha=1-k;
      ctx.strokeStyle=t.accent; ctx.lineWidth=5/s; ctx.beginPath();
      for(const w of ghost.walls){ ctx.moveTo(w.x1,w.y1); ctx.lineTo(w.x2,w.y2); }
      ctx.stroke();
      ctx.strokeStyle=t.pencil; ctx.lineWidth=2/s; ctx.setLineDash([4/s,4/s]); ctx.beginPath();
      ghost.pts.forEach((p,i)=> i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
      if(k>=1) ghost=null;
    }
    if(drawing && drawing.pts.length>1){
      // anteprima: le pareti come verranno raddrizzate, già mentre il dito disegna
      if(drawing.pts.length>3 && pathLen(drawing.spts)>=14){
        if(!drawing.tp || now-drawing.tp>50){ drawing.prev=correggi(drawing.pts); drawing.tp=now; }
        if(drawing.prev && drawing.prev.length){
          ctx.globalAlpha=.4; ctx.strokeStyle=t.accent; ctx.lineWidth=6/s; ctx.beginPath();
          for(const w of drawing.prev){ ctx.moveTo(w.x1,w.y1); ctx.lineTo(w.x2,w.y2); }
          ctx.stroke(); ctx.globalAlpha=1;
        }
      }
      ctx.strokeStyle=t.pencil; ctx.lineWidth=2/s; ctx.beginPath();
      drawing.pts.forEach((p,i)=> i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
      ctx.stroke();
    }
    // livello dello schermo: etichette e cursore gomma
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    if(!walls.length && !drawing){
      const cy=H*.46;
      ctx.fillStyle=t.muted;
      ctx.font=`600 17px 'Space Grotesk', system-ui, sans-serif`; ctx.fillText('Disegna qui la pianta', W/2, cy);
      ctx.font=`400 13px 'Inter', system-ui, sans-serif`; ctx.fillText('Traccia le pareti col dito: le raddrizzo io', W/2, cy+24);
      ctx.fillText('Poi tocca una stanza per le misure', W/2, cy+44);
    }
    regions.forEach((r,i)=>{
      const bw=(r.maxx-r.minx+1)*CELL*s, bh=(r.maxy-r.miny+1)*CELL*s;
      if(bw<36 || bh<20) return;
      const p=toScreen({x:(r.lc.gx+.5)*CELL, y:(r.lc.gy+.5)*CELL});
      if(p.x<-60||p.y<-30||p.x>W+60||p.y>H+30) return;
      const fs= bw<90 ? 11 : 13;
      const senzaNome=!(r.data && r.data.name);
      const lines=[{txt: senzaNome ? '?' : nomeLocale(r,i), font:`600 ${senzaNome?fs+6:fs}px 'Space Grotesk', system-ui, sans-serif`, col: senzaNome ? t.accent : t.ink}];
      const fl=`500 ${fs-1}px 'Inter', system-ui, sans-serif`;
      if(misurato(r.data)){
        // i metri quadri compaiono solo dopo che le misure sono state inserite
        if(bh>=fs*3) lines.push({txt:f1(calcola(r.data).floor)+' m²', font:fl, col:t.ink});
        if(bh>=fs*4.6) lines.push({txt:`${f2(r.data.L)} × ${f2(r.data.W)}`, font:fl, col:t.muted});
      } else if(bh>=fs*3) lines.push({txt:'tocca qui', font:fl, col:t.accent});
      const lh=fs+3, y0=p.y-(lines.length-1)*lh/2;
      lines.forEach((ln,j)=>{
        ctx.font=ln.font;
        let txt=ln.txt;
        if(ctx.measureText(txt).width>bw-8){
          while(txt.length>2 && ctx.measureText(txt+'…').width>bw-8) txt=txt.slice(0,-1);
          txt+='…';
        }
        ctx.lineWidth=4; ctx.strokeStyle=t.paper; ctx.strokeText(txt,p.x,y0+j*lh);
        ctx.fillStyle=ln.col; ctx.fillText(txt,p.x,y0+j*lh);
      });
    });
    // calamita: dove si aggancerà il tratto
    if(drawing && magnete){
      const m=toScreen(magnete);
      ctx.fillStyle=t.accent; ctx.globalAlpha=.18; ctx.beginPath(); ctx.arc(m.x,m.y,13,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1; ctx.beginPath(); ctx.arc(m.x,m.y,5,0,Math.PI*2); ctx.fill();
    }
    if(ghost) requestDraw();
  }

  /* ── cassetto del computo ── */
  const drawer=$('drawer'), handle=$('handle'), body=$('drawerBody');
  function apriCassetto(on){
    drawer.classList.toggle('open', on); body.hidden=!on; handle.setAttribute('aria-expanded', on?'true':'false');
  }
  handle.addEventListener('click', ()=>apriCassetto(body.hidden));
  function renderPanel(){
    let tf=0, tw=0, mancanti=0;
    const righe=regions.map((r,i)=>{
      const d=r.data, nome=esc(nomeLocale(r,i));
      if(misurato(d)){
        const c=calcola(d,r); tf+=c.floor; tw+=c.walls;
        return `<button class="pz-row" type="button" data-r="${i}">
          <span class="pz-rn">${nome}</span><span class="pz-rv">${f1(c.floor)} m²</span>
          <span class="pz-rd">${f2(d.L)} × ${f2(d.W)} · h ${f2(d.H>0?d.H:2.7)}</span><span class="pz-rv2">pavimento</span>
          <span class="pz-rs"><span><i>Pareti</i> ${f1(c.walls)}</span>${c.ded>0?`<span><i>Porte e finestre</i> −${f1(c.ded)}</span>`:''}<span><i>Perimetro</i> ${f2(c.per)} m</span></span>
        </button>`;
      }
      mancanti++;
      return `<button class="pz-row" type="button" data-r="${i}">
        <span class="pz-rn">${nome}</span><span class="pz-rv pz-muto">senza misure</span>
        <span class="pz-rd pz-todo">Tocca per nome e misure</span><span class="pz-rv2"></span>
      </button>`;
    });
    if(troppoGrande){
      $('sumMain').textContent='Disegno troppo esteso';
      $('sumSub').textContent='Centra il disegno ed elimina le linee lontane';
      rowsEl.innerHTML='<p class="pz-empty">Sul foglio ci sono linee molto lontane tra loro: da ⋯ Altro scegli "Centra il disegno", poi tocca le linee finite lì per sbaglio ed eliminale.</p>';
      totalsEl.hidden=true; return;
    }
    if(!regions.length){
      $('sumMain').textContent='Nessuna stanza chiusa';
      $('sumSub').textContent='Disegna il contorno di una stanza';
      rowsEl.innerHTML='<p class="pz-empty">Quando una stanza si chiude si colora e compare qui. I metri quadri arrivano quando la tocchi e inserisci le misure.</p>';
      totalsEl.hidden=true; return;
    }
    const n=regions.length, nl=`${n} ${n===1?'stanza':'stanze'}`, misurati=n-mancanti;
    $('sumMain').textContent = misurati ? `Pavimenti ${f1(tf)} m²` : nl;
    $('sumSub').textContent = nl + (mancanti
      ? ` · ${mancanti} da misurare · tocca la stanza`
      : (inScala ? ' · disegno in scala' : ' · tutte misurate'));
    let scalaHtml='';
    if(misurati && !inScala){
      scalaHtml=`<button class="pz-scala" type="button" data-scala>Metti in scala il disegno</button>
        <p class="pz-scalanote">Ridisegno la pianta con le proporzioni vere${mancanti?'; le stanze senza misure mantengono quelle dello schizzo.':'.'} Succede da solo quando tutte hanno le misure.</p>`;
    } else if(inScala){
      scalaHtml=`<p class="pz-scalanote"><b>Disegno in scala</b> · le proporzioni rispecchiano le misure inserite.</p>`;
      if(avvisi.length) scalaHtml+=`<div class="pz-warnbox"><b>Misure che non tornano</b>${avvisi.map(a=>`<span>${esc(a)}</span>`).join('')}
        <span>Due stanze sulla stessa parete devono avere quella misura in comune. Se in realtà sono diverse, disegna pareti separate o correggi le misure.</span></div>`;
    }
    rowsEl.innerHTML=scalaHtml+righe.join('');
    totalsEl.hidden=!misurati;
    totalsEl.innerHTML=`
      <div><span>Pavimenti</span><b>${f1(tf)} m²</b></div>
      <div class="pz-acc"><span>Pareti</span><b>${f1(tw)} m²</b></div>
      ${mancanti?`<div class="pz-note">${mancanti} ${mancanti===1?'stanza ancora senza misure: non è inclusa':'stanze ancora senza misure: non sono incluse'} nei totali.</div>`:''}`;
  }
  rowsEl.addEventListener('click', e=>{
    if(e.target.closest('[data-scala]')){ mettiInScala(); return; }
    const b=e.target.closest('.pz-row'); if(b) apriModal(+b.dataset.r);
  });

  function aggiorna(){ ricalcola(); renderPanel(); requestDraw(); saveSoon(); if(vista3D()) costruisci3D(false); }

  /* ── avvisi ── */
  let toastT=null;
  function toast(msg, ms){
    toastEl.textContent=msg; toastEl.hidden=false;
    clearTimeout(toastT); toastT=setTimeout(()=>{ toastEl.hidden=true; }, ms||2200);
  }

  /* ── finestra misure ── */
  const modal=$('modal'), form=$('form'), fName=$('fName'), fL=$('fL'), fW=$('fW'), fH=$('fH');
  const out={floor:$('rFloor'), ceil:$('rCeil'), walls:$('rWalls'), per:$('rPer')};
  $('chips').innerHTML=NOMI.map(n=>`<button type="button" class="pz-chip">${n}</button>`).join('');
  const evidenziaNome=()=>document.querySelectorAll('#chips .pz-chip').forEach(c=>c.classList.toggle('on', c.textContent===fName.value.trim()));
  $('chips').addEventListener('click', e=>{
    const lg=e.target.closest('[data-lega]');
    if(lg){ const ri=selRegion; chiudiModal(); legaLocale(ri, +lg.dataset.lega); return; }
    const c=e.target.closest('.pz-chip'); if(c){ fName.value=c.textContent; evidenziaNome(); }
  });
  fName.addEventListener('input', evidenziaNome);
  const fmtIn=v=> v>0 ? v.toFixed(2).replace('.',',') : '';
  function aggiornaRisultati(){
    const d={L:num(fL.value), W:num(fW.value), H:num(fH.value)||2.7};
    if(!misurato(d)){ Object.values(out).forEach(o=>o.textContent='—'); return; }
    const c=calcola(d, regions[selRegion]);
    out.floor.textContent=f2(c.floor)+' m²'; out.ceil.textContent=f2(c.ceil)+' m²';
    out.walls.textContent=f2(c.walls)+' m²'+(c.ded>0 ? ` (−${f2(c.ded)} porte e finestre)` : '');
    out.per.textContent=f2(c.per)+' m';
  }
  [fL,fW,fH].forEach(el=>el.addEventListener('input', aggiornaRisultati));
  function apriModal(ri){
    const r=regions[ri]; if(!r) return;
    selRegion=ri; requestDraw();
    const d=r.data;
    fName.value= d && d.name ? d.name : '';
    fName.placeholder='Nome della stanza';
    fL.value= d ? fmtIn(d.L) : ''; fW.value= d ? fmtIn(d.W) : '';
    fH.value= d && d.H>0 ? fmtIn(d.H) : '2,70';
    const esist=daCollegare();
    $('chips').innerHTML=esist.map(l=>`<button type="button" class="pz-chip pz-chip-loc" data-lega="${l.id}">↔ ${esc(l.nome)}</button>`).join('')+
      NOMI.map(n=>`<button type="button" class="pz-chip">${n}</button>`).join('');
    aggiornaRisultati(); evidenziaNome();
    modal.hidden=false;
    if(matchMedia('(pointer:fine)').matches) setTimeout(()=>fName.focus(),30);
  }
  function chiudiModal(){ modal.hidden=true; selRegion=-1; requestDraw(); }
  form.addEventListener('submit', e=>{
    e.preventDefault();
    const r=regions[selRegion]; if(!r){ chiudiModal(); return; }
    snapshot();
    if(!r.data || !locDi(r.data.locId)) collegaLocali();
    const l=r.data && locDi(r.data.locId); if(!l){ chiudiModal(); return; }
    const nL=num(fL.value), nW=num(fW.value);
    const cambiate = nL!==l.L || nW!==l.W;
    l.nome=fName.value.trim(); l.L=nL; l.W=nW; l.H=num(fH.value)||2.7;
    const d=vista(r.data.ref);
    if(cambiate && inScala){ inScala=false; avvisi=[]; }
    chiudiModal(); aggiorna();
    const tutte=regions.length && regions.every(x=>misurato(x.data));
    if(tutte && !inScala){ setTimeout(mettiInScala, 300); return; }   // l'ultima misura mette in scala da sola
    const restano=regions.filter(x=>!misurato(x.data)).length;
    toast(misurato(d) ? (restano ? `Misure salvate · ${restano} ${restano===1?'stanza':'stanze'} da misurare` : 'Misure salvate') : 'Nome salvato · mancano lunghezza e larghezza');
  });
  $('mClose').addEventListener('click', chiudiModal);
  $('mCancel').addEventListener('click', chiudiModal);
  modal.addEventListener('click', e=>{ if(e.target===modal) chiudiModal(); });

  /* ── guida ── */
  const helpModal=$('helpModal');
  const apriGuida=()=>{ chiudiMenu(); helpModal.hidden=false; };
  const chiudiGuida=()=>{ helpModal.hidden=true; try{ localStorage.setItem(KEY_HELP,'1'); }catch(_){} };
  $('hClose').addEventListener('click', chiudiGuida);
  $('hOk').addEventListener('click', chiudiGuida);
  helpModal.addEventListener('click', e=>{ if(e.target===helpModal) chiudiGuida(); });

  /* ── barra in basso: annulla, ripeti, computo, altro ── */
  $('btnUndo').addEventListener('click', undo);
  $('btnRedo').addEventListener('click', redo);
  const menu=$('menu'), btnMore=$('btnMore');
  function chiudiMenu(){ menu.hidden=true; btnMore.setAttribute('aria-expanded','false'); disarmaPulisci(); }
  btnMore.addEventListener('click', e=>{
    e.stopPropagation(); chiudiPop();
    const on=menu.hidden;
    if(on) menu.style.bottom=(window.innerHeight-drawer.getBoundingClientRect().top+8)+'px';
    menu.hidden=!on; btnMore.setAttribute('aria-expanded', on?'true':'false'); if(!on) disarmaPulisci();
  });
  document.addEventListener('click', e=>{ if(aperto && !menu.hidden && !e.target.closest('#menu') && !e.target.closest('#btnMore')) chiudiMenu(); });
  $('mi3d').addEventListener('click', ()=>apri3D());
  $('miFit').addEventListener('click', ()=>{ chiudiMenu(); inquadra(true); });
  $('miHelp').addEventListener('click', apriGuida);
  $('miScala').addEventListener('click', mettiInScala);
  const miAperture=$('miAperture');
  const etichettaAperture=()=>{ miAperture.textContent = chiudiAperture ? 'Vani porta: dividono i locali ✓' : 'Vani porta: lasciali aperti'; };
  miAperture.addEventListener('click', ()=>{
    chiudiAperture=!chiudiAperture; etichettaAperture(); chiudiMenu(); aggiorna();
    toast(chiudiAperture ? 'I vani porta chiudono i locali' : 'I vani porta restano aperti');
  });
  const miClear=$('miClear'); let clearArm=false;
  function disarmaPulisci(){ clearArm=false; miClear.textContent='Cancella tutto'; }
  miClear.addEventListener('click', ()=>{
    if(!clearArm){ clearArm=true; miClear.textContent='Tocca di nuovo per cancellare'; return; }
    chiudiMenu();
    if(walls.length) snapshot();
    walls=[]; roomsData=[]; infissi=[]; inScala=false; avvisi=[]; aggiorna(); toast('Foglio vuoto · ↶ per recuperarlo');
  });
  document.addEventListener('keydown', e=>{
    if(!aperto) return;
    if(e.key==='Escape'){
      if(!pop.hidden) chiudiPop();
      else if(!infModal.hidden) chiudiInfisso();
      else if(!modal.hidden) chiudiModal();
      else if(!helpModal.hidden) chiudiGuida();
      else if(!menu.hidden) chiudiMenu();
      else if(vista3D()) chiudi3D();
      else chiudi();
    }
    const k=e.key.toLowerCase(), inCampo=e.target.closest && e.target.closest('input');
    if((e.ctrlKey||e.metaKey) && !inCampo && modal.hidden && infModal.hidden){
      if(k==='z' && !e.shiftKey){ e.preventDefault(); undo(); }
      else if(k==='y' || (k==='z' && e.shiftKey)){ e.preventDefault(); redo(); }
    }
  });

  /* ── inquadratura e zoom ── */
  function areaLibera(){
    const top=document.querySelector('#piantaOv .pz-top').getBoundingClientRect().bottom+12;
    const bottom=drawer.getBoundingClientRect().top-12;
    return {x0:16, x1:W-16, y0:top, y1:Math.max(top+80, bottom)};
  }
  function inquadra(anim){
    if(!walls.length){ view={s:1, tx:W/2, ty:H/2}; requestDraw(); saveSoon(); return; }
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const w of walls){ x0=Math.min(x0,w.x1); y0=Math.min(y0,w.y1); x1=Math.max(x1,w.x2); y1=Math.max(y1,w.y2); }
    const a=areaLibera(), bw=Math.max(x1-x0,CELL*4), bh=Math.max(y1-y0,CELL*4);
    const s=Math.max(.03, Math.min(4, Math.min((a.x1-a.x0)/bw, (a.y1-a.y0)/bh)*.9));
    const target={s, tx:(a.x0+a.x1)/2-(x0+x1)/2*s, ty:(a.y0+a.y1)/2-(y0+y1)/2*s};
    if(!anim || matchMedia('(prefers-reduced-motion: reduce)').matches){ view=target; requestDraw(); saveSoon(); return; }
    const from={...view}, t0=performance.now();
    (function step(){
      const k=Math.min(1,(performance.now()-t0)/260), e=1-Math.pow(1-k,3);
      view={s:from.s+(target.s-from.s)*e, tx:from.tx+(target.tx-from.tx)*e, ty:from.ty+(target.ty-from.ty)*e};
      draw(); if(k<1) requestAnimationFrame(step); else saveSoon();
    })();
  }
  function zoomAt(p, f){
    const s=Math.max(.03, Math.min(8, view.s*f)); f=s/view.s;
    view={s, tx:p.x-(p.x-view.tx)*f, ty:p.y-(p.y-view.ty)*f};
  }

  /* ── input: un dito disegna, due dita spostano e zoomano ── */
  const sp=e=>{ const r=cv.getBoundingClientRect(); return {x:e.clientX-r.left, y:e.clientY-r.top}; };
  cv.addEventListener('contextmenu', e=>e.preventDefault());
  cv.addEventListener('pointerdown', e=>{
    if(!modal.hidden || !helpModal.hidden) return;
    chiudiMenu();
    if(!pop.hidden){ chiudiPop(); return; }   // il primo tocco chiude solo il menu del muro
    chiudiNomi();
    try{ cv.setPointerCapture(e.pointerId); }catch(_){}
    const p=sp(e);
    ptrs.set(e.pointerId, p);
    if(ptrs.size===2){
      // arriva il secondo dito: niente disegno, si passa a sposta/zoom
      drawing=null; erasing=null; lastTap=null; gestureLock=true;
      const [a,b]=[...ptrs.values()];
      gesture={d0:Math.max(1,dist(a,b)), m0:{x:(a.x+b.x)/2, y:(a.y+b.y)/2}, v0:{...view}};
      requestDraw(); return;
    }
    if(ptrs.size>2 || gestureLock) return;
    if(e.pointerType==='mouse' && (e.button===1 || e.button===2 || e.shiftKey)){
      panning={id:e.pointerId, p0:p, v0:{...view}}; return;
    }
    if(e.pointerType==='mouse' && e.button!==0) return;
    drawing={id:e.pointerId, pts:[toWorld(p)], spts:[p]};
    magnete=null;
    requestDraw();
  });
  cv.addEventListener('pointermove', e=>{
    const p=sp(e);
    if(mode==='erase' && e.pointerType==='mouse' && !ptrs.size){ cursor=p; requestDraw(); }
    if(!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, p);
    if(gesture && ptrs.size>=2){
      const [a,b]=[...ptrs.values()];
      const d=Math.max(1,dist(a,b)), m={x:(a.x+b.x)/2, y:(a.y+b.y)/2};
      const s=Math.max(.03, Math.min(8, gesture.v0.s*d/gesture.d0));
      const w={x:(gesture.m0.x-gesture.v0.tx)/gesture.v0.s, y:(gesture.m0.y-gesture.v0.ty)/gesture.v0.s};
      view={s, tx:m.x-w.x*s, ty:m.y-w.y*s};
      requestDraw(); return;
    }
    if(panning && e.pointerId===panning.id){
      view={s:panning.v0.s, tx:panning.v0.tx+p.x-panning.p0.x, ty:panning.v0.ty+p.y-panning.p0.y};
      requestDraw(); return;
    }
    if(drawing && e.pointerId===drawing.id){
      const evs= e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for(const ev of (evs.length?evs:[e])){
        const q=sp(ev), last=drawing.spts[drawing.spts.length-1];
        if(dist(q,last)>=2){ drawing.spts.push(q); drawing.pts.push(toWorld(q)); }
      }
      magnete= pathLen(drawing.spts)>=14 ? aggancio(toWorld(p)) : null;
      requestDraw(); return;
    }
    if(erasing && e.pointerId===erasing.id){ cursor=p; cancella(p); requestDraw(); }
  });
  function rilascio(e, annullato){
    if(!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if(gesture){ if(ptrs.size<2){ gesture=null; saveSoon(); } }
    if(!ptrs.size) gestureLock=false;
    if(panning && e.pointerId===panning.id){ panning=null; saveSoon(); return; }
    if(erasing && e.pointerId===erasing.id){
      if(erasing.changed){ aggiorna(); } erasing=null;
      if(e.pointerType!=='mouse') cursor=null;
      requestDraw(); return;
    }
    if(drawing && e.pointerId===drawing.id){
      const d=drawing; drawing=null; magnete=null;
      if(annullato){ requestDraw(); return; }
      if(pathLen(d.spts)<14){ tocco(d.spts[0]); requestDraw(); return; }
      const nuove=correggi(d.pts);
      if(nuove.length){
        // per capire quali stanze sono nuove: com'era il foglio prima del tratto
        const vecchie=regions.map(r=>r.cells.length), vecchiaIn=p=>regionAt(p);
        const prima=regions.map(()=>0);
        const primaGrid=grid;
        snapshot();
        walls=sistemaPareti(walls.concat(nuove));
        inScala=false; avvisi=[];
        ghost={pts:d.pts, walls:nuove, t0:performance.now()};
        // lc delle nuove stanze, verificati sulla griglia vecchia
        const gridNuova=(ricalcola(), grid), nuoveIds=new Set();
        regions.forEach((r,i)=>{
          const wp={x:(r.lc.gx+.5)*CELL, y:(r.lc.gy+.5)*CELL};
          grid=primaGrid; const old=vecchiaIn(wp); grid=gridNuova;
          if(old<0 || vecchie[old]!==r.cells.length) nuoveIds.add(i);
        });
        aggiorna();
        if(nuoveIds.size){
          flash={ids:nuoveIds, t0:performance.now()};
          // il nome si chiede solo per le stanze che non ce l'hanno (dividendo una
          // stanza, la parte che resta mantiene il suo)
          const senzaNome=[...nuoveIds].filter(i=>!(regions[i].data && regions[i].data.name));
          if(senzaNome.length===1) chiediNome(senzaNome[0]);
          else if(senzaNome.length>1) toast(senzaNome.length+' stanze nuove · toccale per nome e misure');
        }
      }
      requestDraw();
    }
  }
  cv.addEventListener('pointerup', e=>rilascio(e,false));
  cv.addEventListener('pointercancel', e=>rilascio(e,true));
  cv.addEventListener('wheel', e=>{
    e.preventDefault();
    if(!modal.hidden) return;
    const f= e.ctrlKey ? Math.exp(-e.deltaY*.01) : Math.exp(-e.deltaY*.0015);
    zoomAt(sp(e), f); requestDraw(); saveSoon();
  }, {passive:false});

  /* ── un tocco: porta/finestra → la modifica; muro → menu del muro; stanza → misure ── */
  function distSeg(p,x1,y1,x2,y2){
    const cx=Math.max(Math.min(x1,x2), Math.min(Math.max(x1,x2), p.x)), cy=Math.max(Math.min(y1,y2), Math.min(Math.max(y1,y2), p.y));
    return Math.hypot(p.x-cx, p.y-cy);
  }
  function muroVicino(wp, px){
    let best=-1, bd=px/view.s;
    walls.forEach((w,i)=>{ const d=distSeg(wp,w.x1,w.y1,w.x2,w.y2); if(d<bd){ bd=d; best=i; } });
    return best;
  }
  function infissoVicino(wp, px){
    const K=metriPerUnita(); let best=-1, bd=px/view.s;
    infissi.forEach((f,i)=>{
      if(!muroDi(f)) return;
      const h=f.w/2/K, d= f.o==='H' ? distSeg(wp,f.x-h,f.y,f.x+h,f.y) : distSeg(wp,f.x,f.y-h,f.x,f.y+h);
      if(d<bd){ bd=d; best=i; }
    });
    return best;
  }
  // punto a cui si aggancerà il dito: prima gli spigoli, poi un punto sul muro
  function aggancio(wp){
    const r1=24/view.s, r2=16/view.s; let best=null, bd=r1;
    for(const w of walls) for(const q of [{x:w.x1,y:w.y1},{x:w.x2,y:w.y2}]){ const d=dist(q,wp); if(d<bd){ bd=d; best=q; } }
    if(best) return best;
    bd=r2;
    for(const w of walls){
      const d=distSeg(wp,w.x1,w.y1,w.x2,w.y2);
      if(d<bd){ bd=d; best= w.y1===w.y2 ? {x:Math.max(w.x1,Math.min(w.x2,wp.x)), y:w.y1} : {x:w.x1, y:Math.max(w.y1,Math.min(w.y2,wp.y))}; }
    }
    return best;
  }
  const pop=$('pop');
  let popPunto=null;
  function apriPop(i, p, wp){
    selWall=i; popPunto=wp; requestDraw();
    const w=walls[i], hor=w.y1===w.y2, lu=(hor?w.x2-w.x1:w.y2-w.y1);
    $('popT').textContent= inScala ? `Muro · ${f2(lu/PPM)} m` : 'Muro';
    pop.hidden=false;
    const r=pop.getBoundingClientRect();
    pop.style.left=Math.max(12, Math.min(W-r.width-12, p.x-r.width/2))+'px';
    pop.style.top=(p.y-r.height-18>70 ? p.y-r.height-18 : Math.min(H-r.height-12, p.y+18))+'px';
  }
  /* ── appena una stanza si chiude: "Che stanza è?" con i nomi da toccare ── */
  const nameBar=$('nameBar'); let nomeRi=-1;
  // locali del preventivo non ancora sulla pianta (es. pianta aggiunta dopo l'elenco)
  const daCollegare=()=> docRef ? docRef.locali.filter(l=>l.inPianta===false && !l.daPianta && String(l.nome||'').trim()) : [];
  function chipsNomi(){
    const esist=daCollegare();
    return esist.map(l=>`<button type="button" class="pz-chip pz-chip-loc" data-lega="${l.id}">↔ ${esc(l.nome)}</button>`).join('')+
      NOMI.slice(0, esist.length?6:8).map(n=>`<button type="button" class="pz-chip" data-nome="${n}">${n}</button>`).join('')+
      '<button type="button" class="pz-chip" data-nome="">Altro…</button>';
  }
  // collega la stanza ri a un locale già esistente (con le sue misure e lavori)
  function legaLocale(ri, id){
    collegaLocali();
    const r=regions[ri], target=locDi(id); if(!r || !r.data || !target) return;
    snapshot();
    const d=r.data.ref, prima=locDi(d.locId);
    d.locId=id;
    if(prima && prima!==target && prima.daPianta && !locMisurato(prima) && !String(prima.nome||'').trim()) docRef.locali=docRef.locali.filter(l=>l!==prima);
    aggiorna();
    toast(`${target.nome} collegato alla pianta`+(locMisurato(target)?'':' · toccalo per le misure'));
  }
  function chiediNome(ri){
    collegaLocali();
    nomeRi=ri; $('nameChips').innerHTML=chipsNomi(); nameBar.hidden=false;
    nameBar.style.bottom=(window.innerHeight-drawer.getBoundingClientRect().top+8)+'px';
  }
  function chiudiNomi(){ if(nameBar && !nameBar.hidden){ nameBar.hidden=true; nomeRi=-1; } }
  $('nameChips').addEventListener('click', e=>{
    const lg=e.target.closest('[data-lega]');
    if(lg){ const ri=nomeRi; chiudiNomi(); legaLocale(ri, +lg.dataset.lega); return; }
    const b=e.target.closest('[data-nome]'); if(!b) return;
    const ri=nomeRi; chiudiNomi();
    if(!regions[ri]) return;
    if(!b.dataset.nome){ apriModal(ri); return; }
    collegaLocali();
    const l=regions[ri].data && locDi(regions[ri].data.locId); if(!l) return;
    snapshot();
    const base=b.dataset.nome, uguali=docRef.locali.filter(x=>x!==l && (x.nome===base || x.nome.startsWith(base+' '))).length;
    l.nome= uguali ? base+' '+(uguali+1) : base;
    aggiorna();
    toast(l.nome+' · toccala per le misure');
  });
  function chiudiPop(){ if(pop.hidden) return; pop.hidden=true; selWall=-1; requestDraw(); }
  pop.addEventListener('click', e=>{
    const b=e.target.closest('[data-p]'); if(!b) return;
    const w=walls[selWall], wp=popPunto; if(!w){ chiudiPop(); return; }
    const azione=b.dataset.p, i=selWall;
    chiudiPop();
    if(azione==='del'){
      snapshot(); walls.splice(i,1);
      inScala=false; avvisi=[];
      ricalcola(); infissi=infissi.filter(f=>muroDi(f));
      aggiorna(); toast('Muro eliminato · ↶ per riaverlo'); return;
    }
    const hor=w.y1===w.y2;
    apriInfisso(-1, {o:hor?'H':'V', x: hor?Math.max(w.x1,Math.min(w.x2,wp.x)):w.x1, y: hor?w.y1:Math.max(w.y1,Math.min(w.y2,wp.y)), tipo:azione});
  });
  function tocco(p){
    const wp=toWorld(p);
    const fi=infissoVicino(wp, 16); if(fi>=0){ apriInfisso(fi); return; }
    const mi=muroVicino(wp, 16);    if(mi>=0){ apriPop(mi, p, wp); return; }
    const ri=regionAt(wp);
    if(ri>=0){ apriModal(ri); return; }
    if(walls.length) toast('Tocca una stanza colorata o un muro');
  }
  function cancella(p){
    const w=toWorld(p), r=16/view.s;
    const colpite=walls.filter(x=>{
      const cx=Math.max(x.x1, Math.min(x.x2, w.x)), cy=Math.max(x.y1, Math.min(x.y2, w.y));
      return Math.hypot(w.x-cx, w.y-cy)<r;
    });
    if(!colpite.length) return;
    if(!erasing.snapped){ snapshot(); erasing.snapped=true; }
    walls=walls.filter(x=>!colpite.includes(x));
    erasing.changed=true; inScala=false; avvisi=[];
    ricalcola(); renderPanel();
  }

  /* ══════════ VISTA 3D ══════════
     Le pareti vengono "alzate" all'altezza dei locali (Three.js, caricato solo
     quando serve). Un tocco su una parete apre la finestra per porte e finestre. */
  let T3=null;
  const SPESS=.12; // spessore pareti nel 3D (m)
  const vista3D=()=>!$('v3d').hidden;
  function caricaThree(){
    const add=src=>new Promise((ok,ko)=>{ const sc=document.createElement('script'); sc.src=src; sc.onload=ok; sc.onerror=ko; document.head.appendChild(sc); });
    return (window.THREE ? Promise.resolve() : add('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'))
      .then(()=> THREE.OrbitControls ? null : add('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'));
  }
  function apri3D(){
    chiudiMenu();
    if(!regions.length && !walls.length){ toast('Disegna prima la pianta'); return; }
    toast('Preparo la vista 3D…', 1500);
    caricaThree().then(()=>{
      $('v3d').hidden=false; ov.classList.add('mode3d');
      init3D(); costruisci3D(true); anima3D();
      toast(inScala ? '1 dito ruota · 2 dita spostano e zoomano' : 'Proporzioni approssimate: "Metti in scala" per quelle vere', 3400);
    }).catch(()=>toast('Per la vista 3D serve la connessione internet'));
  }
  function chiudi3D(){
    $('v3d').hidden=true; ov.classList.remove('mode3d');
    if(T3 && T3.raf){ cancelAnimationFrame(T3.raf); T3.raf=0; }
    requestDraw();
  }
  function init3D(){
    if(T3){ ridimensiona3D(); return; }
    const box=$('v3dCanvas');
    const renderer=new THREE.WebGLRenderer({antialias:true});
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
    box.appendChild(renderer.domElement);
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(45, 1, .05, 600);
    const controls=new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping=true; controls.dampingFactor=.12;
    controls.maxPolarAngle=Math.PI/2-.04; controls.minDistance=1; controls.maxDistance=150;
    controls.screenSpacePanning=true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8796a0, .9));
    const sole=new THREE.DirectionalLight(0xffffff, .5); sole.position.set(9,16,7); scene.add(sole);
    const group=new THREE.Group(); scene.add(group);
    T3={renderer, scene, camera, controls, group, raf:0, ray:new THREE.Raycaster(), cx:0, cy:0, K:1};
    let giu=null;
    renderer.domElement.addEventListener('pointerdown', e=>{ giu={x:e.clientX, y:e.clientY, t:performance.now(), n:(giu&&giu.n)||0}; });
    renderer.domElement.addEventListener('pointerup', e=>{
      if(!giu) return;
      const fermo=Math.hypot(e.clientX-giu.x, e.clientY-giu.y)<8 && performance.now()-giu.t<450;
      giu=null; if(fermo) tocco3D(e);
    });
    window.addEventListener('resize', ()=>{ if(vista3D()) ridimensiona3D(); });
    ridimensiona3D();
  }
  function ridimensiona3D(){
    if(!T3) return;
    T3.renderer.setSize(window.innerWidth, window.innerHeight);
    T3.camera.aspect=window.innerWidth/Math.max(1,window.innerHeight); T3.camera.updateProjectionMatrix();
  }
  function anima3D(){
    if(!T3 || !vista3D()) return;
    T3.controls.update(); T3.renderer.render(T3.scene, T3.camera);
    T3.raf=requestAnimationFrame(anima3D);
  }
  function costruisci3D(primaVolta){
    if(!T3) return;
    const g=T3.group;
    while(g.children.length){ const o=g.children.pop(); if(o.geometry) o.geometry.dispose(); }
    const cs=getComputedStyle(ov), tk=k=>cs.getPropertyValue(k).trim();
    T3.scene.background=new THREE.Color(tk('--paper'));
    const mats={
      muro:new THREE.MeshLambertMaterial({color:tk('--wall3d')}),
      pav:new THREE.MeshLambertMaterial({color:tk('--floor3d'), side:THREE.DoubleSide}),
      spigolo:new THREE.LineBasicMaterial({color:tk('--edge3d')}),
      porta:new THREE.LineBasicMaterial({color:tk('--ink')}),
      fin:new THREE.LineBasicMaterial({color:tk('--accent')}),
      vetro:new THREE.MeshLambertMaterial({color:tk('--accent'), transparent:true, opacity:.28, depthWrite:false}),
      presa:new THREE.MeshBasicMaterial({transparent:true, opacity:0, depthWrite:false})
    };
    const K=metriPerUnita(), Hm=altezzaMuri();
    const tutti=walls.concat(angoli);
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const w of tutti){ x0=Math.min(x0,w.x1); y0=Math.min(y0,w.y1); x1=Math.max(x1,w.x2); y1=Math.max(y1,w.y2); }
    if(!tutti.length){ x0=y0=x1=y1=0; }
    const cx=(x0+x1)/2, cy=(y0+y1)/2;
    Object.assign(T3, {K, cx, cy});
    const P=(x,y)=>({X:(x-cx)*K, Z:(y-cy)*K});
    // pavimenti dei locali
    if(grid && grid.runs.length){
      const pos=[];
      for(const run of grid.runs){
        const a=P(run.x, run.y), b=P(run.x+run.w, run.y+CELL);
        pos.push(a.X,0,a.Z, b.X,0,b.Z, b.X,0,a.Z,  a.X,0,a.Z, a.X,0,b.Z, b.X,0,b.Z);
      }
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); geo.computeVertexNormals();
      g.add(new THREE.Mesh(geo, mats.pav));
    }
    // pareti, spezzate attorno a porte e finestre
    for(const w of tutti){
      const hor=w.y1===w.y2, L=(hor?w.x2-w.x1:w.y2-w.y1)*K;
      const sul=[];
      infissi.forEach((f,fi)=>{
        if((hor ? f.o!=='H' : f.o!=='V') || !contiene(w,{x:f.x,y:f.y})) return;
        const uc=(hor ? f.x-w.x1 : f.y-w.y1)*K;
        sul.push({f, fi, u0:Math.max(0,uc-f.w/2), u1:Math.min(L,uc+f.w/2), z0:Math.min(Hm,f.sill), z1:Math.min(Hm,f.sill+f.h)});
      });
      sul.sort((a,b)=>a.u0-b.u0);
      const pezzo=(uA,uB,zA,zB,mat,dati)=>{
        if(uB-uA<1e-3 || zB-zA<1e-3) return null;
        if(uA<=0) uA=-SPESS/2; if(uB>=L) uB=L+SPESS/2;   // angoli pieni
        const len=uB-uA, hh=zB-zA, um=(uA+uB)/2/K;
        const geo= hor ? new THREE.BoxGeometry(len, hh, SPESS) : new THREE.BoxGeometry(SPESS, hh, len);
        const p= hor ? P(w.x1+um, w.y1) : P(w.x1, w.y1+um);
        const m=new THREE.Mesh(geo, mat); m.position.set(p.X, (zA+zB)/2, p.Z); m.userData=dati; g.add(m);
        return m;
      };
      const spigoli=m=>{ if(!m) return; const e=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), mats.spigolo); e.position.copy(m.position); g.add(e); };
      let cur=0;
      for(const a of sul){
        const u0=Math.max(a.u0,cur);
        if(u0>cur) spigoli(pezzo(cur,u0,0,Hm,mats.muro,{muro:w}));
        if(a.u1>u0){
          spigoli(pezzo(u0,a.u1,0,a.z0,mats.muro,{muro:w}));
          spigoli(pezzo(u0,a.u1,a.z1,Hm,mats.muro,{muro:w}));
          // l'apertura: cornice colorata, vetro per le finestre, volume invisibile per toccarla
          const len=a.u1-u0, hh=a.z1-a.z0, um=(u0+a.u1)/2/K, p= hor ? P(w.x1+um, w.y1) : P(w.x1, w.y1+um);
          const geo= hor ? new THREE.BoxGeometry(len, hh, SPESS+.03) : new THREE.BoxGeometry(SPESS+.03, hh, len);
          const presa=new THREE.Mesh(geo, mats.presa); presa.position.set(p.X, a.z0+hh/2, p.Z); presa.userData={infisso:a.fi}; g.add(presa);
          const cornice=new THREE.LineSegments(new THREE.EdgesGeometry(geo), a.f.tipo==='porta' ? mats.porta : mats.fin);
          cornice.position.copy(presa.position); g.add(cornice);
          if(a.f.tipo==='finestra' || a.f.tipo==='portafinestra'){
            const vg= hor ? new THREE.BoxGeometry(len*.96, hh*.96, .02) : new THREE.BoxGeometry(.02, hh*.96, len*.96);
            const v=new THREE.Mesh(vg, mats.vetro); v.position.copy(presa.position); g.add(v);
          }
        }
        cur=Math.max(cur,a.u1);
      }
      spigoli(pezzo(cur,L,0,Hm,mats.muro,{muro:w}));
    }
    if(primaVolta){
      // distanza calcolata sulla forma dello schermo: la casa entra tutta anche col telefono in verticale
      const S=Math.max((x1-x0)*K, (y1-y0)*K, 3);
      const vf=T3.camera.fov*Math.PI/180, hf=2*Math.atan(Math.tan(vf/2)*T3.camera.aspect);
      const D=Math.max(S/2/Math.tan(hf/2), S/2/Math.tan(vf/2))*1.4+Hm;
      const dir=new THREE.Vector3(.42,.78,.9).normalize();
      T3.camera.position.set(dir.x*D, dir.y*D, dir.z*D);
      T3.controls.target.set(0, 0, 0);
      T3.controls.update();
    }
  }
  function tocco3D(e){
    const r=T3.renderer.domElement.getBoundingClientRect();
    const v=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
    T3.ray.setFromCamera(v, T3.camera);
    const hit=T3.ray.intersectObjects(T3.group.children, false)
      .find(h=>h.object.userData && (h.object.userData.muro || h.object.userData.infisso!==undefined));
    if(!hit) return;
    if(hit.object.userData.infisso!==undefined){ apriInfisso(hit.object.userData.infisso); return; }
    const w=hit.object.userData.muro, hor=w.y1===w.y2;
    const ux=hit.point.x/T3.K+T3.cx, uy=hit.point.z/T3.K+T3.cy;
    apriInfisso(-1, {o:hor?'H':'V', x: hor?ux:w.x1, y: hor?w.y1:uy, tipo: hit.point.y<.8 ? 'porta' : 'finestra'});
  }

  /* ── finestra "Porta o finestra" ── */
  const infModal=$('infModal'), iW=$('iW'), iH=$('iH'), iS=$('iS'), iInfo=$('iInfo'), iDel=$('iDel');
  let infEdit=null; // {fi, f}
  $('infTipi').innerHTML=Object.keys(TIPI).map(k=>`<button type="button" class="pz-chip" data-t="${k}">${TIPI[k].lbl}</button>`).join('');
  function evidenziaTipo(){ document.querySelectorAll('#infTipi .pz-chip').forEach(c=>c.classList.toggle('on', c.dataset.t===infEdit.f.tipo)); }
  function infoInfisso(){
    const f=Object.assign({}, infEdit.f, {w:num(iW.value), h:num(iH.value)});
    const lati=latiInfisso(f).map(i=>nomeLocale(regions[i],i));
    const area=f.w*f.h;
    iInfo.textContent = area>0
      ? `${f2(area)} m² tolti dalle pareti di ${lati.length ? lati.join(' e ') : 'nessun locale chiuso'}.`
      : 'Inserisci larghezza e altezza.';
  }
  $('infTipi').addEventListener('click', e=>{
    const c=e.target.closest('.pz-chip'); if(!c) return;
    const t=TIPI[c.dataset.t]; infEdit.f.tipo=c.dataset.t;
    iW.value=fmtIn(t.w); iH.value=fmtIn(t.h); iS.value= t.s>0 ? fmtIn(t.s) : '0';
    evidenziaTipo(); infoInfisso();
  });
  [iW,iH,iS].forEach(el=>el.addEventListener('input', infoInfisso));
  function apriInfisso(fi, nuovo){
    const f= fi>=0 ? Object.assign({}, infissi[fi]) : Object.assign({}, nuovo, {w:TIPI[nuovo.tipo].w, h:TIPI[nuovo.tipo].h, sill:TIPI[nuovo.tipo].s});
    infEdit={fi, f};
    iW.value=fmtIn(f.w); iH.value=fmtIn(f.h); iS.value= f.sill>0 ? fmtIn(f.sill) : '0';
    iDel.hidden= fi<0;
    $('iTitle').textContent= fi<0 ? 'Aggiungi porta o finestra' : 'Modifica apertura';
    evidenziaTipo(); infoInfisso();
    infModal.hidden=false;
  }
  function chiudiInfisso(){ infModal.hidden=true; infEdit=null; }
  $('infForm').addEventListener('submit', e=>{
    e.preventDefault();
    if(!infEdit) return;
    const f=infEdit.f;
    f.w=num(iW.value); f.h=num(iH.value); f.sill=Math.max(0, parseFloat(String(iS.value).replace(',','.'))||0);
    if(!(f.w>0 && f.h>0)){ toast('Inserisci larghezza e altezza'); return; }
    const w=muroDi(f); if(!w){ toast('Parete non trovata'); chiudiInfisso(); return; }
    // l'apertura deve stare tutta dentro la parete
    const K=metriPerUnita(), half=f.w/2/K, hor=f.o==='H';
    const da= hor?w.x1:w.y1, a= hor?w.x2:w.y2;
    if(a-da < 2*half){ toast('Parete troppo corta per questa apertura'); return; }
    const c=Math.min(a-half, Math.max(da+half, hor?f.x:f.y));
    if(hor) f.x=c; else f.y=c;
    snapshot();
    if(!f.id) f.id=nuovoIdInf();
    if(infEdit.fi>=0) infissi[infEdit.fi]=f; else infissi.push(f);
    chiudiInfisso(); aggiorna();
    toast(`${TIPI[f.tipo].lbl}: ${f2(f.w*f.h)} m² tolti dalle pareti`);
  });
  iDel.addEventListener('click', ()=>{
    if(!infEdit || infEdit.fi<0) return;
    snapshot(); infissi.splice(infEdit.fi,1); chiudiInfisso(); aggiorna(); toast('Apertura eliminata');
  });
  $('iClose').addEventListener('click', chiudiInfisso);
  $('iCancel').addEventListener('click', chiudiInfisso);
  infModal.addEventListener('click', e=>{ if(e.target===infModal) chiudiInfisso(); });
  $('btn2d').addEventListener('click', chiudi3D);

  /* ── apertura e chiusura del foglio ── */
  function resize(){
    if(!aperto) return;
    dpr=window.devicePixelRatio||1;
    W=Math.max(1,window.innerWidth); H=Math.max(1,window.innerHeight);
    cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
    cv.style.width=W+'px'; cv.style.height=H+'px';
    requestDraw();
  }
  window.addEventListener('resize', resize);
  // Apre il foglio per il preventivo d (cb.cambio a ogni modifica, cb.fine alla chiusura).
  function apri(d, cb){
    carica(d); alChiudere=cb||null; aperto=true;
    ov.hidden=false; document.body.style.overflow='hidden';
    chiudiMenu(); chiudiPop(); apriCassetto(false);
    resize(); ricalcola(); collegaLocali();
    if(walls.length) inquadra(false); else { view={s:1, tx:W/2, ty:H/2}; }
    renderPanel(); etichettaAperture(); bottoniStoria(); requestDraw();
    let help=false; try{ help=localStorage.getItem(KEY_HELP)==='1'; }catch(_){}
    if(daCollegare().length) toast('Disegna le stanze: quando una si chiude, scegli a quale locale corrisponde', 4500); else
    toast(help ? (walls.length ? 'Tocca una stanza per le misure, un muro per porte e finestre' : 'Disegna col dito il contorno della casa')
               : 'Disegna col dito · tocca stanze e muri per modificarli', 4200);
  }
  function chiudi(){
    if(!aperto) return;
    chiudiNomi();
    if(!modal.hidden) chiudiModal();
    if(!infModal.hidden) chiudiInfisso();
    if(vista3D()) chiudi3D();
    esporta();
    aperto=false; ov.hidden=true; document.body.style.overflow='';
    const cb=alChiudere; alChiudere=null;
    if(cb && cb.fine) cb.fine();
  }
  $('btnFine').addEventListener('click', chiudi);
  // Messa in scala senza aprire il foglio (dal passo Misure del preventivo).
  function scala(d){
    carica(d); alChiudere=null;
    ricalcola();
    const esito=scalaCore();
    esporta(); docRef=null;
    return {esito, avvisi:avvisi.slice()};
  }
  // Ricalcola i collegamenti stanze↔locali (es. dopo modifiche nel preventivo).
  function aggiornaDoc(d){ carica(d); alChiudere=null; ricalcola(); esporta(); docRef=null; }
  bottoniStoria();
  return {apri, chiudi, scala, aggiornaDoc, aperto:()=>aperto};
})();
