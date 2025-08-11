
// Storage & utilities + theme + CSV
const KEY='cv.params';
const THEME_KEY='cv.theme';
function saveParams(p){ localStorage.setItem(KEY, JSON.stringify(p||{})); }
function loadParams(){ try{ return JSON.parse(localStorage.getItem(KEY)||'{}'); } catch{ return {}; } }
function requireParams(){ const p=loadParams(); if(!p.nom||!p.prenom||!p.classe){ location.href='params.html'; return null; } return p; }
const fmt2=n=>String(n).padStart(2,'0');
function formatMs(ms){ const ds=Math.floor(ms/100); const m=Math.floor(ds/600); const s=Math.floor((ds%600)/10); const d=ds%10; return `${fmt2(m)}:${fmt2(s)}.${d}`; }
function formatMin(ms){ const s=Math.max(0,Math.floor(ms/1000)); const m=Math.floor(s/60); const r=s%60; return `${fmt2(m)}:${fmt2(r)}`; }
function vitesse(distance_m, duree_s){ return +(distance_m>0&&duree_s>0 ? (distance_m/duree_s)*3.6 : 0).toFixed(2); }
function buildScanProfItem({nom,prenom,classe,sexe,distance_m,duree_s,vma_kmh}){
  const sx = (sexe==='M'||sexe==='F') ? sexe : '';
  return {
    nom, prenom, classe, sexe: sx,
    distance: Math.max(0, Math.round(distance_m||0)),
    vitesse: +(distance_m>0&&duree_s>0 ? (distance_m/duree_s)*3.6 : 0).toFixed(2),
    vma: +(vma_kmh ?? (distance_m>0&&duree_s>0 ? (distance_m/duree_s)*3.6 : 0)).toFixed(2),
    duree_s: Math.round(duree_s||0)
  };
}
function showQR(payload, holderId='qrBox'){
  const el=document.getElementById('qr'); const box=document.getElementById(holderId);
  el.classList.remove('hidden'); box.innerHTML=''; new QRCode(box,{text:JSON.stringify(payload),width:240,height:240,correctLevel:QRCode.CorrectLevel.M});
  // store last payload for CSV
  window.__lastPayload = payload;
  const csvBtn = document.getElementById('csvBtn');
  if(csvBtn){ csvBtn.disabled=false; }
}
function payloadToCSV(arr){
  if(!Array.isArray(arr)||!arr.length) return '';
  const std = ['nom','prenom','classe','sexe','distance','vitesse','vma','duree_s'];
  const keys = new Set(std);
  arr.forEach(o=> Object.keys(o).forEach(k=>{ if(!['details'].includes(k)) keys.add(k); }));
  const headers=[...keys];
  const rows=[headers.join(',')];
  arr.forEach(o=>{
    const line = headers.map(h=> {
      let v = o[h];
      if(typeof v==='object'&&v!==null) v = JSON.stringify(v);
      return (v===undefined||v===null)? '' : String(v).replace(/"/g,'""');
    }).map(x=> `"${x}"`).join(',');
    rows.push(line);
  });
  return rows.join('\n');
}
function exportCSV(filename='resultats.csv'){
  const arr = window.__lastPayload||[];
  const csv = payloadToCSV(arr);
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}
// theme
function applyTheme(t){ document.documentElement.classList.toggle('dark', t==='dark'); localStorage.setItem(THEME_KEY, t); }
function initTheme(){ const t=localStorage.getItem(THEME_KEY)||'light'; applyTheme(t); const btn=document.getElementById('themeBtn'); if(btn){ btn.textContent = (t==='dark'?'☀️ Clair':'🌙 Sombre'); btn.onclick=()=>{ const nt=(localStorage.getItem(THEME_KEY)||'light')==='dark'?'light':'dark'; applyTheme(nt); btn.textContent = (nt==='dark'?'☀️ Clair':'🌙 Sombre'); }; } }
// modal
function bindModal(modalId, openBtnId, onSave){
  const modal = document.getElementById(modalId);
  const openBtn = document.getElementById(openBtnId);
  const close = ()=> modal.classList.remove('show');
  if(openBtn){ openBtn.addEventListener('click', ()=> modal.classList.add('show')); }
  modal.querySelector('.cancel').addEventListener('click', close);
  modal.querySelector('.save').addEventListener('click', ()=> { onSave(); close(); });
  modal.addEventListener('click', (e)=>{ if(e.target===modal) close(); });
}
// metronome (20 m beeps) for Léger & VAMEVAL
const Metronome = (()=>{
  let ctx, osc, gain, running=false, beatEl=null, speedKmh=8.0, palierStart=0, palierDurMs=60000, stepM=20, lastTick=0, tickInt=0;
  function kmhToMs(kmh){ return kmh / 3.6; }
  function intervalMs(){ const v=kmhToMs(speedKmh); return (stepM / v) * 1000; } // time to cover 20 m
  function beep(){
    try{
      if(!ctx) ctx = new (window.AudioContext||window.webkitAudioContext)();
      osc = ctx.createOscillator(); gain = ctx.createGain();
      osc.type='sine'; osc.frequency.value=880; gain.gain.value=0.1;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); setTimeout(()=>{ try{osc.stop();}catch(e){} }, 120);
    }catch(e){ /* audio blocked by browser until first user gesture */ }
  }
  function start(cfg){ if(running) return; speedKmh=cfg.startKmh||8.0; stepM=cfg.stepM||20; palierDurMs=cfg.palierMs||60000; beatEl=cfg.beatEl||null; running=true; palierStart=performance.now(); lastTick=performance.now();
    tickInt = setInterval(()=>{
      const now=performance.now();
      if(now - lastTick >= intervalMs()-2){ lastTick=now; if(cfg.sound!==false) beep(); if(beatEl){ beatEl.classList.add('on'); setTimeout(()=>beatEl.classList.remove('on'),80); } }
      if(now - palierStart >= palierDurMs){ palierStart=now; speedKmh += 0.5; if(cfg.onPalier) cfg.onPalier(speedKmh); }
    }, 10);
  }
  function stop(){ if(!running) return; running=false; clearInterval(tickInt); }
  return { start, stop };
})();
