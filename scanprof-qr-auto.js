/*! scanprof-qr-auto.js — Auto-patch Chrono → QR minimal ScanProf (spécifique à ton index.html)
 *  - Injecte la librairie QRCode si absente
 *  - Ajoute un bouton flottant "QR ScanProf"
 *  - Lit tes inputs #nom/#prenom/#classe/#sexe
 *  - Lit les LAPS dans #tbody (2e colonne "Temps sur le palier", format mm:ss.cs)
 *  - Calcule les cumuls et génère un QR JSON minimal: [{ nom, prenom, classe, sexe, cumul_01..N }]
 */
(function(){
  const CDN = "https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs/qrcode.min.js";
  const $ = (s, r=document)=>r.querySelector(s);

  function loadQRCodeLibIfNeeded(){
    if(window.QRCode) return Promise.resolve();
    return new Promise((resolve, reject)=>{
      const s = document.createElement('script');
      s.src = CDN; s.defer = true;
      s.onload = ()=> resolve();
      s.onerror = ()=> reject(new Error('CDN QRCode introuvable'));
      document.head.appendChild(s);
    });
  }

  // mm:ss.cs  -> secondes (nombre), gère aussi "ss", "ss.cs"
  function parseClockToSec(txt){
    const s = String(txt||'').trim();
    if(/^\d+(\.\d+)?$/.test(s)) return Number(s);
    const m = s.match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
    if(!m) return NaN;
    const mm = Number(m[1]), ss = Number(m[2]), cs = m[3] ? Number("0."+m[3]) : 0;
    return mm*60 + ss + cs;
  }
  const secsToClock = (sec)=>{
    if(!Number.isFinite(sec)) return "";
    const s = Math.round(sec);              // on sort en MM:SS (sans centi)
    const m = Math.floor(s/60);
    return m + ":" + String(s % 60).padStart(2,'0');
  };
  const cumulate = (arr)=>{ const out=[]; let acc=0; for(const v of arr){ acc += (Number(v)||0); out.push(acc); } return out; };

  // -- IDENTITÉ lisible telle qu’affichée dans ton index.html
  function getIdentity(){
    const nom = $('#nom')?.value?.trim() || '';
    const prenom = $('#prenom')?.value?.trim() || '';
    const classe = $('#classe')?.value?.trim() || '';
    const sexe = $('#sexe')?.value?.trim() || '';
    return { nom, prenom, classe, sexe };
  }

  // -- LAPS : lit le tableau récap (#tbody). 2e colonne = "Temps sur le palier".
  function getLapSecondsFromTable(){
    const tbody = document.getElementById('tbody');
    if(!tbody) return [];
    const laps = [];
    for(const tr of Array.from(tbody.querySelectorAll('tr'))){
      const tds = tr.querySelectorAll('td');
      if(tds.length < 2) continue;
      const lapTxt = tds[1].textContent; // 2e colonne
      const sec = parseClockToSec(lapTxt);
      if(Number.isFinite(sec)) laps.push(sec);
    }
    return laps;
  }

  function buildMinimalJSON({nom, prenom, classe, sexe, splitsSec=[]}){
    if(!nom||!prenom||!classe||!sexe) throw new Error('Identité incomplète (nom/prenom/classe/sexe).');
    if(!splitsSec.length) throw new Error('Aucun temps intermédiaire trouvé.');
    const cumul = cumulate(splitsSec);
    const one = { nom:String(nom), prenom:String(prenom), classe:String(classe), sexe:String(sexe) };
    cumul.forEach((c,i)=> one['cumul_'+String(i+1).padStart(2,'0')] = secsToClock(c));
    return JSON.stringify([ one ]);
  }

  function ensureOverlay(){
    if(document.getElementById('scanprof-qr-overlay')) return;
    const wrap = document.createElement('div');
    wrap.id = 'scanprof-qr-overlay';
    wrap.innerHTML = `
      <style>
        #scanprof-qr-fab { position: fixed; right: 18px; bottom: 18px; z-index: 99999;
          background:#4dabf7; color:#0b1020; border:none; font-weight:700;
          border-radius:999px; padding:12px 16px; box-shadow:0 6px 18px rgba(0,0,0,.35); cursor:pointer; }
        #scanprof-qr-panel { position: fixed; inset: 0; background: rgba(0,0,0,.55);
          display:none; place-items:center; z-index: 99998; }
        #scanprof-qr-card { background:#121a33; color:#eef2ff; border:1px solid rgba(255,255,255,.08);
          border-radius:16px; width:min(92vw,700px); padding:16px; box-shadow:0 10px 32px rgba(0,0,0,.45); }
        #scanprof-qr { display:grid; place-items:center; min-height:240px; background:#0e1530; border-radius:12px; }
        .btn { padding:10px 14px; border-radius:10px; border:none; cursor:pointer; font-weight:600; }
        .btn-primary{ background:#845ef7; color:#fff } .btn-ok{ background:#20c997; color:#0b1020 }
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
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
            <button id="scanprof-qr-refresh" class="btn btn-primary">Régénérer</button>
            <button id="scanprof-qr-download" class="btn btn-ok">Télécharger PNG</button>
          </div>
          <div style="margin-top:8px;color:#aab4cc;font-size:12px">JSON: [{ nom, prenom, classe, sexe, cumul_01..N }]</div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
  }

  function openPanel(){ document.getElementById('scanprof-qr-panel').style.display='grid'; }
  function closePanel(){ document.getElementById('scanprof-qr-panel').style.display='none'; }

  function renderQRTo(elId, payload){
    const el = document.getElementById(elId);
    el.innerHTML = '';
    const size = Math.max(240, Math.min(520, 170 + Math.ceil(payload.length/4)));
    new QRCode(elId, { text: payload, width: size, height: size, correctLevel: QRCode.CorrectLevel.M });
  }

  function generateOnce(){
    const id = getIdentity();
    const splits = getLapSecondsFromTable(); // ← lit #tbody 2e colonne
    const payload = buildMinimalJSON({ nom:id.nom, prenom:id.prenom, classe:id.classe, sexe:id.sexe, splitsSec:splits });
    renderQRTo('scanprof-qr', payload);
    return payload;
  }

  function downloadQRPNG(){
    const el = document.getElementById('scanprof-qr');
    const img = el.querySelector('img') || el.querySelector('canvas');
    if(!img){ alert('QR non généré'); return; }
    const url = img.tagName === 'IMG' ? img.src : img.toDataURL('image/png');
    const a = document.createElement('a'); a.href=url; a.download='qr-scanprof.png'; a.click();
  }

  async function boot(){
    ensureOverlay();
    try{ await loadQRCodeLibIfNeeded(); }catch(e){ alert('Librairie QRCode introuvable.'); return; }
    document.getElementById('scanprof-qr-fab').addEventListener('click', ()=>{
      try{ generateOnce(); openPanel(); }catch(e){ alert('QR: '+e.message); }
    });
    document.getElementById('scanprof-qr-close').addEventListener('click', closePanel);
    document.getElementById('scanprof-qr-refresh').addEventListener('click', ()=>{
      try{ generateOnce(); }catch(e){ alert('QR: '+e.message); }
    });
    document.getElementById('scanprof-qr-download').addEventListener('click', downloadQRPNG);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
