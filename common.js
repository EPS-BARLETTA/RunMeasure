
// ===== Persistence (localStorage) =====
const STORE_KEY = 'chronoVitesse.params';
function saveParams(obj){ localStorage.setItem(STORE_KEY, JSON.stringify(obj||{})); }
function loadParams(){ try{ return JSON.parse(localStorage.getItem(STORE_KEY)||'{}'); } catch{ return {}; } }
function requireParams(){
  const p = loadParams();
  if(!p.nom || !p.prenom || !p.classe || !p.sexe){
    window.location.href = 'params.html'; return null;
  }
  return p;
}

// ===== QR (ScanProf) =====
function mapSexeForQR(sexe){
  // ScanProf canonique: "M" ou "F" ; sinon chaîne vide
  return (sexe==='M'||sexe==='F') ? sexe : '';
}
function buildScanProfItem({ nom, prenom, classe, sexe, distance_m, duree_s, vma_kmh }){
  const distance = Math.max(0, Math.round(distance_m || 0));
  const vitesse = +(distance>0 && duree_s>0 ? (distance/duree_s)*3.6 : 0).toFixed(2);
  const vma = +(vma_kmh ?? vitesse).toFixed(2);
  return { nom, prenom, classe, sexe: mapSexeForQR(sexe), distance, vitesse, vma };
}
function renderQRArray(payload, holderId='qrGrid'){
  const holder = document.getElementById(holderId);
  const zone = document.getElementById('qrZone');
  if(!holder || !zone) return;
  holder.innerHTML='';
  zone.classList.remove('hidden');
  const box = document.createElement('div');
  box.className='qr-box';
  holder.appendChild(box);
  new QRCode(box, { text: JSON.stringify(payload), width: 240, height: 240, correctLevel: QRCode.CorrectLevel.M });
}

// ===== Time & format =====
const fmt2 = n => String(n).padStart(2,'0');
function formatMs(ms){
  const total = Math.max(0, Math.floor(ms/100)); // deciseconds
  const m = Math.floor(total/600);
  const s = Math.floor((total%600)/10);
  const d = total%10;
  return `${fmt2(m)}:${fmt2(s)}.${d}`;
}
function formatMin(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const m = Math.floor(s/60);
  const r = s%60;
  return `${fmt2(m)}:${fmt2(r)}`;
}
function vitesseFrom(distance_m, duree_s){
  return +(distance_m>0 && duree_s>0 ? (distance_m/duree_s)*3.6 : 0).toFixed(2);
}
function vmaFromDistanceTime(distance_m, duree_s){
  return vitesseFrom(distance_m, duree_s);
}

// ===== Distance tracker (page/global) =====
const dist = {
  tourLen: 0, history: [],
  get total(){ return Math.max(0, Math.round(this.history.reduce((s,h)=>s+h.value_m,0))); },
  push(h){ this.history.push(h); updateDistUI && updateDistUI(); },
  pop(){ this.history.pop(); updateDistUI && updateDistUI(); }
};
function bindDistanceUI(scope=document){
  const $ = (sel)=> (scope.querySelector? scope.querySelector(sel): document.querySelector(sel));
  const tour = $('#tourLen'), laps = $('#lapsCount'), total = $('#distTotal');
  function render(){
    if(laps) laps.textContent = dist.history.filter(h=>h.type==='lap').length.toString();
    if(total) total.textContent = dist.total.toString();
  }
  window.updateDistUI = render;
  dist.tourLen = Number(tour?.value||0);
  dist.history = [];
  render();
  tour?.addEventListener('input', ()=> dist.tourLen = Number(tour.value||0));
  $('#addLap')?.addEventListener('click', ()=>{ if(!dist.tourLen) return alert('Définir la longueur de tour.'); dist.push({type:'lap', value_m: dist.tourLen}); });
  $('#add14')?.addEventListener('click', ()=>{ if(!dist.tourLen) return alert('Définir la longueur de tour.'); dist.push({type:'frac', value_m: dist.tourLen*0.25}); });
  $('#add12')?.addEventListener('click', ()=>{ if(!dist.tourLen) return alert('Définir la longueur de tour.'); dist.push({type:'frac', value_m: dist.tourLen*0.5}); });
  $('#add34')?.addEventListener('click', ()=>{ if(!dist.tourLen) return alert('Définir la longueur de tour.'); dist.push({type:'frac', value_m: dist.tourLen*0.75}); });
  $('#minus10')?.addEventListener('click', ()=> dist.push({type:'manual', value_m:-10}));
  $('#plus10')?.addEventListener('click', ()=> dist.push({type:'manual', value_m:+10}));
  $('#applyAdjust')?.addEventListener('click', ()=>{
    const v = Number(($('#manualAdjust')||{}).value||0);
    if(!v) return; dist.push({type:'manual', value_m:v}); $('#manualAdjust').value='';
  });
  $('#undoLap')?.addEventListener('click', ()=> dist.pop());
}

// ===== VMA tests =====
function vmaCooper(distance_m){ return +(distance_m*0.005).toFixed(2); } // 12 min
function vmaSixMin(distance_m){ return +(distance_m*0.01).toFixed(2); } // 6 min / Astrand
function vmaLegerFromPalier(palier){ if(!palier||palier<1) return 0; return +(8.5 + 0.5*(palier-1)).toFixed(2); }
function vmaVamevalFromPalier(palier){ if(!palier||palier<1) return 0; return +(8.0 + 0.5*(palier-1)).toFixed(2); }
