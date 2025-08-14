// RunMeasure V7.3 — minutes/secondes selects, fractions reflected in totals & QR, CSV compat
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
  const circleWrap = $('#circle-wrap');
  const liveDistance = $('#live-distance');
  const liveDistVal = $('#live-dist-val');
  const fractionTools = $('#fraction-tools');
  const recap = $('#recap');
  const recapBody = $('#recap-body');

  function mmssToMsStr(mm, ss){
    const m = Math.max(0, parseInt(mm||'0',10));
    const s = Math.max(0, parseInt(ss||'0',10));
    return (m*60 + s)*1000;
  }
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
          <div class="info">Appuie sur « Tour » à chaque passage. À la fin, le QR est généré automatiquement (par défaut <em>temps cumulés</em>), et tu peux basculer sur <em>temps par intervalle</em>.</div>
        `;
        state.targetDist = 800;
        state.splitDist = 200;
        break;

      case 'simple':
        modeName.textContent = 'Chrono';
        params.innerHTML = `<div class="info">Chronométrage simple. Pas de tours. <strong>Pas de QR.</strong></div>`;
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
          <div class="info">Lance puis « Stop » à l'arrivée. Récapitulatif + QR minimal.</div>
        `;
        state.targetDist = 100;
        btnLap.classList.add('hidden');
        btnStop.classList.remove('hidden');
        tableWrap.classList.add('hidden');
        break;

      case 'tours':
        modeName.textContent = 'Minuteur avec distance';
        params.appendChild(buildMinuteSecondSelectors());
        params.insertAdjacentHTML('beforeend', `
          <label>Distance par tour (m)
            <input type="number" id="p-lapdist" min="25" step="25" value="100"/>
          </label>
          <div class="info">Décompte + « Tour » pour ajouter la distance. Tableau : <em>Temps cumulé</em>, <em>Temps au tour</em>, <em>Vitesse</em>, <em>Distance cumulée</em>.</div>
        `);
        state.countdownMs = mmssToMsStr(5,0); state.ringTotal = state.countdownMs;
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
          <div class="info">Durée fixe 6:00. Tableau : <em>Temps cumulé</em>, <em>Temps au tour</em>, <em>Vitesse</em>, <em>Distance cumulée</em>.</div>
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
          <div class="info">Durée fixe 12:00. Tableau : <em>Temps cumulé</em>, <em>Temps au tour</em>, <em>Vitesse</em>, <em>Distance cumulée</em>.</div>
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
        params.appendChild(buildMinuteSecondSelectors());
        params.insertAdjacentHTML('beforeend', `<div class="info">Compte à rebours simple. <strong>Pas de QR.</strong></div>`);
        state.countdownMs = mmssToMsStr(5,0); state.ringTotal = state.countdownMs;
        circleWrap.classList.remove('hidden');
        display.classList.add('hidden');
        btnLap.classList.add('hidden');
        btnStop.classList.remove('hidden');
        tableWrap.classList.add('hidden');
        updateRing(state.countdownMs, state.ringTotal);
        break;
    }

    const target = $('#p-target'); if(target) target.addEventListener('change', ()=> state.targetDist = parseFloat(target.value)||0);
    const step   = $('#p-step');   if(step)   step.addEventListener('change', ()=> state.splitDist = parseFloat(step.value)||0);
    const lapd   = $('#p-lapdist');if(lapd)   lapd.addEventListener('change', ()=> state.lapDist = parseFloat(lapd.value)||0);
    liveDistVal.textContent = Math.round(state.cumDist + state.fractionAdded);
  }

  function buildMinuteSecondSelectors(){
    const wrap = document.createElement('div');
    wrap.className = 'grid-3';

    const min = document.createElement('label');
    min.innerHTML = 'Minutes<select id="sel-min"></select>';
    const selMin = min.querySelector('select');
    for(let i=1;i<=120;i++){ const o=document.createElement('option'); o.value=i; o.textContent=String(i).padStart(2,'0'); if(i===5) o.selected=true; selMin.appendChild(o); }

    const sec = document.createElement('label');
    sec.innerHTML = 'Secondes<select id="sel-sec"></select>';
    const selSec = sec.querySelector('select');
    for(let i=1;i<=59;i++){ const o=document.createElement('option'); o.value=i; o.textContent=String(i).padStart(2,'0'); selSec.appendChild(o); }
    const zeroOpt = document.createElement('option'); zeroOpt.value=0; zeroOpt.textContent='00'; selSec.insertBefore(zeroOpt, selSec.firstChild); zeroOpt.selected=true;

    const spacer = document.createElement('div'); spacer.innerHTML='&nbsp;';

    selMin.addEventListener('change', ()=> {
      const mm = parseInt(selMin.value,10), ss = parseInt(selSec.value,10);
      state.countdownMs = (mm*60+ss)*1000; state.ringTotal = state.countdownMs; updateRing(state.countdownMs, state.ringTotal);
    });
    selSec.addEventListener('change', ()=> {
      const mm = parseInt(selMin.value,10), ss = parseInt(selSec.value,10);
      state.countdownMs = (mm*60+ss)*1000; state.ringTotal = state.countdownMs; updateRing(state.countdownMs, state.ringTotal);
    });

    wrap.appendChild(min);
    wrap.appendChild(sec);
    wrap.appendChild(spacer);
    return wrap;
  }

  function updateRing(remaining, total){
    const CIRCUM = 339.292;
    const ratio = Math.max(0, Math.min(1, (total? remaining/total : 0)));
    const offset = CIRCUM * (1 - ratio);
    if($('#circle-fg')){ $('#circle-fg').style.strokeDasharray = CIRCUM; $('#circle-fg').style.strokeDashoffset = offset; }
    if($('#circle-text')){ $('#circle-text').textContent = fmtMMSS(remaining); }
  }
  const now = () => performance.now();

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

    if(state.mode==='intervalles'){
      const next = (state.laps.length+1)*state.splitDist;
      if(next > state.targetDist) return;
      state.cumDist = next;
      addLapRow(cumMs, lapMs);
      if(state.cumDist >= state.targetDist){ finish(); }
      return;
    } else if(['tours','demiCooper','cooper'].includes(state.mode)){
      state.cumDist += state.lapDist;
      liveDistVal.textContent = Math.round(state.cumDist + state.fractionAdded);
    }
    addLapRow(cumMs, lapMs);
  }

  function addLapRow(cumMs, lapMs){
    const tr = document.createElement('tr');
    const idx = state.laps.length+1;
    let lapDist = 0;
    if(state.mode==='intervalles') lapDist = state.splitDist;
    if(['tours','demiCooper','cooper'].includes(state.mode)) lapDist = state.lapDist;
    const lapSpeed = lapDist? kmh(lapDist, lapMs) : 0;
    const cumMetersNow = Math.round(state.cumDist); // after update
    tr.innerHTML = `<td>${idx}</td><td>${fmt(cumMs)}</td><td>${fmt(lapMs)}</td><td>${lapDist? lapSpeed.toFixed(2):'—'}</td><td>${(lapDist||state.mode==='intervalles')? cumMetersNow:'—'}</td>`;
    tbody.appendChild(tr);
    state.laps.push({idx, cumMs, lapMs, lapDist, lapSpeed, cumMeters: cumMetersNow});
  }

  function updateRecapTotals(){
    const totalMs = state.elapsed;
    let totalMeters = 0;
    if(state.mode==='intervalles'){ totalMeters = state.targetDist; }
    else if(['tours','demiCooper','cooper'].includes(state.mode)){
      totalMeters = state.cumDist + state.fractionAdded;
    } else if(state.mode==='simpleDistance'){ totalMeters = state.targetDist; }
    const vAvg = kmh(totalMeters, totalMs);
    totalTime.textContent = fmt(totalMs);
    totalSpeed.textContent = (vAvg? vAvg.toFixed(2):'—');
    if(totalDistanceCell) totalDistanceCell.textContent = (totalMeters? Math.round(totalMeters):'—');

    // Recap rows
    recap.classList.add('hidden');
    recapBody.innerHTML='';
    const sRows = [];
    if(state.mode==='simpleDistance'){
      sRows.push(['Distance', `${Math.round(state.targetDist)} m`]);
      sRows.push(['Temps', fmt(totalMs)]);
      sRows.push(['Vitesse moyenne', `${kmh(state.targetDist, totalMs).toFixed(2)} km/h`]);
    }
    if(['tours','demiCooper','cooper'].includes(state.mode)){
      const d = Math.round(totalMeters);
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

    if(['tours','demiCooper','cooper'].includes(state.mode)){
      fractionTools.classList.remove('hidden');
    }

    if(state.mode==='intervalles'){
      ivlExportBox.classList.remove('hidden');
      generateQR(); // auto default (cumules)
      const radios = document.querySelectorAll('input[name="ivl-type"]');
      radios.forEach(r=> r.addEventListener('change', generateQR));
      const genBtn = $('#btn-gen-qr'); if(genBtn) genBtn.addEventListener('click', generateQR);
    }

    updateRecapTotals();

    if(!['simple','minuteurSimple','intervalles'].includes(state.mode)){
      generateQR();
    }
  }

  function applyFraction(frac){
    if(!['tours','demiCooper','cooper'].includes(state.mode)) return;
    state.fractionAdded = state.lapDist * frac;
    liveDistVal.textContent = Math.round(state.cumDist + state.fractionAdded);
    updateRecapTotals();
    generateQR();
  }
  function undoFraction(){
    if(!['tours','demiCooper','cooper'].includes(state.mode)) return;
    state.fractionAdded = 0;
    liveDistVal.textContent = Math.round(state.cumDist);
    updateRecapTotals();
    generateQR();
  }

  // ---------- QR payloads (identity -> test -> core) ----------
  function identityBlock(){
    const s = student();
    return { nom:s.nom||'', prenom:s.prenom||'', classe:s.classe||'', sexe:s.sexe||'' };
  }
  function payloadWithTest(testLabel, core){
    const id = identityBlock();
    const obj = Object.assign({}, id, { test: testLabel }, core||{});
    return [ obj ];
  }

  function generateQR(){
    const p = buildPayload();
    if(!p){ qrcodeBox.innerHTML=''; return; }
    qrcodeBox.innerHTML='';
    try{
      new QRCode(qrcodeBox, { text: JSON.stringify(p), width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
    }catch(e){
      const div = document.createElement('div');
      div.textContent = 'Erreur QR: '+e.message;
      qrcodeBox.appendChild(div);
    }
  }

  function buildPayload(){
    switch(state.mode){
      case 'intervalles': {
        const type = (document.querySelector('input[name="ivl-type"]:checked')||{}).value || 'cumules';
        if(type==='cumules'){
          const core = {};
          state.laps.forEach((l, i) => { const d = (i+1)*state.splitDist; core[`t${d}`] = fmt(l.cumMs); });
          return payloadWithTest('Temps intermédiaire', core);
        } else {
          const core = {};
          state.laps.forEach((l, i) => { core[`i${i+1}`] = fmt(l.lapMs); });
          return payloadWithTest('Temps intermédiaire', core);
        }
      }
      case 'simpleDistance': {
        const d = Math.round(state.targetDist||0);
        const core = {};
        core[`temps_${d}m`] = fmt(state.elapsed);
        core[`vitesse_${d}m`] = kmh(d, state.elapsed);
        return payloadWithTest('Chrono avec calcul de vitesse', core);
      }
      case 'tours': {
        const dist = Math.round(state.cumDist + state.fractionAdded);
        return payloadWithTest('Minuteur avec distance', { distance_totale: dist, vitesse_moyenne: kmh(dist, state.elapsed) });
      }
      case 'demiCooper': {
        const dist = Math.round(state.cumDist + state.fractionAdded);
        const vma = kmh(dist, state.elapsed);
        return payloadWithTest('Demi-Cooper (6′)', { vma: vma, distance: dist });
      }
      case 'cooper': {
        const dist = Math.round(state.cumDist + state.fractionAdded);
        const vma = kmh(dist, state.elapsed);
        return payloadWithTest('Cooper (12′)', { vma: vma, distance: dist });
      }
      case 'minuteurSimple': {
        return null; // NO QR
      }
      default: return null; // 'simple' : no QR
    }
  }
  // ---------------------------------------------------------

  // CSV Export (robust replace)
  function csvExport(){
    const s = student();
    const esc = (v) => (`"${String(v).replace(/"/g,'""')}"`);
    const lines = [];
    lines.push(['nom','prenom','classe','sexe','lap_index','t_cum','t_lap','v_lap_kmh','dist_cum_m']);
    state.laps.forEach(l => {
      const v = l.lapDist? kmh(l.lapDist, l.lapMs).toFixed(2):'';
      lines.push([s.nom||'', s.prenom||'', s.classe||'', s.sexe||'', l.idx, fmt(l.cumMs), fmt(l.lapMs), v, (l.cumMeters||'')]);
    });
    const totalMeters = (['tours','demiCooper','cooper'].includes(state.mode)) ? Math.round(state.cumDist + state.fractionAdded) : (state.mode==='intervalles'? Math.round(state.targetDist): '');
    lines.push(['TOTAL','','','', '', fmt(state.elapsed), '', ( totalMeters? kmh(totalMeters, state.elapsed).toFixed(2):''), totalMeters]);
    const csv = lines.map(r=>r.map(esc).join(',')).join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `runmeasure_${(s.nom||'')}_${(s.prenom||'')}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // Events
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
  $('#btn-export-csv').addEventListener('click', csvExport);
  // For intervalles, also generate QR button is attached in finish()

  renderParams();
})();