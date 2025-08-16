
/*! scanprof-qr-min.js — QR payload minimal pour ScanProf
 * Contenu JSON : [{ nom, prenom, classe, sexe, cumul_01..N }]
 * Aucune distance/vitesse/VMA.
 */
(function(){
  function secsToClock(sec){
    if(!Number.isFinite(sec)) return "";
    const s = Math.round(sec);
    const m = Math.floor(s/60);
    const rs = String(s % 60).padStart(2,'0');
    return `${m}:${rs}`;
  }
  function cumulateSeconds(arr){
    const out = []; let acc = 0;
    (arr||[]).forEach(v=>{ acc += (Number(v)||0); out.push(acc); });
    return out;
  }
  function buildMinimalJSON(d){
    if(!d) throw new Error('buildMinimalJSON: data manquant');
    const { nom, prenom, classe, sexe, splitsSec=[] } = d;
    if(!nom || !prenom || !classe || !sexe) throw new Error('Champs identitaires manquants');
    const cumul = cumulateSeconds(splitsSec);
    const one = { nom: String(nom), prenom: String(prenom), classe: String(classe), sexe: String(sexe) };
    cumul.forEach((c,i)=> one[`cumul_${String(i+1).padStart(2,'0')}`] = secsToClock(c));
    return JSON.stringify([ one ]);
  }
  function ensureLib(){
    if(!window.QRCode){
      throw new Error("Lib QRCode absente. Ajoutez <script src='https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs/qrcode.min.js' defer></script>");
    }
  }
  function renderScanProfQRMin(containerId, data){
    ensureLib();
    const el = document.getElementById(containerId);
    if(!el) throw new Error('Conteneur QR introuvable: #' + containerId);
    el.innerHTML = '';
    const payload = buildMinimalJSON(data);
    const size = Math.max(220, Math.min(480, 170 + Math.ceil(payload.length/4)));
    new QRCode(el, { text: payload, width: size, height: size, correctLevel: QRCode.CorrectLevel.M });
    return payload;
  }
  window.renderScanProfQRMin = renderScanProfQRMin;
  window.buildMinimalJSON = buildMinimalJSON;
})();
