// app.js — logique des modes + QR JSON (ScanProf)

(function(){
  // ===== Utilities =====
  const $ = (s, r=document)=>r.querySelector(s);
  const $all = (s, r=document)=>Array.from(r.querySelectorAll(s));

  function pad(n){ return String(n).padStart(2,'0'); }
  function msToClock(ms){
    const total = Math.max(0, Math.round(ms/1000));
    const h = Math.floor(total/3600);
    const m = Math.floor((total%3600)/60);
    const s = total%60;
    return h>0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }
  function timeToMs(str){
    if(!str) return null;
    const parts = str.trim().split(':').map(x=>x.trim());
    if(parts.length<2) return null;
    let h=0,m=0,s=0,ms=0;
    if(parts.length===2){ m=+parts[0]||0; s=+parts[1]||0; }
    else { h=+parts[0]||0; m=+parts[1]||0; s=+parts[2]||0; }
    const last=parts[parts.length-1];
    if(String(last).includes('.')){
      const [ss,mmm]=String(last).split('.');
      s = +ss||0; ms = +(String(mmm).padEnd(3,'0').slice(0,3))||0;
    }
    const tot=((h*3600)+(m*60)+s)*1000+ms;
    return Number.isFinite(tot)?tot:null;
  }
  function kmh(m,ms){ if(!m||!ms) return null; return Math.round((m/(ms/1000))*3.6*100)/100; }
  function safeNumber(n){ const v=Number(String(n||'').replace(',','.')); return Number.isFinite(v)?v:null; }

  // ===== Élève =====
  function getEleve(){
    try{ const raw=localStorage.getItem('eleve'); if(raw) return JSON.parse(raw); }catch{}
    return {nom:"",prenom:"",classe:"",sexe:""};
  }

  // ===== QR helpers =====
  function ensureQrContainer(){
    let box = $('#qr-box');
    if(!box){
      box = document.createElement('div');
      box.id = 'qr-box';
      box.style.marginTop = '16px';
      box.innerHTML = `
        <h3 style="margin:0 0 8px 0;">QR JSON (ScanProf)</h3>
        <div id="qr" style="width:220px;height:220px;"></div>
        <pre id="qr-json" style="white-space:pre-wrap;word-break:break-word;font-size:12px;border:1px solid #ccc;padding:8px;border-radius:8px;margin-top:8px"></pre>
      `;
      ( $('#result') || document.body ).appendChild(box);
    }
    return box;
  }
  function renderQR(obj){
    ensureQrContainer();
    const target = $('#qr');
    const pre = $('#qr-json');
    const text = JSON.stringify(obj);
    if(target){
      target.innerHTML='';
      if(typeof QRCode !== 'undefined'){
        new QRCode(target,{ text, width:220, height:220, correctLevel: QRCode.CorrectLevel.M });
      } else {
        target.textContent='QRCode library manquante (qrcode.min.js)';
      }
    }
    if(pre) pre.textContent=text;
  }
  function basePayload(mode,result){
    const e=getEleve();
    return { app:"RunMeasure", mode, nom:e.nom||"", prenom:e.prenom||"", classe:e.classe||"", sexe:e.sexe||"", result };
  }

  // ===== Lecture DOM =====
  function readDistanceMeters(){
    let txt = $('#distance-result')?.textContent || '';
    txt = txt.replace(/[^\d.,]/g,'').replace(',','.');
    let v = Number(txt);
    if(Number.isFinite(v) && v>0) return Math.round(v);
    v = safeNumber($('#distance-input')?.value);
    if(v) return Math.round(v);
    return null;
  }
  function readDurationMs(fallbackSec=null){
    let t = $('#time-result')?.textContent || '';
    let ms = timeToMs(t); if(ms) return ms;
    ms = timeToMs($('#time-input')?.value);
    if(ms) return ms;
    return fallbackSec ? fallbackSec*1000 : null;
  }
  function readSplits(){
    const a = $all('#splits-table .split').map(td=>td.textContent.trim()).filter(Boolean);
    if(a.length) return a;
    const b = $all('#splits li').map(li=>li.textContent.trim()).filter(Boolean);
    return b;
  }

  // ===== Payloads =====
  function payloadIntermediaire(){
    const splits=readSplits();
    let totalMs=readDurationMs(null);
    if(!totalMs && splits.length) totalMs=splits.reduce((acc,t)=>acc+(timeToMs(t)||0),0);
    return basePayload("intermediaire", { type:"temps_intermediaire", splits, total_ms:totalMs, total_hms: totalMs? msToClock(totalMs):null });
  }
  function payloadDemiCooper(){
    const dureeMs=readDurationMs(6*60);
    const dist=readDistanceMeters();
    return basePayload("demi_cooper", { type:"demi_cooper", distance_m:dist, duree_s:dureeMs?Math.round(dureeMs/1000):null, vitesse_kmh:(dist&&dureeMs)?kmh(dist,dureeMs):null });
  }
  function payloadCooper(){
    const dureeMs=readDurationMs(12*60);
    const dist=readDistanceMeters();
    return basePayload("cooper", { type:"cooper", distance_m:dist, duree_s:dureeMs?Math.round(dureeMs/1000):null, vitesse_kmh:(dist&&dureeMs)?kmh(dist,dureeMs):null });
  }

  // ===== Chrono/Minuteur UI =====
  document.addEventListener('DOMContentLoaded',()=>{
    const qs=new URLSearchParams(location.search);
    let mode=(qs.get('mode')||'').toLowerCase();
    // alias courants
    const alias={ 'intervalles':'intermediaire', 'demi-cooper':'demi_cooper' };
    mode = alias[mode] || mode;

    const title=$('#mode-title'), hint=$('#hint');
    const rowDistance=$('#distance-row'), rowTimer=$('#timer-row');
    const distanceInput=$('#distance-input'), timeInput=$('#time-input');
    const startBtn=$('#start-btn'), stopBtn=$('#stop-btn'), resetBtn=$('#reset-btn'), splitBtn=$('#split-btn');
    const timeResult=$('#time-result'), distanceCol=$('#distance-col'), distanceResult=$('#distance-result'), speedCol=$('#speed-col'), speedResult=$('#speed-result');
    const splitsBlock=$('#splits-block'), splitsTbody=document.querySelector('#splits-table tbody');

    let t0=0, raf=0, running=false;
    let countdown=false, targetMs=0; // minuteur
    let elapsed=0;
    let fixedDurationMs=0;
    let splits=[];

    function updateDistanceOutput(){
      const v = Number((distanceInput?.value||'').replace(',','.'));
      distanceResult.textContent = (Number.isFinite(v) && v>0) ? (Math.round(v)+' m') : '—';
    }
    function computeSpeedKmh(m,ms){ if(!m||!ms) return null; return Math.round((m/(ms/1000))*3.6*100)/100; }
    function tick(){
      if(!running) return;
      const now = performance.now();
      const dt = now - t0;
      t0 = now;
      elapsed += dt;

      if(countdown){
        const remain = Math.max(0, targetMs - elapsed);
        timeResult.textContent = msToClock(remain);
        if(remain<=0){ stop(); } else { raf=requestAnimationFrame(tick); }
      } else {
        timeResult.textContent = msToClock(elapsed);
        raf = requestAnimationFrame(tick);
      }

      if((mode==='chrono_vitesse'||mode==='minuteur_distance'||mode==='demi_cooper'||mode==='cooper')){
        const dist = Number((distanceInput?.value||'').replace(',','.'));
        if(Number.isFinite(dist) && dist>0){
          const baseMs = countdown ? (targetMs - Math.max(0, targetMs - elapsed)) : elapsed;
          const v = computeSpeedKmh(dist, baseMs);
          if(v) speedResult.textContent = v + ' km/h';
        }
      }
    }
    function start(){
      if(running) return;
      running=true;
      startBtn.disabled=true; stopBtn.disabled=false; resetBtn.disabled=false;
      t0=performance.now();
      raf=requestAnimationFrame(tick);
    }
    function stop(){
      if(!running) return;
      running=false;
      stopBtn.disabled=true; startBtn.disabled=false;
      cancelAnimationFrame(raf); raf=0;
    }
    function reset(){
      running=false; cancelAnimationFrame(raf); raf=0; elapsed=0;
      timeResult.textContent='00:00';
      splits=[]; if(splitsTbody) splitsTbody.innerHTML='';
      distanceResult.textContent='—'; speedResult.textContent='—';
      stopBtn.disabled=true; resetBtn.disabled=true; startBtn.disabled=false;

      if(mode==='minuteur'){
        targetMs = timeToMs(timeInput?.value||'06:00') || 6*60*1000;
        timeResult.textContent = msToClock(targetMs);
      }
      if(mode==='demi_cooper'){ targetMs=fixedDurationMs=6*60*1000; timeResult.textContent=msToClock(targetMs); }
      if(mode==='cooper'){ targetMs=fixedDurationMs=12*60*1000; timeResult.textContent=msToClock(targetMs); }
    }
    function addSplit(){
      const clock = timeResult.textContent.trim();
      splits.push(clock);
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${splits.length}</td><td class="split">${clock}</td>`;
      splitsTbody.appendChild(tr);
    }

    // Config par mode
    switch(mode){
      case 'chrono':
        title.textContent='Chrono';
        hint.textContent='Démarre/Stop. Reset pour remettre à zéro.';
        break;
      case 'minuteur':
        title.textContent='Minuteur';
        hint.textContent='Règle la durée (MM:SS), puis Démarrer.';
        rowTimer.style.display='block';
        countdown=true;
        targetMs = timeToMs(timeInput?.value||'06:00') || 6*60*1000;
        timeResult.textContent=msToClock(targetMs);
        break;
      case 'chrono_vitesse':
        title.textContent='Chrono avec calcul de vitesse';
        hint.textContent='Renseigne la distance totale (m).';
        rowDistance.style.display='block';
        distanceCol.style.display='block'; speedCol.style.display='block';
        distanceInput.addEventListener('input',updateDistanceOutput);
        break;
      case 'minuteur_distance':
        title.textContent='Minuteur avec distance';
        hint.textContent='Distance (m) + Durée (MM:SS).';
        rowDistance.style.display='block'; rowTimer.style.display='block';
        distanceCol.style.display='block'; speedCol.style.display='block';
        countdown=true;
        targetMs = timeToMs(timeInput?.value||'06:00') || 6*60*1000;
        timeResult.textContent=msToClock(targetMs);
        distanceInput.addEventListener('input',updateDistanceOutput);
        break;
      case 'intermediaire':
        title.textContent='Temps intermédiaire';
        hint.textContent='Démarre puis clique « Temps intermédiaire » pour enregistrer.';
        $('#split-btn').style.display='inline-block';
        $('#splits-block').style.display='block';
        break;
      case 'demi_cooper':
        title.textContent='Demi-Cooper (6′)';
        hint.textContent='Distance libre (m), minuteur fixe 6:00.';
        rowDistance.style.display='block'; distanceCol.style.display='block'; speedCol.style.display='block';
        countdown=true; fixedDurationMs=6*60*1000; targetMs=fixedDurationMs;
        timeResult.textContent=msToClock(targetMs);
        distanceInput.addEventListener('input',updateDistanceOutput);
        break;
      case 'cooper':
        title.textContent='Cooper (12′)';
        hint.textContent='Distance libre (m), minuteur fixe 12:00.';
        rowDistance.style.display='block'; distanceCol.style.display='block'; speedCol.style.display='block';
        countdown=true; fixedDurationMs=12*60*1000; targetMs=fixedDurationMs;
        timeResult.textContent=msToClock(targetMs);
        distanceInput.addEventListener('input',updateDistanceOutput);
        break;
      default:
        title.textContent='Mode inconnu';
        hint.textContent='Revenir aux options.';
        $('#start-btn').disabled=true; $('#stop-btn').disabled=true; $('#reset-btn').disabled=true;
        return;
    }

    // Boutons
    $('#start-btn').addEventListener('click',start);
    $('#stop-btn').addEventListener('click',stop);
    $('#reset-btn').addEventListener('click',reset);
    $('#split-btn').addEventListener('click',addSplit);

    updateDistanceOutput();

    // ===== QR : bouton + auto-QR au STOP =====
    function addQrButton(make){
      if($('#btn-make-qr')) return;
      const btn=document.createElement('button');
      btn.id='btn-make-qr';
      btn.textContent='📱 Générer le QR JSON';
      btn.className='btn';
      btn.style.marginTop='12px';
      ( $('#result') || document.body ).appendChild(btn);
      btn.addEventListener('click',()=>{
        try{ renderQR(make()); }catch(e){ alert('QR impossible: '+e.message); }
      });
    }
    if(mode==='intermediaire') addQrButton(payloadIntermediaire);
    if(mode==='demi_cooper')   addQrButton(payloadDemiCooper);
    if(mode==='cooper')        addQrButton(payloadCooper);

    document.addEventListener('click',(e)=>{
      if((e.target && e.target.id) !== 'stop-btn') return;
      try{
        if(mode==='intermediaire') renderQR(payloadIntermediaire());
        if(mode==='demi_cooper')   renderQR(payloadDemiCooper());
        if(mode==='cooper')        renderQR(payloadCooper());
      }catch{}
    });
  });
})();
