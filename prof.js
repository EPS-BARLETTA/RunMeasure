// Prof - plein écran + affichage visuel VAMEVAL & LÉGER
(function(){
  document.addEventListener('DOMContentLoaded', ()=>{
    const pin=qs('#pin'), unlock=qs('#unlock'), gate=qs('#gate'), panel=qs('#panel');
    const ok=()=> pin.value.trim()==='57';
    on(unlock,'click',()=>{ if(ok()){ gate.style.display='none'; panel.style.display='block'; } else { alert('PIN incorrect'); } });

    // Fullscreen
    const fsBtn = qs('#fs');
    on(fsBtn,'click', async ()=>{
      try{
        if(!document.fullscreenElement){
          await panel.requestFullscreen();
          fsBtn.textContent = '⤡ Quitter plein écran';
        }else{
          await document.exitFullscreen();
          fsBtn.textContent = '⤢ Plein écran';
        }
      }catch(e){ alert('Plein écran non autorisé'); }
    });
    document.addEventListener('fullscreenchange', ()=>{
      if(!document.fullscreenElement) fsBtn.textContent = '⤢ Plein écran';
    });

    // Audio
    let ctx=null;
    function beep(freq=880, dur=0.08){
      if(!ctx) ctx=new (window.AudioContext||window.webkitAudioContext)();
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type='sine'; o.frequency.value=freq; o.connect(g); g.connect(ctx.destination);
      const now=ctx.currentTime; g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.8, now+0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now+dur);
      o.start(now); o.stop(now+dur);
    }

    // Elements Vameval
    const startV=qs('#startV'), stopV=qs('#stopV'), dispV=qs('#dispV'), speedV=qs('#speedV'), palierV=qs('#palierV'), remainV=qs('#remainV'), barV=qs('#barV');
    let runV=false, palier=0, speed=8, t0V=0;
    on(startV,'click', ()=>{
      if(runV) return; runV=true; palier=0; speed=8; t0V=performance.now(); beep(880,0.06);
      function loop(){
        if(!runV) return;
        const elapsed=(performance.now()-t0V)/1000;
        const p=Math.floor(elapsed/60);
        if(p!==palier){ palier=p; speed=8+0.5*palier; beep(600,0.12); }
        const ms=(speed*1000)/3600; const d=20; const interval=d/ms*1000;
        // Beep pacing
        if(!loop._last || performance.now()-loop._last >= interval-5){ beep(880,0.05); loop._last=performance.now(); }
        const secLeft = Math.max(0, 60-(elapsed%60)); remainV.textContent = secLeft.toFixed(0);
        barV.style.width = `${( (elapsed%60)/60 )*100}%`; dispV.textContent = secLeft<=10 ? `Palier ${palier} — ${speed.toFixed(1)} km/h` : `Palier ${palier}`;
        dispV.classList.toggle('blink-red', secLeft<=10);
        speedV.textContent = speed.toFixed(1); palierV.textContent = palier;
        requestAnimationFrame(loop);
      }
      loop();
    });
    on(stopV,'click', ()=>{ runV=false; dispV.textContent='Arrêté'; dispV.classList.remove('blink-red'); barV.style.width='0%'; });

    // Elements Léger
    const startL=qs('#startL'), stopL=qs('#stopL'), dispL=qs('#dispL'), speedL=qs('#speedL'), levelL=qs('#levelL'), shuttleL=qs('#shuttleL'), barL=qs('#barL');
    let runL=false, level=0, shuttle=0, lastL=0;
    const speeds=[8,9,10,11,12,12.5,13,13.5,14,14.5,15,15.5,16,16.5,17];
    on(startL,'click', ()=>{
      if(runL) return; runL=true; level=0; shuttle=0; lastL=performance.now(); beep(820,0.06);
      function loop(){
        if(!runL) return;
        const v=speeds[level]; const ms=(v*1000)/3600; const interval=20/ms*1000;
        const now=performance.now();
        if(now-lastL >= interval-5){ beep(820,0.05); shuttle++; lastL=now; if(shuttle%7===0 && level<speeds.length-1){ level++; beep(600,0.12); } }
        // bar progress within current 20m
        const frac = Math.min(1, (now-lastL)/interval); barL.style.width = `${frac*100}%`;
        dispL.textContent = `Niveau ${level+1} — Navette ${shuttle}`;
        speedL.textContent = v.toFixed(1); levelL.textContent = level+1; shuttleL.textContent = shuttle;
        requestAnimationFrame(loop);
      }
      loop();
    });
    on(stopL,'click', ()=>{ runL=false; dispL.textContent='Arrêté'; barL.style.width='0%'; });
  });
})();
