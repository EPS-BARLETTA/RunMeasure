// Prof - PIN + Bips (Vameval & Léger 20m)
(function(){
  document.addEventListener('DOMContentLoaded', ()=>{
    const pin=qs('#pin'), unlock=qs('#unlock'), gate=qs('#gate'), panel=qs('#panel');
    const ok=()=> pin.value.trim()==='57';
    on(unlock,'click',()=>{ if(ok()){ gate.style.display='none'; panel.style.display='block'; } else { alert('PIN incorrect'); } });

    let ctx=null;
    function beep(freq=880, dur=0.08){
      if(!ctx) ctx=new (window.AudioContext||window.webkitAudioContext)();
      const o=ctx.createOscillator(); const g=ctx.createGain();
      o.type='sine'; o.frequency.value=freq; o.connect(g); g.connect(ctx.destination);
      const now=ctx.currentTime; g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.8, now+0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now+dur);
      o.start(now); o.stop(now+dur);
    }

    const startV=qs('#startV'), stopV=qs('#stopV'), dispV=qs('#dispV'), plots=qs('#plotsLen');
    const startL=qs('#startL'), stopL=qs('#stopL'), dispL=qs('#dispL');
    let runV=false, runL=false, palier=0, speed=8, raf=0;

    on(startV,'click',()=>{
      if(runV) return; runV=true; palier=0; speed=8;
      const d=parseFloat(plots.value)||20; const t0=performance.now(); let last=performance.now();
      beep(880,0.05);
      (function loop(){
        if(!runV) return;
        const elapsed=(performance.now()-t0)/1000;
        const p=Math.floor(elapsed/60);
        if(p!==palier){ palier=p; speed=8+0.5*palier; beep(600,0.12); }
        const ms=(speed*1000)/3600; const interval=d/ms*1000;
        if(performance.now()-last>=interval-5){ beep(880,0.06); last=performance.now(); }
        dispV.textContent=`Palier ${palier} — ${speed.toFixed(1)} km/h — ${(60-(elapsed%60)).toFixed(0)} s`;
        raf=requestAnimationFrame(loop);
      })();
    });
    on(stopV,'click',()=>{ runV=false; dispV.textContent='Arrêté'; cancelAnimationFrame(raf); });

    const speeds=[8,9,10,11,12,12.5,13,13.5,14,14.5,15,15.5,16,16.5,17];
    on(startL,'click',()=>{
      if(runL) return; runL=true; beep(820,0.05);
      let level=0, shuttle=0, last=performance.now();
      (function loop(){
        if(!runL) return;
        const v=speeds[level]; const ms=(v*1000)/3600; const interval=20/ms*1000;
        if(performance.now()-last>=interval-5){
          beep(820,0.06); shuttle++; last=performance.now();
          if(shuttle%7===0){ level=Math.min(level+1, speeds.length-1); beep(600,0.12); }
        }
        dispL.textContent=`Niveau ${level+1} — Navette ${shuttle} — ${speeds[level].toFixed(1)} km/h`;
        requestAnimationFrame(loop);
      })();
    });
    on(stopL,'click',()=>{ runL=false; dispL.textContent='Arrêté'; });
  });
})();
