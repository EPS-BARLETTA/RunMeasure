
// Chrono 6 minutes
(function(){
  document.addEventListener('DOMContentLoaded', ()=>{
    const nom=qs('#nom'), prenom=qs('#prenom'), classe=qs('#classe'), lapLen=qs('#lapLen');
    const time=qs('#display'), start=qs('#startBtn'), stop=qs('#stopBtn'), reset=qs('#resetBtn');
    const incs=$all('[data-inc]'); const qr=qs('#qrcode'); const csv=qs('#saveCsv');
    const TARGET=6*60; let running=false, t0=0, raf=0, laps=0, last=0;

    const setUI = (r)=>{ running=r; start.disabled=r; stop.disabled=!r; reset.disabled=r; incs.forEach(b=>b.disabled=!r); };
    const tick = ()=>{
      const rem = TARGET - (performance.now()-t0)/1000;
      if(rem<=0){ time.textContent='00:00'; time.classList.remove('blink'); finish(); return; }
      if(performance.now()-last>16){ time.textContent = formatSec(Math.ceil(rem)); toggleLast10(time, rem<=10); last=performance.now(); }
      raf = requestAnimationFrame(tick);
    };
    const finish = ()=>{
      cancelAnimationFrame(raf); setUI(false);
      const total = Math.round((parseFloat(lapLen.value)||0) * laps);
      const payload = { mode:'6min', nom:nom.value.trim(), prenom:prenom.value.trim(), classe:classe.value.trim(), duree_s:TARGET, distance_m: total };
      makeQRCode(qr, payload);
      saveRowToCsv(payload, 'mc_6min');
    };

    on(start,'click',()=>{
      if(!nom.value||!prenom.value||!classe.value){ alert('Nom, Prénom, Classe.'); return; }
      laps=0; t0=performance.now(); time.textContent='06:00'; toggleLast10(time,false); setUI(true); tick();
    });
    on(stop,'click',finish);
    on(reset,'click',()=>{ cancelAnimationFrame(raf); setUI(false); time.textContent='06:00'; toggleLast10(time,false); qr.innerHTML=''; laps=0; });
    incs.forEach(b=> on(b,'click', ()=>{ if(running) laps += parseFloat(b.dataset.inc||'0'); }));
    on(csv,'click', ()=> exportCsvFromStore('mc_6min','multichrono_6min.csv') );
  });
})();
