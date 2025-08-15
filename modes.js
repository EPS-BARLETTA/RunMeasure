// RunMeasure — modes.js (QR FIX STABLE)
// - QR JSON plat sans millisecondes pour tous les modes
// - Intermédiaires => test: "Tps intermédiaires", tps_XXX cumulés (H:MM:SS) + temps_total_*
// - Chrono + vitesse => test: "Chrono avec calcul de vitesse"
// - Minuteur + distance => test: "Minuteur avec distance"
// - Demi Cooper / Cooper => test: "Demi Cooper" / "Cooper" (distance, vitesse_moy_kmh, vma_kmh)
// - Charge d'abord ./qrcode.min.js (local), sinon CDN
(function(){
  var $ = function(s, root){ return (root||document).querySelector(s); };

  // ---------- formats ----------
  function fmtTenths(ms){ // affichage live 00:00.0
    var t=Math.max(0,Math.round(ms/100));
    var m=Math.floor(t/600), s=Math.floor((t%600)/10), d=t%10;
    return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+d;
  }
  function fmtMMSS(ms){
    var tot=Math.max(0,Math.round(ms/1000));
    var m=Math.floor(tot/60), s=tot%60;
    return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  }
  function fmtHMS(ms){
    var tot=Math.max(0,Math.round(ms/1000));
    var h=Math.floor(tot/3600), m=Math.floor((tot%3600)/60), s=tot%60;
    var pad=function(n){return String(n).padStart(2,'0');};
    return (h>0)? (h+':'+pad(m)+':'+pad(s)) : (m+':'+pad(s));
  }
  function kmh(meters, ms){ return (ms>0 ? +((meters/(ms/1000))*3.6).toFixed(2) : 0); }

  // ---------- QR lib ----------
  function loadScript(src, cb){
    var s=document.createElement('script');
    s.src=src; s.onload=function(){ cb(true); }; s.onerror=function(){ cb(false); };
    document.head.appendChild(s);
  }
  function ensureQRCodeLib(cb){
    if (window.QRCode) return cb(true);
    // 1) essayer local
    loadScript('./qrcode.min.js', function(okLocal){
      if (okLocal || window.QRCode) return cb(true);
      // 2) secours CDN
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js', function(okCdn){
        cb(!!(okCdn || window.QRCode));
      });
    });
  }

  // ---------- état ----------
  function getMode(){ return new URLSearchParams(location.search).get('mode') || 'intervalles'; }
  function student(){ try { return JSON.parse(localStorage.getItem('rm_student')||'{}'); } catch(e){ return {}; } }
  function now(){ return performance.now(); }
  function mmssToMs(mm, ss){ var m=parseInt(mm||'0',10)||0, s=parseInt(ss||'0',10)||0; return (m*60+s)*1000; }

  var state = {
    mode:getMode(), running:false, startTime:0, elapsed:0, lastLapAt:0, raf:0,
    laps:[], cumDist:0, targetDist:0, splitDist:0, lapDist:0,
    countdownMs:0, fixedDuration:0, ringTotal:0, fractionAdded:0
  };

  // ---------- DOM ----------
  var modeName=$('#mode-name'), params=$('#params'), display=$('#display'),
      btnStart=$('#btn-start'), btnLap=$('#btn-lap'), btnStop=$('#btn-stop'), btnReset=$('#btn-reset'),
      tableWrap=$('#table-wrap'), tbody=$('#laps-table tbody'),
      results=$('#results'), qrcodeBoxInit=$('#qrcode'), totalTime=$('#total-time'), totalSpeed=$('#total-speed'),
      totalDistanceCell=$('#total-distance'), rowTotal=$('#row-total'),
      circleWrap=$('#circle-wrap'), liveDistance=$('#live-distance'), liveDistVal=$('#live-dist-val'),
      fractionTools=$('#fraction-tools'), recap=$('#recap');

  // ---------- rendu paramètres ----------
  function renderParams(){
    if (params) params.innerHTML='';
    if (circleWrap) circleWrap.classList.add('hidden');
    if (display) display.classList.remove('hidden');
    if (liveDistance) liveDistance.classList.add('hidden');
    if (fractionTools) fractionTools.classList.add('hidden');
    state.fractionAdded=0;
    if (btnLap) btnLap.classList.remove('hidden');
    if (btnStop) btnStop.classList.add('hidden');
    if (tableWrap) tableWrap.classList.remove('hidden');

    switch(state.mode){
      case 'intervalles':
        if (modeName) modeName.textContent='Temps intermédiaire';
        if (params) params.innerHTML =
          '<label>Distance cible (m)<input type="number" id="p-target" min="100" step="50" value="800"/></label>'+
          '<label>Intervalle (m)<input type="number" id="p-step" min="25" step="25" value="200"/></label>'+
          '<div class="info">Appuie sur « Tour ». QR avec <em>temps cumulés</em> (sans millisecondes).</div>';
        state.targetDist=800; state.splitDist=200;
        break;

      case 'simple':
        if (modeName) modeName.textContent='Chrono';
        if (params) params.innerHTML = '<div class="info">Chrono simple. Pas de tours. <strong>Pas de QR.</strong></div>';
        if (btnLap) btnLap.classList.add('hidden');
        if (btnStop) btnStop.classList.remove('hidden');
        if (tableWrap) tableWrap.classList.add('hidden');
        if (display) display.classList.add('display-huge');
        break;

      case 'simpleDistance':
        if (modeName) modeName.textContent='Chrono avec calcul de vitesse';
        if (params) params.innerHTML =
          '<label>Distance (m)<input type="number" id="p-target" min="25" step="25" value="100"/></label>'+
          '<div class="info">Lance puis « Stop » à l’arrivée. Récap + QR.</div>';
        state.targetDist=100;
        if (btnLap) btnLap.classList.add('hidden');
        if (btnStop) btnStop.classList.remove('hidden');
        if (tableWrap) tableWrap.classList.add('hidden');
        break;

      case 'tours':
        if (modeName) modeName.textContent='Minuteur avec distance';
        if (params){
          params.innerHTML =
            '<label>Minutes<input id="sel-min" type="number" min="0" max="120" value="5"/></label>'+
            '<label>Secondes<input id="sel-sec" type="number" min="0" max="59" value="0"/></label>'+
            '<label>Distance par tour (m)<input type="number" id="p-lapdist" min="25" step="25" value="100"/></label>'+
            '<div class="info">Décompte + « Tour ». Tableau : <em>Temps cumulé</em>, <em>Temps tour</em>, <em>Vitesse</em>, <em>Distance cumulée</em>.</div>';
          var m=$('#sel-min'), s=$('#sel-sec');
          function onDur(){ state.countdownMs=mmssToMs(m.value,s.value); state.ringTotal=state.countdownMs; }
          if (m) m.addEventListener('input', onDur);
          if (s) s.addEventListener('input', onDur);
          onDur();
        }
        state.lapDist=100;
        if (circleWrap){ circleWrap.classList.remove('hidden'); circleWrap.classList.add('huge'); }
        if (display) display.classList.add('hidden');
        if (liveDistance) liveDistance.classList.remove('hidden');
        break;

      case 'demiCooper':
      case 'cooper':
        if (modeName) modeName.textContent = (state.mode==='demiCooper')?'Demi Cooper (6′)':'Cooper (12′)';
        if (params) params.innerHTML =
          '<label>Distance par tour (m)<input type="number" id="p-lapdist" min="25" step="25" value="100"/></label>'+
          '<div class="info">Durée fixe '+((state.mode==='demiCooper')?'6:00':'12:00')+'. Fractions prises en compte.</div>';
        state.fixedDuration = (state.mode==='demiCooper')? 6*60*1000 : 12*60*1000;
        state.ringTotal=state.fixedDuration; state.lapDist=100;
        if (circleWrap) circleWrap.classList.remove('hidden');
        if (display) display.classList.add('hidden');
        if (liveDistance) liveDistance.classList.remove('hidden');
        break;

      case 'minuteurSimple':
        if (modeName) modeName.textContent='Minuteur';
        if (params){
          params.innerHTML =
            '<label>Minutes<input id="sel-min" type="number" min="0" max="120" value="5"/></label>'+
            '<label>Secondes<input id="sel-sec" type="number" min="0" max="59" value="0"/></label>'+
            '<div class="info">Compte à rebours simple. <strong>Pas de QR.</strong></div>';
          var m2=$('#sel-min'), s2=$('#sel-sec');
          function onDur2(){ state.countdownMs=mmssToMs(m2.value,s2.value); state.ringTotal=state.countdownMs; }
          if (m2) m2.addEventListener('input', onDur2);
          if (s2) s2.addEventListener('input', onDur2);
          onDur2();
        }
        if (circleWrap){ circleWrap.classList.remove('hidden'); circleWrap.classList.add('huge'); }
        if (display) display.classList.add('hidden');
        if (btnLap) btnLap.classList.add('hidden');
        if (btnStop) btnStop.classList.remove('hidden');
        if (tableWrap) tableWrap.classList.add('hidden');
        break;
    }
    var t=$('#p-target'); if(t) t.addEventListener('change', function(){ state.targetDist=parseFloat(t.value)||0; });
    var s=$('#p-step');   if(s) s.addEventListener('change', function(){ state.splitDist=parseFloat(s.value)||0; });
    var l=$('#p-lapdist');if(l) l.addEventListener('change', function(){ state.lapDist=parseFloat(l.value)||0; });
    if (liveDistVal) liveDistVal.textContent = Math.round(state.cumDist + state.fractionAdded);
  }

  // ---------- chrono ----------
  function start(){
    if(state.running){
      state.running=false; state.elapsed=now()-state.startTime+state.elapsed; cancelAnimationFrame(state.raf);
      if (btnStart) btnStart.textContent='Reprendre';
      if(!/^(minuteurSimple|simple|simpleDistance)$/.test(state.mode)) if (btnLap) btnLap.disabled=true;
      if (btnStop) btnStop.disabled=false; if (btnReset) btnReset.disabled=false;
      return;
    }
    state.running=true; state.startTime=now(); state.lastLapAt=state.lastLapAt||state.startTime;
    if (btnStart) btnStart.textContent='Pause';
    if (btnLap) btnLap.disabled=/^(minuteurSimple|simple|simpleDistance)$/.test(state.mode);
    if (btnStop) btnStop.disabled=false; if (btnReset) btnReset.disabled=false;
    if(!/^(simple|simpleDistance|minuteurSimple)$/.test(state.mode)) if(tableWrap) tableWrap.classList.remove('hidden');
    tick();
  }
  function stop(){ if(!state.running && state.elapsed===0) return; finish(); }
  function tick(){
    var t=state.elapsed + (now()-state.startTime);
    if(state.mode==='tours' || state.mode==='minuteurSimple'){
      var remain=Math.max(0,state.countdownMs-t);
      var ctext=$('#circle-text'); if(ctext) ctext.textContent=fmtMMSS(remain);
      if(remain<=0){ finish(); return; }
    } else if(state.mode==='demiCooper' || state.mode==='cooper'){
      var remain2=Math.max(0,state.fixedDuration-t);
      var ctext2=$('#circle-text'); if(ctext2) ctext2.textContent=fmtMMSS(remain2);
      if(remain2<=0){ finish(); return; }
    } else {
      if (display) display.textContent=fmtTenths(t);
    }
    state.raf=requestAnimationFrame(tick);
  }
  function lap(){
    if(!state.running) return;
    if(/^(simple|simpleDistance|minuteurSimple)$/.test(state.mode)) return;
    var tNow=now();
    var cumMs=state.elapsed+(tNow-state.startTime);
    var lapMs=tNow-state.lastLapAt;
    state.lastLapAt=tNow;
    if(state.mode==='intervalles'){
      var next=(state.laps.length+1)*(state.splitDist||0);
      if(next>(state.targetDist||0)) return;
      state.cumDist=next;
      addLapRow(cumMs,lapMs);
      generateQR(); // QR mis à jour à chaque tour
      if(state.cumDist>=(state.targetDist||0)) finish();
      return;
    } else if(state.mode==='tours' || state.mode==='demiCooper' || state.mode==='cooper'){
      state.cumDist += (state.lapDist||0);
      if (liveDistVal) liveDistVal.textContent=Math.round(state.cumDist + state.fractionAdded);
    }
    addLapRow(cumMs,lapMs);
  }
  function addLapRow(cumMs,lapMs){
    var tr=document.createElement('tr'); var idx=state.laps.length+1;
    var lapDist=0; if(state.mode==='intervalles') lapDist=state.splitDist||0; if(state.mode==='tours' || state.mode==='demiCooper' || state.mode==='cooper') lapDist=state.lapDist||0;
    var lapSpeed=lapDist? kmh(lapDist,lapMs).toFixed(2):'—'; var cumMetersNow=Math.round(state.cumDist);
    tr.innerHTML='<td>'+idx+'</td><td>'+fmtTenths(cumMs)+'</td><td>'+fmtTenths(lapMs)+'</td><td>'+ (lapDist? lapSpeed:'—') +'</td><td>'+ ((lapDist||state.mode==='intervalles')? cumMetersNow:'—') +'</td>';
    if (tbody) tbody.appendChild(tr);
    state.laps.push({idx:idx,cumMs:cumMs,lapMs:lapMs,lapDist:lapDist,cumMeters:cumMetersNow});
  }
  function finish(){
    if(state.running){ state.elapsed=state.elapsed + (now()-state.startTime); state.running=false; cancelAnimationFrame(state.raf); }
    if (btnLap) btnLap.disabled=true; if (btnStart) btnStart.textContent='Démarrer'; if (btnStop) btnStop.disabled=true;
    if (results) results.classList.remove('hidden'); if (rowTotal) rowTotal.classList.remove('hidden');
    if(state.mode==='tours' || state.mode==='demiCooper' || state.mode==='cooper'){
      if (fractionTools) fractionTools.classList.remove('hidden');
      var undo=$('#btn-frac-undo'); if(undo) undo.addEventListener('click', undoFraction);
      var frBtns=document.querySelectorAll('#fraction-tools [data-frac]');
      for(var i=0;i<frBtns.length;i++){ frBtns[i].onclick=(function(btn){ return function(){ applyFraction(parseFloat(btn.getAttribute('data-frac'))); }; })(frBtns[i]); }
    }
    generateQR(); // QR à la fin pour tous les modes
  }
  function applyFraction(frac){
    if(!(state.mode==='tours' || state.mode==='demiCooper' || state.mode==='cooper')) return;
    state.fractionAdded = (state.lapDist||0) * frac;
    if (liveDistVal) liveDistVal.textContent = Math.round(state.cumDist + state.fractionAdded);
    generateQR();
  }
  function undoFraction(){
    if(!(state.mode==='tours' || state.mode==='demiCooper' || state.mode==='cooper')) return;
    state.fractionAdded=0;
    if (liveDistVal) liveDistVal.textContent=Math.round(state.cumDist);
    generateQR();
  }

  // ---------- QR ----------
  function identity(){
    var s=student();
    return { nom:s.nom||'', prenom:s.prenom||'', classe:s.classe||'', sexe:s.sexe||'' };
  }

  function buildPayload(){
    var id=identity();

    // Intermédiaires
    if(state.mode==='intervalles'){
      var out = {
        nom:id.nom, prenom:id.prenom, classe:id.classe, sexe:id.sexe,
        test:"Tps intermédiaires",
        distance_cible_m: Math.round(state.targetDist||0),
        intervalle_m: Math.round(state.splitDist||0)
      };
      var totalLaps = Math.min(state.laps.length, Math.floor((state.targetDist||0)/Math.max(1,(state.splitDist||1))));
      for (var i=0;i<totalLaps;i++){
        var dist = (i+1)*(state.splitDist||0);
        out['tps_'+dist] = fmtHMS(state.laps[i].cumMs); // temps cumulés, sans ms
      }
      if (totalLaps>0){
        var last = state.laps[totalLaps-1].cumMs;
        out.temps_total_s = Math.round(last/1000);
        out.temps_total_hms = fmtHMS(last);
      }
      return out;
    }

    // Chrono + vitesse
    if(state.mode==='simpleDistance'){
      var d = Math.round(state.targetDist||0);
      return {
        nom:id.nom, prenom:id.prenom, classe:id.classe, sexe:id.sexe,
        test:"Chrono avec calcul de vitesse",
        distance_m:d,
        temps_total_s: Math.round(state.elapsed/1000),
        temps_total_hms: fmtHMS(state.elapsed),
        vitesse_kmh: +(kmh(d,state.elapsed).toFixed(2))
      };
    }

    // Minuteur + distance
    if(state.mode==='tours'){
      var dist = Math.round(state.cumDist + state.fractionAdded);
      var v = +(kmh(dist,state.elapsed).toFixed(2));
      return {
        nom:id.nom, prenom:id.prenom, classe:id.classe, sexe:id.sexe,
        test:"Minuteur avec distance",
        duree_minuteur_s: Math.round(state.elapsed/1000),
        duree_minuteur_hms: fmtHMS(state.elapsed),
        distance_realisee_m: dist,
        vitesse_kmh: v
      };
    }

    // (Demi) Cooper
    if(state.mode==='demiCooper' || state.mode==='cooper'){
      var isDemi = (state.mode==='demiCooper');
      var fixed = isDemi ? 6*60 : 12*60; // s
      var dist2 = Math.round(state.cumDist + state.fractionAdded);
      var v2 = +(((dist2/1000) / (fixed/3600)).toFixed(2));
      return {
        nom:id.nom, prenom:id.prenom, classe:id.classe, sexe:id.sexe,
        test: isDemi ? "Demi Cooper" : "Cooper",
        duree_s: fixed,
        duree_hms: fmtHMS(fixed*1000),
        distance_realisee_m: dist2,
        vitesse_moy_kmh: v2,
        vma_kmh: v2
      };
    }
    return null;
  }

  function generateQR(){
    var payload = buildPayload();
    if(!payload) return;

    // conteneur (création si absent)
    var box = qrcodeBoxInit || $('#qrcode');
    if (!box){
      box = document.createElement('div');
      box.id = 'qrcode';
      box.style.position='fixed'; box.style.right='12px'; box.style.bottom='12px';
      box.style.padding='8px'; box.style.background='rgba(255,255,255,0.96)'; box.style.border='1px solid #e5e5e5'; box.style.borderRadius='10px'; box.style.zIndex='9999';
      var title=document.createElement('div'); title.textContent='QR résultat'; title.style.fontSize='12px'; title.style.margin='0 0 6px 0'; title.style.color='#333';
      box.appendChild(title);
      document.body.appendChild(box);
    } else {
      box.innerHTML='';
    }

    ensureQRCodeLib(function(ok){
      if(!ok || !window.QRCode){
        var pre=document.createElement('pre'); pre.textContent = JSON.stringify(payload);
        pre.style.maxWidth='250px'; pre.style.maxHeight='250px'; pre.style.overflow='auto'; pre.style.fontSize='10px';
        box.appendChild(pre);
        return;
      }
      new QRCode(box, { text: JSON.stringify(payload), width:250, height:250, correctLevel:QRCode.CorrectLevel.L });
    });
  }

  // ---------- export CSV (inchangé dans l’esprit) ----------
  function csvExport(){
    var s=student(); var esc=function(v){ return '"'+String(v).replace(/\"/g,'\"\"')+'"'; }; var lines=[];
    if(state.mode==='intervalles'){
      lines.push(['nom','prenom','classe','sexe','distance_cible_m','intervalle_m','index','distance_m','temps_cum','temps_interval']);
      for (var i=0;i<state.laps.length;i++){
        var l=state.laps[i]; var dist=(i+1)*(state.splitDist||0);
        lines.push([s.nom||'',s.prenom||'',s.classe||'',s.sexe||'', Math.round(state.targetDist||0), Math.round(state.splitDist||0), i+1, dist, fmtHMS(l.cumMs), fmtHMS(l.lapMs)]);
      }
    } else if(state.mode==='simpleDistance'){
      var head=['nom','prenom','classe','sexe','distance_m','temps_hms','temps_s','vitesse_kmh'];
      var row=[s.nom||'',s.prenom||'',s.classe||'',s.sexe||'', Math.round(state.targetDist||0), fmtHMS(state.elapsed), Math.round(state.elapsed/1000), ((kmh(state.targetDist,state.elapsed))||0).toFixed(2)];
      lines.push(head); lines.push(row);
    } else if(state.mode==='tours' || state.mode==='demiCooper' || state.mode==='cooper'){
      lines.push(['nom','prenom','classe','sexe','lap_index','t_cum_hms','t_lap_hms','v_lap_kmh','dist_cum_m']);
      for (var j=0;j<state.laps.length;j++){
        var l2=state.laps[j]; var v=l2.lapDist? kmh(l2.lapDist,l2.lapMs).toFixed(2):'';
        lines.push([s.nom||'',s.prenom||'',s.classe||'',s.sexe||'', l2.idx, fmtHMS(l2.cumMs), fmtHMS(l2.lapMs), v, (l2.cumMeters||'')]);
      }
      lines.push([]);
      var totalMeters=Math.round(state.cumDist + state.fractionAdded);
      var vavg=kmh(totalMeters,state.elapsed).toFixed(2);
      var headRecap=['nom','prenom','classe','sexe','distance_totale_m','temps_total_hms','temps_total_s','vitesse_moyenne_kmh'];
      var rowRecap=[s.nom||'',s.prenom||'',s.classe||'',s.sexe||'', totalMeters, fmtHMS(state.elapsed), Math.round(state.elapsed/1000), vavg];
      if(state.mode==='demiCooper' || state.mode==='cooper'){ headRecap.push('vma_kmh'); rowRecap.push(vavg); }
      lines.push(headRecap); lines.push(rowRecap);
    } else { lines.push(['info']); lines.push(['Pas de données exportables pour ce mode.']); }
    var csv = lines.map(function(r){return r.map(esc).join(',');}).join('\n');
    var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href=url; a.download='runmeasure_'+((s.nom||''))+'_'+((s.prenom||''))+'.csv';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // ---------- reset & events ----------
  function clearTable(){
    if (tbody) tbody.innerHTML='';
    if (rowTotal) rowTotal.classList.add('hidden');
    if (totalTime) totalTime.textContent='—';
    if (totalSpeed) totalSpeed.textContent='—';
    if (totalDistanceCell) totalDistanceCell.textContent='—';
  }
  function resetAll(){
    state.running=false; cancelAnimationFrame(state.raf); state.startTime=0; state.elapsed=0; state.lastLapAt=0; state.laps=[]; state.cumDist=0; state.fractionAdded=0;
    if (display){ display.textContent='00:00.0'; display.classList.remove('display-huge'); }
    if (btnStart) btnStart.textContent='Démarrer';
    if (btnLap) btnLap.disabled=/^(minuteurSimple|simple|simpleDistance)$/.test(state.mode);
    if (btnStop) btnStop.disabled=true;
    if(!/^(simple|simpleDistance|minuteurSimple)$/.test(state.mode)) if(tableWrap) tableWrap.classList.add('hidden');
    if (results) results.classList.add('hidden');
    var box=$('#qrcode'); if(box) box.innerHTML='';
    if (liveDistVal) liveDistVal.textContent='0';
    if (totalDistanceCell) totalDistanceCell.textContent='—';
    clearTable();
  }

  var btnExport=$('#btn-export-csv'); if (btnExport) btnExport.addEventListener('click', csvExport);
  if (btnStart) btnStart.addEventListener('click', start);
  if (btnStop) btnStop.addEventListener('click', stop);
  if (btnLap) btnLap.addEventListener('click', lap);
  if (btnReset) btnReset.addEventListener('click', resetAll);
  var btnNew=$('#btn-new'); if (btnNew) btnNew.addEventListener('click', function(){ location.reload(); });

  renderParams();
})();
