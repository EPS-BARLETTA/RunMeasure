
// Chrono libre (ascendant)
(function(){
  document.addEventListener('DOMContentLoaded', ()=>{
    const nom=qs('#nom'), prenom=qs('#prenom'), classe=qs('#classe'), lapLen=qs('#lapLen');
    const time=qs('#display'), start=qs('#startBtn'), stop=qs('#stopBtn'), reset=qs('#resetBtn');
    const incs=$all('[data-inc]'); const qr=qs('#qrcode'); const csv=qs('#saveCsv');
    let running=false, t0=0, raf=0, laps=0;

    const setUI = (r)=>{ running=r; start.disabled=r; stop.disabled=!r; reset.disabled=r; incs.forEach(b=>b.disabled=!r); };
    const tick = ()=>{ time.textContent = formatSec((performance.now()-t0)/1000); raf = requestAnimationFrame(tick); };
    const finish = ()=>{
      cancelAnimationFrame(raf); setUI(false);
      const total = Math.round((parseFloat(lapLen.value)||0) * laps);
      const payload = { mode:'libre', nom:nom.value.trim(), prenom:prenom.value.trim(), classe:classe.value.trim(), duree_s: Math.round((performance.now()-t0)/1000), distance_m: total };
      makeQRCode(qr, payload); saveRowToCsv(payload,'mc_libre');
    };

    on(start,'click',()=>{ if(!nom.value||!prenom.value||!classe.value){ alert('Nom, Prénom, Classe.'); return; }
      laps=0; t0=performance.now(); setUI(true); tick();
    });
    on(stop,'click',finish);
    on(reset,'click',()=>{ cancelAnimationFrame(raf); setUI(false); time.textContent='00:00'; qr.innerHTML=''; laps=0; });
    incs.forEach(b=> on(b,'click', ()=>{ if(running) laps += parseFloat(b.dataset.inc||'0'); }));
    on(csv,'click', ()=> exportCsvFromStore('mc_libre','multichrono_libre.csv') );
  });
})();
