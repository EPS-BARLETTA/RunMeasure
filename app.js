// app.js — compat large (sans optional chaining)
(function(){
  function $(s, r){ return (r||document).querySelector(s); }
  function $all(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }

  var qs = new URLSearchParams(location.search);
  var mode = (qs.get('mode')||'').toLowerCase();
  var alias = {'intervalles':'intermediaire','demi-cooper':'demi_cooper'};
  mode = alias[mode] || mode;

  // Elements
  var hint = $('#hint');
  var timeEl = $('#time');
  var speedBox = $('#box-speed'), speedEl = $('#speed');
  var distBox = $('#box-distance'), distEl = $('#distance');
  var splitsWrap = $('#splits-wrap'), splitsBody = $('#splits-table tbody');
  var qrBox = $('#qr-box'), qrDiv = $('#qr'), qrPre = $('#qr-json');

  var btnStart = $('#btn-start'), btnStop = $('#btn-stop'), btnReset = $('#btn-reset'), btnLap = $('#btn-lap'), btnQr = $('#btn-qr');
  var btnFull = $('#btn-full');

  var rowDistance = $('#row-distance'), rowTrack = $('#row-track'), rowTimer = $('#row-timer'), rowIntervalles = $('#row-intervalles');
  var distanceInput = $('#distance-input');
  var trackLength = $('#track-length');
  var whH = $('#wh-h'), whM = $('#wh-m'), whS = $('#wh-s');
  var totalDistance = $('#total-distance'), splitStep = $('#split-step');

  var fsChrono = $('#fs-chrono'), fsTime = $('#fs-time');
  var fsCount = $('#fs-countdown'), cdCanvas = $('#cd-canvas'), cdTime = $('#cd-time');

  // Utils
  function pad(n){ n = String(n); return n.length<2 ? ('0'+n) : n; }
  function msToClock(ms){
    var t = Math.max(0, Math.round(ms/1000));
    var h = Math.floor(t/3600), m = Math.floor((t%3600)/60), s = t%60;
    return h>0 ? (h+':'+pad(m)+':'+pad(s)) : (m+':'+pad(s));
  }
  function timeToMs(str){
    if(!str) return null;
    var p = str.trim().split(':');
    if(p.length<2) return null;
    var h=0,m=0,s=0,ms=0;
    if(p.length===2){ m=+p[0]||0; s=+p[1]||0; }
    else { h=+p[0]||0; m=+p[1]||0; s=+p[2]||0; }
    var last = p[p.length-1];
    if(String(last).indexOf('.')>-1){
      var sp = String(last).split('.');
      s = +sp[0]||0;
      ms = +( (sp[1]||'').slice(0,3) );
    }
    var tot = ((h*3600)+(m*60)+s)*1000+ms;
    return isFinite(tot)?tot:null;
  }
  function kmh(m,ms){ if(!m||!ms) return null; return Math.round((m/(ms/1000))*3.6*100)/100; }
  function safeNumber(n){ var v=Number(String(n||'').replace(',','.')); return isFinite(v)?v:null; }
  function getEleve(){ try{var raw=localStorage.getItem('eleve'); if(raw) return JSON.parse(raw);}catch(e){} return {nom:'',prenom:'',classe:'',sexe:''}; }

  // Chrono engine
  var running=false, t0=0, raf=0, elapsed=0, countdown=false, targetMs=0;
  var splits=[], currentCumDist=0, goalDist=0, stepDist=0;
  var laps=0, finished=false;
  var cdCtx=null, cdTotal=0;

  function tick(){
    if(!running) return;
    var now = performance.now(); var dt = now - t0; t0 = now; elapsed += dt;
    if(countdown){
      var remain = Math.max(0, targetMs - elapsed);
      if(timeEl) timeEl.textContent = msToClock(remain);
      if(cdTime) cdTime.textContent = msToClock(remain);
      drawCountdown(remain);
      if(remain<=0){ stop(); }
      else { raf = requestAnimationFrame(tick); }
    } else {
      if(timeEl) timeEl.textContent = msToClock(elapsed);
      raf = requestAnimationFrame(tick);
    }
    // live speed for some modes
    if(mode==='chrono_vitesse' || mode==='minuteur_distance' || mode==='demi_cooper' || mode==='cooper'){
      var dist = computeDistanceLive();
      var msBase = countdown ? (targetMs - Math.max(0, targetMs - elapsed)) : elapsed;
      var v = kmh(dist, msBase);
      if(v && speedEl) speedEl.textContent = (v + ' km/h');
      if(distEl) distEl.textContent = dist ? (dist+' m') : '—';
    }
  }

  function start(){
    if(running) return;
    running=true; t0=performance.now();
    if(btnStart) btnStart.disabled=true;
    if(btnStop) btnStop.disabled=false;
    if(btnReset) btnReset.disabled=false;
    // fullscreen only for chrono & minuteur
    if(mode==='chrono'){ requestFS(fsChrono); if(fsTime && timeEl) fsTime.textContent=timeEl.textContent; }
    if(mode==='minuteur'){ requestFS(fsCount); if(cdTime && timeEl) cdTime.textContent=timeEl.textContent; }
    raf=requestAnimationFrame(tick);
  }
  function stop(){
    if(!running) return;
    running=false; finished=true;
    if(btnStop) btnStop.disabled=true;
    if(btnStart) btnStart.disabled=false;
    cancelAnimationFrame(raf); raf=0;
    if(mode==='minuteur_distance' || mode==='demi_cooper' || mode==='cooper'){
      var f = prompt('Ajouter une fraction de tour ? (0, 0.25, 0.5, 0.75)', '0');
      var frac = Math.max(0, Math.min(0.75, Number(String(f||'0').replace(',','.'))||0));
      window._extraFraction = frac;
      updateDistanceAfterFinish();
      updateSpeedAfterFinish();
    }
    if(needsQR()){ renderQR(buildPayload()); }
  }
  function reset(){
    running=false; cancelAnimationFrame(raf); raf=0; elapsed=0; finished=false;
    if(timeEl) timeEl.textContent='00:00';
    if(cdTime) cdTime.textContent='00:00';
    splits=[]; if(splitsBody) splitsBody.innerHTML='';
    currentCumDist=0; laps=0; if(distEl) distEl.textContent='—'; if(speedEl) speedEl.textContent='—';
    if(btnStop) btnStop.disabled=true; if(btnReset) btnReset.disabled=true; if(btnStart) btnStart.disabled=false;
    if(mode==='minuteur'){ targetMs = computeWheelMs(); if(timeEl) timeEl.textContent=msToClock(targetMs); if(cdTime) cdTime.textContent=msToClock(targetMs); drawCountdown(targetMs); }
  }

  // Intermédiaires
  function addIntermediaire(){
    if(!running) return;
    var next = Math.min(goalDist, currentCumDist + stepDist);
    var msBase = elapsed;
    var hms = msToClock(msBase);
    var dist = next;
    var lastDist = currentCumDist;
    var instDist = (dist - lastDist) || stepDist;
    var prevMs = (splits.length ? timeToMs(splits[splits.length-1].time) : 0);
    var instMs = msBase - prevMs;
    var instSpeed = kmh(instDist, instMs) || null;

    currentCumDist = next;
    var tr = document.createElement('tr');
    tr.innerHTML = '<td>'+(splits.length+1)+'</td><td>'+dist+'</td><td class="split">'+hms+'</td><td>'+(instSpeed? (instSpeed+' km/h'):'—')+'</td>';
    if(splitsBody) splitsBody.appendChild(tr);
    splits.push({distance: dist, time: hms, speed: instSpeed});

    if(currentCumDist >= goalDist){ stop(); }
  }

  // Laps for Cooper/minuteur_distance
  function addLap(){
    if(!running) return;
    laps += 1;
    if(distEl) distEl.textContent = computeDistanceLive() + ' m';
  }

  // Distance live computations
  function computeDistanceLive(){
    if(mode==='chrono_vitesse'){
      var d = Math.max(0, Math.round(safeNumber(distanceInput && distanceInput.value)||0));
      return d;
    }
    if(mode==='minuteur_distance' || mode==='demi_cooper' || mode==='cooper'){
      var L = Math.max(1, Math.round(safeNumber(trackLength && trackLength.value)||400));
      return Math.round(L * (laps + (finished ? (window._extraFraction||0) : 0)));
    }
    return Math.max(0, Math.round(safeNumber(distanceInput && distanceInput.value)||0))||0;
  }
  function updateDistanceAfterFinish(){
    if(!(mode==='minuteur_distance' || mode==='demi_cooper' || mode==='cooper')) return;
    var d = computeDistanceLive();
    if(distEl) distEl.textContent = d ? (d+' m') : '—';
  }
  function updateSpeedAfterFinish(){
    var d = computeDistanceLive();
    var ms = countdown ? targetMs : elapsed;
    var v = kmh(d, ms);
    if(v && speedEl) speedEl.textContent = v + ' km/h';
  }

  // Fullscreen helpers
  function requestFS(el){
    if(!el) return;
    el.classList.add('active');
    if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  }
  function exitFS(){
    if(document.exitFullscreen) document.exitFullscreen();
    if(fsChrono) fsChrono.classList.remove('active');
    if(fsCount) fsCount.classList.remove('active');
  }
  if(btnFull){
    btnFull.addEventListener('click', function(){
      if(mode==='chrono') requestFS(fsChrono);
      if(mode==='minuteur') requestFS(fsCount);
    });
  }
  document.addEventListener('fullscreenchange', function(){
    if(!document.fullscreenElement){
      if(fsChrono) fsChrono.classList.remove('active');
      if(fsCount) fsCount.classList.remove('active');
    }
  });

  // Wheels (small)
  function fillWheel(sel,max){
    if(!sel) return;
    sel.innerHTML='';
    for(var i=0;i<=max;i++){
      var o=document.createElement('option'); o.value=i; o.textContent=String(i<10?'0'+i:i); sel.appendChild(o);
    }
  }
  function computeWheelMs(){ return ((+(whH&&whH.value)||0)*3600 + (+(whM&&whM.value)||0)*60 + (+(whS&&whS.value)||0))*1000; }

  // Countdown circle
  function drawCountdown(remainMs){
    var c = cdCanvas; if(!c) return;
    var dpr = Math.max(1, window.devicePixelRatio||1);
    var W = Math.min(window.innerWidth, window.innerHeight)*0.8;
    c.width = c.height = W*dpr; c.style.width = c.style.height = W+'px';
    if(!cdCtx) cdCtx = c.getContext('2d');
    var ctx = cdCtx; if(ctx.reset) ctx.reset();
    var R = (c.width/2) - 20*dpr, cx=c.width/2, cy=c.height/2;
    ctx.clearRect(0,0,c.width,c.height);
    ctx.lineWidth = 20*dpr; ctx.strokeStyle = '#eee'; ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.stroke();
    var left = Math.max(0, remainMs);
    var frac = cdTotal? (left/cdTotal) : 0;
    ctx.strokeStyle = '#2b50ff'; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(cx,cy,R,-Math.PI/2, -Math.PI/2 + Math.PI*2*frac, false); ctx.stroke();
  }

  // Mode setup
  function setup(){
    // hide QR controls for chrono & minuteur
    if(mode==='chrono' || mode==='minuteur'){
      if(btnQr) btnQr.style.display='none';
      if(qrBox) qrBox.style.display='none';
    }

    if(mode==='chrono'){
      if(hint) hint.textContent='Chrono plein écran (H:MM:SS).';
    }
    if(mode==='minuteur'){
      if(hint) hint.textContent='Choisissez H:M:S (petits sélecteurs), minuteur circulaire en plein écran.';
      if(rowTimer) rowTimer.style.display='flex';
      fillWheel(whH,12); fillWheel(whM,59); fillWheel(whS,59);
      countdown=true; targetMs = computeWheelMs(); cdTotal = targetMs;
      if(timeEl) timeEl.textContent=msToClock(targetMs);
      if(cdTime) cdTime.textContent=msToClock(targetMs);
      drawCountdown(targetMs);
    }
    if(mode==='chrono_vitesse'){
      if(hint) hint.textContent='Distance à courir (petit champ). Affichage temps/vitesse/distance sans plein écran.';
      if(rowDistance) rowDistance.style.display='flex';
      if(speedBox) speedBox.style.display='block';
      if(distBox) distBox.style.display='block';
    }
    if(mode==='minuteur_distance'){
      if(hint) hint.textContent='Longueur de piste + minuteur. Utilisez « Tour ». Fraction demandée à la fin pour ajuster.';
      if(rowTrack) rowTrack.style.display='flex';
      if(speedBox) speedBox.style.display='block';
      if(distBox) distBox.style.display='block';
      if(btnLap) btnLap.style.display='inline-flex';
      if(rowTimer) rowTimer.style.display='flex';
      fillWheel(whH,12); fillWheel(whM,59); fillWheel(whS,59);
      countdown=true; targetMs = computeWheelMs(); cdTotal = targetMs;
      if(timeEl) timeEl.textContent=msToClock(targetMs);
    }
    if(mode==='intermediaire'){
      if(hint) hint.textContent='Distance totale + pas. Bouton Intermédiaire pour 200, 400, … Auto-stop au dernier.';
      if(rowIntervalles) rowIntervalles.style.display='flex';
      if(splitsWrap) splitsWrap.style.display='block';
      if(btnLap){ btnLap.textContent='🏁 Intermédiaire'; btnLap.style.display='inline-flex'; }
      goalDist = Math.max(0, Math.round(safeNumber(totalDistance && totalDistance.value)||800));
      stepDist = Math.max(1, Math.round(safeNumber(splitStep && splitStep.value)||200));
    }
    if(mode==='demi_cooper'){
      if(hint) hint.textContent='Longueur de piste uniquement. Utilisez « Tour ». Fraction demandée à la fin pour ajuster. Durée fixe 6:00.';
      if(rowTrack) rowTrack.style.display='flex';
      if(speedBox) speedBox.style.display='block';
      if(distBox) distBox.style.display='block';
      if(btnLap) btnLap.style.display='inline-flex';
      countdown=true; targetMs = 6*60*1000; cdTotal = targetMs; if(timeEl) timeEl.textContent=msToClock(targetMs);
    }
    if(mode==='cooper'){
      if(hint) hint.textContent='Longueur de piste uniquement. Utilisez « Tour ». Fraction demandée à la fin pour ajuster. Durée fixe 12:00.';
      if(rowTrack) rowTrack.style.display='flex';
      if(speedBox) speedBox.style.display='block';
      if(distBox) distBox.style.display='block';
      if(btnLap) btnLap.style.display='inline-flex';
      countdown=true; targetMs = 12*60*1000; cdTotal = targetMs; if(timeEl) timeEl.textContent=msToClock(targetMs);
    }
  }

  // QR helpers
  function needsQR(){ return !(mode==='chrono' || mode==='minuteur'); }
  function basePayload(modeName,result){
    var e = getEleve(); result = result||{}; if(!result.lines) result.lines=[];
    return { app:"RunMeasure", mode:modeName, nom:e.nom||"", prenom:e.prenom||"", classe:e.classe||"", sexe:e.sexe||"", result: result };
  }
  function buildPayload(){
    if(mode==='intermediaire'){
      var totalMs = elapsed;
      var lines = ['Distance totale: '+goalDist+' m','Pas: '+stepDist+' m','Temps total: '+msToClock(totalMs)];
      splits.forEach(function(s){ lines.push(s.distance+' m: '+s.time+' — v instant: '+(s.speed? s.speed+' km/h':'—')); });
      return basePayload('intermediaire', { total_m:goalDist, pas_m:stepDist, total_ms: totalMs, splits:splits, lines:lines });
    }
    if(mode==='chrono_vitesse'){
      var d = Math.max(0, Math.round(safeNumber(distanceInput && distanceInput.value)||0));
      var v = kmh(d, elapsed);
      var lines2 = ['Distance: '+d+' m','Durée: '+msToClock(elapsed),'Vitesse: '+(v? v+' km/h':'—')];
      return basePayload('chrono_vitesse', { distance_m:d, duree_ms: elapsed, vitesse_kmh:v, lines:lines2 });
    }
    if(mode==='minuteur_distance'){
      var L = Math.max(1, Math.round(safeNumber(trackLength && trackLength.value)||400));
      var frac = window._extraFraction||0;
      var dist = Math.round(L * (laps + frac));
      var v2 = kmh(dist, targetMs);
      var lines3 = ['Piste: '+L+' m','Tours: '+laps,'Fraction: '+frac,'Distance: '+dist+' m','Durée: '+msToClock(targetMs),'Vitesse: '+(v2? v2+' km/h':'—')];
      return basePayload('minuteur_distance', { piste_m:L, tours:laps, fraction:frac, distance_m:dist, duree_ms: targetMs, vitesse_kmh:v2, lines:lines3 });
    }
    if(mode==='demi_cooper' || mode==='cooper'){
      var L2 = Math.max(1, Math.round(safeNumber(trackLength && trackLength.value)||400));
      var frac2 = window._extraFraction||0;
      var dist2 = Math.round(L2 * (laps + frac2));
      var dur = (mode==='demi_cooper')? 6*60*1000 : 12*60*1000;
      var v3 = kmh(dist2, dur);
      var lines4 = ['Piste: '+L2+' m','Tours: '+laps,'Fraction: '+frac2,'Distance: '+dist2+' m','Durée: '+msToClock(dur),'Vitesse: '+(v3? v3+' km/h':'—'),'VMA: '+(v3? v3+' km/h':'—')];
      return basePayload(mode, { piste_m:L2, tours:laps, fraction:frac2, distance_m:dist2, duree_ms: dur, vitesse_kmh:v3, vma_kmh:v3, lines:lines4 });
    }
    return basePayload(mode, { note: "QR non utilisé pour ce mode" });
  }

  function renderQR(payload){
    if(!needsQR()) return;
    if(qrBox) qrBox.style.display = 'block';
    if(qrPre) qrPre.textContent = JSON.stringify(payload);
    if(typeof QRCode !== 'undefined' && qrDiv){
      qrDiv.innerHTML='';
      new QRCode(qrDiv,{ text: JSON.stringify(payload), width:220, height:220, correctLevel: (window.QRCode && window.QRCode.CorrectLevel? window.QRCode.CorrectLevel.M : 1) });
    } else if(qrDiv){
      qrDiv.innerHTML = '<div style="color:#a00;font-size:12px">QR hors-ligne indisponible : librairie non chargée.</div>';
    }
  }

  // Events
  if(btnStart) btnStart.addEventListener('click', start);
  if(btnStop) btnStop.addEventListener('click', stop);
  if(btnReset) btnReset.addEventListener('click', reset);
  if(btnLap) btnLap.addEventListener('click', function(){ if(mode==='intermediaire') addIntermediaire(); else addLap(); });
  if(btnQr) btnQr.addEventListener('click', function(){ if(needsQR()) renderQR(buildPayload()); });

  if(totalDistance) totalDistance.addEventListener('change', function(){ goalDist = Math.max(0, Math.round(safeNumber(totalDistance.value)||0)); });
  if(splitStep) splitStep.addEventListener('change', function(){ stepDist = Math.max(1, Math.round(safeNumber(splitStep.value)||0)); });
  [whH,whM,whS].forEach(function(sel){
    if(!sel) return;
    sel.addEventListener('change', function(){
      if(mode==='minuteur' || mode==='minuteur_distance'){
        targetMs=computeWheelMs(); cdTotal=targetMs;
        if(timeEl) timeEl.textContent=msToClock(targetMs);
        if(cdTime) cdTime.textContent=msToClock(targetMs);
        drawCountdown(targetMs);
      }
    });
  });

  document.addEventListener('DOMContentLoaded', function(){
    // wheel defaults
    [whH,whM,whS].forEach(function(sel,idx){
      if(!sel) return;
      var max = (sel===whH)?12:59; sel.innerHTML='';
      for(var k=0;k<=max;k++){ var o=document.createElement('option'); o.value=k; o.textContent=String(k<10?'0'+k:k); sel.appendChild(o); }
      sel.value = (sel===whH?0:(sel===whM?6:0)); // 06:00 par défaut pour minuteur*
    });

    // show per-mode
    if(mode==='minuteur'){
      if(rowTimer) rowTimer.style.display='flex';
    } else if(mode==='chrono_vitesse'){
      if(rowDistance) rowDistance.style.display='flex'; if(speedBox) speedBox.style.display='block'; if(distBox) distBox.style.display='block';
    } else if(mode==='minuteur_distance'){
      if(rowTrack) rowTrack.style.display='flex'; if(rowTimer) rowTimer.style.display='flex';
      if(speedBox) speedBox.style.display='block'; if(distBox) distBox.style.display='block';
      if(btnLap) btnLap.style.display='inline-flex';
    } else if(mode==='intermediaire'){
      if(rowIntervalles) rowIntervalles.style.display='flex'; if(splitsWrap) splitsWrap.style.display='block';
      if(btnLap) btnLap.style.display='inline-flex';
    } else if(mode==='demi_cooper' || mode==='cooper'){
      if(rowTrack) rowTrack.style.display='flex'; if(speedBox) speedBox.style.display='block'; if(distBox) distBox.style.display='block';
      if(btnLap) btnLap.style.display='inline-flex';
    }
    setup();
  });

})();
