
(function(){
  document.addEventListener('DOMContentLoaded', ()=>{
    const nom=qs('#nom'), prenom=qs('#prenom'), classe=qs('#classe');
    const lapLen=qs('#lapLen'), display=qs('#display'), start=qs('#startBtn'), stop=qs('#stopBtn'), reset=qs('#resetBtn');
    const incBtns=$all('[data-inc]'), qr=qs('#qrcode'), saveCsv=qs('#saveCsv');
    let running=false, t0=0, raf=0, laps=0;

    const tick = ()=>{ display.textContent = formatSec((performance.now()-t0)/1000); raf=requestAnimationFrame(tick); };
    const setRun=(r)=>{ running=r; start.disabled=r; stop.disabled=!r; reset.disabled=r; incBtns.forEach(b=>b.disabled=!r); };
    const finish=()=>{
      cancelAnimationFrame(raf); setRun(false);
      const total = Math.round((parseFloat(lapLen.value)||0) * laps);
      const payload = { mode:'libre', nom:nom.value.trim(), prenom:prenom.value.trim(), classe:classe.value.trim(),
        duree_s: Math.round((performance.now()-t0)/1000), distance_m: total };
      makeQRCode(qr, payload); saveRowToCsv(payload,'mc_libre');
    };

    on(start,'click',()=>{ if(!nom.value||!prenom.value||!classe.value){alert('Nom, Prénom, Classe.'); return;}
      laps=0; t0=performance.now(); setRun(true); tick(); });
    on(stop,'click',finish);
    on(reset,'click',()=>{ cancelAnimationFrame(raf); setRun(false); display.textContent='00:00'; qr.innerHTML=''; laps=0; });
    incBtns.forEach(b=> on(b,'click',()=>{ if(running) laps += parseFloat(b.dataset.inc||'0'); }));
    on(saveCsv,'click',()=> exportCsvFromStore('mc_libre','multichrono_libre.csv') );
  });
})();
