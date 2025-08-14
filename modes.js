// RunMeasure V8.1 — Intervalles QR: 'tc' uses MM:SS (pipe-separated), very compact
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

  const state = { mode:getMode(), running:false, startTime:0, elapsed:0, lastLapAt:0, laps:[], cumDist:0, targetDist:0, splitDist:0, lapDist:0, countdownMs:0, fixedDuration:0, ringTotal:0, fractionAdded:0 };

  const modeName=$('#mode-name'); const params=$('#params'); const display=$('#display'); const btnStart=$('#btn-start'); const btnLap=$('#btn-lap'); const btnStop=$('#btn-stop'); const btnReset=$('#btn-reset');
  const tableWrap=$('#table-wrap'); const tbody=$('#laps-table tbody'); const results=$('#results'); const qrcodeBox=$('#qrcode'); const totalTime=$('#total-time'); const totalSpeed=$('#total-speed'); const totalDistanceCell=$('#total-distance'); const rowTotal=$('#row-total');
  const circleWrap=$('#circle-wrap'); const liveDistance=$('#live-distance'); const liveDistVal=$('#live-dist-val'); const fractionTools=$('#fraction-tools'); const recap=$('#recap'); const recapBody=$('#recap-body');

  function mmssToMsStr(mm, ss){ const m=Math.max(0,parseInt(mm||'0',10)); const s=Math.max(0,parseInt(ss||'0',10)); return (m*60 + s)*1000; }
  const now = () => performance.now();
  async function tryFullscreen(){ try{ if(!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); }catch(e){} }

  function renderParams(){
    params.innerHTML='';
    circleWrap.classList.add('hidden'); display.classList.remove('hidden'); liveDistance.classList.add('hidden'); fractionTools.classList.add('hidden'); state.fractionAdded=0;
    btnLap.classList.remove('hidden'); btnStop.classList.add('hidden'); tableWrap.classList.remove('hidden');

    switch(state.mode){
      case 'intervalles':
        modeName.textContent='Temps intermédiaire';
        params.innerHTML = `
          <label>Distance cible (m)
            <input type="number" id="p-target" min="100" step="50" value="800"/>
          </label>
          <label>Intervalle (m)
            <input type="number" id="p-step" min="25" step="25" value="200"/>
          </label>
          <div class="info">Appuie sur « Tour ». À la fin : QR <strong>unique</strong> avec <em>temps cumulés</em> (format <code>MM:SS</code>) compressés dans <code>tc</code>.</div>`;
        state.targetDist=800; state.splitDist=200; break;

      case 'simple':
        modeName.textContent='Chrono'; params.innerHTML = `<div class="info">Chrono simple. Pas de tours. <strong>Pas de QR.</strong></div>`; btnLap.classList.add('hidden'); btnStop.classList.remove('hidden'); tableWrap.classList.add('hidden'); display.classList.add('display-huge'); break;

      case 'simpleDistance':
        modeName.textContent='Chrono avec calcul de vitesse'; params.innerHTML=`<label>Distance (m)<input type="number" id="p-target" min="25" step="25" value="100"/></label><div class="info">Lance puis « Stop » à l'arrivée. Récap + QR.</div>`; state.targetDist=100; btnLap.classList.add('hidden'); btnStop.classList.remove('hidden'); tableWrap.classList.add('hidden'); break;

      case 'tours':
        modeName.textContent='Minuteur avec distance'; params.appendChild(buildMinuteSecondSelectors()); params.insertAdjacentHTML('beforeend', `<label>Distance par tour (m)<input type="number" id="p-lapdist" min="25" step="25" value="100"/></label><div class="info">Décompte + « Tour ». Tableau : <em>Temps cumulé</em>, <em>Temps tour</em>, <em>Vitesse</em>, <em>Distance cumulée</em>.</div>`);
        state.countdownMs=mmssToMsStr(5,0); state.ringTotal=state.countdownMs; state.lapDist=100; circleWrap.classList.remove('hidden'); circleWrap.classList.add('huge'); display.classList.add('hidden'); liveDistance.classList.remove('hidden'); updateRing(state.countdownMs, state.ringTotal); break;

      case 'demiCooper':
      case 'cooper':
        modeName.textContent = (state.mode==='demiCooper')?'Demi-Cooper (6′)':'Cooper (12′)'; params.innerHTML = `<label>Distance par tour (m)<input type="number" id="p-lapdist" min="25" step="25" value="100"/></label><div class="info">Durée fixe ${(state.mode==='demiCooper')? '6:00' : '12:00'}. Tableau identique. Fractions mises à jour partout.</div>`;
        state.fixedDuration = (state.mode==='demiCooper')? 6*60*1000 : 12*60*1000; state.ringTotal=state.fixedDuration; state.lapDist=100; circleWrap.classList.remove('hidden'); display.classList.add('hidden'); liveDistance.classList.remove('hidden'); updateRing(state.fixedDuration, state.ringTotal); break;

      case 'minuteurSimple':
        modeName.textContent='Minuteur'; params.appendChild(buildMinuteSecondSelectors()); params.insertAdjacentHTML('beforeend', `<div class="info">Compte à rebours simple. <strong>Pas de QR.</strong></div>`); state.countdownMs=mmssToMsStr(5,0); state.ringTotal=state.countdownMs; circleWrap.classList.remove('hidden'); circleWrap.classList.add('huge'); display.classList.add('hidden'); btnLap.classList.add('hidden'); btnStop.classList.remove('hidden'); tableWrap.classList.add('hidden'); updateRing(state.countdownMs, state.ringTotal); break;
    }
    const t=$('#p-target'); if(t) t.addEventListener('change', ()=> state.targetDist=parseFloat(t.value)||0);
    const s=$('#p-step'); if(s) s.addEventListener('change', ()=> state.splitDist=parseFloat(s.value)||0);
    const l=$('#p-lapdist'); if(l) l.addEventListener('change', ()=> state.lapDist=parseFloat(l.value)||0);
    liveDistVal.textContent = Math.round(state.cumDist + state.fractionAdded);
  }

  function buildMinuteSecondSelectors(){
    const wrap=document.createElement('div'); wrap.className='grid-3';
    const min=document.createElement('label'); min.innerHTML='Minutes<select id="sel-min"></select>'; const selMin=min.querySelector('select'); for(let i=0;i<=120;i++){ const o=document.createElement('option'); o.value=i; o.textContent=String(i).padStart(2,'0'); if(i===5) o.selected=true; selMin.appendChild(o); }
    const sec=document.createElement('label'); sec.innerHTML='Secondes<select id="sel-sec"></select>'; const selSec=sec.querySelector('select'); for(let i=0;i<=59;i++){ const o=document.createElement('option'); o.value=i; o.textContent=String(i).padStart(2,'0'); selSec.appendChild(o); } selSec.value=0;
    const spacer=document.createElement('div'); spacer.innerHTML='&nbsp;';
    function onDur(){ const mm=parseInt(selMin.value,10), ss=parseInt(selSec.value,10); state.countdownMs=(mm*60+ss)*1000; state.ringTotal=state.countdownMs; updateRing(state.countdownMs,state.ringTotal); }
    selMin.addEventListener('change', onDur); selSec.addEventListener('change', onDur);
    wrap.appendChild(min); wrap.appendChild(sec); wrap.appendChild(spacer); return wrap;
  }

  function updateRing(remaining,total){ const C=339.292; const ratio=Math.max(0,Math.min(1,(total?remaining/total:0))); const off=C*(1-ratio); const fg=$('#circle-fg'); if(fg){ fg.style.strokeDasharray=C; fg.style.strokeDashoffset=off; } const txt=$('#circle-text'); if(txt) txt.textContent=fmtMMSS(remaining); }

  function clearTable(){ tbody.innerHTML=''; rowTotal.classList.add('hidden'); totalTime.textContent='—'; totalSpeed.textContent='—'; if(totalDistanceCell) totalDistanceCell.textContent='—'; }

  function start(){ if(state.running){ state.running=false; state.elapsed=now()-state.startTime+state.elapsed; cancelAnimationFrame(state.raf); btnStart.textContent='Reprendre'; if(!['minuteurSimple','simple','simpleDistance'].includes(state.mode)) btnLap.disabled=true; btnStop.disabled=false; btnReset.disabled=false; return; } state.running=true; state.startTime=now(); state.lastLapAt=state.lastLapAt||state.startTime; btnStart.textContent='Pause'; btnLap.disabled=(['minuteurSimple','simple','simpleDistance'].includes(state.mode)); btnStop.disabled=false; btnReset.disabled=false; if(!['simple','simpleDistance','minuteurSimple'].includes(state.mode)) tableWrap.classList.remove('hidden'); tryFullscreen(); tick(); }
  function stop(){ if(!state.running && state.elapsed===0) return; finish(); }
  function tick(){ const t=state.elapsed + (now()-state.startTime); if(['tours','minuteurSimple'].includes(state.mode)){ const remain=Math.max(0,state.countdownMs-t); updateRing(remain,state.ringTotal); if(remain<=0){ finish(); return; } } else if(['demiCooper','cooper'].includes(state.mode)){ const remain=Math.max(0,state.fixedDuration-t); updateRing(remain,state.ringTotal); if(remain<=0){ finish(); return; } } else { display.textContent=fmt(t); } state.raf=requestAnimationFrame(tick); }
  function lap(){ if(!state.running) return; if(['simple','simpleDistance','minuteurSimple'].includes(state.mode)) return; const tNow=now(); const cumMs=state.elapsed+(tNow-state.startTime); const lapMs=tNow-state.lastLapAt; state.lastLapAt=tNow; if(state.mode==='intervalles'){ const next=(state.laps.length+1)*state.splitDist; if(next>state.targetDist) return; state.cumDist=next; addLapRow(cumMs,lapMs); if(state.cumDist>=state.targetDist) finish(); return; } else if(['tours','demiCooper','cooper'].includes(state.mode)){ state.cumDist += state.lapDist; liveDistVal.textContent=Math.round(state.cumDist + state.fractionAdded); } addLapRow(cumMs,lapMs); }
  function addLapRow(cumMs,lapMs){ const tr=document.createElement('tr'); const idx=state.laps.length+1; let lapDist=0; if(state.mode==='intervalles') lapDist=state.splitDist; if(['tours','demiCooper','cooper'].includes(state.mode)) lapDist=state.lapDist; const lapSpeed=lapDist? kmh(lapDist,lapMs):0; const cumMetersNow=Math.round(state.cumDist); tr.innerHTML=`<td>${idx}</td><td>${fmt(cumMs)}</td><td>${fmt(lapMs)}</td><td>${lapDist? lapSpeed.toFixed(2):'—'}</td><td>${(lapDist||state.mode==='intervalles')? cumMetersNow:'—'}</td>`; tbody.appendChild(tr); state.laps.push({idx,cumMs,lapMs,lapDist,lapSpeed,cumMeters:cumMetersNow}); }
  function updateRecapTotals(){ const totalMs=state.elapsed; let totalMeters=0; if(state.mode==='intervalles') totalMeters=state.targetDist; else if(['tours','demiCooper','cooper'].includes(state.mode)) totalMeters=state.cumDist + state.fractionAdded; else if(state.mode==='simpleDistance') totalMeters=state.targetDist; const vAvg=kmh(totalMeters,totalMs); totalTime.textContent=fmt(totalMs); totalSpeed.textContent=(vAvg? vAvg.toFixed(2):'—'); if(totalDistanceCell) totalDistanceCell.textContent=(totalMeters? Math.round(totalMeters):'—'); recap.classList.add('hidden'); recapBody.innerHTML=''; const rows=[]; if(state.mode==='simpleDistance'){ rows.push(['Distance',`${Math.round(state.targetDist)} m`],['Temps',fmt(totalMs)],['Vitesse moyenne',`${kmh(state.targetDist,totalMs).toFixed(2)} km/h`]); } if(['tours','demiCooper','cooper'].includes(state.mode)){ const d=Math.round(totalMeters); rows.push(['Temps',fmt(totalMs)],['Distance totale',`${d} m`],['Vitesse moyenne',`${kmh(d,totalMs).toFixed(2)} km/h`]); if(['demiCooper','cooper'].includes(state.mode)) rows.push(['VMA (moyenne)',`${kmh(d,totalMs).toFixed(2)} km/h`]); } if(rows.length){ recap.classList.remove('hidden'); recapBody.innerHTML=rows.map(([k,v])=>`<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`).join(''); } }
  function finish(){ if(state.running){ state.elapsed=state.elapsed + (now()-state.startTime); state.running=false; cancelAnimationFrame(state.raf); } btnLap.disabled=true; btnStart.textContent='Démarrer'; btnStop.disabled=true; results.classList.remove('hidden'); rowTotal.classList.remove('hidden'); if(['tours','demiCooper','cooper'].includes(state.mode)){ fractionTools.classList.remove('hidden'); document.querySelectorAll('#fraction-tools [data-frac]').forEach(btn=> btn.onclick=()=>applyFraction(parseFloat(btn.dataset.frac))); const undo=$('#btn-frac-undo'); if(undo) undo.onclick=undoFraction; } updateRecapTotals(); generateQR(); }
  function applyFraction(frac){ if(!['tours','demiCooper','cooper'].includes(state.mode)) return; state.fractionAdded = state.lapDist * frac; liveDistVal.textContent = Math.round(state.cumDist + state.fractionAdded); updateRecapTotals(); generateQR(); }
  function undoFraction(){ if(!['tours','demiCooper','cooper'].includes(state.mode)) return; state.fractionAdded=0; liveDistVal.textContent=Math.round(state.cumDist); updateRecapTotals(); generateQR(); }
  function identity(){ const s=student(); return { nom:s.nom||'', prenom:s.prenom||'', classe:s.classe||'', sexe:s.sexe||'' }; }
  function payload(testLabel, core){
    const id=identity();
    const obj={ nom:id.nom, prenom:id.prenom, classe:id.classe, sexe:id.sexe, test:testLabel };
    Object.keys(core||{}).forEach(k=> obj[k]=core[k]);
    return [obj];
  }
  function generateQR(){
    const p=buildPayload(); qrcodeBox.innerHTML=''; if(!p) return;
    try{ new QRCode(qrcodeBox,{ text:JSON.stringify(p), width:220, height:220, correctLevel:QRCode.CorrectLevel.L }); }
    catch(e){ const d=document.createElement('div'); d.textContent='Erreur QR: '+e.message; qrcodeBox.appendChild(d); }
  }
  function buildPayload(){
    if(state.mode==='intervalles'){
      // 'tc' as MM:SS values joined by '|'
      const tc = state.laps.map(l => fmtMMSS(l.cumMs)).join('|');
      return payload('Temps intermédiaire', { distance: Math.round(state.targetDist||0), intervalle: Math.round(state.splitDist||0), tc });
    }
    if(state.mode==='simpleDistance'){
      const d=Math.round(state.targetDist||0);
      const core={};
      core[`temps_${d}m`] = fmt(state.elapsed);
      core[`vitesse_${d}m`] = kmh(d,state.elapsed);
      return payload('Chrono avec calcul de vitesse', core);
    }
    if(state.mode==='tours'){
      const dist=Math.round(state.cumDist + state.fractionAdded);
      return payload('Minuteur avec distance', { distance_totale:dist, temps_total:fmt(state.elapsed), vitesse_moyenne: kmh(dist,state.elapsed) });
    }
    if(state.mode==='demiCooper'){
      const dist=Math.round(state.cumDist + state.fractionAdded), v=kmh(dist,state.elapsed);
      return payload('Demi-Cooper (6′)', { distance:dist, temps_total:fmt(state.elapsed), vma:v });
    }
    if(state.mode==='cooper'){
      const dist=Math.round(state.cumDist + state.fractionAdded), v=kmh(dist,state.elapsed);
      return payload('Cooper (12′)', { distance:dist, temps_total:fmt(state.elapsed), vma:v });
    }
    return null;
  }

  function csvExport(){
    const s=student();
    const esc=(v)=>`\"${String(v).replace(/\"/g,'\"\"')}\"`;
    let lines=[];
    if(state.mode==='intervalles'){
      lines.push(['nom','prenom','classe','sexe','distance_cible_m','intervalle_m','index','distance_m','temps_cum','temps_interval']);
      state.laps.forEach((l,i)=>{
        const dist=(i+1)*state.splitDist;
        lines.push([s.nom||'',s.prenom||'',s.classe||'',s.sexe||'', Math.round(state.targetDist||0), Math.round(state.splitDist||0), i+1, dist, fmt(l.cumMs), fmt(l.lapMs)]);
      });
    } else if(state.mode==='simpleDistance'){
      const head=['nom','prenom','classe','sexe','distance_m','temps','vitesse_kmh'];
      const row=[s.nom||'',s.prenom||'',s.classe||'',s.sexe||'', Math.round(state.targetDist||0), fmt(state.elapsed), kmh(state.targetDist,state.elapsed).toFixed(2)];
      lines.push(head); lines.push(row);
    } else if(['tours','demiCooper','cooper'].includes(state.mode)){
      lines.push(['nom','prenom','classe','sexe','lap_index','t_cum','t_lap','v_lap_kmh','dist_cum_m']);
      state.laps.forEach(l=>{
        const v=l.lapDist? kmh(l.lapDist,l.lapMs).toFixed(2):'';
        lines.push([s.nom||'',s.prenom||'',s.classe||'',s.sexe||'', l.idx, fmt(l.cumMs), fmt(l.lapMs), v, (l.cumMeters||'')]);
      });
      lines.push([]);
      const totalMeters=Math.round(state.cumDist + state.fractionAdded);
      const vavg=kmh(totalMeters,state.elapsed).toFixed(2);
      const headRecap=['nom','prenom','classe','sexe','distance_totale_m','temps_total','vitesse_moyenne_kmh'];
      const rowRecap=[s.nom||'',s.prenom||'',s.classe||'',s.sexe||'', totalMeters, fmt(state.elapsed), vavg];
      if(['demiCooper','cooper'].includes(state.mode)){ headRecap.push('vma_kmh'); rowRecap.push(vavg); }
      lines.push(headRecap); lines.push(rowRecap);
    } else {
      lines.push(['info']); lines.push(['Pas de données exportables pour ce mode.']);
    }
    const csv = lines.map(r=>r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`runmeasure_${(s.nom||'')}_${(s.prenom||'')}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  btnStart.addEventListener('click', start); btnStop.addEventListener('click', stop); btnLap.addEventListener('click', lap);
  btnReset.addEventListener('click', ()=>{ state.running=false; cancelAnimationFrame(state.raf); state.startTime=0; state.elapsed=0; state.lastLapAt=0; state.laps=[]; state.cumDist=0; state.fractionAdded=0; display.textContent='00:00.0'; display.classList.remove('display-huge'); if(circleWrap && !circleWrap.classList.contains('hidden')){ if(state.ringTotal) updateRing(state.ringTotal, state.ringTotal);} btnStart.textContent='Démarrer'; btnLap.disabled=(['minuteurSimple','simple','simpleDistance'].includes(state.mode)); btnStop.disabled=true; btnReset.disabled=false; if(!['simple','simpleDistance','minuteurSimple'].includes(state.mode)) tableWrap.classList.add('hidden'); results.classList.add('hidden'); qrcodeBox.innerHTML=''; liveDistVal.textContent='0'; recap.classList.add('hidden'); recapBody.innerHTML=''; if(totalDistanceCell) totalDistanceCell.textContent='—'; clearTable(); });
  $('#btn-new').addEventListener('click', ()=> location.reload()); $('#btn-export-csv').addEventListener('click', csvExport);
  renderParams();
})();