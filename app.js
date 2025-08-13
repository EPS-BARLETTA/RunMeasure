
const Bus = (()=>{ const map=new Map(); return { on:(ev,fn)=> (map.get(ev)||map.set(ev,[]).get(ev)).push(fn), emit:(ev,p)=> (map.get(ev)||[]).forEach(fn=>fn(p)) }; })();
class DigitalTimer{
  constructor(opts={}){this.screen=opts.screen;this.sub=opts.sub;this.bar=opts.bar;this.targetMs=null;this.running=false;this.t0=0;this.elapsed=0;this.raf=0;this.splits=[];}
  fmt(ms,showMs=false){const total=Math.max(0,Math.floor(ms));const m=Math.floor(total/60000);const s=Math.floor((total%60000)/1000);const cs=Math.floor((total%1000)/10);return showMs?`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
  _tick(){this.elapsed=performance.now()-this.t0; if(this.screen) this.screen.textContent=this.fmt(this.elapsed,false); if(this.targetMs&&this.bar){const p=Math.min(100,(this.elapsed/this.targetMs)*100); this.bar.style.width=p+'%';} this.raf=requestAnimationFrame(()=>this._tick());}
  start(){if(this.running) return; this.running=true; this.t0=performance.now()-this.elapsed; this.raf=requestAnimationFrame(()=>this._tick()); Bus.emit('timer:start');}
  lap(){if(!this.running) return; const now=this.elapsed; const last=this.splits.length?this.splits[this.splits.length-1].cumMs:0; const row={idx:this.splits.length+1, lapMs:now-last, cumMs:now}; this.splits.push(row); Bus.emit('timer:lap',row);}
  stop(){if(!this.running) return; this.running=false; cancelAnimationFrame(this.raf); Bus.emit('timer:stop',{totalMs:this.elapsed, splits:this.splits.slice()});}
  reset(){this.running=false; cancelAnimationFrame(this.raf); this.elapsed=0; this.splits=[]; if(this.screen) this.screen.textContent='00:00'; if(this.sub) this.sub.textContent='millisecondes masquées'; if(this.bar) this.bar.style.width='0%'; Bus.emit('timer:reset');}
  setTargetMinutes(min){this.targetMs=min?min*60*1000:null;} getTotal(){return this.elapsed;} getSplits(){return this.splits.slice();}
}
const CSV={to(elems,headers){const rows=elems.map(o=> headers.map(h=> (o[h]??'']).join(',')); return [headers.join(','),...rows.map(r=>r.join(','))].join('\n');}};
const store=(k,v)=>localStorage.setItem(k,JSON.stringify(v)); const load=(k,f=[])=>JSON.parse(localStorage.getItem(k)||JSON.stringify(f));
function download(name,content,type='text/plain;charset=utf-8'){const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);}
function nowISO(){const d=new Date(); return d.toISOString().slice(0,19).replace('T',' ');}
function toggleDark(){ document.documentElement.classList.toggle('dark'); localStorage.setItem('dark', document.documentElement.classList.contains('dark')? '1':'0'); }
function initDark(){ if(localStorage.getItem('dark')==='1'){ document.documentElement.classList.add('dark'); } }
