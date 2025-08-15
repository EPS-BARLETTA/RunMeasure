// RunMeasure — modes.js (LAST BUILD)
// - Fix QR for "Temps intermédiaire" + "Demi Cooper" + "Cooper"
// - JSON plat (sans millisecondes), alias de clés pour compatibilité ScanProf
// - Charge qrcodejs si absent (aucune modif HTML)
// - Cache "version" sur la page de saisie via injection CSS (pas de modif style.css)
// - Export CSV conservé
(() => {
  const $ = (s, root=document) => root.querySelector(s);

  // ===== CSS injection : cacher l'affichage de version =====
  (function injectVersionHideCSS(){
    const css = `#version, .version, [data-version], .app-version { display:none !important; }`;
    const st = document.createElement('style');
    st.setAttribute('data-runmeasure-patch','hide-version');
    st.appendChild(document.createTextNode(css));
    document.head.appendChild(st);
  })();

  // ===== Formats =====
  const fmt = (ms) => { // MM:SS.d (affichage live)
    const t=Math.max(0,Math.round(ms/100));
    const m=Math.floor(t/600), s=Math.floor((t%600)/10), d=t%10;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${d}`;
  };
  const fmtMMSS = (ms) => { const tot=Math.max(0,Math.round(ms/1000)); const m=Math.floor(tot/60); const s=tot%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; };
  const fmtHMS = (ms) => { const tot=Math.max(0,Math.round(ms/1000)); const h=Math.floor(tot/3600); const m=Math.floor((tot%3600)/60); const s=tot%60; const pad=n=>String(n).padStart(2,'0'); return (h>0)?`${h}:${pad(m)}:${pad(s)}`:`${m}:${pad(s)}`; };
  const kmh = (meters, ms) => (ms>0 ? +((meters/(ms/1000))*3.6).toFixed(2) : 0);

  // ===== QR lib loader =====
  function ensureQRCodeLib(){
    return new Promise((resolve)=>{
      if (window.QRCode) return resolve(true);
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      s.onload=()=>resolve(true);
      s.onerror=()=>{ console.warn('[RunMeasure] QRCode lib failed to load'); resolve(false); };
      document.head.appendChild(s);
    });
  }

  // ===== State & DOM =====
  const getMode = () => new URLSearchParams(location.search).get('mode') || 'intervalles';
  const student = () => { try { return JSON.parse(localStorage.getItem('rm_student')||'{}'); } catch(e){ return {}; } };
  function identity(){ const s=student(); return { nom:s.nom||'', prenom:s.prenom||'', classe:s.classe||'', sexe:s.sexe||'' }; }
  function mmssToMsStr(mm, ss){ const m=Math.max(0,parseInt(mm||'0',10)); const s=Math.max(0,parseInt(ss||'0',10)); return (m*60 + s)*1000; }
  const now = () => performance.now();
  async function tryFullscreen(){ try{ if(!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); }catch(e){} }

  const state = {
    mode:getMode(), running:false, startTime:0, elapsed:0, lastLapAt:0, raf:0,
    laps:[], cumDist:0, targetDist:0, splitDist:0, lapDist:0,
    countdownMs:0, fixedDuration:0, ringTotal:0, fractionAdded:0
  };

  const modeName=$('#mode-name'), params=$('#params'), display=$('#display'),
        btnStart=$('#btn-start'), btnLap=$('#btn-lap'), btnStop=$('#btn-stop'), btnReset=$('#btn-reset'),
        tableWrap=$('#table-wrap'), tbody=$('#laps-table tbody'),
        results=$('#results'), qrcodeBoxInit=$('#qrcode'), totalTime=$('#total-time'), totalSpeed=$('#total-speed'),
        totalDistanceCell=$('#total-distance'), rowTotal=$('#row-total'),
        circleWrap=$('#circle-wrap'), liveDistance=$('#live-distance'), liveDistVal=$('#live-dist-val'),
        fractionTools=$('#fraction-tools'), recap=$('#recap'), recapBody=$('#recap-body');

  // ===== Build UI per mode =====
  function renderParams(){
    if (params) params.innerHTML='';
    circleWrap?.classList.add('hidden'); display?.classList.remove('hidden'); liveDistance?.classList.add('hidden');
    fractionTools?.classList.add('hidden'); state.fractionAdded=0;
    btnLap?.classList.remove('hidden'); btnStop?.classList.add('hidden'); tableWrap?.classList.remove('hidden');

    switch(state.mode){
      case 'intervalles':
        if (modeName) modeName.textContent='Temps intermédiaire';
        if (params) params.innerHTML = `
          <label>Distance cible (m)<input type="number" id="p-target" min="100" step="50" value="800"/></label>
          <label>Intervalle (m)<input type="number" id="p-step" min="25" step="25" value="200"/></label>
          <div class="info">Appuie sur « Tour ». À la fin : QR <strong>unique</strong> avec <em>temps cumulés</em> (sans millisecondes).</div>`;
        state.targetDist=800; state.splitDist=200; break;

      case 'simple':
        if (modeName) modeName.textContent='Chrono';
        if (params) params.innerHTML = `<div class="info">Chrono simple. Pas de tours. <strong>Pas de QR.</strong></div>`;
        btnLap?.classList.add('hidden'); btnStop?.classList.remove('hidden'); tableWrap?.classList.add('hidden'); display?.classList.add('display-huge');
        break;

      case 'simpleDistance':
        if (modeName) modeName.textContent='Chrono avec calcul de vitesse';
        if (params) params.innerHTML=`<label>Distance (m)<input type="number" id="p-target" min="25" step="25" value="100"/></label><div class="info">Lance puis « Stop » à l'arrivée. Récap + QR.</div>`;
        state.targetDist=100; btnLap?.classList.add('hidden'); btnStop?.classList.remove('hidden'); tableWrap?.classList.add('hidden');
        break;

      case 'tours':
        if (modeName) modeName.textContent='Minuteur avec distance';
        if (params){
          params.appendChild(buildMinuteSecondSelectors());
          params.insertAdjacentHTML('beforeend', `<label>Distance par tour (m)<input type="number" id="p-lapdist" min="25" step="25" value="100"/></label><div class="info">Décompte + « Tour ». Tableau : <em>Temps cumulé</em>, <em>Temps tour</em>, <em>Vitesse</em>, <em>Distance cumulée</em>.</div>`);
        }
        state.countdownMs=mmssToMsStr(5,0); state.ringTotal=state.countdownMs; state.lapDist=100;
        circleWrap?.classList.remove('hidden'); circleWrap?.classList.add('huge'); display?.classList.add('hidden'); liveDistance?.classList.remove('hidden');
        updateRing(state.countdownMs, state.ringTotal);
        break;

      case 'demiCooper':
      case 'cooper':
        if (modeName) modeName.textContent = (state.mode==='demiCooper')?'Demi Cooper (6′)':'Cooper (12′)';
        if (params) params.innerHTML = `<label>Distance par tour (m)<input type="number" id="p-lapdist" min="25" step="25" value="100"/></label><div class="info">Durée fixe ${(state.mode==='demiCooper')? '6:00' : '12:00'}. Tableau identique. Fractions mises à jour partout.</div>`;
        state.fixedDuration = (state.mode==='demiCooper')? 6*60*1000 : 12*60*1000; state.ringTotal=state.fixedDuration; state.lapDist=100;
        circleWrap?.classList.remove('hidden'); display?.classList.add('hidden'); liveDistance?.classList.remove('hidden');
        updateRing(state.fixedDuration, state.ringTotal);
        break;

      case 'minuteurSimple':
        if (modeName) modeName.textContent='Minuteur';
        if (params){
          params.appendChild(buildMinuteSecondSelectors());
          params.insertAdjacentHTML('beforeend', `<div class="info">Compte à rebours simple. <strong>Pas de QR.</strong></div>`);
        }
        state.countdownMs=mmssToMsStr(5,0); state.ringTotal=state.countdownMs; circleWrap?.classList.remove('hidden'); circleWrap?.classList.add('huge'); display?.classList.add('hidden'); btnLap?.classList.add('hidden'); btnStop?.classList.remove('hidden'); tableWrap?.classList.add('hidden'); updateRing(state.countdownMs, state.ringTotal);
        break;
    }
    const t=$('#p-target'); if(t) t.addEventListener('change', ()=> state.targetDist=parseFloat(t.value)||0);
    const s=$('#p-step'); if(s) s.addEventListener('change', ()=> state.splitDist=parseFloat(s.value)||0);
    const l=$('#p-lapdist'); if(l) l.addEventListener('change', ()=> state.lapDist=parseFloat(l.value)||0);
    if (liveDistVal) liveDistVal.textContent = Math.round(state.cumDist + state.fractionAdded);
  }

  function buildMinuteSecondSelectors(){
    const wrap=document.createElement('div'); wrap.className='grid-3';
    const min=document.createElement('label'); min.innerHTML='Minutes<select id="sel-min"></select>'; const selMin=min.querySelector('select');
    for(let i=0;i<=120;i++){ const o=document.createElement('option'); o.value=i; o.textContent=String(i).padStart(2,'0'); if(i===5) o.selected=true; selMin.appendChild(o); }
    const sec=document.createElement('label'); sec.innerHTML='Secondes<select id="sel-sec"></select>'; const selSec=sec.querySelector('select');
    for(let i=0;i<=59;i++){ const o=document.createElement('option'); o.value=i; o.textContent=String(i).padStart(2,'0'); selSec.appendChild(o); } selSec.value=0;
    const spacer=document.createElement('div'); spacer.innerHTML='&nbsp;';
    function onDur(){ const mm=parseInt(selMin.value,10), ss=parseInt(selSec.value,10); state.countdownMs=(mm*60+ss)*1000; state.ringTotal=state.countdownMs; updateRing(state.countdownMs,state.ringTotal); }
    selMin.addEventListener('change', onDur); selSec.addEventListener('change', onDur);
    wrap.appendChild(min); wrap.appendChild(sec); wrap.appendChild(spacer); return wrap;
  }

  // ===== Core chrono =====
  function updateRing(remaining,total){
    const C=339.292; const ratio=Math.max(0,Math.min(1,(total?remaining/total:0)));
    const off=C*(1-ratio); const fg=$('#circle-fg'); if(fg){ fg.style.strokeDasharray=C; fg.style.strokeDashoffset=off; }
    const txt=$('#circle-text'); if(txt) txt.textContent=fmtMMSS(remaining);
  }

  function clearTable(){
    if (tbody) tbody.innerHTML=''; rowTotal?.classList.add('hidden'); if (totalTime) totalTime.textContent='—'; if (totalSpeed) totalSpeed.textContent='—';
    if(totalDistanceCell) totalDistanceCell.textContent='—';
  }

  function start(){
    if(state.running){
      state.running=false; state.elapsed=now()-state.startTime+state.elapsed; cancelAnimationFrame(state.raf);
      if (btnStart) btnStart.textContent='Reprendre';
      if(!['minuteurSimple','simple','simpleDistance'].includes(state.mode)) if (btnLap) btnLap.disabled=true;
      if (btnStop) btnStop.disabled=false; if (btnReset) btnReset.disabled=false;
      return;
    }
    state.running=true; state.startTime=now(); state.lastLapAt=state.lastLapAt||state.startTime;
    if (btnStart) btnStart.textContent='Pause'; if (btnLap) btnLap.disabled=(['minuteurSimple','simple','simpleDistance'].includes(state.mode));
    if (btnStop) btnStop.disabled=false; if (btnReset) btnReset.disabled=false;
    if(!['simple','simpleDistance','minuteurSimple'].includes(state.mode)) tableWrap?.classList.remove('hidden');
    tryFullscreen(); tick();
  }

  function stop(){ if(!state.running && state.elapsed===0) return; finish(); }

  function tick(){
    const t=state.elapsed + (now()-state.startTime);
    if(['tours','minuteurSimple'].includes(state.mode)){
      const remain=Math.max(0,state.countdownMs-t); updateRing(remain,state.ringTotal); if(remain<=0){ finish(); return; }
    } else if(['demiCooper','cooper'].includes(state.mode)){
      const remain=Math.max(0,state.fixedDuration-t); updateRing(remain,state.ringTotal); if(remain<=0){ finish(); return; }
    } else {
      if (display) display.textContent=fmt(t);
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
      const next=(state.laps.length+1)*state.splitDist;
      if(next>state.targetDist) return;
      state.cumDist=next;
      addLapRow(cumMs,lapMs);
      if(state.cumDist>=state.targetDist) finish();
      return;
    } else if(['tours','demiCooper','cooper'].includes(state.mode)){
      state.cumDist += state.lapDist;
      if (liveDistVal) liveDistVal.textContent=Math.round(state.cumDist + state.fractionAdded);
    }
    addLapRow(cumMs,lapMs);
  }

  function addLapRow(cumMs,lapMs){
    const tr=document.createElement('tr'); const idx=state.laps.length+1;
    let lapDist=0; if(state.mode==='intervalles') lapDist=state.splitDist; if(['tours','demiCooper','cooper'].includes(state.mode)) lapDist=state.lapDist;
    const lapSpeed=lapDist? kmh(lapDist,lapMs):0; const cumMetersNow=Math.round(state.cumDist);
    tr.innerHTML=`<td>${idx}</td><td>${fmt(cumMs)}</td><td>${fmt(lapMs)}</td><td>${lapDist? lapSpeed.toFixed(2):'—'}</td><td>${(lapDist||state.mode==='intervalles')? cumMetersNow:'—'}</td>`;
    if (tbody) tbody.appendChild(tr); state.laps.push({idx,cumMs,lapMs,lapDist,lapSpeed,cumMeters:cumMetersNow});
  }

  function updateRecapTotals(){
    const totalMs=state.elapsed; let totalMeters=0;
    if(state.mode==='intervalles') totalMeters=state.targetDist;
    else if(['tours','demiCooper','cooper'].includes(state.mode)) totalMeters=state.cumDist + state.fractionAdded;
    else if(state.mode==='simpleDistance') totalMeters=state.targetDist;
    const vAvg=kmh(totalMeters,totalMs);
    if (totalTime) totalTime.textContent=fmt(totalMs); if (totalSpeed) totalSpeed.textContent=(vAvg? vAvg.toFixed(2):'—');
    if(totalDistanceCell) totalDistanceCell.textContent=(totalMeters? Math.round(totalMeters):'—');
    recap?.classList.add('hidden'); if (recapBody) recapBody.innerHTML='';
    const rows=[];
    if(state.mode==='simpleDistance'){
      rows.push(['Distance',`${Math.round(state.targetDist)} m`],['Temps',fmt(totalMs)],['Vitesse moyenne',`${kmh(state.targetDist,totalMs).toFixed(2)} km/h`]);
    }
    if(['tours','demiCooper','cooper'].includes(state.mode)){
      const d=Math.round(totalMeters);
      rows.push(['Temps',fmt(totalMs)],['Distance totale',`${d} m`],['Vitesse moyenne',`${kmh(d,totalMs).toFixed(2)} km/h`]);
      if(['demiCooper','cooper'].includes(state.mode)) rows.push(['VMA (moyenne)',`${kmh(d,totalMs).toFixed(2)} km/h`]);
    }
    if(rows.length && recap && recapBody){ recap.classList.remove('hidden'); recapBody.innerHTML=rows.map(([k,v])=>`<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`).join(''); }
  }

  function finish(){
    if(state.running){ state.elapsed=state.elapsed + (now()-state.startTime); state.running=false; cancelAnimationFrame(state.raf); }
    if(btnLap) btnLap.disabled=true; if(btnStart) btnStart.textContent='Démarrer'; if(btnStop) btnStop.disabled=true;
    results?.classList.remove('hidden'); rowTotal?.classList.remove('hidden');
    if(['tours','demiCooper','cooper'].includes(state.mode)){
      fractionTools?.classList.remove('hidden');
      document.querySelectorAll('#fraction-tools [data-frac]').forEach(btn=> btn.onclick=()=>applyFraction(parseFloat(btn.dataset.frac)));
      const undo=$('#btn-frac-undo'); if(undo) undo.onclick=undoFraction;
    }
    updateRecapTotals(); generateQR();
  }

  function applyFraction(frac){
    if(!['tours','demiCooper','cooper'].includes(state.mode)) return;
    state.fractionAdded = state.lapDist * frac;
    if (liveDistVal) liveDistVal.textContent = Math.round(state.cumDist + state.fractionAdded);
    updateRecapTotals(); generateQR();
  }
  function undoFraction(){
    if(!['tours','demiCooper','cooper'].includes(state.mode)) return;
    state.fractionAdded=0; if (liveDistVal) liveDistVal.textContent=Math.round(state.cumDist);
    updateRecapTotals(); generateQR();
  }

  // ===== QR Payloads plats (sans ms) =====
  function buildPayload(){
    const id=identity();
    const base = { nom:id.nom, prenom:id.prenom, classe:id.classe, sexe:id.sexe };

    if(state.mode==='intervalles'){
      // "Temps intermédiaire" + alias de clés
      const out = Object.assign({}, base, {
        test: "Temps intermédiaire",
        distance_cible_m: Math.round(state.targetDist||0),
        intervalle_m: Math.round(state.splitDist||0),
        pas_intermediaire_m: Math.round(state.splitDist||0) // alias
      });
      const totalLaps = Math.min(state.laps.length, Math.floor((state.targetDist||0)/(state.splitDist||1)));
      for (let i=0;i<totalLaps;i++){
        const dist = (i+1)*(state.splitDist||0);
        const val = fmtHMS(state.laps[i].cumMs);
        out[`tps_${dist}`] = val;   // ex: tps_200
        out[`tps${dist}`]  = val;   // ex: tps200 (alias)
      }
      if (totalLaps>0){
        const last = state.laps[totalLaps-1].cumMs;
        out.temps_total_s = Math.round(last/1000);
        out.temps_total_hms = fmtHMS(last);
      }
      return out;
    }

    if(state.mode==='simpleDistance'){
      const d = Math.round(state.targetDist||0);
      return Object.assign({}, base, {
        test: "Chrono + vitesse",
        distance_m: d,
        temps_total_s: Math.round(state.elapsed/1000),
        temps_total_hms: fmtHMS(state.elapsed),
        vitesse_kmh: +(kmh(d,state.elapsed).toFixed(2))
      });
    }

    if(state.mode==='tours'){
      const dist = Math.round(state.cumDist + state.fractionAdded);
      const v = +(kmh(dist,state.elapsed).toFixed(2));
      return Object.assign({}, base, {
        test: "Minuteur + distance",
        duree_minuteur_s: Math.round(state.elapsed/1000),
        duree_minuteur_hms: fmtHMS(state.elapsed),
        distance_realisee_m: dist,
        distance_m: dist,           // alias
        vitesse_kmh: v
      });
    }

    if(state.mode==='demiCooper' || state.mode==='cooper'){
      const isDemi = (state.mode==='demiCooper');
      const fixed = isDemi ? 6*60 : 12*60; // s
      const dist = Math.round(state.cumDist + state.fractionAdded);
      const v = +( ((dist/1000) / (fixed/3600)).toFixed(2) );
      return Object.assign({}, base, {
        test: isDemi ? "Demi Cooper" : "Cooper",
        duree_s: fixed,
        duree_hms: fmtHMS(fixed*1000),
        distance_realisee_m: dist,
        distance_m: dist,            // alias
        vitesse_moy_kmh: v,
        vma_kmh: v,                  // alias
        vma_estimee_kmh: v           // alias
      });
    }
    return null;
  }

  async function generateQR(){
    const p=buildPayload();
    if(!p) return;

    // Conteneur : existant (#qrcode) sinon création discrète
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
      const pre=document.createElement('pre'); pre.textContent = JSON.stringify(p);
      pre.style.maxWidth='250px'; pre.style.maxHeight='250px'; pre.style.overflow='auto'; pre.style.fontSize='10px';
      box.appendChild(pre);
      return;
    }
    new QRCode(box,{ text:JSON.stringify(p), width:250, height:250, correctLevel:QRCode.CorrectLevel.L });
  }

  // ===== CSV =====
  function csvExport(){
    const s=student(); const esc=v=>`\"${String(v).replace(/\"/g,'\"\"')}\"`; let lines=[];
    if(state.mode==='intervalles'){
      lines.push(['nom','prenom','classe','sexe','distance_cible_m','intervalle_m','index','distance_m','temps_cum','temps_interval']);
      state.laps.forEach((l,i)=>{ const dist=(i+1)*state.splitDist; lines.push([s.nom||'',s.prenom||'',s.classe||'',s.sexe||'', Math.round(state.targetDist||0), Math.round(state.splitDist||0), i+1, dist, fmtHMS(l.cumMs), fmtHMS(l.lapMs)]); });
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
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`runmeasure_${(s.nom||'')}_${(s.prenom||'')}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // ===== Wiring =====
  btnStart?.addEventListener('click', start);
  btnStop?.addEventListener('click', stop);
  btnLap?.addEventListener('click', lap);
  btnReset?.addEventListener('click', ()=>{
    state.running=false; cancelAnimationFrame(state.raf); state.startTime=0; state.elapsed=0; state.lastLapAt=0; state.laps=[]; state.cumDist=0; state.fractionAdded=0;
    if (display){ display.textContent='00:00.0'; display.classList.remove('display-huge'); }
    if(circleWrap && !circleWrap.classList.contains('hidden')){ if(state.ringTotal) updateRing(state.ringTotal, state.ringTotal);}
    if (btnStart) btnStart.textContent='Démarrer'; if(btnLap) btnLap.disabled=(['minuteurSimple','simple','simpleDistance'].includes(state.mode)); if(btnStop) btnStop.disabled=true;
    if(!['simple','simpleDistance','minuteurSimple'].includes(state.mode)) tableWrap?.classList.add('hidden');
    results?.classList.add('hidden'); if($('#qrcode')) $('#qrcode').innerHTML=''; if (liveDistVal) liveDistVal.textContent='0'; recap?.classList.add('hidden'); if(recapBody) recapBody.innerHTML=''; if(totalDistanceCell) totalDistanceCell.textContent='—'; clearTable();
  });
  $('#btn-new')?.addEventListener('click', ()=> location.reload());
  $('#btn-export-csv')?.addEventListener('click', csvExport);

  renderParams();
})();