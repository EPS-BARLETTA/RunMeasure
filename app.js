
// app.js — modes réactifs + QR + fullscreen + iPad friendly
(function(){
  const $ = (s, r=document)=>r.querySelector(s);
  const $all = (s, r=document)=>Array.from(r.querySelectorAll(s));

  // ---------- State ----------
  const qs = new URLSearchParams(location.search);
  let mode = (qs.get('mode')||'').toLowerCase();
  const alias = {'intervalles':'intermediaire','demi-cooper':'demi_cooper'};
  mode = alias[mode] || mode;

  // Elements
  const hint = $('#hint');
  const timeEl = $('#time');
  const speedBox = $('#box-speed'); const speedEl = $('#speed');
  const distBox = $('#box-distance'); const distEl = $('#distance');
  const splitsWrap = $('#splits-wrap'); const splitsBody = $('#splits-table tbody');
  const btnStart = $('#btn-start'), btnStop = $('#btn-stop'), btnReset = $('#btn-reset'), btnLap = $('#btn-lap'), btnQr = $('#btn-qr');
  const rowDistance = $('#row-distance'), rowTrack = $('#row-track'), rowIntervalles = $('#row-intervalles'), rowTimer = $('#row-timer');
  const distanceInput = $('#distance-input');
  const trackLength = $('#track-length'), lapsCount = $('#laps-count'), lapFraction = $('#lap-fraction');
  const totalDistance = $('#total-distance'), splitStep = $('#split-step');
  const whH = $('#wh-h'), whM = $('#wh-m'), whS = $('#wh-s');

  // Fullscreen overlays
  const fsChrono = $('#fs-chrono'), fsTime = $('#fs-time');
  const fsCount = $('#fs-countdown'), cdCanvas = $('#cd-canvas'), cdTime = $('#cd-time');
  const fsSpeed = $('#fs-speed'), fsSpeedVal = $('#fs-speed-val'), fsTime2 = $('#fs-time2');
  const btnFull = $('#btn-full');
  const btnHelp = $('#btn-help');

  // ---------- Utils ----------
  const pad = n => String(n).padStart(2,'0');
  function msToClock(ms){
    const t = Math.max(0, Math.round(ms/1000));
    const h = Math.floor(t/3600), m = Math.floor((t%3600)/60), s = t%60;
    return h>0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }
  function timeToMs(str){
    if(!str) return null;
    const p = str.trim().split(':').map(x=>x.trim());
    if(p.length<2) return null;
    let h=0,m=0,s=0,ms=0;
    if(p.length===2){ m=+p[0]||0; s=+p[1]||0; }
    else { h=+p[0]||0; m=+p[1]||0; s=+p[2]||0; }
    const last=p[p.length-1];
    if(String(last).includes('.')){ const [ss,mmm]=String(last).split('.'); s=+ss||0; ms=+(String(mmm).padEnd(3,'0').slice(0,3))||0; }
    const tot=((h*3600)+(m*60)+s)*1000+ms;
    return Number.isFinite(tot)?tot:null;
  }
  function kmh(m,ms){ if(!m||!ms) return null; return Math.round((m/(ms/1000))*3.6*100)/100; }
  function safeNumber(n){ const v = Number(String(n||'').replace(',','.')); return Number.isFinite(v)?v:null; }
  function getEleve(){ try{const raw=localStorage.getItem('eleve'); if(raw) return JSON.parse(raw);}catch{} return {nom:'',prenom:'',classe:'',sexe:''}; }

  // ---------- QR ----------
  function ensureQrBox(){
    let box = $('#qr-box');
    if(!box){
      box = document.createElement('div'); box.id = 'qr-box';
      box.innerHTML = `<h3>QR JSON (ScanProf)</h3><div id="qr" style="width:220px;height:220px;"></div><pre id="qr-json" class="code"></pre>`;
      ( $('#results') || document.body ).appendChild(box);
    }
    return box;
  }
  function renderQR(obj){
    ensureQrBox();
    const target = $('#qr'); const pre = $('#qr-json');
    const text = JSON.stringify(obj);
    if(target){
      target.innerHTML='';
      if(typeof QRCode !== 'undefined'){
        new QRCode(target,{ text, width:220, height:220, correctLevel:QRCode.CorrectLevel.M });
      }else{
        target.textContent = 'QR indisponible (lib manquante)';
      }
    }
    if(pre) pre.textContent = text;
  }
  function basePayload(mode,result){
    const e = getEleve();
    return { app:"RunMeasure", mode, nom:e.nom||"", prenom:e.prenom||"", classe:e.classe||"", sexe:e.sexe||"", result };
  }

  // ---------- Wheels for timer ----------
  function fillWheel(sel, max){
    sel.innerHTML = ''; for(let i=0;i<=max;i++){ const o=document.createElement('option'); o.value=i; o.textContent=String(i).padStart(2,'0'); sel.appendChild(o); }
  }
  function computeWheelMs(){ return ((+whH.value||0)*3600 + (+whM.value||0)*60 + (+whS.value||0))*1000; }

  // ---------- Chrono engine ----------
  let running=false, t0=0, raf=0, elapsed=0, countdown=false, targetMs=0;
  let splits=[], currentCumDist=0, goalDist=0, stepDist=0;

  function tick(){
    if(!running) return;
    const now = performance.now(); const dt = now - t0; t0 = now; elapsed += dt;
    if(countdown){
      const remain = Math.max(0, targetMs - elapsed);
      timeEl.textContent = msToClock(remain);
      fsTime.textContent = msToClock(remain);
      cdTime.textContent = msToClock(remain);
      fsTime2.textContent = msToClock(targetMs - remain);
      drawCountdown(remain);
      if(remain<=0){ stop(); }
      else { raf = requestAnimationFrame(tick); }
    } else {
      timeEl.textContent = msToClock(elapsed);
      fsTime.textContent = msToClock(elapsed);
      fsTime2.textContent = msToClock(elapsed);
      raf = requestAnimationFrame(tick);
    }
    // live speed
    if((mode==='chrono_vitesse'||mode==='minuteur_distance'||mode==='demi_cooper'||mode==='cooper')){
      const dist = readTrackDistance();
      const msBase = countdown ? (targetMs - Math.max(0,targetMs - elapsed)) : elapsed;
      const v = kmh(dist, msBase);
      if(v) { speedEl.textContent = v + ' km/h'; fsSpeedVal.textContent = v + ' km/h'; }
    }
  }
  function start(){
    if(running) return;
    running=true; t0=performance.now();
    btnStart.disabled=true; btnStop.disabled=false; btnReset.disabled=false;
    requestFullscreen();
    raf=requestAnimationFrame(tick);
  }
  function stop(){
    if(!running) return;
    running=false; btnStop.disabled=true; btnStart.disabled=false;
    cancelAnimationFrame(raf); raf=0;
    autoQR();
  }
  function reset(){
    running=false; cancelAnimationFrame(raf); raf=0; elapsed=0;
    timeEl.textContent='00:00'; fsTime.textContent='00:00'; fsTime2.textContent='00:00'; cdTime.textContent='00:00';
    if(splitsBody) splitsBody.innerHTML=''; splits=[]; currentCumDist=0;
    updateDistanceUI(0);
    btnStop.disabled=true; btnReset.disabled=true; btnStart.disabled=false;
    if(mode==='minuteur'){ targetMs = computeWheelMs(); timeEl.textContent = msToClock(targetMs); fsTime.textContent=msToClock(targetMs); cdTime.textContent=msToClock(targetMs); drawCountdown(targetMs); }
    if(mode==='demi_cooper'){ targetMs = 6*60*1000; timeEl.textContent = msToClock(targetMs); fsTime.textContent=msToClock(targetMs); cdTime.textContent=msToClock(targetMs); drawCountdown(targetMs); }
    if(mode==='cooper'){ targetMs = 12*60*1000; timeEl.textContent = msToClock(targetMs); fsTime.textContent=msToClock(targetMs); cdTime.textContent=msToClock(targetMs); drawCountdown(targetMs); }
  }

  // ---------- Intermédiaires ----------
  function addLap(){
    if(!running) return;
    if(!goalDist || !stepDist){ // fallback simple: push time only
      pushSplit(null);
      return;
    }
    const next = Math.min(goalDist, currentCumDist + stepDist);
    currentCumDist = next;
    pushSplit(next);
    if(currentCumDist >= goalDist){ stop(); }
  }
  function pushSplit(dist){
    const t = countdown ? (targetMs - Math.max(0, targetMs - elapsed)) : elapsed;
    const hms = msToClock(t);
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${splits.length+1}</td><td>${dist??'—'}</td><td class="split">${hms}</td>`;
    splitsBody.appendChild(tr);
    splits.push({distance: dist, time: hms});
  }

  // ---------- Distance helpers ----------
  function readTrackDistance(){
    if(mode==='demi_cooper' || mode==='cooper' || mode==='minuteur_distance'){
      const L = safeNumber(trackLength?.value)||400;
      const N = Math.max(0, Math.floor(safeNumber(lapsCount?.value)||0));
      const F = safeNumber(lapFraction?.value)||0;
      const total = Math.round(L*(N+F));
      updateDistanceUI(total);
      return total;
    }
    // chrono_vitesse uses direct distance input
    if(mode==='chrono_vitesse'){
      const d = Math.max(0, Math.round(safeNumber(distanceInput?.value)||0));
      updateDistanceUI(d);
      return d;
    }
    return Math.max(0, Math.round(safeNumber(distanceInput?.value)||0))||0;
  }
  function updateDistanceUI(m){ if(distEl) distEl.textContent = m? (m+' m') : '—'; }

  // ---------- Countdown drawing ----------
  let cdCtx=null, cdTotal=0;
  function drawCountdown(remainMs){
    const c = cdCanvas; if(!c) return;
    const dpr = Math.max(1, window.devicePixelRatio||1);
    const W = Math.min(window.innerWidth, window.innerHeight)*0.8;
    c.width = c.height = W*dpr; c.style.width = c.style.height = W+'px';
    if(!cdCtx) cdCtx = c.getContext('2d');
    const ctx = cdCtx; ctx.reset?.();
    const R = (c.width/2) - 20*dpr, cx=c.width/2, cy=c.height/2;
    ctx.clearRect(0,0,c.width,c.height);
    // background ring
    ctx.lineWidth = 20*dpr; ctx.strokeStyle = '#eee'; ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.stroke();
    // progress
    const left = Math.max(0, remainMs); const frac = cdTotal ? (left/cdTotal) : 0;
    ctx.strokeStyle = '#2b50ff'; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(cx,cy,R,-Math.PI/2, -Math.PI/2 + Math.PI*2*frac, false); ctx.stroke();
  }

  // ---------- Fullscreen ----------
  function requestFullscreen(){
    const root = document.documentElement;
    if(root.requestFullscreen) root.requestFullscreen().catch(()=>{});
    // switch overlay depending on mode
    fsChrono.classList.remove('active'); fsCount.classList.remove('active'); fsSpeed.classList.remove('active');
    if(mode==='chrono' || mode==='intermediaire'){ fsChrono.classList.add('active'); }
    if(mode==='minuteur' || mode==='demi_cooper' || mode==='cooper'){ fsCount.classList.add('active'); }
    if(mode==='chrono_vitesse' || mode==='minuteur_distance'){ fsSpeed.classList.add('active'); }
  }
  btnFull?.addEventListener('click', requestFullscreen);

  // ---------- Mode setup ----------
  function setup(){
    if(mode==='chrono'){
      hint.textContent='Chrono plein écran (H:MM:SS)'; rowDistance.style.display='none'; rowTrack.style.display='none'; rowIntervalles.style.display='none'; rowTimer.style.display='none';
    }
    if(mode==='minuteur'){
      hint.textContent='Choisissez H:M:S avec les roues, puis Démarrer (plein écran, compte à rebours circulaire).';
      rowTimer.style.display='flex'; fillWheel(whH,12); fillWheel(whM,59); fillWheel(whS,59);
      countdown=true; targetMs = computeWheelMs(); timeEl.textContent = msToClock(targetMs); fsTime.textContent=msToClock(targetMs); cdTime.textContent=msToClock(targetMs); cdTotal = targetMs; drawCountdown(targetMs);
    }
    if(mode==='chrono_vitesse'){
      hint.textContent='Saisir la distance (m). Affichage vitesse + temps en plein écran.';
      rowDistance.style.display='flex'; speedBox.style.display='block'; distBox.style.display='block';
    }
    if(mode==='minuteur_distance'){
      hint.textContent='Réglez la piste et les tours + fraction après le test pour une distance précise.';
      rowTrack.style.display='flex'; speedBox.style.display='block'; distBox.style.display='block';
      countdown=true; // user will start a countdown via wheels? Here we keep as basic minuteur? use wheels too?
      // offer wheels too for minuteur_distance
      rowTimer.style.display='flex'; fillWheel(whH,12); fillWheel(whM,59); fillWheel(whS,59);
      targetMs = computeWheelMs(); timeEl.textContent = msToClock(targetMs); fsTime.textContent=msToClock(targetMs); cdTime.textContent=msToClock(targetMs); cdTotal = targetMs; drawCountdown(targetMs);
    }
    if(mode==='intermediaire'){
      hint.textContent='Réglez distance totale (ex: 800) et pas (ex: 200). Appuyez sur Intermédiaire à chaque passage: 200, 400, 600, 800… Auto-stop à la fin.';
      rowIntervalles.style.display='flex'; splitsWrap.style.display='block'; btnLap.style.display='inline-flex';
      goalDist = Math.max(0, Math.round(safeNumber(totalDistance.value)||800));
      stepDist = Math.max(1, Math.round(safeNumber(splitStep.value)||200));
    }
    if(mode==='demi_cooper'){
      hint.textContent='Minuteur fixe 6:00. Réglez la piste et, à la fin, saisissez tours + fraction. Vitesse calculée.';
      rowTrack.style.display='flex'; speedBox.style.display='block'; distBox.style.display='block';
      countdown=true; targetMs = 6*60*1000; timeEl.textContent=msToClock(targetMs); fsTime.textContent=msToClock(targetMs); cdTime.textContent=msToClock(targetMs); cdTotal = targetMs; drawCountdown(targetMs);
    }
    if(mode==='cooper'){
      hint.textContent='Minuteur fixe 12:00. Réglez la piste et, à la fin, saisissez tours + fraction. Vitesse calculée.';
      rowTrack.style.display='flex'; speedBox.style.display='block'; distBox.style.display='block';
      countdown=true; targetMs = 12*60*1000; timeEl.textContent=msToClock(targetMs); fsTime.textContent=msToClock(targetMs); cdTime.textContent=msToClock(targetMs); cdTotal = targetMs; drawCountdown(targetMs);
    }
  }

  // ---------- QR payloads ----------
  function payloadIntermediaire(){
    const result = {
      type: "temps_intermediaire",
      total_m: Math.max(0, Math.round(safeNumber(totalDistance.value)||0)),
      pas_m: Math.max(0, Math.round(safeNumber(splitStep.value)||0)),
      splits: splits.map(s=>s.time),
      distances: splits.map(s=>s.distance),
      total_ms: countdown ? (targetMs - Math.max(0, targetMs - elapsed)) : elapsed,
      total_hms: countdown ? msToClock(targetMs - Math.max(0, targetMs - elapsed)) : msToClock(elapsed)
    };
    return basePayload("intermediaire", result);
  }
  function payloadDemiCooper(){
    const dist = readTrackDistance();
    const result = {
      type: "demi_cooper",
      piste_m: Math.max(1, Math.round(safeNumber(trackLength.value)||400)),
      tours: Math.max(0, Math.floor(safeNumber(lapsCount.value)||0)),
      fraction: safeNumber(lapFraction.value)||0,
      distance_m: dist,
      duree_s: 360,
      vitesse_kmh: kmh(dist, 360*1000)
    };
    return basePayload("demi_cooper", result);
  }
  function payloadCooper(){
    const dist = readTrackDistance();
    const result = {
      type: "cooper",
      piste_m: Math.max(1, Math.round(safeNumber(trackLength.value)||400)),
      tours: Math.max(0, Math.floor(safeNumber(lapsCount.value)||0)),
      fraction: safeNumber(lapFraction.value)||0,
      distance_m: dist,
      duree_s: 720,
      vitesse_kmh: kmh(dist, 720*1000)
    };
    return basePayload("cooper", result);
  }
  function payloadMinuteurDistance(){
    const dist = readTrackDistance();
    const ms = computeWheelMs();
    const result = {
      type: "minuteur_distance",
      piste_m: Math.max(1, Math.round(safeNumber(trackLength.value)||400)),
      tours: Math.max(0, Math.floor(safeNumber(lapsCount.value)||0)),
      fraction: safeNumber(lapFraction.value)||0,
      distance_m: dist,
      duree_s: Math.round(ms/1000),
      vitesse_kmh: kmh(dist, ms)
    };
    return basePayload("minuteur_distance", result);
  }
  function payloadChronoVitesse(){
    const dist = Math.max(0, Math.round(safeNumber(distanceInput.value)||0));
    const ms = elapsed;
    const result = {
      type: "chrono_vitesse",
      distance_m: dist,
      duree_s: Math.round(ms/1000),
      vitesse_kmh: kmh(dist, ms)
    };
    return basePayload("chrono_vitesse", result);
  }

  // Auto-QR on stop
  function autoQR(){
    try{
      if(mode==='intermediaire') renderQR(payloadIntermediaire());
      if(mode==='demi_cooper') renderQR(payloadDemiCooper());
      if(mode==='cooper') renderQR(payloadCooper());
      if(mode==='minuteur_distance') renderQR(payloadMinuteurDistance());
      if(mode==='chrono_vitesse') renderQR(payloadChronoVitesse());
    }catch{}
  }

  // ---------- Events ----------
  btnStart?.addEventListener('click', ()=>{ start(); });
  btnStop?.addEventListener('click', ()=>{ stop(); });
  btnReset?.addEventListener('click', ()=>{ reset(); });
  btnLap?.addEventListener('click', ()=>{ addLap(); });
  btnQr?.addEventListener('click', ()=>{
    if(mode==='intermediaire') return renderQR(payloadIntermediaire());
    if(mode==='demi_cooper') return renderQR(payloadDemiCooper());
    if(mode==='cooper') return renderQR(payloadCooper());
    if(mode==='minuteur_distance') return renderQR(payloadMinuteurDistance());
    if(mode==='chrono_vitesse') return renderQR(payloadChronoVitesse());
  });
  totalDistance?.addEventListener('change', ()=>{ goalDist = Math.max(0, Math.round(safeNumber(totalDistance.value)||0)); });
  splitStep?.addEventListener('change', ()=>{ stepDist = Math.max(1, Math.round(safeNumber(splitStep.value)||0)); });
  trackLength?.addEventListener('change', ()=>{ readTrackDistance(); });
  lapsCount?.addEventListener('change', ()=>{ readTrackDistance(); });
  lapFraction?.addEventListener('change', ()=>{ readTrackDistance(); });
  whH?.addEventListener('change', ()=>{ if(mode==='minuteur' || mode==='minuteur_distance'){ targetMs=computeWheelMs(); timeEl.textContent=msToClock(targetMs); fsTime.textContent=msToClock(targetMs); cdTime.textContent=msToClock(targetMs); cdTotal=targetMs; drawCountdown(targetMs);} });
  whM?.addEventListener('change', ()=>{ if(mode==='minuteur' || mode==='minuteur_distance'){ targetMs=computeWheelMs(); timeEl.textContent=msToClock(targetMs); fsTime.textContent=msToClock(targetMs); cdTime.textContent=msToClock(targetMs); cdTotal=targetMs; drawCountdown(targetMs);} });
  whS?.addEventListener('change', ()=>{ if(mode==='minuteur' || mode==='minuteur_distance'){ targetMs=computeWheelMs(); timeEl.textContent=msToClock(targetMs); fsTime.textContent=msToClock(targetMs); cdTime.textContent=msToClock(targetMs); cdTotal=targetMs; drawCountdown(targetMs);} });

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    // Default wheels
    [whH,whM,whS].forEach((sel,i)=>{
      if(!sel) return;
      const max = (sel===whH)?12:59;
      sel.innerHTML='';
      for(let k=0;k<=max;k++){ const o=document.createElement('option'); o.value=k; o.textContent = String(k).padStart(2,'0'); sel.appendChild(o); }
      sel.value= (sel===whH?0:(sel===whM?6:0)); // 00:06:00 par défaut pour minuteurs
    });
    // Show per mode
    if(mode==='chrono'){
      rowDistance.style.display='none'; rowTrack.style.display='none'; rowIntervalles.style.display='none'; rowTimer.style.display='none'; btnLap.style.display='none';
    } else if(mode==='minuteur'){
      rowTimer.style.display='flex'; btnLap.style.display='none';
    } else if(mode==='chrono_vitesse'){
      rowDistance.style.display='flex'; speedBox.style.display='block'; distBox.style.display='block'; btnLap.style.display='none';
    } else if(mode==='minuteur_distance'){
      rowTrack.style.display='flex'; rowTimer.style.display='flex'; speedBox.style.display='block'; distBox.style.display='block'; btnLap.style.display='none';
    } else if(mode==='intermediaire'){
      rowIntervalles.style.display='flex'; splitsWrap.style.display='block'; btnLap.style.display='inline-flex';
    } else if(mode==='demi_cooper' || mode==='cooper'){
      rowTrack.style.display='flex'; speedBox.style.display='block'; distBox.style.display='block'; btnLap.style.display='none';
    }
    setup();
    readTrackDistance();
  });

  // Fallback: auto-load qrcodejs if missing (from unpkg)
  window.addEventListener('load', ()=>{
    if(typeof QRCode === 'undefined'){
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/qrcodejs@1.0.0/qrcode.min.js'; s.defer=true;
      document.head.appendChild(s);
    }
  });
})();