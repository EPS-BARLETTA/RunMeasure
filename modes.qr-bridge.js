
/* modes.qr-bridge.js
   Pont non intrusif : ne remplace rien, n'impose rien.
   - Expose des hooks globaux faciles à appeler depuis le code existant SI souhaité :
       window.RM_emitInter = RM.emitIntermediaires
       window.RM_emitChronoVitesse = RM.emitChronoVitesse
       window.RM_emitMinuteurDistance = RM.emitMinuteurDistance
       window.RM_emitCooper12 = RM.emitCooper12
       window.RM_emitDemiCooper6 = RM.emitDemiCooper6
   - Fournit des commandes console pratiques pour tester rapidement.
*/
(function(){
  if (!window.RM) { console.warn("[RunMeasure] rm-qrcode.js non chargé"); return; }
  window.RM_emitInter = RM.emitIntermediaires;
  window.RM_emitChronoVitesse = RM.emitChronoVitesse;
  window.RM_emitMinuteurDistance = RM.emitMinuteurDistance;
  window.RM_emitCooper12 = RM.emitCooper12;
  window.RM_emitDemiCooper6 = RM.emitDemiCooper6;

  console.log("%cRunMeasure QR bridge prêt.", "color:#0a0");
  console.log("Exemples console :");
  console.log("RM_emitChronoVitesse(1000, 240)  // 1000 m en 4:00");
  console.log("RM_emitMinuteurDistance(360, 1420)");
  console.log("RM_emitCooper12(2700)");
  console.log("RM_emitDemiCooper6(1400)");
  console.log("RM_emitInter(800, 200, [200,400,600,800], [45,92,139,185], { temps_total_s:185 })");
})();
