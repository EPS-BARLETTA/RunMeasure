// ChronoVitesse V4
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
  const student = () => { try { return JSON.parse(localStorage.getItem('cv_student')||'{}'); } catch(e){ return {}; } };

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
    ringTotal: 0
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
  const rowTotal = $('#row-total');
  const ivlExportBox = $('#intervalles-export');
  const btnGenQR = $('#btn-gen-qr');
  const circleWrap = $('#circle-wrap');
  const circleFG = $('#circle-fg');
  const circleText = $('#circle-text');
  const CIRCUM = 2 * Math.PI * 54;

  function renderParams(){
    params.innerHTML = '';
    circleWrap.classList.add('hidden');
    display.classList.remove('hidden');

    // defaults
    btnLap.classList.remove('hidden');
    btnStop.classList.add('hidden'); // only for simple/simpleDistance
    tableWrap.classList.remove('hidden');

    switch(state.mode){
      case 'intervalles':
        modeName.textContent = '⏱️ Intermédiaires';
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
        modeName.textContent = '⏱️ Chrono (sans distance)';
        params.innerHTML = `<div class="info">Chronométrage simple (QR : temps_total). Pas de tours.</div>`;
        // No laps, show Stop instead of Lap, and hide table
        btnLap.classList.add('hidden');
        btnStop.classList.remove('hidden');
        tableWrap.classList.add('hidden');
        break;

      case 'simpleDistance':
        modeName.textContent = '⏱️ Chrono + Distance';
        params.innerHTML = `
          <label>Distance (m)
            <input type="number" id="p-target" min="25" step="25" value="100"/>
          </label>
          <div class="info">Lance puis « Stop » à l'arrivée.</div>
        `;
        state.targetDist = 100;
        btnLap.classList.add('hidden');
        btnStop.classList.remove('hidden');
        tableWrap.classList.add('hidden');
        break;

      case 'tours':
        modeName.textContent = '⏲️ Minuteur & Tours';
        params.innerHTML = `
          <label>Durée (mm:ss)
            <input type="text" id="p-countdown" value="05:00"/>
          </label>
          <label>Distance par tour (m)
            <input type="number" id="p-lapdist" min="25" step="25" value="100"/>
          </label>
          <div class="info">Décompte + « Tour » pour ajouter la distance.</div>
        `;
        state.countdownMs = mmssToMs('05:00'); state.ringTotal = state.countdownMs;
        state.lapDist = 100;
        circleWrap.classList.remove('hidden');
        display.classList.add('hidden');
        updateRing(state.countdownMs, state.ringTotal);
        break;

      case 'demiCooper':
        modeName.textContent = '⏱️ Demi-Cooper (6′)';
        params.innerHTML = `
          <label>Distance par tour (m)
            <input type="number" id="p-lapdist" min="25" step="25" value="100"/>
          </label>
          <div class="info">Durée fixe 6:00. « Tour » à chaque passage.</div>
        `;
        state.fixedDuration = 6*60*1000; state.ringTotal = state.fixedDuration;
        state.lapDist = 100;
        circleWrap.classList.remove('hidden');
        display.classList.add('hidden');
        updateRing(state.fixedDuration, state.ringTotal);
        break;

      case 'cooper':
        modeName.textContent = '⏱️ Cooper (12′)';
        params.innerHTML = `
          <label>Distance par tour (m)
            <input type="number" id="p-lapdist" min="25" step="25" value="100"/>
          </label>
          <div class="info">Durée fixe 12:00. « Tour » à chaque passage.</div>
        `;
        state.fixedDuration = 12*60*1000; state.ringTotal = state.fixedDuration;
        state.lapDist = 100;
        circleWrap.classList.remove('hidden');
        display.classList.add('hidden');
        updateRing(state.fixedDuration, state.ringTotal);
        break;

      case 'minuteurSimple':
        modeName.textContent = '⏳ Minuteur simple';
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
        btnStop.classList.remove('hidden'); // Stop possible
        tableWrap.classList.add('hidden');
        updateRing(state.countdownMs, state.ringTotal);
        break;
    }

    const target = $('#p-target'); if(target) target.addEventListener('change', ()=> state.targetDist = parseFloat(target.value)||0);
    const step   = $('#p-step');   if(step)   step.addEventListener('change', ()=> state.splitDist = parseFloat(step.value)||0);
    const lapd   = $('#p-lapdist');if(lapd)   lapd.addEventListener('change', ()=> state.lapDist = parseFloat(lapd.value)||0);
    const cdown  = $('#p-countdown'); if(cdown) cdown.addEventListener('change', ()=> {
      state.countdownMs = mmssToMs(cdown.value||'00:00'); state.ringTotal = state.countdownMs; updateRing(state.countdownMs, state.ringTotal);
    });
  }

  function updateRing(remaining, total){
    const ratio = Math.max(0, Math.min(1, (total? remaining/total : 0)));
    const offset = CIRCUM * (1 - ratio);
    if(circleFG){ circleFG.style.strokeDasharray = CIRCUM; circleFG.style.strokeDashoffset = offset; }
    if(circleText){ circleText.textContent = fmtMMSS(remaining); }
  }
  function mmssToMs(s){ const m = /^(\d{1,2}):(\d{2})$/.exec(s)||[0,0,0]; return ((parseInt(m[1],10)||0)*60 + (parseInt(m[2],10)||0))*1000; }
  function now(){ return performance.now(); }

  function clearTable(){
    tbody.innerHTML='';
    rowTotal.classList.add('hidden');
    totalTime.textContent='—';
    totalSpeed.textContent='—';
  }

  function start(){
    if(state.running){
      state.running = false;
      state.elapsed = now() - state.startTime + state.elapsed;
      cancelAnimationFrame(state.raf);
      btnStart.textContent = 'Reprendre';
      if(state.mode!=='minuteurSimple' && state.mode!=='simple' && state.mode!=='simpleDistance'){
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
    btnLap.disabled = (state.mode==='minuteurSimple' || state.mode==='simple' || state.mode==='simpleDistance');
    btnStop.disabled = false;
    btnReset.disabled = false;
    if(!['simple','simpleDistance','minuteurSimple'].includes(state.mode)){
      tableWrap.classList.remove('hidden');
    }
    tick();
  }

  function stop(){
    if(!state.running && state.elapsed===0) return; // nothing to stop
    finish();
  }

  function tick(){
    let t = state.elapsed + (now() - state.startTime);

    if(state.mode==='tours' || state.mode==='minuteurSimple'){
      const remain = Math.max(0, state.countdownMs - t);
      updateRing(remain, state.ringTotal);
      if(remain<=0){ finish(); return; }
    } else if(state.mode==='demiCooper' || state.mode==='cooper'){
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
    if(state.mode==='simple' || state.mode==='simpleDistance' || state.mode==='minuteurSimple') return;

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
    } else if(state.mode==='tours' || state.mode==='demiCooper' || state.mode==='cooper'){
      lapDist = state.lapDist;
      state.cumDist += lapDist;
    }
    addLapRow(cumMs, lapMs, lapDist);
  }

  function addLapRow(cumMs, lapMs, lapDist){
    const tr = document.createElement('tr');
    const idx = state.laps.length+1;
    const lapSpeed = lapDist? kmh(lapDist, lapMs) : 0;
    tr.innerHTML = `<td>${idx}</td><td>${fmt(cumMs)}</td><td>${fmt(lapMs)}</td><td>${lapDist? lapSpeed.toFixed(2):'—'}</td>`;
    tbody.appendChild(tr);
    state.laps.push({idx, cumMs, lapMs, lapDist: lapDist||0, lapSpeed});
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
      totalMeters = state.targetDist;
      vAvg = kmh(totalMeters, totalMs);
      $('#intervalles-export').classList.remove('hidden');
    } else if(state.mode==='simple'){
      // only time
    } else if(state.mode==='simpleDistance'){
      totalMeters = state.targetDist; vAvg = kmh(totalMeters, totalMs);
    } else if(state.mode==='tours'){
      totalMeters = state.cumDist; vAvg = kmh(totalMeters, totalMs);
    } else if(state.mode==='demiCooper' || state.mode==='cooper'){
      totalMeters = state.cumDist; vAvg = kmh(totalMeters, totalMs);
    } else if(state.mode==='minuteurSimple'){
      // nothing
    }

    totalTime.textContent = fmt(totalMs);
    totalSpeed.textContent = vAvg.toFixed(2);

    if(state.mode!=='intervalles'){
      generateQR();
    }
  }

  function generateQR(){
    const s = student();
    const base = { nom:s.nom||'', prenom:s.prenom||'', classe:s.classe||'', sexe:s.sexe||'' };
    let payloadObj = {};

    switch(state.mode){
      case 'intervalles': {
        const type = (document.querySelector('input[name="ivl-type"]:checked')||{}).value || 'cumules';
        if(type==='cumules'){
          const obj = { ...base };
          state.laps.forEach((l, i) => { const d = (i+1)*state.splitDist; obj[`t${d}`] = fmt(l.cumMs); });
          payloadObj = obj;
        } else {
          const obj = { ...base };
          state.laps.forEach((l, i) => { obj[`i${i+1}`] = fmt(l.lapMs); });
          payloadObj = obj;
        }
        break;
      }
      case 'simple': {
        payloadObj = { ...base, temps_total: fmt(state.elapsed) };
        break;
      }
      case 'simpleDistance': {
        const d = Math.round(state.targetDist||0);
        payloadObj = { ...base };
        payloadObj[`temps_${d}m`] = fmt(state.elapsed);
        payloadObj[`vitesse_${d}m`] = kmh(d, state.elapsed);
        break;
      }
      case 'tours': {
        payloadObj = { ...base, distance_totale: Math.round(state.cumDist), vitesse_moyenne: kmh(state.cumDist, state.elapsed) };
        break;
      }
      case 'demiCooper':
      case 'cooper': {
        const vma = kmh(state.cumDist, state.elapsed);
        payloadObj = { ...base, vma: vma, distance: Math.round(state.cumDist) };
        break;
      }
      case 'minuteurSimple': {
        const set = state.countdownMs;
        payloadObj = { ...base, duree: fmtMMSS(set) };
        break;
      }
    }

    const payload = [payloadObj];
    qrcodeBox.innerHTML='';
    try{
      new QRCode(qrcodeBox, { text: JSON.stringify(payload), width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
    }catch(e){
      const div = document.createElement('div');
      div.textContent = 'Erreur QR: '+e.message;
      qrcodeBox.appendChild(div);
    }
  }

  btnStart.addEventListener('click', start);
  btnStop.addEventListener('click', stop);
  btnLap.addEventListener('click', lap);
  btnReset.addEventListener('click', () => {
    state.running=false; cancelAnimationFrame(state.raf);
    state.startTime=0; state.elapsed=0; state.lastLapAt=0; state.laps=[]; state.cumDist=0;
    display.textContent='00:00.0';
    if(circleWrap && !circleWrap.classList.contains('hidden')){
      if(state.ringTotal) updateRing(state.ringTotal, state.ringTotal);
    }
    btnStart.textContent='Démarrer';
    btnLap.disabled=(state.mode==='minuteurSimple' || state.mode==='simple' || state.mode==='simpleDistance');
    btnStop.disabled=true;
    btnReset.disabled=false;
    if(!['simple','simpleDistance','minuteurSimple'].includes(state.mode)){
      tableWrap.classList.add('hidden');
    }
    results.classList.add('hidden');
    ivlExportBox.classList.add('hidden');
    qrcodeBox.innerHTML='';
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
    lines.push(['TOTAL','','','', '', fmt(state.elapsed), '', (state.cumDist? kmh(state.cumDist, state.elapsed).toFixed(2):'')]);
    const csv = lines.map(r=>r.map(x=>`"${String(x).replaceAll('"','""')}"`).join(',')).join('\\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `chronovitesse_${(s.nom||'')}_${(s.prenom||'')}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  renderParams();
})();