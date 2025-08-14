// RunMeasure V8 — auto-enriched QR for all modes
(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const fmt = (ms) => {
    const totalTenths = Math.round(ms/100);
    const minutes = Math.floor(totalTenths/600);
    const seconds = Math.floor((totalTenths%600)/10);
    const tenths  = totalTenths%10;
    return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${tenths}`;
  };
  const fmtMMSS = (ms) => {
    const tot = Math.max(0, Math.round(ms/1000));
    const m = Math.floor(tot/60);
    const s = tot%60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };
  const kmh = (meters, ms) => (ms>0 ? +((meters/(ms/1000))*3.6).toFixed(2) : 0);
  const getMode = () => new URLSearchParams(location.search).get('mode') || 'intervalles';
  const student = () => { try { return JSON.parse(localStorage.getItem('rm_student')||'{}'); } catch(e){ return {}; } };

  const state = {
    mode: getMode(),
    running: false,
    startTime: 0,
    elapsed: 0,
    lastLapAt: 0,
    laps: [],
    cumDist: 0,
    targetDist: 0,
    splitDist: 0,
    lapDist: 0,
    countdownMs: 0,
    fixedDuration: 0,
    ringTotal: 0,
    fractionAdded: 0 // meters added by fraction
  };

  const modeName = $('#mode-name');
  const params = $('#params');
  const display = $('#display');
  const btnStart = $('#btn-start');
  const btnLap = $('#btn-lap');
  const btnStop = $('#btn-stop');
  const btnReset = $('#btn-reset');
  const tableWrap = $('#table-wrap');
  const tbody = $('#laps-table tbody');
  const results = $('#results');
  const qrcodeBox = $('#qrcode');
  const totalTime = $('#total-time');
  const totalSpeed = $('#total-speed');
  const totalDistanceCell = $('#total-distance');
  const rowTotal = $('#row-total');
  const ivlExportBox = $('#intervalles-export');
  const btnGenQR = $('#btn-gen-qr');
  const circleWrap = $('#circle-wrap');
  const liveDistance = $('#live-distance');
  const liveDistVal = $('#live-dist-val');
  const fractionTools = $('#fraction-tools');
  const recap = $('#recap');
  const recapBody = $('#recap-body');

  async function tryFullscreen(){
    const el = document.documentElement;
    try{ if(!document.fullscreenElement && el.requestFullscreen){ await el.requestFullscreen(); } }catch(e){}
  }

  function renderParams(){
    params.innerHTML = '';
    circleWrap.classList.add('hidden');
    display.classList.remove('hidden');
    liveDistance.classList.add('hidden');
    fractionTools.classList.add('hidden');
    state.fractionAdded = 0;

    // defaults
    btnLap.classList.remove('hidden');
    btnStop.classList.add('hidden');
    tableWrap.classList.remove('hidden');

    switch(state.mode){
      case 'intervalles':
        modeName.textContent = 'Temps intermédiaire';
        params.innerHTML = `
          <label>Distance cible (m)
            <input type="number" id="p-target" min="100" step="50" value="800"/>
          </label>
          <label>Intervalle (m)
            <input type="number" id="p-step" min="25" step="25" value="200"/>
          </label>
          <div class="info">Appuie sur « Tour » à chaque passage.</div>
        `;
        state.targetDist = 800;
        state.splitDist = 200;
        break;

      case 'simple':
        modeName.textContent = 'Chrono';
        params.innerHTML = `<div class="info">Chronométrage simple. Pas de tours. Pas de QR.</div>`;
        btnLap.classList.add('hidden');
        btnStop.classList.remove('hidden');
        tableWrap.classList.add('hidden');
        break;

      case 'simpleDistance':
        modeName.textContent = 'Chrono avec calcul de vitesse';
        params.innerHTML = `
          <label>Distance (m)
            <input type="number" id="p-target" min="25" step="25" value="100"/>
          </label>
          <div class="info">Lance puis « Stop » à l'arrivée. La vitesse moyenne est calculée.</div>
        `;
        state.targetDist = 100;
        btnLap.classList.add('hidden');
        btnStop.classList.remove('hidden');
        tableWrap.classList.add('hidden');
        break;

      case 'tours':
        modeName.textContent = 'Minuteur avec distance';
        params.innerHTML = `
          <label>Durée (mm:ss)
            <input type="text" id="p-countdown" value="05:00"/>
          </label>
          <label>Distance par tour (m)
            <input type="number" id="p-lapdist" min="25" step="25" value="100"/>
          </label>
          <div class="info">Décompte + « Tour » pour ajouter la distance. Le tableau affiche la distance du tour et la cumulée.</div>
        `;
        state.countdownMs = mmssToMs('05:00'); state.ringTotal = state.countdownMs;
        state.lapDist = 100;
        circleWrap.classList.remove('hidden');
        display.classList.add('hidden');
        liveDistance.classList.remove('hidden');
        updateRing(state.countdownMs, state.ringTotal);
        break;

      case 'demiCooper':
        modeName.textContent = 'Demi-Cooper (6′)';
        params.innerHTML = `
          <label>Distance par tour (m)
            <input type="number" id="p-lapdist" min="25" step="25" value="100"/>
          </label>
          <div class="info">Durée fixe 6:00. « Tour » à chaque passage. Le tableau affiche distance du tour et cumulée.</div>
        `;
        state.fixedDuration = 6*60*1000; state.ringTotal = state.fixedDuration;
        state.lapDist = 100;
        circleWrap.classList.remove('hidden');
        display.classList.add('hidden');
        liveDistance.classList.remove('hidden');
        updateRing(state.fixedDuration, state.ringTotal);
        break;

      case 'cooper':
        modeName.textContent = 'Cooper (12′)';
        params.innerHTML = `
          <label>Distance par tour (m)
            <input type="number" id="p-lapdist" min="25" step="25" value="100"/>
          </label>
          <div class="info">Durée fixe 12:00. « Tour » à chaque passage. Le tableau affiche distance du tour et cumulée.</div>
        `;
        state.fixedDuration = 12*60*1000; state.ringTotal = state.fixedDuration;
        state.lapDist = 100;
        circleWrap.classList.remove('hidden');
        display.classList.add('hidden');
        liveDistance.classList.remove('hidden');
        updateRing(state.fixedDuration, state.ringTotal);
        break;

      case 'minuteurSimple':
        modeName.textContent = 'Minuteur';
        params.innerHTML = `
          <label>Durée (mm:ss)
            <input type="text" id="p-countdown" value="05:00"/>
          </label>
          <div class="info">Compte à rebours simple. Pas de tours.</div>
        `;
        state.countdownMs = mmssToMs('05:00'); state.ringTotal = state.countdownMs;
        circleWrap.classList.remove('hidden');
        display.classList.add('hidden');
        btnLap.classList.add('hidden');
        btnStop.classList.remove('hidden');
        tableWrap.classList.add('hidden');
        updateRing(state.countdownMs, state.ringTotal);
        break;
    }

    const target = $('#p-target'); if(target) target.addEventListener('change', ()=> state.targetDist = parseFloat(target.value)||0);
    const step   = $('#p-step');   if(step)   addEventListener('change', ()=> state.splitDist = parseFloat(step.value)||0);
    const lapd   = $('#p-lapdist');if(lapd)   lapd.addEventListener('change', ()=> state.lapDist = parseFloat(lapd.value)||0);
    const cdown  = $('#p-countdown'); if(cdown) cdown.addEventListener('change', ()=> {
      state.countdownMs = mmssToMs(cdown.value||'00:00'); state.ringTotal = state.countdownMs; updateRing(state.countdownMs, state.ringTotal);
    });
    liveDistVal.textContent = Math.round(state.cumDist + state.fractionAdded);
  }

  function updateRing(remaining, total){
    const CIRCUM = 339.292;
    const ratio = Math.max(0, Math.min(1, (total? remaining/total : 0)));
    const offset = CIRCUM * (1 - ratio);
    if($('#circle-fg')){ $('#circle-fg').style.strokeDasharray = CIRCUM; $('#circle-fg').style.strokeDashoffset = offset; }
    if($('#circle-text')){ $('#circle-text').textContent = fmtMMSS(remaining); }
  }
  function mmssToMs(s){ const m = /^(\d{1,2}):(\d{2})$/.exec(s)||[0,0,0]; return ((parseInt(m[1],10)||0)*60 + (parseInt(m[2],10)||0))*1000; }
  function now(){ return performance.now(); }

  function clearTable(){
    tbody.innerHTML='';
    rowTotal.classList.add('hidden');
    totalTime.textContent='—';
    totalSpeed.textContent='—';
    if(totalDistanceCell) totalDistanceCell.textContent='—';
  }

  function start(){
    if(state.running){
      state.running = false;
      state.elapsed = now() - state.startTime + state.elapsed;
      cancelAnimationFrame(state.raf);
      btnStart.textContent = 'Reprendre';
      if(!['minuteurSimple','simple','simpleDistance'].includes(state.mode)){
        btnLap.disabled = true;
      }
      btnStop.disabled = false;
      btnReset.disabled = false;
      return;
    }
    state.running = true;
    state.startTime = now();
    state.lastLapAt = state.lastLapAt || state.startTime;
    btnStart.textContent = 'Pause';
    btnLap.disabled = (['minuteurSimple','simple','simpleDistance'].includes(state.mode));
    btnStop.disabled = false;
    btnReset.disabled = false;
    if(!['simple','simpleDistance','minuteurSimple'].includes(state.mode)){
      tableWrap.classList.remove('hidden');
    }
    tryFullscreen();
    tick();
  }

  function stop(){ if(!state.running && state.elapsed===0) return; finish(); }

  function tick(){
    let t = state.elapsed + (now() - state.startTime);
    if(['tours','minuteurSimple'].includes(state.mode)){
      const remain = Math.max(0, state.countdownMs - t);
      updateRing(remain, state.ringTotal);
      if(remain<=0){ finish(); return; }
    } else if(['demiCooper','cooper'].includes(state.mode)){
      const remain = Math.max(0, state.fixedDuration - t);
      updateRing(remain, state.ringTotal);
      if(remain<=0){ finish(); return; }
    } else {
      display.textContent = fmt(t);
    }
    state.raf = requestAnimationFrame(tick);
  }

  function lap(){
    if(!state.running) return;
    if(['simple','simpleDistance','minuteurSimple'].includes(state.mode)) return;

    const tNow = now();
    const cumMs = state.elapsed + (tNow - state.startTime);
    const lapMs = tNow - state.lastLapAt;
    state.lastLapAt = tNow;

    let lapDist = undefined;
    if(state.mode==='intervalles'){
      const next = (state.laps.length+1)*state.splitDist;
      if(next > state.targetDist) return;
      lapDist = state.splitDist;
      state.cumDist = next;
      addLapRow(cumMs, lapMs, lapDist);
      if(state.cumDist >= state.targetDist){ finish(); }
      return;
    } else if(['tours','demiCooper','cooper'].includes(state.mode)){
      lapDist = state.lapDist;
      state.cumDist += lapDist;
      liveDistVal.textContent = Math.round(state.cumDist + state.fractionAdded);
    }
    addLapRow(cumMs, lapMs, lapDist);
  }

  function addLapRow(cumMs, lapMs, lapDist){
    const tr = document.createElement('tr');
    const idx = state.laps.length+1;
    const lapSpeed = lapDist? kmh(lapDist, lapMs) : 0;
    const cumMetersNow = Math.round(state.cumDist); // after update
    tr.innerHTML = `<td>${idx}</td><td>${fmt(cumMs)}</td><td>${fmt(lapMs)}</td><td>${lapDist? lapSpeed.toFixed(2):'—'}</td><td>${lapDist? Math.round(lapDist):'—'}</td><td>${(lapDist||state.mode==='intervalles')? cumMetersNow:'—'}</td>`;
    tbody.appendChild(tr);
    state.laps.push({idx, cumMs, lapMs, lapDist: lapDist||0, lapSpeed, cumMeters: cumMetersNow});
  }

  function finish(){
    if(state.running){
      state.elapsed = state.elapsed + (now() - state.startTime);
      state.running = false;
      cancelAnimationFrame(state.raf);
    }
    btnLap.disabled = true;
    btnStart.textContent = 'Démarrer';
    btnStop.disabled = true;
    results.classList.remove('hidden');
    rowTotal.classList.remove('hidden');

    let totalMs = state.elapsed;
    let totalMeters = 0;
    let vAvg = 0;

    if(state.mode==='intervalles'){
      totalMeters = state.targetDist; vAvg = kmh(totalMeters, totalMs);
      ivlExportBox.classList.remove('hidden');
    } else if(state.mode==='simple'){
      qrcodeBox.innerHTML = '';
    } else if(state.mode==='simpleDistance'){
      totalMeters = state.targetDist; vAvg = kmh(totalMeters, totalMs);
    } else if(state.mode==='tours'){
      totalMeters = state.cumDist + state.fractionAdded; vAvg = kmh(totalMeters, totalMs);
      fractionTools.classList.remove('hidden');
    } else if(['demiCooper','cooper'].includes(state.mode)){
      totalMeters = state.cumDist + state.fractionAdded; vAvg = kmh(totalMeters, totalMs);
      fractionTools.classList.remove('hidden');
    } else if(state.mode==='minuteurSimple'){
      // nothing
    }

    totalTime.textContent = fmt(totalMs);
    totalSpeed.textContent = vAvg.toFixed(2);
    if(totalDistanceCell) totalDistanceCell.textContent = (totalMeters? Math.round(totalMeters):'—');

    // Recap
    recap.classList.add('hidden');
    recapBody.innerHTML='';
    const sRows = [];
    if(state.mode==='simpleDistance'){
      sRows.push(['Distance', `${Math.round(state.targetDist)} m`]);
      sRows.push(['Temps', fmt(totalMs)]);
      sRows.push(['Vitesse moyenne', `${kmh(state.targetDist, totalMs).toFixed(2)} km/h`]);
    }
    if(['tours','demiCooper','cooper'].includes(state.mode)){
      const d = Math.round(state.cumDist + state.fractionAdded);
      sRows.push(['Temps', fmt(totalMs)]);
      sRows.push(['Distance totale', `${d} m`]);
      sRows.push(['Vitesse moyenne', `${kmh(d, totalMs).toFixed(2)} km/h`]);
      if(['demiCooper','cooper'].includes(state.mode)){
        sRows.push(['VMA (moyenne)', `${kmh(d, totalMs).toFixed(2)} km/h`]);
      }
    }
    if(sRows.length){
      recap.classList.remove('hidden');
      recapBody.innerHTML = sRows.map(([k,v])=>`<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`).join('');
    }

    if(state.mode!=='intervalles' && state.mode!=='simple'){
      generateQR();
    }
  }

  function applyFraction(frac){
    if(!['tours','demiCooper','cooper'].includes(state.mode)) return;
    const add = state.lapDist * frac;
    state.fractionAdded = add;
    liveDistVal.textContent = Math.round(state.cumDist + state.fractionAdded);
    const totalMs = state.elapsed;
    const totalMeters = state.cumDist + state.fractionAdded;
    totalSpeed.textContent = kmh(totalMeters, totalMs).toFixed(2);
    if(totalDistanceCell) totalDistanceCell.textContent = Math.round(totalMeters);
    generateQR();
  }
  function undoFraction(){
    if(!['tours','demiCooper','cooper'].includes(state.mode)) return;
    state.fractionAdded = 0;
    liveDistVal.textContent = Math.round(state.cumDist);
    const totalMs = state.elapsed;
    const totalMeters = state.cumDist;
    totalSpeed.textContent = kmh(totalMeters, totalMs).toFixed(2);
    if(totalDistanceCell) totalDistanceCell.textContent = Math.round(totalMeters);
    generateQR();
  }

  // ---------- QR payload (auto-enriched) ----------
  function identityBlock(){
    const s = student();
    return { nom:s.nom||'', prenom:s.prenom||'', classe:s.classe||'', sexe:s.sexe||'' };
  }
  function payloadEnvelope(modeId, libelle, core, meta){
    return [ Object.assign({ version:'rm-1', mode: modeId, libelle }, identityBlock(), core, { meta }) ];
  }

  function buildPayload(){
    switch(state.mode){
      case 'intervalles': {
        const type = (document.querySelector('input[name="ivl-type"]:checked')||{}).value || 'cumules';
        const meta = { distance_cible_m: Math.round(state.targetDist||0), intervalle_m: Math.round(state.splitDist||0), export: (type==='cumules'?'temps_cumules':'temps_intervalle') };
        if(type==='cumules'){
          const core = {};
          state.laps.forEach((l, i) => { const d = (i+1)*state.splitDist; core[`t${d}`] = fmt(l.cumMs); });
          return payloadEnvelope('intermediaires','Temps intermédiaire', core, meta);
        } else {
          const core = {};
          state.laps.forEach((l, i) => { core[`i${i+1}`] = fmt(l.lapMs); });
          return payloadEnvelope('intermediaires','Temps intermédiaire', core, meta);
        }
      }
      case 'simpleDistance': {
        const d = Math.round(state.targetDist||0);
        const core = { };
        core[`temps_${d}m`] = fmt(state.elapsed);
        core[`vitesse_${d}m`] = kmh(d, state.elapsed);
        const meta = { distance_cible_m: d };
        return payloadEnvelope('chrono_vitesse','Chrono avec calcul de vitesse', core, meta);
      }
      case 'tours': {
        const dist = Math.round(state.cumDist + state.fractionAdded);
        const core = { distance_totale: dist, vitesse_moyenne: kmh(dist, state.elapsed) };
        const meta = { duree: fmtMMSS(state.countdownMs||0), distance_tour_m: Math.round(state.lapDist||0) };
        return payloadEnvelope('minuteur_distance','Minuteur avec distance', core, meta);
      }
      case 'demiCooper':
      case 'cooper': {
        const dist = Math.round(state.cumDist + state.fractionAdded);
        const vma = kmh(dist, state.elapsed);
        const core = { vma: vma, distance: dist };
        const meta = { duree: state.mode==='demiCooper' ? '06:00' : '12:00', distance_tour_m: Math.round(state.lapDist||0) };
        return payloadEnvelope(state.mode==='demiCooper'?'demi_cooper':'cooper', state.mode==='demiCooper'?'Demi-Cooper (6′)':'Cooper (12′)', core, meta);
      }
      case 'minuteurSimple': {
        const core = { duree: fmtMMSS(state.countdownMs||0) };
        const meta = { duree: fmtMMSS(state.countdownMs||0) };
        return payloadEnvelope('minuteur','Minuteur', core, meta);
      }
      default: return null; // 'simple' : no QR
    }
  }

  function generateQR(){
    const payload = buildPayload();
    if(!payload) { qrcodeBox.innerHTML=''; return; }
    qrcodeBox.innerHTML='';
    try{
      new QRCode(qrcodeBox, { text: JSON.stringify(payload), width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
    }catch(e){
      const div = document.createElement('div');
      div.textContent = 'Erreur QR: '+e.message;
      qrcodeBox.appendChild(div);
    }
  }
  // -----------------------------------------------

  // Events
  const circleWrap = $('#circle-wrap'), circleFG = $('#circle-fg'), circleText = $('#circle-text');
  const btnGenQR = $('#btn-gen-qr');
  btnStart.addEventListener('click', start);
  btnStop.addEventListener('click', stop);
  btnLap.addEventListener('click', lap);
  btnReset.addEventListener('click', () => {
    state.running=false; cancelAnimationFrame(state.raf);
    state.startTime=0; state.elapsed=0; state.lastLapAt=0; state.laps=[]; state.cumDist=0; state.fractionAdded=0;
    display.textContent='00:00.0';
    if(circleWrap && !circleWrap.classList.contains('hidden')){
      if(state.ringTotal) updateRing(state.ringTotal, state.ringTotal);
    }
    btnStart.textContent='Démarrer';
    btnLap.disabled=(['minuteurSimple','simple','simpleDistance'].includes(state.mode));
    btnStop.disabled=true;
    btnReset.disabled=false;
    if(!['simple','simpleDistance','minuteurSimple'].includes(state.mode)){
      tableWrap.classList.add('hidden');
    }
    results.classList.add('hidden');
    ivlExportBox.classList.add('hidden');
    fractionTools.classList.add('hidden');
    qrcodeBox.innerHTML='';
    liveDistVal.textContent = '0';
    recap.classList.add('hidden');
    recapBody.innerHTML='';
    if(totalDistanceCell) totalDistanceCell.textContent='—';
    clearTable();
  });
  $('#btn-new').addEventListener('click', () => location.reload());
  if(btnGenQR) btnGenQR.addEventListener('click', generateQR);
  $('#btn-export-csv').addEventListener('click', () => {
    const s = student();
    const lines = [];
    lines.push(['nom','prenom','classe','sexe','lap_index','t_cum','t_lap','v_lap_kmh']);
    state.laps.forEach(l => {
      lines.push([s.nom||'', s.prenom||'', s.classe||'', s.sexe||'', l.idx, fmt(l.cumMs), fmt(l.lapMs), l.lapDist? kmh(l.lapDist, l.lapMs).toFixed(2):'']);
    });
    lines.push(['TOTAL','','','', '', fmt(state.elapsed), '', ( (state.cumDist + state.fractionAdded) ? kmh(state.cumDist + state.fractionAdded, state.elapsed).toFixed(2):'')]);
    const csv = lines.map(r=>r.map(x=>`"${String(x).replaceAll('"','""')}"`).join(',')).join('\\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `runmeasure_${(student().nom||'')}_${(student().prenom||'')}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  // Fractions
  fractionTools?.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if(!btn) return;
    if(btn.id === 'btn-frac-undo'){ undoFraction(); return; }
    const frac = parseFloat(btn.dataset.frac||'0');
    if(frac>0){ applyFraction(frac); }
  });

  renderParams();
})();