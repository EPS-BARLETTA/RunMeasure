// ChronoVitesse - logique principale
// Modes: intervalles, simple, tours, demiCooper(6'), cooper(12')
(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
  const fmt = (ms) => {
    const totalTenths = Math.round(ms/100);
    const minutes = Math.floor(totalTenths/600);
    const seconds = Math.floor((totalTenths%600)/10);
    const tenths  = totalTenths%10;
    return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${tenths}`;
  };
  const kmh = (meters, ms) => {
    if (ms<=0) return 0;
    const mps = meters / (ms/1000);
    return +(mps * 3.6).toFixed(2);
  };

  const state = {
    mode: null,
    running: false,
    startTime: 0,
    elapsed: 0,     // ms cumulés (pause/reprise)
    lastLapAt: 0,   // timestamp du dernier tour
    laps: [],       // {idx, lapMs, cumMs, lapDist, cumDist, lapSpeed, avgSpeed}
    cumDist: 0,
    totalTargetDist: 0, // pour intervalles / simple
    interStep: 0,       // taille d'intervalle (intervalles)
    lapFixedDist: 0,    // distance par tour (tours)
    fixedDuration: 0,   // pour 6' / 12' en ms
    raf: 0
  };

  // Elements
  const modeTitle = $('#mode-title');
  const display = $('#display');
  const btnStart = $('#btn-start');
  const btnLap = $('#btn-lap');
  const btnReset = $('#btn-reset');
  const tableWrap = $('#table-wrap');
  const tbody = $('#laps-table tbody');
  const rowTotal = $('#row-total');
  const totalTime = $('#total-time');
  const totalDist = $('#total-dist');
  const totalSpeed = $('#total-speed');
  const results = $('#results');
  const jsonPreview = $('#json-preview');
  const qrcodeBox = $('#qrcode');

  // Params
  const paramsBlocks = {
    intervalles: $('#params-intervalles'),
    simple: $('#params-simple'),
    tours: $('#params-tours'),
    demiCooper: $('#params-demic'),
    cooper: $('#params-cooper'),
  };

  const ivlDistance = $('#ivl-distance');
  const ivlStep = $('#ivl-step');
  const ivlApply = $('#ivl-apply');
  const simpleDistance = $('#simple-distance');
  const lapDistance = $('#lap-distance');

  // Mode selection
  $$('.mode-buttons .btn').forEach(b => {
    b.addEventListener('click', () => selectMode(b.dataset.mode));
  });
  function selectMode(mode){
    state.mode = mode;
    Object.values(paramsBlocks).forEach(p => p.classList.add('hidden'));
    tableWrap.classList.add('hidden');
    results.classList.add('hidden');
    clearTable();
    resetCore(true);
    btnLap.disabled = true;
    btnReset.disabled = true;

    switch(mode){
      case 'intervalles':
        modeTitle.textContent = '⏱️ Chrono avec temps intermédiaires';
        paramsBlocks.intervalles.classList.remove('hidden');
        state.totalTargetDist = parseFloat(ivlDistance.value)||800;
        state.interStep = parseFloat(ivlStep.value)||200;
        break;
      case 'simple':
        modeTitle.textContent = '⏱️ Chrono simple';
        paramsBlocks.simple.classList.remove('hidden');
        state.totalTargetDist = parseFloat(simpleDistance.value)||500;
        state.interStep = 0;
        break;
      case 'tours':
        modeTitle.textContent = '⏲️ Minuteur & compteur de tours';
        paramsBlocks.tours.classList.remove('hidden');
        state.lapFixedDist = parseFloat(lapDistance.value)||200;
        break;
      case 'demiCooper':
        modeTitle.textContent = '⏱️ Demi‑Cooper (6 minutes)';
        paramsBlocks.demiCooper.classList.remove('hidden');
        state.fixedDuration = 6*60*1000;
        break;
      case 'cooper':
        modeTitle.textContent = '⏱️ Cooper (12 minutes)';
        paramsBlocks.cooper.classList.remove('hidden');
        state.fixedDuration = 12*60*1000;
        break;
    }
  }
  // Default mode
  selectMode('intervalles');

  ivlApply?.addEventListener('click', () => {
    state.totalTargetDist = parseFloat(ivlDistance.value)||800;
    state.interStep = parseFloat(ivlStep.value)||200;
  });
  simpleDistance?.addEventListener('change', () => {
    state.totalTargetDist = parseFloat(simpleDistance.value)||500;
  });
  lapDistance?.addEventListener('change', () => {
    state.lapFixedDist = parseFloat(lapDistance.value)||200;
  });

  // Core chrono
  function start(){
    if(state.running) { // pause
      state.running = false;
      state.elapsed = now() - state.startTime + state.elapsed;
      cancelAnimationFrame(state.raf);
      btnStart.textContent = 'Reprendre';
      btnLap.disabled = true;
      btnReset.disabled = false;
      return;
    }
    // start or resume
    state.running = true;
    state.startTime = now();
    state.lastLapAt = state.lastLapAt || state.startTime;
    btnStart.textContent = 'Pause';
    btnLap.disabled = false;
    btnReset.disabled = false;
    tableWrap.classList.remove('hidden');
    tick();
  }

  function resetCore(soft=false){
    state.running = false;
    cancelAnimationFrame(state.raf);
    state.startTime = 0;
    state.elapsed = 0;
    state.lastLapAt = 0;
    state.laps = [];
    state.cumDist = 0;
    display.textContent = '00:00.0';
    btnStart.textContent = 'Démarrer';
    btnLap.disabled = true;
    if(!soft){
      tableWrap.classList.add('hidden');
      results.classList.add('hidden');
    }
  }

  function now(){ return performance.now(); }

  function tick(){
    const t = state.elapsed + (now() - state.startTime);
    display.textContent = fmt(t);

    // Auto-stop for fixed durations
    if((state.mode==='demiCooper' || state.mode==='cooper') && t >= state.fixedDuration){
      finish();
      return;
    }

    state.raf = requestAnimationFrame(tick);
  }

  function addRow({idx, lapMs, cumMs, lapDist, cumDist, lapSpeed, avgSpeed}){
    const tr = document.createElement('tr');
    const cells = [
      idx,
      lapDist>0 ? Math.round(lapDist) : '—',
      fmt(lapMs),
      lapDist>0 ? lapSpeed.toFixed(2) : '—',
      fmt(cumMs),
      Math.round(cumDist),
      avgSpeed.toFixed(2),
    ];
    cells.forEach(c => {
      const td = document.createElement('td');
      td.textContent = c;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }

  function clearTable(){
    tbody.innerHTML='';
    rowTotal.classList.add('hidden');
    totalTime.textContent='—';
    totalDist.textContent='—';
    totalSpeed.textContent='—';
  }

  function lap(){
    if(!state.running) return;

    const tNow = now();
    const cumMs = state.elapsed + (tNow - state.startTime);
    const lapMs = tNow - state.lastLapAt;
    state.lastLapAt = tNow;

    let lapDist = 0;
    if(state.mode==='intervalles'){
      // On ajoute une distance de "interStep" par tour, jusqu'à atteindre la distance cible
      if(state.cumDist >= state.totalTargetDist) return; // déjà fini
      lapDist = Math.min(state.interStep, state.totalTargetDist - state.cumDist);
      state.cumDist += lapDist;
    } else if(state.mode==='tours'){
      lapDist = state.lapFixedDist;
      state.cumDist += lapDist;
    } else {
      // modes simple / demiCooper / cooper : tour = marqueur sans distance fixe
      lapDist = 0;
    }

    const lapSpeed = lapDist>0 ? kmh(lapDist, lapMs) : 0;
    const avgSpeed = kmh(state.cumDist, cumMs);

    const entry = {
      idx: state.laps.length+1,
      lapMs, cumMs, lapDist, cumDist: state.cumDist,
      lapSpeed, avgSpeed
    };
    state.laps.push(entry);
    addRow(entry);

    // Afficher total si arrivés à l'objectif en mode intervalles/simple
    if(state.mode==='intervalles' && state.cumDist>=state.totalTargetDist){
      finish();
    }
  }

  function finish(){
    if(state.running){
      // on fige
      state.elapsed = state.elapsed + (now() - state.startTime);
      state.running = false;
      cancelAnimationFrame(state.raf);
    }
    btnLap.disabled = true;
    btnStart.textContent = 'Démarrer';

    // Pour modes à distance fixe (intervalles/simple), forcer la distance totale.
    let totalMeters = state.cumDist;
    if(state.mode==='simple'){
      totalMeters = parseFloat(document.getElementById('simple-distance').value)||0;
    } else if(state.mode==='intervalles'){
      totalMeters = parseFloat(document.getElementById('ivl-distance').value)||0;
    } // tours/demi/cooper: totalMeters = cumDist

    const totalMs = state.elapsed;
    const vAvg = kmh(totalMeters, totalMs);

    rowTotal.classList.remove('hidden');
    totalTime.textContent = fmt(totalMs);
    totalDist.textContent = Math.round(totalMeters).toString();
    totalSpeed.textContent = vAvg.toFixed(2);

    results.classList.remove('hidden');

    // Préparer QR JSON compatible ScanProf
    const nom = $('#nom').value.trim();
    const prenom = $('#prenom').value.trim();
    const classe = $('#classe').value.trim();
    const sexe = $('#sexe').value;

    const payload = [{
      nom, prenom, classe, sexe,
      distance: Math.round(totalMeters),
      vitesse: +vAvg.toFixed(2),
      vma: +vAvg.toFixed(2) // estimation = vitesse moyenne
    }];

    const pretty = JSON.stringify(payload, null, 2);
    jsonPreview.textContent = pretty;

    // Générer QR
    qrcodeBox.innerHTML = '';
    try{
      new QRCode(qrcodeBox, {
        text: JSON.stringify(payload),
        width: 180,
        height: 180,
        correctLevel: QRCode.CorrectLevel.M
      });
    }catch(e){
      const err = document.createElement('div');
      err.textContent = 'Erreur génération QR: ' + e.message;
      qrcodeBox.appendChild(err);
    }
  }

  // Buttons
  btnStart.addEventListener('click', start);
  btnLap.addEventListener('click', lap);
  btnReset.addEventListener('click', () => resetCore(false));
  $('#btn-reset-all').addEventListener('click', () => {
    resetCore(false);
    clearTable();
    results.classList.add('hidden');
  });

  // Export CSV
  $('#btn-export-csv').addEventListener('click', () => {
    const nom = $('#nom').value.trim();
    const prenom = $('#prenom').value.trim();
    const classe = $('#classe').value.trim();
    const sexe = $('#sexe').value;

    // construire lignes: une par tour + total
    const lines = [];
    lines.push(['nom','prenom','classe','sexe','lap_index','lap_dist_m','lap_time','lap_speed_kmh','cum_time','cum_dist_m','avg_speed_kmh']);
    state.laps.forEach(l => {
      lines.push([nom, prenom, classe, sexe, l.idx, l.lapDist||'', fmt(l.lapMs), l.lapDist?l.lapSpeed.toFixed(2):'', fmt(l.cumMs), Math.round(l.cumDist), l.avgSpeed.toFixed(2)]);
    });
    // Total
    const tDist = totalDist.textContent==='—' ? Math.round(state.cumDist) : parseInt(totalDist.textContent,10);
    const tSpeed = totalSpeed.textContent==='—' ? kmh(state.cumDist, state.elapsed).toFixed(2) : totalSpeed.textContent;
    const tTime = totalTime.textContent==='—' ? fmt(state.elapsed) : totalTime.textContent;
    lines.push([nom, prenom, classe, sexe, 'TOTAL', '', '', '', tTime, tDist, tSpeed]);

    const csv = lines.map(r=>r.map(x=>`"${String(x).replaceAll('"','""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronovitesse_${nom}_${prenom}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

})();