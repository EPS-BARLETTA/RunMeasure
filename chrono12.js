
(function(){
  document.addEventListener('DOMContentLoaded', ()=>{
    const nom=qs('#nom'), prenom=qs('#prenom'), classe=qs('#classe');
    const lapLen=qs('#lapLen'), display=qs('#display'), start=qs('#startBtn'), stop=qs('#stopBtn'), reset=qs('#resetBtn');
    const lapBtn=qs('#lapBtn'), incBtns=$all('[data-inc]'), fracBtns=$all('[data-fraction]'), manualExtra=qs('#manualExtra');
    const splitsBody=qs('#splitsBody'), totalDistance=qs('#totalDistance'), lapsCount=qs('#lapsCount'), fractionAdded=qs('#fractionAdded');
    const qr=qs('#qrcode'), saveCsv=qs('#saveCsv');
    const TARGET=12*60; let running=false, t0=0, raf=0, laps=0, liveExtra=0, endFrac=0, splits=[], last=0;

    const fmt = (s)=>{s=Math.max(0,Math.round(s)); const m=String(Math.floor(s/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0'); return `${m}:${ss}`;}
    const setRunning = (r)=>{
      running=r; start.disabled=r; stop.disabled=!r; reset.disabled=r; lapBtn.disabled=!r;
      incBtns.forEach(b=>b.disabled=!r); fracBtns.forEach(b=>b.disabled=r); manualExtra.disabled=r;
    };
    const tick = ()=>{
      const rem = TARGET-(performance.now()-t0)/1000;
      if(rem<=0){ display.textContent='00:00'; display.classList.remove('blink'); finish(); return; }
      if(performance.now()-last>16){ display.textContent=fmt(Math.ceil(rem)); toggleLast10(display, rem<=10); last=performance.now(); }
      raf=requestAnimationFrame(tick);
    };
    const addSplit = (ms)=>{
      const tr=document.createElement('tr'); const idx=splits.length+1;
      tr.innerHTML=`<td>${idx}</td><td>${fmt(ms/1000)}</td><td>${ms}</td>`; splitsBody.appendChild(tr);
    };
    const recalc = ()=>{
      const L=parseFloat(lapLen.value)||0; const manual=parseFloat(manualExtra.value)||0;
      const fracMeters = Math.round(endFrac*L)+manual, liveMeters=Math.round(liveExtra*L);
      const total = Math.max(0, Math.round(laps*L + liveMeters + fracMeters));
      totalDistance.value = `${total} m`; lapsCount.value = `${(laps+liveExtra).toFixed(2)}`; fractionAdded.value = `${fracMeters} m`;
      return {total, fracMeters};
    };
    const finish = ()=>{
      cancelAnimationFrame(raf); setRunning(false); const {total, fracMeters} = recalc();
      const payload = { mode:'12min', nom:nom.value.trim(), prenom:prenom.value.trim(), classe:classe.value.trim(), duree_s:TARGET, distance_m:total };
      if(fracMeters>0) payload.fraction_added_m = fracMeters;
      if(splits.length) payload.splits_ms = splits;
      makeQRCode(qr, payload);
      saveRowToCsv({nom:payload.nom, prenom:payload.prenom, classe:payload.classe, mode:payload.mode, duree_s:payload.duree_s, distance_m:payload.distance_m, fraction_added_m:payload.fraction_added_m||0, splits_ms:(payload.splits_ms||[]).join('|')}, 'mc_12min');
    };

    on(start,'click',()=>{
      if(!nom.value||!prenom.value||!classe.value){ alert('Nom, Prénom, Classe.'); return; }
      laps=0; liveExtra=0; endFrac=0; splits=[]; splitsBody.innerHTML=''; manualExtra.value='0';
      t0=performance.now(); display.textContent='12:00'; toggleLast10(display,false); setRunning(true); tick(); recalc();
    });
    on(stop,'click',finish);
    on(reset,'click',()=>{ cancelAnimationFrame(raf); setRunning(false); display.textContent='12:00'; display.classList.remove('blink'); qr.innerHTML=''; laps=0; liveExtra=0; endFrac=0; manualExtra.value='0'; splits=[]; splitsBody.innerHTML=''; recalc(); });
    on(lapBtn,'click',()=>{ if(!running) return; laps++; splits.push(performance.now()-t0); addSplit(performance.now()-t0); recalc(); });
    incBtns.forEach(b=> on(b,'click', ()=>{ if(running){ liveExtra += parseFloat(b.dataset.inc||'0'); recalc(); }}));
    fracBtns.forEach(b=> on(b,'click', ()=>{ if(!running){ endFrac += parseFloat(b.dataset.fraction||'0'); recalc(); }}));
    on(manualExtra,'input', debounce(recalc,150));
    recalc();
  });
})();
