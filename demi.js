
// Demi-Cooper 6' avec VMA = distance/100
(function(){
  document.addEventListener('DOMContentLoaded', ()=>{
    const nom=qs('#nom'), prenom=qs('#prenom'), classe=qs('#classe');
    const lapLen=qs('#lapLen'); const display=qs('#display'); const start=qs('#startBtn'); const stop=qs('#stopBtn'); const reset=qs('#resetBtn');
    const incBtns=$all('[data-inc]'); const fracBtns=$all('[data-fraction]'); const manualExtra=qs('#manualExtra');
    const totalDistance=qs('#totalDistance'); const vma=qs('#vma'); const qr=qs('#qrcode'); const saveCsv=qs('#saveCsv');
    const TARGET=6*60; let running=false, t0=0, raf=0, laps=0, liveExtra=0, endFrac=0, last=0;

    const fmt=(s)=>{s=Math.max(0,Math.round(s)); const m=String(Math.floor(s/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0'); return `${m}:${ss}`;};
    const setRun=(r)=>{ running=r; start.disabled=r; stop.disabled=!r; reset.disabled=r; incBtns.forEach(b=>b.disabled=!r); fracBtns.forEach(b=>b.disabled=r); manualExtra.disabled=r; };
    const tick=()=>{ const rem = TARGET - (performance.now()-t0)/1000; if(rem<=0){ display.textContent='00:00'; display.classList.remove('blink'); finish(); return; }
      if(performance.now()-last>16){ display.textContent=fmt(Math.ceil(rem)); display.classList.toggle('blink', rem<=10); last=performance.now(); } raf=requestAnimationFrame(tick); };

    function recalc(){
      const L=parseFloat(lapLen.value)||0; const manual=parseFloat(manualExtra.value)||0;
      const fracMeters = Math.round(endFrac*L)+manual; const liveMeters=Math.round(liveExtra*L);
      const total = Math.max(0, Math.round(laps*L + liveMeters + fracMeters));
      totalDistance.value = `${total} m`; vma.value = `${(total/100).toFixed(1)} km/h`; return total;
    }

    function finish(){
      cancelAnimationFrame(raf); setRun(false);
      const total = recalc(); const payload = { mode:'demi_cooper', nom:nom.value.trim(), prenom:prenom.value.trim(), classe:classe.value.trim(),
        duree_s: TARGET, distance_m: total, vma_kmh: Math.round((total/100)*10)/10 };
      makeQRCode(qr, payload);
      saveRowToCsv(payload, 'mc_demi');
    }

    on(start,'click',()=>{ if(!nom.value||!prenom.value||!classe.value){ alert('Nom, Prénom, Classe.'); return; }
      laps=0; liveExtra=0; endFrac=0; manualExtra.value='0'; qr.innerHTML=''; t0=performance.now(); display.textContent='06:00'; setRun(true); tick(); recalc();
    });
    on(stop,'click',finish);
    on(reset,'click',()=>{ cancelAnimationFrame(raf); setRun(false); display.textContent='06:00'; qr.innerHTML=''; laps=0; liveExtra=0; endFrac=0; manualExtra.value='0'; recalc(); });
    incBtns.forEach(b=> on(b,'click',()=>{ if(running){ liveExtra += parseFloat(b.dataset.inc||'0'); recalc(); } }));
    fracBtns.forEach(b=> on(b,'click',()=>{ if(!running){ endFrac += parseFloat(b.dataset.fraction||'0'); recalc(); } }));
    on(manualExtra,'input', ()=> recalc());
    recalc();
  });
})();
