/*! scanprof-qr-auto.js — v4
 * - JSON = [{ nom, prenom, classe, sexe, "200":"M:SS", "400":"M:SS", ... }] (PLUS AUCUN cumul_XX)
 * - Lit la 3e colonne "Temps cumulé" (#tbody). Sinon recalcule depuis la 2e (laps).
 * - Force sexe -> 'M' ou 'F'. Lit #distPalier pour les clés 200, 400, …
 * - QR immédiatement scannable : fond BLANC + large “quiet zone”
 * - Bouton "Plein écran" (fond blanc) pour iPad + "Télécharger PNG"
 */
(function(){
  const CDN = "https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs/qrcode.min.js";
  const $ = (s,r=document)=>r.querySelector(s);

  function loadQRCodeLibIfNeeded(){
    if(window.QRCode) return Promise.resolve();
    return new Promise((resolve, reject)=>{
      const s=document.createElement('script'); s.src=CDN; s.defer=true;
      s.onload=()=>resolve(); s.onerror=()=>reject(new Error('QRCode CDN introuvable'));
      document.head.appendChild(s);
    });
  }

  // mm:ss(.cs) / ss(.cs) -> secondes
  function parseClockToSec(txt){
    const s=String(txt||'').trim();
    if(/^\d+(\.\d+)?$/.test(s)) return Number(s);
    const m=s.match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
    if(!m) return NaN;
    const mm=Number(m[1]), ss=Number(m[2]), cs=m[3]?Number("0."+m[3]):0;
    return mm*60+ss+cs;
  }
  const secsToClock = (sec)=>{ const s=Math.round(sec); const m=Math.floor(s/60); return m+":"+String(s%60).padStart(2,'0'); };
  const cumulate = (arr)=>{ const out=[]; let acc=0; for(const v of arr){ acc+=(Number(v)||0); out.push(acc);} return out; };

  function getIdentity(){
    const nom=$('#nom')?.value?.trim()||'';
    const prenom=$('#prenom')?.value?.trim()||'';
    const classe=$('#classe')?.value?.trim()||'';
    let sexe=$('#sexe')?.value?.trim()||'';
    if(sexe!=='M' && sexe!=='F') sexe='F'; // ScanProf: M ou F uniquement
    return { nom, prenom, classe, sexe };
  }
  function getDistPalier(){
    const v=parseInt($('#distPalier')?.value||'200',10);
    return Number.isFinite(v)&&v>0 ? v : 200;
  }
  // 3e colonne = "Temps cumulé"
  function getCumulsFromTable(){
    const tb=document.getElementById('tbody'); if(!tb) return [];
    const out=[]; for(const tr of Array.from(tb.querySelectorAll('tr'))){
      const tds=tr.querySelectorAll('td'); if(tds.length>=3){
        const sec=parseClockToSec(tds[2].textContent); if(Number.isFinite(sec)) out.push(sec);
      }
    } return out;
  }
  // 2e colonne = "Temps sur le palier" (fallback)
  function getLapsFromTable(){
    const tb=document.getElementById('tbody'); if(!tb) return [];
    const out=[]; for(const tr of Array.from(tb.querySelectorAll('tr'))){
      const tds=tr.querySelectorAll('td'); if(tds.length>=2){
        const sec=parseClockToSec(tds[1].textContent); if(Number.isFinite(sec)) out.push(sec);
      }
    } return out;
  }

  // Construit l'objet avec SEULEMENT les clés distance ("200","400",...)
  function buildRecord({nom, prenom, classe, sexe, cumulSec=[], distPalier=200}){
    if(!nom||!prenom||!classe||!sexe) throw new Error('Identité incomplète.');
    if(!cumulSec.length) throw new Error('Aucun temps cumulé.');
    const rec = { nom:String(nom), prenom:String(prenom), classe:String(classe), sexe:String(sexe) };
    cumulSec.forEach((c,i)=>{
      const dist = distPalier*(i+1);
      rec[String(dist)] = secsToClock(c); // ex: "200": "1:24"
    });
    return rec;
  }

  function ensureOverlay(){
    if(document.getElementById('scanprof-qr-overlay')) return;
    const wrap=document.createElement('div'); wrap.id='scanprof-qr-overlay';
    wrap.innerHTML = `
      <style>
        #scanprof-qr-fab{position:fixed;right:18px;bottom:18px;z-index:99999;background:#4dabf7;color:#0b1020;border:none;font-weight:700;border-radius:999px;padding:12px 16px;box-shadow:0 6px 18px rgba(0,0,0,.35);cursor:pointer}
        #scanprof-qr-panel{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;place-items:center;z-index:99998}
        #scanprof-qr-card{background:#121a33;color:#eef2ff;border:1px solid rgba(255,255,255,.08);border-radius:16px;width:min(92vw,760px);padding:16px;box-shadow:0 10px 32px rgba(0,0,0,.45)}
        #scanprof-qr{display:grid;place-items:center;min-height:240px}
        /* QR lisible: fond blanc + marge = quiet zone */
        #scanprof-qr .qr-wrap-white{background:#fff;border:1px solid #d1d5db;border-radius:12px;padding:16px}
        #scanprof-qr canvas,#scanprof-qr img{image-rendering:pixelated}
        .btn{padding:10px 14px;border-radius:10px;border:none;cursor:pointer;font-weight:600}
        .btn-primary{background:#845ef7;color:#fff}.btn-ok{background:#20c997;color:#0b1020}.btn-ghost{background:transparent;color:#a9b3c6;border:1px dashed rgba(255,255,255,.25)}
        #scanprof-json{margin-top:8px;background:#0e1530;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px;color:#cbd5e1;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;white-space:pre-wrap;word-break:break-word}
        /* Plein écran blanc (iPad) */
        #scanprof-qr-full{position:fixed;inset:0;background:#fff;display:none;place-items:center;z-index:100000}
        #scanprof-qr-full .inner{display:grid;place-items:center;gap:16px}
        #scanprof-qr-full .inner .qr-wrap-white{background:#fff;padding:20px}
        #scanprof-qr-full .close{position:fixed;top:14px;right:14px}
      </style>
      <button id="scanprof-qr-fab" title="QR ScanProf">QR ScanProf</button>
      <div id="scanprof-qr-panel">
        <div id="scanprof-qr-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <h3>QR compatible ScanProf</h3>
            <button id="scanprof-qr-close" class="btn btn-ghost">Fermer</button>
          </div>
          <div id="scanprof-qr"><div class="qr-wrap-white"><div id="scanprof-qr-slot"></div></div></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
            <button id="scanprof-qr-refresh" class="btn btn-primary">Régénérer</button>
            <button id="scanprof-qr-fullscreen" class="btn btn-primary">Plein écran</button>
            <button id="scanprof-qr-download" class="btn btn-ok">Télécharger PNG</button>
          </div>
          <div id="scanprof-json" aria-label="JSON encodé dans le QR"></div>
          <div style="margin-top:8px;color:#aab4cc;font-size:12px">Format: [{ nom, prenom, classe, sexe, "200","400",... }]</div>
        </div>
      </div>
      <div id="scanprof-qr-full">
        <button class="btn btn-ghost close">Fermer</button>
        <div class="inner">
          <div class="qr-wrap-white"><div id="scanprof-qr-slot-full"></div></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
            <button id="scanprof-qr-download-full" class="btn btn-ok">Télécharger PNG</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
  }

  function openPanel(){ document.getElementById('scanprof-qr-panel').style.display='grid'; }
  function closePanel(){ document.getElementById('scanprof-qr-panel').style.display='none'; }
  function openFull(){ document.getElementById('scanprof-qr-full').style.display='grid'; }
  function closeFull(){ document.getElementById('scanprof-qr-full').style.display='none'; }

  function renderQRInto(targetEl, payload, size=360){
    targetEl.innerHTML='';
    // Génère le QR avec fond blanc; la "quiet zone" est apportée par le padding du conteneur .qr-wrap-white
    new QRCode(targetEl, { text: payload, width: size, height: size, colorDark:"#000000", colorLight:"#ffffff", correctLevel: QRCode.CorrectLevel.H });
  }

  function generatePayload(){
    const id = getIdentity();
    const distPalier = getDistPalier();
    let cumulSec = getCumulsFromTable();
    if(!cumulSec.length){
      const laps = getLapsFromTable();
      cumulSec = laps.length ? cumulate(laps) : [];
    }
    const rec = buildRecord({ ...id, cumulSec, distPalier });
    const payload = JSON.stringify([rec]);
    return { payload, rec };
  }

  function generateOnce(){
    const { payload, rec } = generatePayload();
    renderQRInto(document.getElementById('scanprof-qr-slot'), payload, 360);
    document.getElementById('scanprof-json').textContent = JSON.stringify([rec], null, 2);
    return payload;
  }

  function renderFull(){
    const { payload } = generatePayload();
    renderQRInto(document.getElementById('scanprof-qr-slot-full'), payload, 480);
    openFull();
  }

  function downloadFrom(containerId){
    const container = document.getElementById(containerId);
    const img = container.querySelector('img') || container.querySelector('canvas');
    if(!img){ alert('QR non généré'); return; }
    const url = img.tagName === 'IMG' ? img.src : img.toDataURL('image/png');
    const a=document.createElement('a');
    const id=getIdentity();
    a.href=url; a.download=`QR_${(id.nom||'')}_${(id.prenom||'')}.png`.replace(/\s+/g,'_');
    a.click();
  }

  async function boot(){
    ensureOverlay();
    try{ await loadQRCodeLibIfNeeded(); }catch(e){ alert('Librairie QRCode introuvable.'); return; }

    // Ouverture panneau + génération immédiate (scannable directement)
    document.getElementById('scanprof-qr-fab').addEventListener('click', ()=>{
      try{ generateOnce(); openPanel(); }catch(e){ alert('QR: '+e.message); }
    });
    document.getElementById('scanprof-qr-close').addEventListener('click', closePanel);
    document.getElementById('scanprof-qr-refresh').addEventListener('click', ()=>{ try{ generateOnce(); }catch(e){ alert('QR: '+e.message); } });

    // Plein écran (fond blanc iPad)
    document.getElementById('scanprof-qr-fullscreen').addEventListener('click', ()=>{ try{ renderFull(); }catch(e){ alert('QR: '+e.message); } });
    document.querySelector('#scanprof-qr-full .close').addEventListener('click', closeFull);

    // Téléchargement PNG (depuis panneau normal ou plein écran)
    document.getElementById('scanprof-qr-download').addEventListener('click', ()=> downloadFrom('scanprof-qr-slot'));
    document.getElementById('scanprof-qr-download-full').addEventListener('click', ()=> downloadFrom('scanprof-qr-slot-full'));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
