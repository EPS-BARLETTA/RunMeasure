
/*! scanprof-qr-auto.js — Auto-patch Chrono → QR minimal ScanProf (0 modifs HTML)
 *  - Injecte la librairie QRCode si absente (CDN davidshimjs/qrcodejs)
 *  - Ajoute un bouton flottant "QR ScanProf"
 *  - Lit automatiquement: nom/prenom/classe/sexe (inputs ou texte), splits (mm:ss ou secondes)
 *  - Calcule cumul_01..N (MM:SS) et génère un QR JSON minimal pour ScanProf
 *  - Ouvre un panneau overlay avec le QR + bouton "Télécharger PNG"
 *
 *  Contenu JSON encodé: [{ nom, prenom, classe, sexe, cumul_01..N }]
 *  Aucune distance/vitesse/VMA.
 */
(function(){
  const CDN = "https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs/qrcode.min.js";

  // ---------- Helpers
  const $ = (s, r=document)=>r.querySelector(s);
  const $all = (s, r=document)=>Array.from(r.querySelectorAll(s));
  const once = (fn)=>{ let done=false; return (...a)=>{ if(!done){ done=true; return fn(...a); } } };

  function waitFor(condition, timeout=8000, interval=50){
    return new Promise((resolve, reject)=>{
      const t0 = performance.now();
      (function tick(){
        if(condition()) return resolve(true);
        if(performance.now()-t0 > timeout) return reject(new Error('timeout'));
        setTimeout(tick, interval);
      })();
    });
  }

  function loadQRCodeLibIfNeeded(){
    if(window.QRCode) return Promise.resolve();
    return new Promise((resolve, reject)=>{
      const s = document.createElement('script');
      s.src = CDN; s.defer = true; s.onload = ()=> resolve(); s.onerror = ()=> reject(new Error('CDN QRCode introuvable'));
      document.head.appendChild(s);
    });
  }

  function secsToClock(sec){
    if(!Number.isFinite(sec)) return "";
    const s = Math.round(sec);
    const m = Math.floor(s/60);
    const rs = String(s % 60).padStart(2,'0');
    return `${m}:${rs}`;
  }

  function parseClockToSec(txt){
    const s = String(txt||'').trim();
    if(/^\d+(\.\d+)?$/.test(s)) return Number(s); // déjà en secondes
    const m = s.match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
    if(!m) return NaN;
    const mm = Number(m[1]), ss = Number(m[2]);
    return mm*60 + ss;
  }

  function cumulateSeconds(arr){
    const out = []; let acc = 0;
    (arr||[]).forEach(v=>{ acc += (Number(v)||0); out.push(acc); });
    return out;
  }

  function findIdentity(){
    // Cherche inputs par IDs usuels puis par placeholders/labels
    const tryIds = ['nom','name','last','lastname','family','eleve_nom'];
    const tryFirst = ['prenom','first','firstname','given','eleve_prenom'];
    const tryClass = ['classe','class','groupe','group','eleve_classe'];
    const trySexe  = ['sexe','sex','gender','eleve_sexe'];

    function pick(cands){
      for(const id of cands){
        const el = document.getElementById(id) || document.querySelector(`[name="${id}"]`);
        if(el) return el;
      }
      // placeholders
      const alt = document.querySelector('input[placeholder*="Nom" i], input[placeholder*="name" i]') ||
                  document.querySelector('[data-nom], [data-name]');
      return alt || null;
    }
    function pick2(cands, ph){
      for(const id of cands){
        const el = document.getElementById(id) || document.querySelector(`[name="${id}"]`);
        if(el) return el;
      }
      const sel = `input[placeholder*="${ph}" i], select[aria-label*="${ph}" i]`;
      return document.querySelector(sel) || null;
    }
    const elNom = pick(tryIds) || document.querySelector('input[aria-label*="nom" i]');
    const elPre = pick2(tryFirst, 'prénom') || document.querySelector('input[aria-label*="prénom" i]');
    const elClas= document.getElementById('classe') || document.querySelector('input[placeholder*="classe" i], [data-classe]');
    const elSex = document.getElementById('sexe') || document.querySelector('select[name*="sex" i], select#sexe, [data-sexe]');

    function val(el){
      if(!el) return '';
      if('value' in el) return (el.value||'').trim();
      return (el.textContent||'').trim();
    }
    return {
      nom: val(elNom), prenom: val(elPre), classe: val(elClas), sexe: val(elSex),
      _els: {elNom, elPre, elClas, elSex}
    };
  }

  function findSplits(){
    // Heuristique: lignes portant .split, .lap, .inter, ou un tableau dont l'entête contient "Inter" ou "Lap"
    let rows = $all('.split1, .split, .lap, .inter, tr[data-sec]');
    if(!rows.length){
      const tables = $all('table');
      for(const t of tables){
        const head = (t.tHead && t.tHead.textContent) || t.querySelector('thead')?.textContent || '';
        if(/inter|lap|tour|split/i.test(head)){
          rows = $all('tbody tr', t);
          break;
        }
      }
    }
    const splits = [];
    rows.forEach(tr=>{
      const vAttr = tr.getAttribute('data-sec');
      if(vAttr!=null){
        const n = Number(vAttr);
        if(Number.isFinite(n)) splits.push(n);
      }else{
        // prend la 1ère cellule chiffrée mm:ss
        const cells = tr.querySelectorAll('td,th');
        let added=false;
        for(const c of cells){
          const sec = parseClockToSec(c.textContent);
          if(Number.isFinite(sec)){ splits.push(sec); added=true; break; }
        }
        if(!added){
          const sec = parseClockToSec(tr.textContent);
          if(Number.isFinite(sec)) splits.push(sec);
        }
      }
    });
    return splits;
  }

  function buildMinimalJSON({nom, prenom, classe, sexe, splitsSec=[]}){
    if(!nom||!prenom||!classe||!sexe) throw new Error('Identité incomplète');
    const cumul = cumulateSeconds(splitsSec);
    const one = { nom:String(nom), prenom:String(prenom), classe:String(classe), sexe:String(sexe) };
    cumul.forEach((c,i)=> one['cumul_'+String(i+1).padStart(2,'0')] = secsToClock(c));
    return JSON.stringify([ one ]);
  }

  // ---------- UI overlay + bouton flottant
  function ensureOverlay(){
    let wrap = document.getElementById('scanprof-qr-overlay');
    if(wrap) return wrap;
    wrap = document.createElement('div');
    wrap.id = 'scanprof-qr-overlay';
    wrap.innerHTML = `
      <style>
        #scanprof-qr-fab {
          position: fixed; right: 18px; bottom: 18px; z-index: 99999;
          background:#4dabf7; color:#0b1020; border:none; font-weight:700;
          border-radius:999px; padding:12px 16px; box-shadow:0 6px 18px rgba(0,0,0,.35); cursor:pointer;
        }
        #scanprof-qr-panel {
          position: fixed; inset: 0; background: rgba(0,0,0,.55);
          display:none; place-items:center; z-index: 99998;
        }
        #scanprof-qr-card {
          background:#121a33; color:#eef2ff; border:1px solid rgba(255,255,255,.08);
          border-radius:16px; width:min(92vw,700px); padding:16px;
          box-shadow:0 10px 32px rgba(0,0,0,.45);
        }
        #scanprof-qr-card h3 { margin:0 0 6px }
        #scanprof-qr-actions { display:flex; gap:10px; flex-wrap:wrap }
        #scanprof-qr { display:grid; place-items:center; min-height:240px; background:#0e1530; border-radius:12px; }
        .btn { padding:10px 14px; border-radius:10px; border:none; cursor:pointer; font-weight:600; }
        .btn-primary{ background:#845ef7; color:#fff }
        .btn-ok{ background:#20c997; color:#0b1020 }
        .btn-ghost{ background:transparent; color:#a9b3c6; border:1px dashed rgba(255,255,255,.25) }
      </style>
      <button id="scanprof-qr-fab" title="QR ScanProf">QR ScanProf</button>
      <div id="scanprof-qr-panel">
        <div id="scanprof-qr-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <h3>QR compatible ScanProf</h3>
            <button id="scanprof-qr-close" class="btn btn-ghost">Fermer</button>
          </div>
          <div id="scanprof-qr"></div>
          <div id="scanprof-qr-actions" style="margin-top:10px">
            <button id="scanprof-qr-refresh" class="btn btn-primary">Régénérer</button>
            <button id="scanprof-qr-download" class="btn btn-ok">Télécharger PNG</button>
          </div>
          <div style="margin-top:8px;color:#aab4cc;font-size:12px">JSON: [{{ nom, prenom, classe, sexe, cumul_01..N }}]</div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    return wrap;
  }

  function openPanel(){ $('#scanprof-qr-panel').style.display='grid'; }
  function closePanel(){ $('#scanprof-qr-panel').style.display='none'; }

  function renderQRTo(elId, payload){
    const el = document.getElementById(elId);
    el.innerHTML = '';
    const size = Math.max(240, Math.min(520, 170 + Math.ceil(payload.length/4)));
    new QRCode(elId, { text: payload, width: size, height: size, correctLevel: QRCode.CorrectLevel.M });
  }

  function generateOnce(){
    const id = findIdentity();
    const splits = findSplits();
    if(!splits.length) throw new Error('Aucun temps intermédiaire détecté (laps/splits).');
    const payload = buildMinimalJSON({ nom:id.nom, prenom:id.prenom, classe:id.classe, sexe:id.sexe, splitsSec:splits });
    renderQRTo('scanprof-qr', payload);
    return payload;
  }

  function downloadQRPNG(){
    const el = $('#scanprof-qr');
    const img = el.querySelector('img') || el.querySelector('canvas');
    if(!img){ alert('QR non généré'); return; }
    const url = img.tagName === 'IMG' ? img.src : img.toDataURL('image/png');
    const a = document.createElement('a'); a.href=url; a.download='qr-scanprof.png'; a.click();
  }

  // ---------- Boot
  async function boot(){
    ensureOverlay();
    try{
      await loadQRCodeLibIfNeeded();
    }catch(e){
      alert('Librairie QRCode introuvable. Réseau ?'); return;
    }
    $('#scanprof-qr-fab').addEventListener('click', ()=>{
      try{
        generateOnce();
        openPanel();
      }catch(e){
        alert('QR: '+e.message);
      }
    });
    $('#scanprof-qr-close').addEventListener('click', closePanel);
    $('#scanprof-qr-refresh').addEventListener('click', ()=>{
      try{ generateOnce(); }catch(e){ alert('QR: '+e.message); }
    });
    $('#scanprof-qr-download').addEventListener('click', downloadQRPNG);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else{ boot(); }
})();
