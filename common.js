
// Storage
const KEY='cv.params';
function saveParams(p){ localStorage.setItem(KEY, JSON.stringify(p||{})); }
function loadParams(){ try{ return JSON.parse(localStorage.getItem(KEY)||'{}'); } catch{ return {}; } }
function requireParams(){ const p=loadParams(); if(!p.nom||!p.prenom||!p.classe){ location.href='params.html'; return null; } return p; }
function fmt2(n){ return String(n).padStart(2,'0'); }
function formatMs(ms){ const ds=Math.floor(ms/100); const m=Math.floor(ds/600); const s=Math.floor((ds%600)/10); const d=ds%10; return `${fmt2(m)}:${fmt2(s)}.${d}`; }
function formatMin(ms){ const s=Math.max(0,Math.floor(ms/1000)); const m=Math.floor(s/60); const r=s%60; return `${fmt2(m)}:${fmt2(r)}`; }
function vitesse(distance_m, duree_s){ return +(distance_m>0&&duree_s>0 ? (distance_m/duree_s)*3.6 : 0).toFixed(2); }
function buildScanProfItem({nom,prenom,classe,sexe,distance_m,duree_s,vma_kmh}){
  // Sexe canonical M/F else ""
  const sx = (sexe==='M'||sexe==='F') ? sexe : '';
  return {
    nom, prenom, classe, sexe: sx,
    distance: Math.max(0, Math.round(distance_m||0)),
    vitesse: +(distance_m>0&&duree_s>0 ? (distance_m/duree_s)*3.6 : 0).toFixed(2),
    vma: +(vma_kmh ?? (distance_m>0&&duree_s>0 ? (distance_m/duree_s)*3.6 : 0)).toFixed(2)
  };
}
function showQR(payload, holderId='qrBox'){ const el=document.getElementById('qr'); const box=document.getElementById(holderId); el.classList.remove('hidden'); box.innerHTML=''; new QRCode(box,{text:JSON.stringify(payload),width:240,height:240,correctLevel:QRCode.CorrectLevel.M}); }
// Simple settings modal helpers
function bindModal(modalId, openBtnId, onSave){
  const modal = document.getElementById(modalId);
  const openBtn = document.getElementById(openBtnId);
  const closeAll = ()=> modal.classList.remove('show');
  openBtn.addEventListener('click', ()=> modal.classList.add('show'));
  modal.querySelector('.cancel').addEventListener('click', closeAll);
  modal.querySelector('.save').addEventListener('click', ()=> { onSave(); closeAll(); });
  modal.addEventListener('click', (e)=>{ if(e.target===modal) closeAll(); });
}
