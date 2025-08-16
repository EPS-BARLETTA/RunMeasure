
// app.js — logic with ergonomic UI and QR present everywhere except Chrono and Minuteur
(function(){
  const $ = (s, r=document)=>r.querySelector(s);
  const $all = (s, r=document)=>Array.from(r.querySelectorAll(s));

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
  const qrBox = $('#qr-box'); const qrDiv = $('#qr'); const qrPre = $('#qr-json');

  const btnStart = $('#btn-start'), btnStop = $('#btn-stop'), btnReset = $('#btn-reset'), btnLap = $('#btn-lap'), btnQr = $('#btn-qr');
  const btnFull = $('#btn-full');

  const rowDistance = $('#row-distance'), rowTrack = $('#row-track'), rowTimer = $('#row-timer'), rowIntervalles = $('#row-intervalles');
  const distanceInput = $('#distance-input');
  const trackLength = $('#track-length');
  const whH = $('#wh-h'), whM = $('#wh-m'), whS = $('#wh-s');
  const totalDistance = $('#total-distance'), splitStep = $('#split-step');

  const fsChrono = $('#fs-chrono'), fsTime = $('#fs-time');
  const fsCount = $('#fs-countdown'), cdCanvas = $('#cd-canvas'), cdTime = $('#cd-time');

  // Utils
  const pad = n=>String(n).padStart(2,'0');
  function msToClock(ms){
    const t = Math.max(0, Math.round(ms/1000));
    const h=Math.floor(t/3600), m=Math.floor((t%3600)/60), s=t%60;
    return h>0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }
  function timeToMs(str){
    if(!str) return null;
    const p=str.trim().split(':').map(x=>x.trim());
    if(p.length<2) return null;
    let h=0,m=0,s=0,ms=0;
    if(p.length===2){ m=+p[0]||0; s=+p[1]||0; } else { h=+p[0]||0; m=+p[1]||0; s=+p[2]||0; }
    const last=p[p.length-1];
    if(String(last).includes('.')){ const [ss,mmm]=String(last).split('.'); s=+ss||0; ms=+(String(mmm).padEnd(3,'0').slice(0,3))||0; }
    const tot=((h*3600)+(m*60)+s)*1000+ms;
    return Number.isFinite(tot)?tot:null;
  }
  function kmh(m,ms){ if(!m||!ms) return null; return Math.round((m/(ms/1000))*3.6*100)/100; }
  function safeNumber(n){ const v=Number(String(n||'').replace(',','.')); return Number.isFinite(v)?v:null; }
  function getEleve(){ try{const raw=localStorage.getItem('eleve'); if(raw) return JSON.parse(raw);}catch{} return {nom:'',prenom:'',classe:'',sexe:''}; }

  // Chrono engine
  let running=false, t0=0, raf=0, elapsed=0, countdown=false, targetMs=0;
  let splits=[], currentCumDist=0, goalDist=0, stepDist=0;
  let laps=0, finished=false;

  function tick(){
    if(!running) return;
    const now = performance.now(); const dt = now - t0; t0 = now; elapsed += dt;
    if(countdown){
      const remain = Math.max(0, targetMs - elapsed);
      timeEl.textContent = msToClock(remain);
      cdTime.textContent = msToClock(remain);
      drawCountdown(remain);
      if(remain<=0){ stop(); }
      else { raf = requestAnimationFrame(tick); }
    } else {
      timeEl.textContent = msToClock(elapsed);
      raf = requestAnimationFrame(tick);
    }
    // live speed for some modes
    if((mode==='chrono_vitesse' || mode==='minuteur_distance' || mode==='demi_cooper' || mode==='cooper')){
      const dist = computeDistanceLive();
      const msBase = countdown ? (targetMs - Math.max(0, targetMs - elapsed)) : elapsed;
      const v = kmh(dist, msBase);
      if(v) speedEl.textContent = v + ' km/h';
      distEl.textContent = dist ? (dist+' m') : '—';
    }
  }

  function start(){
    if(running) return;
    running=true; t0=performance.now();
    btnStart.disabled=true; btnStop.disabled=false; btnReset.disabled=false;
    // fullscreen only for chrono & minuteur
    if(mode==='chrono'){ requestFS(fsChrono); fsTime.textContent=timeEl.textContent; }
    if(mode==='minuteur'){ requestFS(fsCount); cdTime.textContent=timeEl.textContent; }
    raf=requestAnimationFrame(tick);
  }
  function stop(){
    if(!running) return;
    running=false; finished=true;
    btnStop.disabled=true; btnStart.disabled=false;
    cancelAnimationFrame(raf); raf=0;
    if(mode==='minuteur_distance' || mode==='demi_cooper' || mode==='cooper'){
      // show fraction prompt after finish
      const f = prompt('Ajouter une fraction de tour ? (0, 0.25, 0.5, 0.75)', '0');
      const frac = Math.max(0, Math.min(0.75, Number(String(f||'0').replace(',','.'))||0));
      window._extraFraction = frac;
      updateDistanceAfterFinish();
      updateSpeedAfterFinish();
    }
    if(needsQR()){ renderQR(buildPayload()); }
  }
  function reset(){
    running=false; cancelAnimationFrame(raf); raf=0; elapsed=0; finished=false;
    timeEl.textContent='00:00'; cdTime.textContent='00:00';
    splits=[]; if(splitsBody) splitsBody.innerHTML='';
    currentCumDist=0; laps=0; distEl.textContent='—'; speedEl.textContent='—';
    btnStop.disabled=true; btnReset.disabled=true; btnStart.disabled=false;
    if(mode==='minuteur'){ targetMs = computeWheelMs(); timeEl.textContent=msToClock(targetMs); cdTime.textContent=msToClock(targetMs); drawCountdown(targetMs); }
  }

  // Intermédiaires
  function addIntermediaire(){
    if(!running) return;
    const next = Math.min(goalDist, currentCumDist + stepDist);
    const msBase = elapsed;
    const hms = msToClock(msBase);
    const dist = next;
    const lastDist = currentCumDist;
    const instDist = (dist - lastDist) || stepDist;
    const instMs = msBase - (splits.length? timeToMs(splits[splits.length-1].time): 0);
    const instSpeed = kmh(instDist, instMs) || null;

    currentCumDist = next;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${splits.length+1}</td><td>${dist}</td><td class="split">${hms}</td><td>${instSpeed? (instSpeed+' km/h'):'—'}</td>`;
    splitsBody.appendChild(tr);
    splits.push({distance: dist, time: hms, speed: instSpeed});

    if(currentCumDist >= goalDist){ stop(); }
  }

  // Laps for Cooper/minuteur_distance
  function addLap(){
    if(!running) return;
    laps += 1;
    distEl.textContent = computeDistanceLive() + ' m';
  }

  // Distance live computations
  function computeDistanceLive(){
    if(mode==='chrono_vitesse'){
      const d = Math.max(0, Math.round(safeNumber(distanceInput?.value)||0));
      return d;
    }
    if(mode==='minuteur_distance' || mode==='demi_cooper' || mode==='cooper'){
      const L = Math.max(1, Math.round(safeNumber(trackLength?.value)||400));
      return Math.round(L * (laps + (finished ? (window._extraFraction||0) : 0)));
    }
    return Math.max(0, Math.round(safeNumber(distanceInput?.value)||0))||0;
  }
  function updateDistanceAfterFinish(){
    if(!(mode==='minuteur_distance' || mode==='demi_cooper' || mode==='cooper')) return;
    const d = computeDistanceLive();
    distEl.textContent = d ? (d+' m') : '—';
  }
  function updateSpeedAfterFinish(){
    const d = computeDistanceLive();
    const ms = countdown ? targetMs : elapsed;
    const v = kmh(d, ms);
    if(v) speedEl.textContent = v + ' km/h';
  }

  // Fullscreen helpers
  function requestFS(el){ if(!el) return; el.classList.add('active'); document.documentElement.requestFullscreen?.(); }
  function exitFS(){ document.exitFullscreen?.(); fsChrono.classList.remove('active'); fsCount.classList.remove('active'); }
  $('#btn-full')?.addEventListener('click', ()=>{
    if(mode==='chrono') requestFS(fsChrono);
    if(mode==='minuteur') requestFS(fsCount);
  });
  document.addEventListener('fullscreenchange', ()=>{
    if(!document.fullscreenElement){ fsChrono.classList.remove('active'); fsCount.classList.remove('active'); }
  });

  // Wheels (small)
  function fillWheel(sel,max){ sel.innerHTML=''; for(let i=0;i<=max;i++){ const o=document.createElement('option'); o.value=i; o.textContent=String(i).padStart(2,'0'); sel.appendChild(o);} }
  function computeWheelMs(){ return ((+whH.value||0)*3600 + (+whM.value||0)*60 + (+whS.value||0))*1000; }

  // Countdown circle
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
    // bg ring
    ctx.lineWidth = 20*dpr; ctx.strokeStyle = '#eee'; ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.stroke();
    // progress
    const left = Math.max(0, remainMs);
    const frac = cdTotal? (left/cdTotal) : 0;
    ctx.strokeStyle = '#2b50ff'; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(cx,cy,R,-Math.PI/2, -Math.PI/2 + Math.PI*2*frac, false); ctx.stroke();
  }

  // Mode setup
  function setup(){
    // hide QR controls for chrono & minuteur
    if(mode==='chrono' || mode==='minuteur'){ btnQr.style.display='none'; qrBox.style.display='none'; }

    if(mode==='chrono'){
      hint.textContent='Chrono plein écran (H:MM:SS).';
    }
    if(mode==='minuteur'){
      hint.textContent='Choisissez H:M:S (petits sélecteurs), minuteur circulaire en plein écran.';
      rowTimer.style.display='flex'; fillWheel(whH,12); fillWheel(whM,59); fillWheel(whS,59);
      countdown=true; targetMs = computeWheelMs(); cdTotal = targetMs; timeEl.textContent=msToClock(targetMs); cdTime.textContent=msToClock(targetMs); drawCountdown(targetMs);
    }
    if(mode==='chrono_vitesse'){
      hint.textContent='Distance à courir (petit champ). Affichage temps/vitesse/distance sans plein écran.';
      rowDistance.style.display='flex'; speedBox.style.display='block'; distBox.style.display='block';
    }
    if(mode==='minuteur_distance'){
      hint.textContent='Longueur de piste + minuteur. Utilisez « Tour ». Fraction demandée à la fin pour ajuster.';
      rowTrack.style.display='flex'; speedBox.style.display='block'; distBox.style.display='block'; btnLap.style.display='inline-flex';
      rowTimer.style.display='flex'; fillWheel(whH,12); fillWheel(whM,59); fillWheel(whS,59);
      countdown=true; targetMs = computeWheelMs(); cdTotal = targetMs; timeEl.textContent=msToClock(targetMs);
    }
    if(mode==='intermediaire'){
      hint.textContent='Distance totale + pas. Bouton Intermédiaire pour 200, 400, … Auto-stop au dernier.';
      rowIntervalles.style.display='flex'; splitsWrap.style.display='block'; btnLap.textContent='🏁 Intermédiaire'; btnLap.style.display='inline-flex';
      goalDist = Math.max(0, Math.round(safeNumber(totalDistance.value)||800));
      stepDist = Math.max(1, Math.round(safeNumber(splitStep.value)||200));
    }
    if(mode==='demi_cooper'){
      hint.textContent='Longueur de piste uniquement. Utilisez « Tour ». Fraction demandée à la fin pour ajuster. Durée fixe 6:00.';
      rowTrack.style.display='flex'; speedBox.style.display='block'; distBox.style.display='block'; btnLap.style.display='inline-flex';
      countdown=true; targetMs = 6*60*1000; cdTotal = targetMs; timeEl.textContent=msToClock(targetMs);
    }
    if(mode==='cooper'){
      hint.textContent='Longueur de piste uniquement. Utilisez « Tour ». Fraction demandée à la fin pour ajuster. Durée fixe 12:00.';
      rowTrack.style.display='flex'; speedBox.style.display='block'; distBox.style.display='block'; btnLap.style.display='inline-flex';
      countdown=true; targetMs = 12*60*1000; cdTotal = targetMs; timeEl.textContent=msToClock(targetMs);
    }
  }

  // Build QR payload (only for modes != chrono/minuteur)
  function needsQR(){ return !(mode==='chrono' || mode==='minuteur'); }
  function basePayload(mode,result){
    const e = getEleve();
    result.lines = result.lines || [];
    return { app:"RunMeasure", mode, nom:e.nom||"", prenom:e.prenom||"", classe:e.classe||"", sexe:e.sexe||"", result };
  }
  function buildPayload(){
    if(mode==='intermediaire'){
      const totalMs = elapsed;
      const lines = [`Distance totale: ${goalDist} m`,`Pas: ${stepDist} m`,`Temps total: ${msToClock(totalMs)}`];
      splits.forEach((s)=>{ lines.push(`${s.distance} m: ${s.time} — v instant: ${s.speed? s.speed+' km/h':'—'}`); });
      return basePayload('intermediaire', { total_m:goalDist, pas_m:stepDist, total_ms: totalMs, splits, lines });
    }
    if(mode==='chrono_vitesse'){
      const d = Math.max(0, Math.round(safeNumber(distanceInput?.value)||0));
      const v = kmh(d, elapsed);
      const lines = [`Distance: ${d} m`, `Durée: ${msToClock(elapsed)}`, `Vitesse: ${v? v+' km/h':'—'}`];
      return basePayload('chrono_vitesse', { distance_m:d, duree_ms: elapsed, vitesse_kmh:v, lines });
    }
    if(mode==='minuteur_distance'){
      const L = Math.max(1, Math.round(safeNumber(trackLength?.value)||400));
      const frac = window._extraFraction||0;
      const dist = Math.round(L * (laps + frac));
      const v = kmh(dist, targetMs);
      const lines = [`Piste: ${L} m`,`Tours: ${laps}`,`Fraction: ${frac}`,`Distance: ${dist} m`,`Durée: ${msToClock(targetMs)}`,`Vitesse: ${v? v+' km/h':'—'}`];
      return basePayload('minuteur_distance', { piste_m:L, tours:laps, fraction:frac, distance_m:dist, duree_ms: targetMs, vitesse_kmh:v, lines });
    }
    if(mode==='demi_cooper' || mode==='cooper'){
      const L = Math.max(1, Math.round(safeNumber(trackLength?.value)||400));
      const frac = window._extraFraction||0;
      const dist = Math.round(L * (laps + frac));
      const dur = (mode==='demi_cooper')? 6*60*1000 : 12*60*1000;
      const v = kmh(dist, dur);
      const vma = v;
      const lines = [`Piste: ${L} m`,`Tours: ${laps}`,`Fraction: ${frac}`,`Distance: ${dist} m`,`Durée: ${msToClock(dur)}`,`Vitesse: ${v? v+' km/h':'—'}`,`VMA: ${vma? vma+' km/h':'—'}`];
      return basePayload(mode, { piste_m:L, tours:laps, fraction:frac, distance_m:dist, duree_ms: dur, vitesse_kmh:v, vma_kmh:vma, lines });
    }
    return basePayload(mode, { note: "QR non utilisé pour ce mode" });
  }

  // QR rendering
  function renderQR(payload){
    if(!needsQR()) return;
    qrBox.style.display = 'block';
    qrPre.textContent = JSON.stringify(payload);
    if(typeof QRCode !== 'undefined' && qrDiv){
      qrDiv.innerHTML='';
      new QRCode(qrDiv,{ text: JSON.stringify(payload), width:220, height:220, correctLevel: QRCode.CorrectLevel.M });
    } else {
      qrDiv.innerHTML = '<div style="color:#a00;font-size:12px">QR hors-ligne indisponible : la librairie n\\'est pas chargée.</div>';
    }
  }

  // Events
  btnStart?.addEventListener('click', ()=>{ start(); });
  btnStop?.addEventListener('click', ()=>{ stop(); });
  btnReset?.addEventListener('click', ()=>{ reset(); });
  btnLap?.addEventListener('click', ()=>{
    if(mode==='intermediaire') addIntermediaire();
    else addLap();
  });
  btnQr?.addEventListener('click', ()=>{ if(needsQR()) renderQR(buildPayload()); });

  // Inputs
  totalDistance?.addEventListener('change', ()=>{ goalDist = Math.max(0, Math.round(safeNumber(totalDistance.value)||0)); });
  splitStep?.addEventListener('change', ()=>{ stepDist = Math.max(1, Math.round(safeNumber(splitStep.value)||0)); });
  [whH,whM,whS].forEach(sel=> sel?.addEventListener('change', ()=>{ if(mode==='minuteur' || mode==='minuteur_distance'){ targetMs=computeWheelMs(); cdTotal=targetMs; timeEl.textContent=msToClock(targetMs); cdTime.textContent=msToClock(targetMs); drawCountdown(targetMs);} }));

  // Init
  document.addEventListener('DOMContentLoaded', ()=>{
    // wheel options
    [whH,whM,whS].forEach((sel,i)=>{
      if(!sel) return;
      const max = (sel===whH)?12:59; sel.innerHTML='';
      for(let k=0;k<=max;k++){ const o=document.createElement('option'); o.value=k; o.textContent=String(k).padStart(2,'0'); sel.appendChild(o); }
      sel.value = (sel===whH?0:(sel===whM?6:0)); // default 06:00 for minuteur* modes
    });

    // show per-mode
    if(mode==='chrono'){
      // QR hidden by setup()
    } else if(mode==='minuteur'){
      rowTimer.style.display='flex';
    } else if(mode==='chrono_vitesse'){
      rowDistance.style.display='flex'; speedBox.style.display='block'; distBox.style.display='block';
    } else if(mode==='minuteur_distance'){
      rowTrack.style.display='flex'; rowTimer.style.display='flex'; speedBox.style.display='block'; distBox.style.display='block';
      btnLap.style.display='inline-flex';
    } else if(mode==='intermediaire'){
      rowIntervalles.style.display='flex'; splitsWrap.style.display='block'; btnLap.style.display='inline-flex';
    } else if(mode==='demi_cooper' || mode==='cooper'){
      rowTrack.style.display='flex'; speedBox.style.display='block'; distBox.style.display='block'; btnLap.style.display='inline-flex';
    }
    setup();
  });

})();