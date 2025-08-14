
/*
  RunMeasure — QR plats + CSV dynamique (union des colonnes)
  ✅ Sans changement d'UI : tout est masqué tant que rien n'est généré
  ✅ Expose des helpers globaux: RM.emitIntermediaires, RM.emitChronoVitesse, RM.emitMinuteurDistance, RM.emitCooper12, RM.emitDemiCooper6
  ✅ Temps sans millisecondes (HH:MM:SS)
  Dépendances: qrcode.min.js (David Shim)
*/

window.RM = window.RM || (function(){
  // Session mémoire (pour export CSV multi-lignes)
  const SESSION = { rows: [] };

  function getVal(sel){
    const el = document.querySelector(sel);
    return (el && "value" in el) ? String(el.value||"").trim() : "";
  }
  function getSexe(){
    const r = document.querySelector('input[name="sexe"]:checked');
    if (r) return String(r.value||"").trim();
    const s = document.querySelector('#sexe');
    return s ? String(s.value||"").trim() : "";
  }
  function getStudentBase(){
    return {
      nom: getVal('#nom'),
      prenom: getVal('#prenom'),
      classe: getVal('#classe'),
      sexe: getSexe()
    };
  }

  function fmtHMS_noMs(totalSec){
    totalSec = Math.max(0, Math.round(Number(totalSec) || 0));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n)=>String(n).padStart(2,'0');
    return (h>0) ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  function buildFlatPayload(flatExtras){
    const base = getStudentBase();
    return Object.assign({
      version: "1.0",
      app: "RunMeasure",
      date_iso: new Date().toISOString()
    }, base, flatExtras || {});
  }

  function ensureRecapShell(){
    let recap = document.getElementById('recap');
    if (!recap){
      // crée dynamiquement un bloc invisible si absent (ne modifie pas le visuel tant que caché)
      recap = document.createElement('section');
      recap.id = 'recap';
      recap.style.marginTop = '1rem';
      recap.style.display = 'none';
      recap.innerHTML = [
        '<h2 style="margin:0 0 8px 0;font-size:1.1rem;">Résumé & export</h2>',
        '<pre id="qr-json" style="white-space:pre-wrap;background:#f7f7f7;border:1px solid #ddd;padding:8px;border-radius:8px;"></pre>',
        '<div id="qrcode" style="margin:12px 0;"></div>',
        '<div>',
          '<button id="export-csv" type="button">Exporter en CSV</button>',
          '<button id="reset-session" type="button" style="margin-left:8px;">Réinitialiser la session</button>',
        '</div>'
      ].join('');
      // place à la fin du body pour ne pas bousculer la mise en page
      document.body.appendChild(recap);
    }
    return recap;
  }

  function showAndPush(payloadFlat){
    const recap = ensureRecapShell();
    // JSON lisible
    const pre = document.getElementById('qr-json');
    if (pre) pre.textContent = JSON.stringify(payloadFlat, null, 2);

    // QR
    const qrDiv = document.getElementById('qrcode');
    if (qrDiv) {
      qrDiv.innerHTML = '';
      if (typeof QRCode !== "undefined"){
        new QRCode(qrDiv, {
          text: JSON.stringify(payloadFlat),
          width: 220,
          height: 220,
          correctLevel: QRCode.CorrectLevel.M
        });
      } else {
        qrDiv.textContent = "Erreur: bibliothèque QRCode manquante.";
      }
    }
    // Afficher le bloc
    recap.style.display = 'block';
    // Empiler pour CSV
    SESSION.rows.push(payloadFlat);
  }

  function safeCSV(val){
    if (val === null || val === undefined) return '';
    const s = String(val);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }

  function exportCSV(){
    const rows = SESSION.rows;
    if (!rows.length){ alert('Aucune donnée à exporter.'); return; }
    const baseOrder = ['version','app','date_iso','nom','prenom','classe','sexe','test'];
    const allKeys = new Set();
    rows.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));
    const extras = [...allKeys].filter(k => !baseOrder.includes(k)).sort();
    const headers = [...baseOrder, ...extras];
    const lines = [ headers.join(',') ];
    for (const r of rows){
      lines.push(headers.map(h=>safeCSV(r[h])).join(','));
    }
    const csv = lines.join('\r\n');
    const blob = new Blob(["\uFEFF"+csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RunMeasure_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  // Actions boutons (fonctionnent sur le shell auto-généré OU si l'HTML existe déjà)
  document.addEventListener('click', (e)=>{
    const id = e.target && e.target.id;
    if (id === 'export-csv') exportCSV();
    if (id === 'reset-session'){
      SESSION.rows = [];
      const qrDiv = document.getElementById('qrcode'); if (qrDiv) qrDiv.innerHTML='';
      const pre   = document.getElementById('qr-json'); if (pre) pre.textContent='';
      const recap = document.getElementById('recap'); if (recap) recap.style.display='none';
    }
  });

  // ==== Emitters publics ====
  function emitIntermediaires(distanceCibleM, pasM, distances, cumulSecs, opts){
    const extras = {
      test: "Tps intermédiaires",
      distance_cible_m: Number(distanceCibleM) || '',
      pas_intermediaire_m: Number(pasM) || ''
    };
    (distances||[]).forEach((d, i)=>{
      const key = `tps_${d}`;
      extras[key] = fmtHMS_noMs((cumulSecs||[])[i] || 0);
    });
    if (opts && opts.temps_total_s != null){
      extras.temps_total_s = Math.round(opts.temps_total_s);
      extras.temps_total_hms = fmtHMS_noMs(opts.temps_total_s);
    }
    if (opts && opts.distance_realisee_m != null) extras.distance_realisee_m = Math.round(opts.distance_realisee_m);
    if (opts && opts.vitesse_kmh != null) extras.vitesse_kmh = Math.round(opts.vitesse_kmh*10)/10;
    showAndPush(buildFlatPayload(extras));
  }

  function emitChronoVitesse(distanceM, tempsTotalSec){
    const d = Number(distanceM)||0, t = Math.max(0, Number(tempsTotalSec)||0);
    const v = t>0 ? (d/1000)/(t/3600) : 0;
    showAndPush(buildFlatPayload({
      test: "Chrono + vitesse",
      distance_m: Math.round(d),
      temps_total_s: Math.round(t),
      temps_total_hms: fmtHMS_noMs(t),
      vitesse_kmh: Math.round(v*10)/10
    }));
  }

  function emitMinuteurDistance(dureeSec, distanceM){
    const d = Number(distanceM)||0, t = Math.max(0, Number(dureeSec)||0);
    const v = t>0 ? (d/1000)/(t/3600) : 0;
    showAndPush(buildFlatPayload({
      test: "Minuteur + distance",
      duree_minuteur_s: Math.round(t),
      duree_minuteur_hms: fmtHMS_noMs(t),
      distance_realisee_m: Math.round(d),
      vitesse_kmh: Math.round(v*10)/10
    }));
  }

  function emitCooper12(distanceM){
    const t = 12*60;
    const d = Number(distanceM)||0;
    const v = (d/1000)/(t/3600);
    showAndPush(buildFlatPayload({
      test: "Cooper 12min",
      duree_s: t,
      duree_hms: fmtHMS_noMs(t),
      distance_realisee_m: Math.round(d),
      vitesse_moy_kmh: Math.round(v*10)/10,
      vma_estimee_kmh: Math.round(v*10)/10
    }));
  }

  function emitDemiCooper6(distanceM){
    const t = 6*60;
    const d = Number(distanceM)||0;
    const v = (d/1000)/(t/3600);
    showAndPush(buildFlatPayload({
      test: "Demi-Cooper 6min",
      duree_s: t,
      duree_hms: fmtHMS_noMs(t),
      distance_realisee_m: Math.round(d),
      vitesse_moy_kmh: Math.round(v*10)/10,
      vma_estimee_kmh: Math.round(v*10)/10
    }));
  }

  return {
    emitIntermediaires,
    emitChronoVitesse,
    emitMinuteurDistance,
    emitCooper12,
    emitDemiCooper6
  };
})();
