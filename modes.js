/* modes.js — RunMeasure
 * Ajoute la génération de QR JSON (compatible ScanProf) pour :
 * - Temps intermédiaire
 * - Demi-Cooper (6′)
 * - Cooper (12′)
 *
 * Hypothèses douces :
 * - qrcode.min.js est chargé AVANT ce fichier (defer conseillé).
 * - La page mode.html est appelée avec ?mode=... parmi:
 *   "chrono", "minuteur", "chrono_vitesse", "minuteur_distance",
 *   "intermediaire", "demi_cooper", "cooper"
 * - Les infos élève sont saisies sur options.html puis stockées
 *   dans localStorage sous la clé "eleve" (voir getEleve()).
 * - Le DOM des pages de mode expose les valeurs (distance, durée, splits)
 *   via des ids/classes usuels. Ce fichier essaie plusieurs sélecteurs.
 */

/* ===================== Utilitaires ===================== */

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function parseQuery() {
  const p = new URLSearchParams(location.search);
  return Object.fromEntries(p.entries());
}

function timeToMs(str) {
  // Accepte "MM:SS", "HH:MM:SS", avec option millisecondes "MM:SS.mmm"
  if (!str) return null;
  const parts = str.trim().split(':').map(s => s.trim());
  if (parts.length < 2) return null;
  let h = 0, m = 0, s = 0;
  if (parts.length === 2) {
    [m, s] = parts;
  } else if (parts.length === 3) {
    [h, m, s] = parts;
  }
  let ms = 0;
  if (String(s).includes('.')) {
    const [ss, mmm] = String(s).split('.');
    s = Number(ss);
    ms = Number(mmm.padEnd(3, '0').slice(0,3));
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
  const v = Number(String(n).replace(',','.'));
  return Number.isFinite(v) ? v : null;
}

/* ===================== Élève ===================== */

function getEleve() {
  // Cherche d’abord en cache, sinon lit le formulaire si présent
  try {
    const raw = localStorage.getItem('eleve');
    if (raw) {
      const e = JSON.parse(raw);
      if (e && (e.nom||e.prenom||e.classe||e.sexe)) return e;
    }
  } catch {}
  // Lecture directe d’un éventuel bloc “Informations élève” sur la page
  const nom = $('#nom')?.value || $('[name="nom"]')?.value || '';
  const prenom = $('#prenom')?.value || $('[name="prenom"]')?.value || '';
  const classe = $('#classe')?.value || $('[name="classe"]')?.value || '';
  const sexe = ($('[name="sexe"]:checked')?.value || $('#sexe')?.value || '').toLowerCase();
  const e = { nom, prenom, classe, sexe };
  try { localStorage.setItem('eleve', JSON.stringify(e)); } catch {}
  return e;
}

/* ===================== QR ===================== */

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
    // Par défaut on l’ajoute en bas du contenu
    ( $('#result') || $('#app') || $('main') || document.body ).appendChild(box);
  }
  return box;
}

function renderQR(payloadObj) {
  const box = ensureQrContainer();
  const target = $('#qr');
  const pre = $('#qr-json');
  if (!target) return;

  const text = JSON.stringify(payloadObj);
  // Nettoie avant re-render
  target.innerHTML = '';
  if (typeof QRCode !== 'undefined') {
    new QRCode(target, {
      text,
      width: 220,
      height: 220,
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    // Fallback si lib absente
    target.textContent = 'QRCode library manquante (qrcode.min.js)';
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
    // Champ standardisé pour ScanProf :
    result
  };
}

/* ===================== Collecte des résultats par mode ===================== */

// Récupère une distance (m) depuis divers emplacements possibles
function readDistanceMeters() {
  // <span id="distance-result">1234 m</span>
  let txt = $('#distance-result')?.textContent || $('#distance')?.textContent || '';
  txt = txt.replace(/[^\d.,]/g,'').replace(',','.');
  let v = Number(txt);
  if (Number.isFinite(v) && v>0) return Math.round(v);

  // <input id="distance-input" value="1234">
  v = safeNumber($('#distance-input')?.value || $('[name="distance"]')?.value);
  if (v) return Math.round(v);

  // Essai sur un total en mètres dans un tableau (ex: data-total-m)
  const any = $('[data-total-m]');
  if (any) {
    v = safeNumber(any.getAttribute('data-total-m'));
    if (v) return Math.round(v);
  }
  return null;
}

// Récupère une durée ms depuis divers emplacements possibles
function readDurationMs(fallbackSec=null) {
  // <span id="time-result">MM:SS(.mmm)</span>
  let t = $('#time-result')?.textContent || $('#duree')?.textContent || '';
  let ms = timeToMs(t);
  if (ms) return ms;

  // <input id="time-input">
  ms = timeToMs($('#time-input')?.value || $('[name="duree"]')?.value);
  if (ms) return ms;

  // data-total-ms
  const any = $('[data-total-ms]');
  if (any) {
    const v = safeNumber(any.getAttribute('data-total-ms'));
    if (v) return Math.round(v);
  }
  // Fallback fixe (ex: 6 min ou 12 min)
  if (fallbackSec) return fallbackSec*1000;
  return null;
}

// Récupère les temps intermédiaires au format texte "MM:SS(.mmm)" dans un tableau
function readSplits() {
  // Cas 1: <table id="splits-table"> avec des <td class="split">MM:SS</td>
  let splits = $all('#splits-table .split')
    .map(td => td.textContent.trim()).filter(Boolean);
  if (splits.length) return splits;

  // Cas 2: éléments portant data-split="MM:SS"
  splits = $all('[data-split]').map(el => el.getAttribute('data-split')).filter(Boolean);
  if (splits.length) return splits;

  // Cas 3: liste <ul id="splits"> <li>MM:SS</li>
  splits = $all('#splits li').map(li => li.textContent.trim()).filter(Boolean);
  if (splits.length) return splits;

  return [];
}

/* ======== Générateurs par mode ======== */

function buildIntermediairePayload() {
  const splits = readSplits();
  // Si la page expose un total, on prend, sinon on additionne
  let totalMs = readDurationMs(null);
  if (!totalMs && splits.length) {
    totalMs = splits.reduce((acc, t) => acc + (timeToMs(t)||0), 0);
  }
  const result = {
    type: "temps_intermediaire",
    splits,                // ex: ["00:45.12","01:31.20", ...]
    total_ms: totalMs,     // total en ms si disponible
    total_hms: totalMs ? msToTime(totalMs) : null
  };
  return basePayload("intermediaire", result);
}

function buildDemiCooperPayload() {
  const dureeMs = readDurationMs(6*60); // 6 minutes
  const dist = readDistanceMeters();
  const v = (dist && dureeMs) ? kmh(dist, dureeMs) : null;
  const result = {
    type: "demi_cooper",
    distance_m: dist,
    duree_s: dureeMs ? Math.round(dureeMs/1000) : null,
    vitesse_kmh: v
  };
  return basePayload("demi_cooper", result);
}

function buildCooperPayload() {
  const dureeMs = readDurationMs(12*60); // 12 minutes
  const dist = readDistanceMeters();
  const v = (dist && dureeMs) ? kmh(dist, dureeMs) : null;
  const result = {
    type: "cooper",
    distance_m: dist,
    duree_s: dureeMs ? Math.round(dureeMs/1000) : null,
    vitesse_kmh: v
  };
  return basePayload("cooper", result);
}

/* ===================== Wiring ===================== */

function addQrButtonIfMissing(handler) {
  if ($('#btn-make-qr')) return;
  const btn = document.createElement('button');
  btn.id = 'btn-make-qr';
  btn.textContent = "📱 Générer le QR JSON";
  btn.style.cssText = `
    display:inline-block; margin-top:12px; padding:10px 14px; border-radius:10px;
    border:1px solid #ccc; font-weight:600; cursor:pointer; background:#f5f5f5;
  `;
  ( $('#result') || $('#actions') || $('main') || document.body ).appendChild(btn);
  btn.addEventListener('click', () => {
    try {
      const payload = handler();
      renderQR(payload);
    } catch (e) {
      alert("Impossible de générer le QR: " + e.message);
      console.error(e);
    }
  });
}

function boot() {
  const { mode } = parseQuery();

  // Intermédiaire
  if (mode === 'intermediaire' || /interm/.test(mode||'')) {
    addQrButtonIfMissing(buildIntermediairePayload);
    return;
  }
  // Demi-Cooper
  if (mode === 'demi_cooper' || mode === 'demi-cooper' || /demi.*cooper/.test(mode||'')) {
    addQrButtonIfMissing(buildDemiCooperPayload);
    return;
  }
  // Cooper
  if (mode === 'cooper') {
    addQrButtonIfMissing(buildCooperPayload);
    return;
  }

  // Les autres modes restent gérés comme avant (aucune casse).
  // Si tu veux forcer un QR générique sur d’autres pages, tu peux raccrocher ici de la même façon.
}

document.addEventListener('DOMContentLoaded', boot);

/* ===================== Notes d’intégration =====================
1) Vérifie que qrcode.min.js est chargé AVANT modes.js (idéalement <script defer> pour les deux).
2) Les sélecteurs utilisés pour lire distance/durée/splits sont "meilleurs efforts".
   Si ta page utilise d’autres ids/classes, adapte readDistanceMeters(), readDurationMs(), readSplits().
3) Le payload final ressemble à :
   {
     "app":"RunMeasure", "mode":"cooper", "nom":"...", "prenom":"...",
     "classe":"...", "sexe":"...",
     "result": { "type":"cooper", "distance_m": 2400, "duree_s": 720, "vitesse_kmh": 12.0 }
   }
   → C’est un JSON simple que ScanProf sait lire si tu alignes les clés attendues de ton côté.
4) Si tu veux aplatir certaines clés (exposer "distance" au lieu de "distance_m"),
   fais-le ici pour coller exactement à ce que consomme ScanProf.
=============================================================== */
