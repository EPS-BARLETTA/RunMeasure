
/*! chrono-wire.js — branche Chrono Intervalles -> QR minimal ScanProf
 * Modifie l'application *sans changer ScanProf*.
 * 1) Configurez les sélecteurs ci-dessous pour vos champs & tables existants.
 * 2) Appelez `wireScanProfQR();` après que vos résultats soient connus (ou sur un bouton).
 *
 * Hypothèses par défaut (modifiables en haut) :
 *  - Inputs identitaires: #nom, #prenom, #classe, #sexe
 *  - Tableau des temps intermédiaires (athlète 1): lignes .split1 [data-sec] OU texte "mm:ss"
 *  - Tableau des temps intermédiaires (athlète 2): lignes .split2 [data-sec] OU texte "mm:ss"
 *  - Conteneurs QR: #qr1 et #qr2
 */

(function(){
  // === CONFIG — adaptez ici une fois pour toutes ===
  const CFG = {
    // IDs/Selectors d'identité (athlète courant; si vous avez 2 élèves simultanés, dupliquez l'appel)
    id: { nom:'#nom', prenom:'#prenom', classe:'#classe', sexe:'#sexe' },

    // Sélecteurs des lignes de splits (DEUX listes possibles si vous avez 2 personnes en même temps)
    splitsSel1: '.split1',
    splitsSel2: '.split2',

    // Fallback: si pas d'attribut data-sec sur la ligne, on lira le texte "mm:ss" du 1er <td>
    readFromCellIndex: 0,

    // Conteneurs QR
    qr1: '#qr1',
    qr2: '#qr2',
  };

  // === outils ===
  const $ = (s, r=document)=>r.querySelector(s);
  const $all = (s, r=document)=>Array.from(r.querySelectorAll(s));

  function parseClockToSec(txt){
    const s = String(txt||'').trim();
    if(/^\d+(\.\d+)?$/.test(s)) return Number(s); // déjà en secondes
    const m = s.match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
    if(!m) return NaN;
    const mm = Number(m[1]), ss = Number(m[2]);
    return mm*60 + ss;
  }

  function readIdentity(){
    const nom = $(CFG.id.nom)?.value?.trim() || $(CFG.id.nom)?.textContent?.trim() || '';
    const prenom = $(CFG.id.prenom)?.value?.trim() || $(CFG.id.prenom)?.textContent?.trim() || '';
    const classe = $(CFG.id.classe)?.value?.trim() || $(CFG.id.classe)?.textContent?.trim() || '';
    const sexe = $(CFG.id.sexe)?.value?.trim() || $(CFG.id.sexe)?.textContent?.trim() || '';
    return {nom, prenom, classe, sexe};
  }

  function readSplits(selector){
    const out = [];
    $all(selector).forEach(tr=>{
      const vAttr = tr.getAttribute('data-sec');
      if(vAttr!=null){
        const n = Number(vAttr);
        if(Number.isFinite(n)) out.push(n);
      }else{
        const cell = tr.querySelectorAll('td')[CFG.readFromCellIndex];
        const t = cell ? cell.textContent : tr.textContent;
        const sec = parseClockToSec(t);
        if(Number.isFinite(sec)) out.push(sec);
      }
    });
    return out;
  }

  // === API ===
  function wireScanProfQR(){
    if(!window.renderScanProfQRMin){
      console.error('scanprof-qr-min.js manquant. Chargez-le avant chrono-wire.js.');
      alert('QR: dépendance manquante (scanprof-qr-min.js).'); return;
    }

    const id = readIdentity();
    // QR pour la liste 1 (si présente)
    const splits1 = readSplits(CFG.splitsSel1);
    if($(CFG.qr1) && splits1.length){
      try{
        renderScanProfQRMin(CFG.qr1.slice(1), { ...id, splitsSec:splits1 });
      }catch(e){ console.error(e); alert('Erreur QR #1: ' + e.message); }
    }
    // QR pour la liste 2 (si présente)
    const splits2 = readSplits(CFG.splitsSel2);
    if($(CFG.qr2) && splits2.length){
      try{
        renderScanProfQRMin(CFG.qr2.slice(1), { ...id, splitsSec:splits2 });
      }catch(e){ console.error(e); alert('Erreur QR #2: ' + e.message); }
    }
  }

  // Expose global pour l'app
  window.wireScanProfQR = wireScanProfQR;
  window.__SCANPROF_QR_CFG__ = CFG; // pour adapter dynamiquement si besoin
})();
