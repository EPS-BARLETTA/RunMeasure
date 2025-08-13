
// Base helpers
const store=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const load=(k,f)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? f; }catch{ return f; } };
function download(name,content,type='text/plain;charset=utf-8'){const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);}
function toggleXL(){ document.documentElement.classList.toggle('xl'); store('xl', document.documentElement.classList.contains('xl')?1:0); }
function initXL(){ if(load('xl',0)===1) document.documentElement.classList.add('xl'); }
function baseInit(){ initXL(); }
let oscCtx=null,useBeep=false,useVib=false,wl=null;
function beep(freq=880,dur=120,vol=.25){ if(!useBeep) return; try{ oscCtx=oscCtx||new (window.AudioContext||window.webkitAudioContext)(); const o=oscCtx.createOscillator(), g=oscCtx.createGain(); o.type='sine'; o.frequency.value=freq; o.connect(g); g.connect(oscCtx.destination); const t=oscCtx.currentTime; g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+.01); o.start(); g.gain.exponentialRampToValueAtTime(0.0001,t+dur/1000); o.stop(t+dur/1000+0.02);}catch(e){} }
function vibrate(ms=60){ if(useVib && navigator.vibrate) navigator.vibrate(ms); }

// Digital timer
class DigitalTimer{
  constructor(o={}){this.screen=o.screen;this.sub=o.sub;this.bar=o.bar;this.running=false;this.t0=0;this.elapsed=0;this.raf=0;this.splits=[];this.targetMs=null;}
  fmt(ms,show=false){ms=Math.max(0,Math.floor(ms));const m=Math.floor(ms/60000),s=Math.floor((ms%60000)/1000),cs=Math.floor((ms%1000)/10);return show?`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
  _tick(){this.elapsed=performance.now()-this.t0; if(this.screen) this.screen.textContent=this.fmt(this.elapsed,false); if(this.targetMs&&this.bar){this.bar.style.width=Math.min(100,this.elapsed/this.targetMs*100)+'%'} this.raf=requestAnimationFrame(()=>this._tick())}
  start(){ if(this.running) return; this.running=true; this.t0=performance.now()-this.elapsed; this.raf=requestAnimationFrame(()=>this._tick()); document.dispatchEvent(new CustomEvent('timer:start')); }
  lap(){ if(!this.running) return; const now=this.elapsed; const last=this.splits.length?this.splits[this.splits.length-1].cumMs:0; const row={idx:this.splits.length+1, lapMs:now-last, cumMs:now}; this.splits.push(row); document.dispatchEvent(new CustomEvent('timer:lap',{detail:row})); }
  stop(){ if(!this.running) return; this.running=false; cancelAnimationFrame(this.raf); document.dispatchEvent(new CustomEvent('timer:stop',{detail:{totalMs:this.elapsed, splits:this.splits.slice()}})); }
  reset(){ this.running=false; cancelAnimationFrame(this.raf); this.elapsed=0; this.splits=[]; if(this.screen) this.screen.textContent='00:00'; if(this.sub) this.sub.textContent='millisecondes masquées'; if(this.bar) this.bar.style.width='0%'; document.dispatchEvent(new CustomEvent('timer:reset')); }
  setTargetMinutes(min){ this.targetMs=min?min*60*1000:null; }
  getTotal(){ return this.elapsed; } getSplits(){ return this.splits.slice(); }
}

// Roster (very simple)
const Roster={
  load(){ return load('roster',[]); },
  save(list){ store('roster',list); },
  add(nom,prenom,classe,sexe){ const list=this.load(); list.push({nom,prenom,classe,sexe,vma:null}); this.save(list); return list; },
  setVMA(idx,vma){ const list=this.load(); if(list[idx]){ list[idx].vma=vma; this.save(list); } return list; },
  clear(){ this.save([]); }
};

function csvFromRoster(list){
  const headers=['nom','prenom','classe','sexe','vma'];
  const rows=list.map(s=>[s.nom,s.prenom,s.classe,s.sexe, s.vma ?? '']);
  return [headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
}
