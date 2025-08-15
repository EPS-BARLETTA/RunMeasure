// RunMeasure — modes.js (QR FIX FINAL)
// - QR JSON plat sans millisecondes pour tous les modes
// - Intermédiaires => test: "Tps intermédiaires", tps_XXX cumulés (H:MM:SS) + temps_total_*
// - Chrono + vitesse => test: "Chrono avec calcul de vitesse"
// - Minuteur + distance => test: "Minuteur avec distance"
// - Demi Cooper / Cooper => test: "Demi Cooper" / "Cooper", avec distance/vitesse/vma
// - Charge qrcodejs automatiquement si besoin
(() => {
  const $ = (s, root=document) => root.querySelector(s);

  // ---------- formats ----------
  const fmtTenths = (ms) => { // affichage live 00:00.0
    const t=Math.max(0,Math.round(ms/100));
    const m=Math.floor(t/600), s=Math.floor((t%600)/10), d=t%10;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${d}`;
  };
  const fmtMMSS = (ms) => { const tot=Math.max(0,Math.round(ms/1000)); const m=Math.floor(tot/60), s=tot%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; };
  const fmtHMS  = (ms) => { const tot=Math.max(0,Math.round(ms/1000)); const h=Math.floor(tot/3600), m=Math.floor((tot%3600)/60), s=tot%60; const pad=n=>String(n).padStart(2,'0'); return (h>0)?`${h}:${pad(m)}:${pad(s)}`:`${m}:${pad(s)}`; };
  const kmh     = (meters, ms) => (ms>0 ? +((meters/(ms/1000))*3.6).toFixed(2) : 0);

  // ---------- QR lib ----------
  function ensureQRCodeLib(){
    return new Promise((resolve)=>{
      if (window.QRCode) return resolve(true);
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      s.onload=()=>resolve(true);
      s.onerror=()=>{ console.warn('[RunMeasure] QRCode lib failed'); resolve(false); };
      document.head.appendChild(s);
    });
  }

  // ---------- état ----------
  const getMode = () => new URLSearchParams(location.search).get('mode') || 'intervalles';
  const student = () => { try { return JSON.parse(localStorage.getItem('rm_student')||'{}'); } catch(e){ return {}; } };
  const now = () => performance.now();

  const state = {
    mode:getMode(), running:false, startTime:0, elapsed:0, lastLapAt:0, raf:0,
    laps:[], cumDist:0, targetDist:0, splitDist:0, lapDist:0,
    countdownMs:0, fixedDuration:0, ringTotal:0, fractionAdded:0
  };

  // ---------- DOM (ids utilisés par tes pages V8.x) ----------
  const modeName=$('#mode-name'), params=$('#params'), display=$('#display'),
        btnStart=$('#btn-start'), btnLap=$('#btn-lap'), btnStop=$('#btn-stop'), btnReset=$('#btn-reset'),
        tableWrap=$('#table-wrap'), tbody=$('#laps-table tbody'),
        results=$('#results'), qrcodeBoxInit=$('#qrcode'), totalTime=$('#total-time'), totalSpeed=$('#total-speed'),
        totalDistanceCell=$('#total-distance'), rowTotal=$('#row-total'),
        circleWrap=$('#circle-wrap'), liveDistance=$('#live-distance'), liveDistVal=$('#live-dist-val'),
        fractionTools=$('#fraction-tools'), recap=$('#recap'), recapBody=$('#recap-body');

  // petits utilitaires
  const mmssToMs = (mm, ss) => (Math.max(0,parseInt(mm||'0',10))*60 + Math.max(0,parseInt(ss||'0',10)))*1000;

  // ---------- rendu paramètres selon le mode ----------
  function renderParams(){
    if (params) params.innerHTML='';
    circleWrap?.classList.add('hidden'); display?.classList.remove('hidden'); liveDistance?.classList.add('hidden');
    fractionTools?.classList.add('hidden'); state.fractionAdded=0;
    btnLap?.classList.remove('hidden'); btnStop?.classList.add('hidden'); tableWrap?.classList.remove('hidden');

    switch(state.mode){
      case 'intervalles': {
        modeName && (modeName.textContent='Temps intermédiaire');
        params && (params.innerHTML = `
          <label>Distance cible (m)<input type="number" id="p-target" min="100" step="50" value="800"/></label>
          <label>Intervalle (m)<input type="number" id="p-step" min="25" step="25" value="200"/></label>
          <div class="info">Appuie sur « Tour ». À la fin : QR unique avec <em>temps cumulés</em> (sans millisecondes).</div>`);
        state.targetDist=800; state.splitDist=200;
        break;
      }
      case 'simple': {
        modeName && (modeName.textContent='Chrono');
        params && (params.innerHTML = `<div class="info">Chrono simple. Pas de tours. <strong>Pas de QR.</strong></div>`);
        btnLap?.classList.add('hidden'); btnStop?.classList.remove('hidden'); tableWrap?.classList.add('hidden'); display?.classList.add('display-huge');
        break;
      }
      case 'simpleDistance': {
        modeName && (modeName.textContent='Chrono avec calcul de vitesse');
        params && (params.innerHTML=`<label>Distance (m)<input type="number" id="p-target" min="25" step="25" value="100"/></label><div class="info">Lance puis « Stop » à l'arrivée. Récap + QR.</div>`);
        state.targetDist=100; btnLap?.classList.add('hidden'); btnStop?.classList.remove('hidden'); tableWrap?.classList.add('hidden');
        break;
      }
      case 'tours': {
        modeName && (modeName.textContent='Minuteur avec distance');
        if (params){
          params.innerHTML = `
            <label>Minutes<input id="sel-min" type="number" min="0" max="120" value="5"/></label>
            <label>Secondes<input id="sel-sec" type="number" min="0" max="59" value="0"/></label>
            <label>Distance par tour (m)<input type="number" id="p-lapdist" min="25" step="25" value="100"/></label>
            <div class="info">Décompte + « Tour ». Tableau : <em>Temps cumulé</em>, <em>Temps tour</em>, <em>Vitesse</em>, <em>Distance cumulée</em>.</div>`;
          const m=$('#sel-min'), s=$('#sel-sec'); const onDur=()=>{ state.countdownMs=mmssToMs(m.value,s.value); state.ringTotal=state.countdownMs; };
          m?.addEventListener('input', onDur); s?.addEventListener('input', onDur);
          onDur();
        }
        state.lapDist=100;
        circleWrap?.classList.remove('hidden'); circleWrap?.classList.add('huge'); display?.classList.add('hidden'); liveDistance?.classList.remove('hidden');
        break;
      }
      case 'demiCooper':
      case 'cooper': {
        modeName && (modeName.textContent = (state.mode==='demiCooper')?'Demi Cooper (6′)':'Cooper (12′)');
        params && (params.innerHTML = `<label>Distance par tour (m)<input type="number" id="p-lapdist" min="25" step="25" value="100"/></label><div class="info">Durée fixe ${(state.mode==='demiCooper')? '6:00' : '12:00'}. Tableau identique. Fractions mises à jour partout.</div>`);
        state.fixedDuration = (state.mode==='demiCooper')? 6*60*1000 : 12*60*1000; state.ringTotal=state.fixedDuration; state.lapDist=100;
        circleWrap?.classList.remove('hidden'); display?.classList.add('hidden'); liveDistance?.classList.remove('hidden');
        break;
      }
      case 'minuteurSimple': {
        modeName && (modeName.textContent='Minuteur');
        if (params){
          params.innerHTML = `
            <label>Minutes<input id="sel-min" type="number" min="0" max="120" value="5"/></label>
            <label>Secondes<input id="sel-sec" type="number" min="0" max="59" value="0"/></label>
            <div class="info">Compte à rebours simple. <strong>Pas de QR.</strong></div>`;
          const m=$('#sel-min'), s=$('#sel-sec'); const onDur=()=>{ state.countdownMs=mmssToMs(m.value,s.value); state.ringTotal=state.countdownMs; };
          m?.addEventListener('input', onDur); s?.addEventListener('input', onDur);
          onDur();
        }
        circleWrap?.classList.remove('hidden'); circleWrap?.classList.add('huge'); display?.classList.add('hidden'); btnLap?.classList.add('hidden'); btnStop?.classList.remove('hidden'); tableWrap?.classList.add('hidden');
        break;
      }
    }
    $('#p-target')?.addEventListener('change', e=> state.targetDist=parseFloat(e.target.value)||0);
    $('#p-step')?.addEventListener('change',   e=> state.splitDist=parseFloat(e.target.value)||0);
    $('#p-lapdist')?.addEventListener('change',e=> state.lapDist=parseFloat(e.target.value)||0);
    liveDistVal && (liveDistVal.textContent = Math.round(state.cumDist + state.fractionAdded));
  }

  // ---------- coeur chrono ----------
  function clearTable(){
    if (tbody) tbody.innerHTML=''; rowTotal?.classList.add('hidden'); totalTime && (totalTime.textContent='—'); totalSpeed && (totalSpeed.textContent='—');
    totalDistanceCell && (totalDistanceCell.textContent='—');
  }
  function start(){
    if(state.running){
      state.running=false; state.elapsed=now()-state.startTime+state.elapsed; cancelAnimationFrame(state.raf);
      btnStart && (btnStart.textContent='Reprendre'); if(!['minuteurSimple','simple','simpleDistance'].includes(state.mode)) btnLap && (btnLap.disabled=true);
      btnStop && (btnStop.disabled=false); btnReset && (btnReset.disabled=false); return;
    }
    state.running=true; state.startTime=now(); state.lastLapAt=state.lastLapAt||state.startTime;
    btnStart && (btnStart.textContent='Pause'); btnLap && (btnLap.disabled=(['minuteurSimple','simple','simpleDistance'].includes(state.mode)));
    btnStop && (btnStop.disabled=false); btnReset && (btnReset.disabled=false);
    !['simple','simpleDistance','minuteurSimple'].includes(state.mode) && tableWrap?.classList.remove('hidden');
    tick();
  }
  function stop(){ if(!state.running && state.elapsed===0) return; finish(); }
  function tick(){
    const t=state.elapsed + (now()-state.startTime);
    if(['tours','minuteurSimple'].includes(state.mode)){
      const remain=Math.max(0,state.countdownMs-t);
      if ($('#circle-text')) $('#circle-text').textContent = fmtMMSS(remain);
      if(remain<=0){ finish(); return; }
    } else if(['demiCooper','cooper'].includes(state.mode)){
      const remain=Math.max(0,state.fixedDuration-t);
      if ($('#circle-text')) $('#circle-text').textContent = fmtMMSS(remain);
      if(remain<=0){ finish(); return; }
    } else {
      display && (display.textContent=fmtTenths(t));
    }
    state.raf=requestAnimationFrame(tick);
  }
  function lap(){
    if(!state.running) return;
    if(['simple','simpleDistance','minuteurSimple'].includes(state.mode)) return;
    const tNow=now();
    const cumMs=state.elapsed+(tNow-state.startTime);
    const lapMs=tNow-state.lastLapAt;
    state.lastLapAt=tNow;
    if(state.mode==='intervalles'){
      const next=(state.laps.length+1)*(state.splitDist||0);
      if(next>(state.targetDist||0)) return;
      state.cumDist=next;
      addLapRow(cumMs,lapMs);
      if(state.cumDist>=(state.targetDist||0)) finish();
      return;
    } else if(['tours','demiCooper','cooper'].includes(state.mode)){
      state.cumDist += (state.lapDist||0);
      liveDistVal && (liveDistVal.textContent=Math.round(state.cumDist + state.fractionAdded));
    }
    addLapRow(cumMs,lapMs);
  }
  function addLapRow(cumMs,lapMs){
    const tr=document.createElement('tr'); const idx=state.laps.length+1;
    let lapDist=0; if(state.mode==='intervalles') lapDist=state.splitDist||0; if(['tours','demiCooper','cooper'].includes(state.mode)) lapDist=state.lapDist||0;
    const lapSpeed=lapDist? kmh(lapDist,lapMs):0; const cumMetersNow=Math.round(state.cumDist);
    tr.innerHTML=`<td>${idx}</td><td>${fmtTenths(cumMs)}</td><td>${fmtTenths(lapMs)}</td><td>${lapDist? lapSpeed.toFixed(2):'—'}</td><td>${(lapDist||state.mode==='intervalles')? cumMetersNow:'—'}</td>`;
    tbody && tbody.appendChild(tr); state.laps.push({idx,cumMs,lapMs,lapDist,lapSpeed,cumMeters:cumMetersNow});
  }
  function updateRecap(){
    const totalMs=state.elapsed; let totalMeters=0;
    if(state.mode==='intervalles') totalMeters=state.targetDist||0;
    else if(['tours','demiCooper','cooper'].includes(state.mode)) totalMeters=state.cumDist + state.fractionAdded;
    else if(state.mode==='simpleDistance') totalMeters=state.targetDist||0;
    const vAvg=kmh(totalMeters,totalMs);
    totalTime && (totalTime.textContent=fmtTenths(totalMs)); totalSpeed && (totalSpeed.textContent=(vAvg? vAvg.toFixed(2):'—'));
    totalDistanceCell && (totalDistanceCell.textContent=(totalMeters? Math.round(totalMeters):'—'));
  }
  function applyFraction(frac){
    if(!['tours','demiCooper','cooper'].includes(state.mode)) return;
    state.fractionAdded = (state.lapDist||0) * frac;
    liveDistVal && (liveDistVal.textContent = Math.round(state.cumDist + state.fractionAdded));
    updateRecap(); generateQR(); // met à jour le QR quand on ajoute une fraction
  }
  function undoFraction(){ if(!['tours','demiCooper','cooper'].includes(state.mode)) return; state.fractionAdded=0; liveDistVal && (liveDistVal.textContent=Math.round(state.cumDist)); updateRecap(); generateQR(); }

  function finish(){
    if(state.running){ state.elapsed=state.elapsed + (now()-state.startTime); state.running=false; cancelAnimationFrame(state.raf); }
    btnLap && (btnLap.disabled=true); btnStart && (btnStart.textContent='Démarrer'); btnStop && (btnStop.disabled=true);
    results?.classList.remove('hidden'); rowTotal?.classList.remove('hidden');
    if(['tours','demiCooper','cooper'].includes(state.mode)){
      fractionTools?.classList.remove('hidden');
      document.querySelectorAll('#fraction-tools [data-frac]').forEach(btn=> btn.onclick=()=>applyFraction(parseFloat(btn.dataset.frac)));
      $('#btn-frac-undo')?.addEventListener('click', undoFraction);
    }
    updateRecap(); generateQR();
  }

  // ---------- QR ----------
  function identity(){ const s=student(); return { nom:s.nom||'', prenom:s.prenom||'', classe:s.classe||'', sexe:s.sexe||'' }; }

  function buildPayload(){
    const id=identity();
    // Intermédiaires
    if(state.mode==='intervalles'){
      const out = { nom:id.nom, prenom:id.prenom, classe:id.classe, sexe:id.sexe,
        test:"Tps intermédiaires",
        distance_cible_m: Math.round(state.targetDist||0),
        intervalle_m: Math.round(state.splitDist||0)
      };
      const totalLaps = Math.min(state.laps.length, Math.floor((state.targetDist||0)/Math.max(1,(state.splitDist||1))));
      for (let i=0;i<totalLaps;i++){
        const dist = (i+1)*(state.splitDist||0);
        out[`tps_${dist}`] = fmtHMS(state.laps[i].cumMs); // cumulés, sans ms
      }
      if (totalLaps>0){
        const last = state.laps[totalLaps-1].cumMs;
        out.temps_total_s = Math.round(last/1000);
        out.temps_total_hms = fmtHMS(last);
      }
      return out;
    }
    // Chrono + vitesse
    if(state.mode==='simpleDistance'){
      const d = Math.round(state.targetDist||0);
      return { nom:id.nom, prenom:id.prenom, classe:id.classe, sexe:id.sexe,
        test:"Chrono avec calcul de vitesse",
        distance_m:d,
        temps_total_s: Math.round(state.elapsed/1000),
        temps_total_hms: fmtHMS(state.elapsed),
        vitesse_kmh: +(kmh(d,state.elapsed).toFixed(2))
      };
    }
    // Minuteur + distance
    if(state.mode==='tours'){
      const dist = Math.round(state.cumDist + state.fractionAdded);
      const v = +(kmh(dist,state.elapsed).toFixed(2));
      return { nom:id.nom, prenom:id.prenom, classe:id.classe, sexe:id.sexe,
        test:"Minuteur avec distance",
        duree_minuteur_s: Math.round(state.elapsed/1000),
        duree_minuteur_hms: fmtHMS(state.elapsed),
        distance_realisee_m: dist,
        vitesse_kmh: v
      };
    }
    // (Demi) Cooper
    if(state.mode==='demiCooper' || state.mode==='cooper'){
      const isDemi = (state.mode==='demiCooper');
      const fixed = isDemi ? 6*60 : 12*60; // s
      const dist = Math.round(state.cumDist + state.fractionAdded);
      const v = +( ((dist/1000) / (fixed/3600)).toFixed(2) );
      return { nom:id.nom, prenom:id.prenom, classe:id.classe, sexe:id.sexe,
        test: isDemi ? "Demi Cooper" : "Cooper",
        duree_s: fixed,
        duree_hms: fmtHMS(fixed*1000),
        distance_realisee_m: dist,
        vitesse_moy_kmh: v,
        vma_kmh: v
      };
    }
    return null;
  }

  async function generateQR(){
    const payload = buildPayload();
    if(!payload) return;

    // crée un conteneur si absent
    let box = qrcodeBoxInit || $('#qrcode');
    if (!box){
      box = document.createElement('div');
      box.id = 'qrcode';
      box.style.position='fixed'; box.style.right='12px'; box.style.bottom='12px';
      box.style.padding='8px'; box.style.background='rgba(255,255,255,0.96)'; box.style.border='1px solid #e5e5e5'; box.style.borderRadius='10px'; box.style.zIndex='9999';
      const title=document.createElement('div'); title.textContent='QR résultat'; title.style.fontSize='12px'; title.style.margin='0 0 6px 0'; title.style.color='#333';
      box.appendChild(title);
      document.body.appendChild(box);
    } else {
      box.innerHTML='';
    }

    const ok = await ensureQRCodeLib();
    if (!ok){
      const pre=document.createElement('pre'); pre.textContent = JSON.stringify(payload);
      pre.style.maxWidth='250px'; pre.style.maxHeight='250px'; pre.style.overflow='auto'; pre.style.fontSize='10px';
      box.appendChild(pre);
      return;
    }
    new QRCode(box,{ text:JSON.stringify(payload), width:250, height:250, correctLevel:QRCode.CorrectLevel.L });
  }

  // ---------- export CSV (inchangé dans l’esprit) ----------
  function csvExport(){
    const s=student(); const esc=v=>`\"${String(v).replace(/\"/g,'\"\"')}\"`; let lines=[];
    if(state.mode==='intervalles'){
      lines.push(['nom','prenom','classe','sexe','distance_cible_m','intervalle_m','index','distance_m','temps_cum','temps_interval']);
      state.laps.forEach((l,i)=>{ const dist=(i+1)*(state.splitDist||0); lines.push([s.nom||'',s.prenom||'',s.classe||'',s.sexe||'', Math.round(state.targetDist||0), Math.round(state.splitDist||0), i+1, dist, fmtHMS(l.cumMs), fmtHMS(l.lapMs)]); });
    } else if(state.mode==='simpleDistance'){
      const head=['nom','prenom','classe','sexe','distance_m','temps_hms','temps_s','vitesse_kmh'];
      const row=[s.nom||'',s.prenom||'',s.classe||'',s.sexe||'', Math.round(state.targetDist||0), fmtHMS(state.elapsed), Math.round(state.elapsed/1000), ((kmh(state.targetDist,state.elapsed))||0).toFixed(2)];
      lines.push(head); lines.push(row);
    } else if(['tours','demiCooper','cooper'].includes(state.mode)){
      lines.push(['nom','prenom','classe','sexe','lap_index','t_cum_hms','t_lap_hms','v_lap_kmh','dist_cum_m']);
      state.laps.forEach(l=>{ const v=l.lapDist? kmh(l.lapDist,l.lapMs).toFixed(2):''; lines.push([s.nom||'',s.prenom||'',s.classe||'',s.sexe||'', l.idx, fmtHMS(l.cumMs), fmtHMS(l.lapMs), v, (l.cumMeters||'')]); });
      lines.push([]);
      const totalMeters=Math.round(state.cumDist + state.fractionAdded);
      const vavg=kmh(totalMeters,state.elapsed).toFixed(2);
      const headRecap=['nom','prenom','classe','sexe','distance_totale_m','temps_total_hms','temps_total_s','vitesse_moyenne_kmh'];
      const rowRecap=[s.nom||'',s.prenom||'',s.classe||'',s.sexe||'', totalMeters, fmtHMS(state.elapsed), Math.round(state.elapsed/1000), vavg];
      if(['demiCooper','cooper'].includes(state.mode)){ headRecap.push('vma_kmh'); rowRecap.push(vavg); }
      lines.push(headRecap); lines.push(rowRecap);
    } else { lines.push(['info']); lines.push(['Pas de données exportables pour ce mode.']); }
    const csv = lines.map(r=>r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`runmeasure_${(s.nom||'')}_${(s.prenom||'')}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // ---------- reset & events ----------
  function resetAll(){
    state.running=false; cancelAnimationFrame(state.raf); state.startTime=0; state.elapsed=0; state.lastLapAt=0; state.laps=[]; state.cumDist=0; state.fractionAdded=0;
    display && (display.textContent='00:00.0'); display && display.classList.remove('display-huge');
    btnStart && (btnStart.textContent='Démarrer'); btnLap && (btnLap.disabled=(['minuteurSimple','simple','simpleDistance'].includes(state.mode))); btnStop && (btnStop.disabled=true);
    !['simple','simpleDistance','minuteurSimple'].includes(state.mode) && tableWrap?.classList.add('hidden');
    results?.classList.add('hidden'); $('#qrcode') && ($('#qrcode').innerHTML=''); liveDistVal && (liveDistVal.textContent='0'); recap?.classList.add('hidden'); recapBody && (recapBody.innerHTML=''); totalDistanceCell && (totalDistanceCell.textContent='—'); clearTable();
  }

  btnStart?.addEventListener('click', start);
  btnStop?.addEventListener('click', stop);
  btnLap?.addEventListener('click', lap);
  btnReset?.addEventListener('click', resetAll);
  $('#btn-export-csv')?.addEventListener('click', csvExport);
  $('#btn-new')?.addEventListener('click', ()=> location.reload());

  renderParams();
})();
