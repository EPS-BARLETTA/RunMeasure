
// Prof - PIN + Bips (Vameval & Léger 20m simplifiés)
(function(){
  document.addEventListener('DOMContentLoaded', ()=>{
    const pinInput = qs('#pin'); const unlock = qs('#unlock'); const gate = qs('#gate'); const panel = qs('#panel');
    const pinOK = ()=> (pinInput.value.trim() === '57');
    on(unlock,'click', ()=>{ if(pinOK()){ gate.style.display='none'; panel.style.display='block'; } else { alert('PIN incorrect'); } });

    // Audio setup
    let ctx=null;
    function beep(freq=880, dur=0.08){
      if(!ctx) ctx = new (window.AudioContext||window.webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type='sine'; o.frequency.value=freq; o.connect(g); g.connect(ctx.destination);
      const now = ctx.currentTime; g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.8, now+0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now+dur);
      o.start(now); o.stop(now+dur);
    }

    // Vameval parameters
    const vStart=8; // km/h
    const vStep=0.5; // km/h per minute
    // Léger 20 m (vitesses approximatives par niveau)
    const legerSpeeds = [8,9,10,11,12,12.5,13,13.5,14,14.5,15,15.5,16,16.5,17]; // km/h

    // UI elements
    const startV = qs('#startV'), stopV = qs('#stopV'), dispV=qs('#dispV');
    const startL = qs('#startL'), stopL = qs('#stopL'), dispL=qs('#dispL');
    const plotsInput = qs('#plotsLen');
    let vInt=null, lInt=null, runningV=false, runningL=false, vPalier=0, vSpeed=vStart;

    // Vameval: beep every 20m, speed increases each minute by 0.5 km/h
    on(startV,'click', ()=>{
      if(runningV) return; runningV=true; vPalier=0; vSpeed=vStart;
      const d = parseFloat(plotsInput.value)||20;
      // schedule
      const start = performance.now();
      let lastBeep = start;
      function step(){
        if(!runningV) return;
        const elapsed = (performance.now()-start)/1000;
        // Increase speed every 60s
        const p = Math.floor(elapsed/60);
        if(p!==vPalier){ vPalier=p; vSpeed = vStart + vPalier*vStep; beep(660,0.12); } // palier beep
        // Distance per second (m/s)
        const ms = (vSpeed*1000)/3600;
        const interval = d/ms*1000; // ms between beeps
        if(performance.now()-lastBeep >= interval - 5){ beep(880,0.06); lastBeep=performance.now(); }
        dispV.textContent = `Palier ${vPalier} — ${vSpeed.toFixed(1)} km/h — ${Math.max(0,60-(elapsed%60)).toFixed(0)} s`;
        requestAnimationFrame(step);
      }
      // first user gesture unlock
      beep(880,0.05);
      step();
    });
    on(stopV,'click', ()=>{ runningV=false; dispV.textContent='Arrêté'; });

    // Léger 20 m: levels with shuttles, beep each 20m
    on(startL,'click', ()=>{
      if(runningL) return; runningL=true;
      const d = 20; let level = 0; let shuttle = 0; let speed = legerSpeeds[level];
      let last = performance.now();
      function step(){
        if(!runningL) return;
        // compute interval for 20m
        const ms = (speed*1000)/3600;
        const interval = d/ms*1000;
        if(performance.now()-last >= interval - 5){
          beep(820,0.06); last=performance.now(); shuttle++;
          if(shuttle%7===0){ // after some shuttles, next level (approximate)
            level = Math.min(level+1, legerSpeeds.length-1);
            speed = legerSpeeds[level];
            beep(600,0.12);
          }
        }
        dispL.textContent = `Niveau ${level+1} — Navette ${shuttle} — ${speed.toFixed(1)} km/h`;
        requestAnimationFrame(step);
      }
      beep(820,0.05);
      step();
    });
    on(stopL,'click', ()=>{ runningL=false; dispL.textContent='Arrêté'; });
  });
})();
