
(function(){
  document.addEventListener('DOMContentLoaded', ()=>{
    const lap=qs('#lapLen'), start=qs('#startBtn'), reset=qs('#resetBtn'), stopA=qs('#stopA'), stopB=qs('#stopB');
    const incA=$all('[data-inc-a]'), incB=$all('[data-inc-b]');
    const qr=qs('#qrcode');
    const nomA=qs('#nomA'), prenomA=qs('#prenomA'), classeA=qs('#classeA'), tA=qs('#displayA');
    const nomB=qs('#nomB'), prenomB=qs('#prenomB'), classeB=qs('#classeB'), tB=qs('#displayB');
    let running=false, t0=0, raf=0, timeA=null, timeB=null, lapsA=0, lapsB=0;

    const fmt=(s)=>formatSec(Math.floor(s));
    const render=()=>{ if(!running) return; const s=(performance.now()-t0)/1000; if(timeA===null) tA.textContent=fmt(s); if(timeB===null) tB.textContent=fmt(s); raf=requestAnimationFrame(render); };

    on(start,'click',()=>{
      if(!nomA.value||!prenomA.value||!classeA.value||!nomB.value||!prenomB.value||!classeB.value){ alert('Infos A et B requises.'); return; }
      running=true; t0=performance.now(); timeA=null; timeB=null; lapsA=0; lapsB=0;
      start.disabled=true; reset.disabled=false; stopA.disabled=false; stopB.disabled=false;
      incA.forEach(b=>b.disabled=false); incB.forEach(b=>b.disabled=false); render();
    });
    on(stopA,'click',()=>{ if(timeA!==null) return; timeA=(performance.now()-t0)/1000; stopA.disabled=true; incA.forEach(b=>b.disabled=true); if(timeB!==null){ running=false; cancelAnimationFrame(raf);} });
    on(stopB,'click',()=>{ if(timeB!==null) return; timeB=(performance.now()-t0)/1000; stopB.disabled=true; incB.forEach(b=>b.disabled=true); if(timeA!==null){ running=false; cancelAnimationFrame(raf);} });

    incA.forEach(b=> on(b,'click', ()=>{ if(running) lapsA += parseFloat(b.dataset.incA||'0'); }));
    incB.forEach(b=> on(b,'click', ()=>{ if(running) lapsB += parseFloat(b.dataset.incB||'0'); }));

    on(reset,'click',()=>{ running=false; cancelAnimationFrame(raf); start.disabled=false; reset.disabled=true; stopA.disabled=true; stopB.disabled=true;
      incA.forEach(b=>b.disabled=true); incB.forEach(b=>b.disabled=true); tA.textContent='00:00'; tB.textContent='00:00'; qr.innerHTML=''; });

    const gen=()=>{
      if(timeA===null||timeB===null){ requestAnimationFrame(gen); return; }
      const d = parseFloat(lap.value)||0;
      const payload = { mode:'duel', eleves:[
        {nom:nomA.value.trim(), prenom:prenomA.value.trim(), classe:classeA.value.trim(), duree_s:Math.round(timeA), distance_m:Math.round(lapsA*d)},
        {nom:nomB.value.trim(), prenom:prenomB.value.trim(), classe:classeB.value.trim(), duree_s:Math.round(timeB), distance_m:Math.round(lapsB*d)}
      ]};
      makeQRCode(qr, payload);
      saveRowToCsv(payload.eleves[0],'mc_duel'); saveRowToCsv(payload.eleves[1],'mc_duel');
    };
    gen();
  });
})();
