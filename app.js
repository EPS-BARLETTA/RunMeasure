
const Bus=(()=>{const m=new Map();return{on:(e,f)=>(m.get(e)||m.set(e,[]).get(e)).push(f),emit:(e,p)=>(m.get(e)||[]).forEach(f=>f(p))}})();
const store=(k,v)=>localStorage.setItem(k,JSON.stringify(v));const load=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
function download(n,c,t='text/plain;charset=utf-8'){const b=new Blob([c],{type:t});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=n;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u)}
function toggleDark(){document.documentElement.classList.toggle('dark');store('dark',document.documentElement.classList.contains('dark')?1:0)};function initDark(){if(load('dark',0)===1)document.documentElement.classList.add('dark')}
function toggleXL(){document.documentElement.classList.toggle('xl');store('xl',document.documentElement.classList.contains('xl')?1:0)};function initXL(){if(load('xl',0)===1)document.documentElement.classList.add('xl')}
async function registerSW(){if('serviceWorker'in navigator){try{await navigator.serviceWorker.register('./assets/sw.js')}catch(e){}}}
function baseInit(){initDark();initXL();registerSW()}
class DigitalTimer{constructor(o={}){this.screen=o.screen;this.sub=o.sub;this.bar=o.bar;this.running=false;this.t0=0;this.elapsed=0;this.raf=0;this.splits=[];this.targetMs=null}
fmt(ms,show=false){ms=Math.max(0,Math.floor(ms));const m=Math.floor(ms/60000),s=Math.floor((ms%60000)/1000),cs=Math.floor((ms%1000)/10);return show?`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
_tick(){this.elapsed=performance.now()-this.t0; if(this.screen)this.screen.textContent=this.fmt(this.elapsed,false); if(this.targetMs&&this.bar){this.bar.style.width=Math.min(100,this.elapsed/this.targetMs*100)+'%'} this.raf=requestAnimationFrame(()=>this._tick())}
start(){if(this.running)return;this.running=true;this.t0=performance.now()-this.elapsed;this.raf=requestAnimationFrame(()=>this._tick());Bus.emit('timer:start')}
lap(){if(!this.running)return;const now=this.elapsed;const last=this.splits.length?this.splits[this.splits.length-1].cumMs:0;const row={idx:this.splits.length+1,lapMs:now-last,cumMs:now};this.splits.push(row);Bus.emit('timer:lap',row)}
stop(){if(!this.running)return;this.running=false;cancelAnimationFrame(this.raf);Bus.emit('timer:stop',{totalMs:this.elapsed,splits:this.splits.slice()})}
reset(){this.running=false;cancelAnimationFrame(this.raf);this.elapsed=0;this.splits=[];if(this.screen)this.screen.textContent='00:00';if(this.sub)this.sub.textContent='millisecondes masquées';if(this.bar)this.bar.style.width='0%';Bus.emit('timer:reset')}
setTargetMinutes(min){this.targetMs=min?min*60*1000:null} getTotal(){return this.elapsed} getSplits(){return this.splits.slice()}}
let oscCtx=null,useBeep=false,useVib=false,wl=null;
function beep(){if(!useBeep)return;try{oscCtx=oscCtx||new (window.AudioContext||window.webkitAudioContext)();const o=oscCtx.createOscillator(),g=oscCtx.createGain();o.type='sine';o.frequency.value=880;o.connect(g);g.connect(oscCtx.destination);const t=oscCtx.currentTime;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.25,t+.01);o.start();g.gain.exponentialRampToValueAtTime(.0001,t+.12);o.stop(t+.14)}catch(e){}}
function vibrate(ms=60){if(useVib&&navigator.vibrate)navigator.vibrate(ms)}
