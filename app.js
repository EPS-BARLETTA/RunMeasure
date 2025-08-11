
// ===== Helpers =====
const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
const fmt2 = n => String(n).padStart(2,'0');
const nowMs = ()=>Date.now();
function formatMs(ms){
  const ds = Math.floor(ms/100);
  const m = Math.floor(ds/600);
  const s = Math.floor((ds%600)/10);
  const d = ds%10;
  return `${fmt2(m)}:${fmt2(s)}.${d}`;
}
function vitesseFrom(distance_m, duree_s){
  return +(distance_m>0 && duree_s>0 ? (distance_m/duree_s)*3.6 : 0).toFixed(2);
}
function vmaFromDistanceTime(distance_m, duree_s){
  return vitesseFrom(distance_m, duree_s);
}
// VMA tests
function vmaCooper(distance_m){ return +(distance_m*0.005).toFixed(2); } // 12 min
function vmaSixMin(distance_m){ return +(distance_m*0.01).toFixed(2); } // 6 min
function vmaLegerFromPalier(palier){ if(!palier||palier<1) return 0; return +(8.5 + 0.5*(palier-1)).toFixed(2); }
function vmaVamevalFromPalier(palier){ if(!palier||palier<1) return 0; return +(8.0 + 0.5*(palier-1)).toFixed(2); }

// ===== Distance tracker (mono) =====
const dist = {
  tourLen:0,
  history:[],
  get total(){ return Math.max(0, Math.round(this.history.reduce((s,h)=>s+h.value_m,0))); },
  push(h){ this.history.push(h); renderDist(); },
  pop(){ this.history.pop(); renderDist(); }
};
function initDistanceTracker(){
  const tourLenInput = $('#tourLen');
  const lapsCount = $('#lapsCount');
  const distTotal = $('#distTotal');
  function render(){
    if(lapsCount) lapsCount.textContent = dist.history.filter(h=>h.type==='lap').length.toString();
    if(distTotal) distTotal.textContent = dist.total.toString();
  }
  window.renderDist = render;
  dist.tourLen = Number(tourLenInput?.value||0);
  dist.history = [];
  render();
  tourLenInput?.addEventListener('input', ()=> dist.tourLen = Number(tourLenInput.value||0));
  $('#addLap')?.addEventListener('click', ()=>{ if(!dist.tourLen) return alert('Définis la longueur de tour.'); dist.push({type:'lap', value_m:dist.tourLen}); });
  $('#add14')?.addEventListener('click', ()=>{ if(!dist.tourLen) return alert('Définis la longueur de tour.'); dist.push({type:'frac', value_m:dist.tourLen*0.25}); });
  $('#add12')?.addEventListener('click', ()=>{ if(!dist.tourLen) return alert('Définis la longueur de tour.'); dist.push({type:'frac', value_m:dist.tourLen*0.5}); });
  $('#add34')?.addEventListener('click', ()=>{ if(!dist.tourLen) return alert('Définis la longueur de tour.'); dist.push({type:'frac', value_m:dist.tourLen*0.75}); });
  $('#undoLap')?.addEventListener('click', ()=> dist.pop());
  $('#minus10')?.addEventListener('click', ()=> dist.push({type:'manual', value_m:-10}));
  $('#plus10')?.addEventListener('click', ()=> dist.push({type:'manual', value_m:+10}));
  $('#applyAdjust')?.addEventListener('click', ()=>{
    const v = Number($('#manualAdjust').value||0);
    if(!v) return;
    dist.push({type:'manual', value_m:v});
    $('#manualAdjust').value='';
  });
}

// ===== QR (ScanProf array) =====
function buildScanProfItem({ nom, prenom, classe, sexe, distance_m, duree_s, vma_kmh }) {
  const distance = Math.max(0, Math.round(distance_m || 0));
  const vitesse = +(distance > 0 && duree_s > 0 ? (distance / duree_s) * 3.6 : 0).toFixed(2);
  const vma = +(vma_kmh ?? vitesse).toFixed(2);
  return { nom:String(nom||'').trim(), prenom:String(prenom||'').trim(), classe:String(classe||'').trim(),
           sexe:(sexe==='M'||sexe==='F')?sexe:'', distance, vitesse, vma };
}
function renderQRForAthletes(athletes, { perStudent=false }={}){
  const payload = athletes.map(a=>buildScanProfItem(a));
  const holder = $('#qrGrid');
  const zone = $('#qrZoneScanProf');
  holder.innerHTML='';
  zone.classList.remove('hidden');
  if (!perStudent){
    const box = document.createElement('div');
    box.className='qr-box';
    holder.appendChild(box);
    new QRCode(box, { text: JSON.stringify(payload), width: 240, height: 240, correctLevel: QRCode.CorrectLevel.M });
  } else {
    payload.forEach(item=>{
      const box = document.createElement('div');
      box.className='qr-box';
      holder.appendChild(box);
      new QRCode(box, { text: JSON.stringify([item]), width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
    });
  }
}

// ===== UI building =====
const panel = $('#panel');
const panelTitle = $('#panel-title');
const identiteZone = $('#identiteZone');
const timersZone = $('#timersZone');
const distanceZone = $('#distanceZone');
const vmaZone = $('#vmaZone');
const mainControls = $('#mainControls');

function showPanel(title){ panel.classList.remove('hidden'); panelTitle.textContent = title; $('#qrZoneScanProf').classList.add('hidden'); }
function clearZones(){ identiteZone.innerHTML=''; timersZone.innerHTML=''; mainControls.innerHTML=''; distanceZone.classList.add('hidden'); vmaZone.classList.add('hidden'); }

function identityForm(prefix=''){
  return `
  <div class="card">
    <h4>Identité ${prefix}</h4>
    <div class="grid two">
      <label>Nom <input class="in-nom" type="text" required></label>
      <label>Prénom <input class="in-prenom" type="text" required></label>
      <label>Classe <input class="in-classe" type="text" required></label>
      <label>Sexe
        <select class="in-sexe">
          <option value="M">M</option>
          <option value="F">F</option>
        </select>
      </label>
    </div>
  </div>`;
}

function readIdentity(scope){
  return {
    nom: $('.in-nom', scope).value.trim(),
    prenom: $('.in-prenom', scope).value.trim(),
    classe: $('.in-classe', scope).value.trim(),
    sexe: ($('.in-sexe', scope).value || '').toUpperCase()
  };
}

// Mode: Chrono simple
function setupChronoSimple(){
  showPanel('Chrono simple');
  clearZones();
  identiteZone.innerHTML = identityForm();
  timersZone.innerHTML = `<div class="timer" id="timerMain">00:00.0</div>`;
  mainControls.innerHTML = `
    <button class="btn btn-start" id="start">Démarrer</button>
    <button class="btn btn-stop" id="stop" disabled>Stop</button>
    <button class="btn btn-reset" id="reset" disabled>Réinitialiser</button>
    <label class="inline"><input id="qrPerStudent" type="checkbox"> Un QR par élève</label>`;
  distanceZone.classList.remove('hidden');
  initDistanceTracker();

  let t0=null, tick=null;
  const timerEl = $('#timerMain');
  $('#start').onclick=()=>{
    t0 = nowMs();
    tick = setInterval(()=> timerEl.textContent = formatMs(nowMs()-t0), 100);
    $('#start').disabled=true; $('#stop').disabled=false; $('#reset').disabled=true;
  };
  $('#stop').onclick=()=>{
    clearInterval(tick);
    $('#stop').disabled=true; $('#reset').disabled=false;
    const duree_s = Math.round((nowMs()-t0)/1000);
    const id = readIdentity(identiteZone);
    const item = { ...id, distance_m: dist.total, duree_s, vma_kmh: vmaFromDistanceTime(dist.total, duree_s) };
    renderQRForAthletes([item], { perStudent: $('#qrPerStudent').checked });
  };
  $('#reset').onclick=()=>{ clearInterval(tick); timerEl.textContent='00:00.0'; $('#start').disabled=false; $('#stop').disabled=true; $('#reset').disabled=true; };
}

// Mode: Minuteur
function setupMinuteur(){
  showPanel('Minuteur');
  clearZones();
  identiteZone.innerHTML = identityForm();
  timersZone.innerHTML = `<div class="timer" id="timerMain">00:00.0</div>`;
  mainControls.innerHTML = `
    <label>Durée (s) <input id="minuteurDur" type="number" min="5" step="1" value="360"></label>
    <button class="btn btn-start" id="start">Démarrer</button>
    <button class="btn btn-stop" id="stop" disabled>Stop</button>
    <button class="btn btn-reset" id="reset" disabled>Réinitialiser</button>
    <label class="inline"><input id="qrPerStudent" type="checkbox"> Un QR par élève</label>`;
  distanceZone.classList.remove('hidden');
  initDistanceTracker();

  let t0=null, tick=null, targetMs=0;
  const el = $('#timerMain');
  function render(){
    const elapsed = nowMs()-t0;
    const remain = Math.max(0, targetMs - elapsed);
    el.textContent = formatMs(remain);
    if (remain<=0){ finish(); }
  }
  function finish(){
    clearInterval(tick);
    $('#stop').disabled=true; $('#reset').disabled=false;
    const duree_s = Math.round(targetMs/1000);
    const id = readIdentity(identiteZone);
    const item = { ...id, distance_m: dist.total, duree_s, vma_kmh: vmaFromDistanceTime(dist.total, duree_s) };
    renderQRForAthletes([item], { perStudent: $('#qrPerStudent').checked });
  }

  $('#start').onclick=()=>{
    targetMs = Math.max(5, Number($('#minuteurDur').value||0)) * 1000;
    t0 = nowMs();
    tick = setInterval(render, 100);
    $('#start').disabled=true; $('#stop').disabled=false; $('#reset').disabled=true;
  };
  $('#stop').onclick=()=>{ finish(); };
  $('#reset').onclick=()=>{ clearInterval(tick); el.textContent='00:00.0'; $('#start').disabled=false; $('#stop').disabled=true; $('#reset').disabled=true; };
}

// Mode: VMA
function setupVMA(){
  showPanel('VMA');
  clearZones();
  identiteZone.innerHTML = identityForm();
  timersZone.innerHTML = `<div class="timer" id="timerMain">00:00.0</div>`;
  vmaZone.classList.remove('hidden');
  mainControls.innerHTML = `
    <button class="btn btn-start" id="start">Démarrer</button>
    <button class="btn btn-stop" id="stop" disabled>Stop</button>
    <button class="btn btn-reset" id="reset" disabled>Réinitialiser</button>
    <label class="inline"><input id="qrPerStudent" type="checkbox"> Un QR par élève</label>`;
  // distance facultative (zone universelle)
  distanceZone.classList.remove('hidden');
  initDistanceTracker();

  // VMA UI logic
  const typeSel = $('#vmaType');
  const distF = $('#distanceField'); const durF = $('#dureeField'); const palF = $('#palierFields');
  function syncFields(){
    const t = typeSel.value;
    distF.classList.toggle('hidden', t==='leger'||t==='vameval');
    palF.classList.toggle('hidden', !(t==='leger'||t==='vameval'));
    durF.classList.toggle('hidden', !(t==='cooper'||t==='six'||t==='libre'));
    if (t==='cooper') $('#dureeInput').value = 720;
    else if (t==='six') $('#dureeInput').value = 360;
  }
  typeSel.addEventListener('change', syncFields); syncFields();

  $('#calcVMA').onclick=()=>{
    const t = typeSel.value;
    let v=0, explain='';
    if (t==='cooper'){ const d=Number($('#distanceInput').value||dist.total); v=vmaCooper(d); explain='Cooper 12′ : VMA = distance × 0,005'; }
    else if (t==='six'){ const d=Number($('#distanceInput').value||dist.total); v=vmaSixMin(d); explain='6′ : VMA = distance × 0,01'; }
    else if (t==='leger'){ const p=Number($('#palierInput').value||0); v=vmaLegerFromPalier(p); explain='Léger-Boucher : VMA = vitesse du palier final'; }
    else if (t==='vameval'){ const p=Number($('#palierInput').value||0); v=vmaVamevalFromPalier(p); explain='VAMEVAL : VMA = vitesse du palier final'; }
    else { const d=Number($('#distanceInput').value||dist.total), s=Number($('#dureeInput').value||0); v=vmaFromDistanceTime(d,s); explain='Libre : VMA = distance/durée × 3,6'; }
    $('#vmaValue').textContent = v.toFixed(2);
    $('#vmaExplain').textContent = explain;
    $('#vmaReadout').classList.remove('hidden');
  };

  let t0=null, tick=null;
  const timerEl = $('#timerMain');
  $('#start').onclick=()=>{
    t0 = nowMs();
    tick = setInterval(()=> timerEl.textContent = formatMs(nowMs()-t0), 100);
    $('#start').disabled=true; $('#stop').disabled=false; $('#reset').disabled=true;
  };
  $('#stop').onclick=()=>{
    clearInterval(tick);
    $('#stop').disabled=true; $('#reset').disabled=false;
    const duree_s = Math.round((nowMs()-t0)/1000);
    const id = readIdentity(identiteZone);
    const t = $('#vmaType').value;
    let vma_kmh = Number($('#vmaValue').textContent) || 0;
    if (!vma_kmh){
      // fallback par vitesse moyenne si non calculée
      vma_kmh = vmaFromDistanceTime(dist.total, duree_s);
    }
    const item = { ...id, distance_m: dist.total || Number($('#distanceInput').value||0), duree_s: (t==='cooper'||t==='six') ? Number($('#dureeInput').value||0) : duree_s, vma_kmh };
    renderQRForAthletes([item], { perStudent: $('#qrPerStudent').checked });
  };
  $('#reset').onclick=()=>{ clearInterval(tick); timerEl.textContent='00:00.0'; $('#start').disabled=false; $('#stop').disabled=true; $('#reset').disabled=true; };
}

// Mode: Duel (2 élèves)
function setupDuel(){
  showPanel('Duel (2 élèves)');
  clearZones();
  // two cards
  const cards = [`A`,`B`].map(tag=>{
    const wrap = document.createElement('div');
    wrap.className='multi-card';
    wrap.innerHTML = `
      ${identityForm(tag)}
      <div class="timer">00:00.0</div>
      <div class="controls wrap">
        <button class="btn btn-start start">Démarrer</button>
        <button class="btn btn-stop stop" disabled>Stop</button>
        <button class="btn btn-reset reset" disabled>Réinitialiser</button>
      </div>
      <div class="distance-zone">
        <div class="grid two">
          <label>Tour (m)<input class="tourLen" type="number" min="1" step="1" placeholder="ex:200"></label>
          <label>± m
            <div class="inline">
              <button class="minus10 btn">−10</button>
              <button class="plus10 btn">+10</button>
              <input class="manualAdjust" type="number" step="1" placeholder="ex: 37">
              <button class="applyAdjust btn">Appliquer</button>
            </div>
          </label>
        </div>
        <div class="controls wrap">
          <button class="btn btn-primary addLap">+1 tour</button>
          <button class="btn add14">+¼</button>
          <button class="btn add12">+½</button>
          <button class="btn add34">+¾</button>
          <button class="btn btn-reset undo">Annuler</button>
        </div>
        <div class="muted">Tours: <span class="lapsCount">0</span> • Distance: <strong class="distTotal">0</strong> m</div>
      </div>`;
    timersZone.appendChild(wrap);
    return wrap;
  });

  mainControls.innerHTML = `
    <button class="btn" id="stopAll">Stop général + QR</button>
    <label class="inline"><input id="qrPerStudent" type="checkbox"> Un QR par élève</label>`;

  function attach(card){
    let t0=null, tick=null;
    const timerEl = $('.timer', card);
    const tracker = { tourLen:0, history:[], get total(){ return Math.max(0, Math.round(this.history.reduce((s,h)=>s+h.value_m,0))); } };
    card._tracker = tracker;
    function render(){ $('.distTotal',card).textContent = tracker.total.toString();
                       $('.lapsCount',card).textContent = tracker.history.filter(h=>h.type==='lap').length.toString(); }
    $('.start',card).onclick=()=>{ t0=nowMs(); tick=setInterval(()=> timerEl.textContent=formatMs(nowMs()-t0),100);
      $('.start',card).disabled=true; $('.stop',card).disabled=false; $('.reset',card).disabled=true; card._t0=t0; card._tick=tick; };
    $('.stop',card).onclick=()=>{ clearInterval(card._tick); $('.stop',card).disabled=true; $('.reset',card).disabled=false; };
    $('.reset',card).onclick=()=>{ clearInterval(card._tick); timerEl.textContent='00:00.0'; $('.start',card).disabled=false; $('.stop',card).disabled=true; $('.reset',card).disabled=true; tracker.history=[]; render(); };

    $('.tourLen',card).addEventListener('input', e=> tracker.tourLen = Number(e.target.value||0));
    const add = v=>{ if(!tracker.tourLen && v!=='manual') return alert('Définis la longueur de tour.'); tracker.history.push(v==='manual'?{type:'manual',value_m:Number($('.manualAdjust',card).value||0)}:v); render(); };
    $('.addLap',card).onclick=()=> add({type:'lap', value_m: tracker.tourLen});
    $('.add14',card).onclick=()=> add({type:'frac', value_m: tracker.tourLen*0.25});
    $('.add12',card).onclick=()=> add({type:'frac', value_m: tracker.tourLen*0.5});
    $('.add34',card).onclick=()=> add({type:'frac', value_m: tracker.tourLen*0.75});
    $('.undo',card).onclick=()=>{ tracker.history.pop(); render(); };
    $('.minus10',card).onclick=()=> add({type:'manual', value_m:-10});
    $('.plus10',card).onclick=()=> add({type:'manual', value_m:+10});
    $('.applyAdjust',card).onclick=()=> add('manual');
  }
  cards.forEach(attach);

  $('#stopAll').onclick=()=>{
    const results = cards.map(c=>{
      const id = readIdentity(c);
      const t0 = c._t0 || nowMs();
      const dur = Math.round((nowMs()-t0)/1000);
      const dm = c._tracker.total;
      const vma = vmaFromDistanceTime(dm, dur);
      return { ...id, distance_m: dm, duree_s: dur, vma_kmh: vma };
    });
    renderQRForAthletes(results, { perStudent: $('#qrPerStudent').checked });
  };
}

// Mode: Multi (4 élèves)
function setupMulti(){
  showPanel('Multi (jusqu’à 4)');
  clearZones();
  const n = 4;
  const cards = [];
  for(let i=1;i<=n;i++){
    const wrap = document.createElement('div');
    wrap.className='multi-card';
    wrap.innerHTML = `
      ${identityForm('n°'+i)}
      <div class="timer">00:00.0</div>
      <div class="controls wrap">
        <button class="btn btn-start start">Démarrer</button>
        <button class="btn btn-stop stop" disabled>Stop</button>
        <button class="btn btn-reset reset" disabled>Réinitialiser</button>
      </div>
      <div class="distance-zone">
        <div class="grid two">
          <label>Tour (m)<input class="tourLen" type="number" min="1" step="1" placeholder="ex:200"></label>
          <label>± m
            <div class="inline">
              <button class="minus10 btn">−10</button>
              <button class="plus10 btn">+10</button>
              <input class="manualAdjust" type="number" step="1" placeholder="ex: 37">
              <button class="applyAdjust btn">Appliquer</button>
            </div>
          </label>
        </div>
        <div class="controls wrap">
          <button class="btn btn-primary addLap">+1 tour</button>
          <button class="btn add14">+¼</button>
          <button class="btn add12">+½</button>
          <button class="btn add34">+¾</button>
          <button class="btn btn-reset undo">Annuler</button>
        </div>
        <div class="muted">Tours: <span class="lapsCount">0</span> • Distance: <strong class="distTotal">0</strong> m</div>
      </div>`;
    timersZone.appendChild(wrap);
    cards.push(wrap);
  }
  mainControls.innerHTML = `
    <button class="btn" id="stopAll">Stop général + QR</button>
    <label class="inline"><input id="qrPerStudent" type="checkbox"> Un QR par élève</label>`;

  function attach(card){
    let t0=null, tick=null;
    const timerEl = $('.timer', card);
    const tracker = { tourLen:0, history:[], get total(){ return Math.max(0, Math.round(this.history.reduce((s,h)=>s+h.value_m,0))); } };
    card._tracker = tracker;
    function render(){ $('.distTotal',card).textContent = tracker.total.toString();
                       $('.lapsCount',card).textContent = tracker.history.filter(h=>h.type==='lap').length.toString(); }
    $('.start',card).onclick=()=>{ t0=nowMs(); tick=setInterval(()=> timerEl.textContent=formatMs(nowMs()-t0),100);
      $('.start',card).disabled=true; $('.stop',card).disabled=false; $('.reset',card).disabled=true; card._t0=t0; card._tick=tick; };
    $('.stop',card).onclick=()=>{ clearInterval(card._tick); $('.stop',card).disabled=true; $('.reset',card).disabled=false; };
    $('.reset',card).onclick=()=>{ clearInterval(card._tick); timerEl.textContent='00:00.0'; $('.start',card).disabled=false; $('.stop',card).disabled=true; $('.reset',card).disabled=true; tracker.history=[]; render(); };

    $('.tourLen',card).addEventListener('input', e=> tracker.tourLen = Number(e.target.value||0));
    const add = v=>{ if(!tracker.tourLen && v!=='manual') return alert('Définis la longueur de tour.'); tracker.history.push(v==='manual'?{type:'manual',value_m:Number($('.manualAdjust',card).value||0)}:v); render(); };
    $('.addLap',card).onclick=()=> add({type:'lap', value_m: tracker.tourLen});
    $('.add14',card).onclick=()=> add({type:'frac', value_m: tracker.tourLen*0.25});
    $('.add12',card).onclick=()=> add({type:'frac', value_m: tracker.tourLen*0.5});
    $('.add34',card).onclick=()=> add({type:'frac', value_m: tracker.tourLen*0.75});
    $('.undo',card).onclick=()=>{ tracker.history.pop(); render(); };
    $('.minus10',card).onclick=()=> add({type:'manual', value_m:-10});
    $('.plus10',card).onclick=()=> add({type:'manual', value_m:+10});
    $('.applyAdjust',card).onclick=()=> add('manual');
  }
  cards.forEach(attach);

  $('#stopAll').onclick=()=>{
    const results = cards.map(c=>{
      const id = readIdentity(c);
      const t0 = c._t0 || nowMs();
      const dur = Math.round((nowMs()-t0)/1000);
      const dm = c._tracker.total;
      const vma = vmaFromDistanceTime(dm, dur);
      return { ...id, distance_m: dm, duree_s: dur, vma_kmh: vma };
    });
    renderQRForAthletes(results, { perStudent: $('#qrPerStudent').checked });
  };
}

// Router
$$('.mode-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const m = btn.dataset.mode;
    if (m==='chrono') setupChronoSimple();
    else if (m==='minuteur') setupMinuteur();
    else if (m==='vma') setupVMA();
    else if (m==='duel') setupDuel();
    else if (m==='multi') setupMulti();
  });
});

// Expose download all QR canvases
document.addEventListener('click', (e)=>{
  if (e.target && e.target.id==='downloadAllQR'){
    const canvases = $$('#qrGrid canvas');
    canvases.forEach((cv,i)=>{
      const a = document.createElement('a');
      a.download = `scanprof-qr-${i+1}.png`;
      a.href = cv.toDataURL('image/png');
      a.click();
    });
  }
});
