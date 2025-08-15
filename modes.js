/* modes.js — RunMeasure
 * QR JSON (ScanProf) pour : intermediaire, demi_cooper, cooper
 * — sans casser les autres modes.
 * Nécessite qrcode.min.js AVANT (defer).
 */

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function timeToMs(str) {
  if (!str) return null;
  const parts = str.trim().split(':').map(s => s.trim());
  if (parts.length < 2) return null;
  let h = 0, m = 0, s = 0;
  if (parts.length === 2) { [m, s] = parts; }
  else if (parts.length === 3) { [h, m, s] = parts; }
  let ms = 0;
  if (String(s).includes('.')) {
    const [ss, mmm] = String(s).split('.');
    s = Number(ss);
    ms = Number(String(mmm).padEnd(3, '0').slice(0,3));
  } else {
    s = Number(s);
  }
  h = Number(h)||0; m = Number(m)||0;
  const totalMs = ((h*3600)+(m*60)+s)*1000 + ms;
  return Number.isFinite(totalMs) ? totalMs : null;
}
function msToTime(ms) {
  const total = Math.max(0, Math.round(ms/1000));
  const h = Math.floor(total/3600);
  const m = Math.floor((total%3600)/60);
  const s = total%60;
  const pad = n => String(n).padStart(2,'0');
  return h>0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
function kmh(distance_m, duree_ms) {
  if (!distance_m || !duree_ms) return null;
  const v = (distance_m / (duree_ms/1000)) * 3.6;
  return Math.round(v*100)/100;
}
function safeNumber(n) {
  const v = Number(String(n||'').replace(',','.'));
  return Number.isFinite(v) ? v : null;
}

function getEleve() {
  try {
    const raw = localStorage.getItem('eleve');
    if (raw) {
      const e = JSON.parse(raw);
      if (e && (e.nom||e.prenom||e.classe||e.sexe)) return e;
    }
  } catch {}
  const nom = $('#nom')?.value || $('[name="nom"]')?.value || '';
  const prenom = $('#prenom')?.value || $('[name="prenom"]')?.value || '';
  const classe = $('#classe')?.value || $('[name="classe"]')?.value || '';
  const sexe = ($('[name="sexe"]:checked')?.value || $('#sexe')?.value || '').toLowerCase();
  const e = { nom, prenom, classe, sexe };
  try { localStorage.setItem('eleve', JSON.stringify(e)); } catch {}
  return e;
}

function ensureQrContainer() {
  let box = $('#qr-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'qr-box';
    box.style.marginTop = '16px';
    box.innerHTML = `
      <h3 style="margin:0 0 8px 0;">QR JSON (ScanProf)</h3>
      <div id="qr" style="width:220px; height:220px;"></div>
      <pre id="qr-json" style="white-space:pre-wrap; word-break:break-word; font-size:12px; border:1px solid #ccc; padding:8px; border-radius:8px; margin-top:8px"></pre>
    `;
    ( $('#result') || $('#app') || $('main') || document.body ).appendChild(box);
  }
  return box;
}
function renderQR(payloadObj) {
  ensureQrContainer();
  const target = $('#qr');
  const pre = $('#qr-json');
  const text = JSON.stringify(payloadObj);
  if (target) {
    target.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(target, { text, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
    } else {
      target.textContent = 'QRCode library manquante (qrcode.min.js)';
    }
  }
  if (pre) pre.textContent = text;
}
function basePayload(mode, result) {
  const e = getEleve();
  return {
    app: "RunMeasure",
    mode,
    nom: e.nom || "",
    prenom: e.prenom || "",
    classe: e.classe || "",
    sexe: e.sexe || "",
    result
  };
}

// Lecture valeurs DOM
function readDistanceMeters() {
  let txt = $('#distance-result')?.textContent || $('#distance')?.textContent || '';
  txt = txt.replace(/[^\d.,]/g,'').replace(',','.');
  let v = Number(txt);
  if (Number.isFinite(v) && v>0) return Math.round(v);

  v = safeNumber($('#distance-input')?.value || $('[name="distance"]')?.value);
  if (v) return Math.round(v);

  const any = $('[data-total-m]');
  if (any) {
    v = safeNumber(any.getAttribute('data-total-m'));
    if (v) return Math.round(v);
  }
  return null;
}
function readDurationMs(fallbackSec=null) {
  let t = $('#time-result')?.textContent || $('#duree')?.textContent || '';
  let ms = timeToMs(t);
  if (ms) return ms;

  ms = timeToMs($('#time-input')?.value || $('[name="duree"]')?.value);
  if (ms) return ms;

  const any = $('[data-total-ms]');
  if (any) {
    const v = safeNumber(any.getAttribute('data-total-ms'));
    if (v) return Math.round(v);
  }
  if (fallbackSec) return fallbackSec*1000;
  return null;
}
function readSplits() {
  let splits = $all('#splits-table .split').map(td => td.textContent.trim()).filter(Boolean);
  if (splits.length) return splits;
  splits = $all('[data-split]').map(el => el.getAttribute('data-split')).filter(Boolean);
  if (splits.length) return splits;
  splits = $all('#splits li').map(li => li.textContent.trim()).filter(Boolean);
  if (splits.length) return splits;
  return [];
}

// Payloads
function buildIntermediairePayload() {
  const splits = readSplits();
  let totalMs = readDurationMs(null);
  if (!totalMs && splits.length) totalMs = splits.reduce((acc, t) => acc + (timeToMs(t)||0), 0);
  const result = { type: "temps_intermediaire", splits, total_ms: totalMs, total_hms: totalMs ? msToTime(totalMs) : null };
  return basePayload("intermediaire", result);
}
function buildDemiCooperPayload() {
  const dureeMs = readDurationMs(6*60);
  const dist = readDistanceMeters();
  const v = (dist && dureeMs) ? kmh(dist, dureeMs) : null;
  const result = { type: "demi_cooper", distance_m: dist, duree_s: dureeMs ? Math.round(dureeMs/1000) : null, vitesse_kmh: v };
  return basePayload("demi_cooper", result);
}
function buildCooperPayload() {
  const dureeMs = readDurationMs(12*60);
  const dist = readDistanceMeters();
  const v = (dist && dureeMs) ? kmh(dist, dureeMs) : null;
  const result = { type: "cooper", distance_m: dist, duree_s: dureeMs ? Math.round(dureeMs/1000) : null, vitesse_kmh: v };
  return basePayload("cooper", result);
}

// Bouton QR
function addQrButtonIfMissing(handler) {
  if ($('#btn-make-qr')) return;
  const btn = document.createElement('button');
  btn.id = 'btn-make-qr';
  btn.textContent = "📱 Générer le QR JSON";
  btn.style.cssText = "display:inline-block;margin-top:12px;padding:10px 14px;border-radius:10px;border:1px solid #ccc;font-weight:600;cursor:pointer;background:#f5f5f5;";
  ( $('#result') || $('#actions') || $('main') || document.body ).appendChild(btn);
  btn.addEventListener('click', () => {
    try { renderQR(handler()); }
    catch (e) { alert("Impossible de générer le QR: " + e.message); console.error(e); }
  });
}

// Boot
function boot() {
  const q = new URLSearchParams(location.search);
  let mode = (q.get('mode') || '').toLowerCase();

  // Alias
  const alias = { 'intervalles': 'intermediaire', 'demi-cooper': 'demi_cooper' };
  mode = alias[mode] || mode;

  if (!mode) return;

  if (mode === 'intermediaire') { addQrButtonIfMissing(buildIntermediairePayload); return; }
  if (mode === 'demi_cooper')   { addQrButtonIfMissing(buildDemiCooperPayload);   return; }
  if (mode === 'cooper')        { addQrButtonIfMissing(buildCooperPayload);        return; }
}
document.addEventListener('DOMContentLoaded', boot);
