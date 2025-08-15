RunMeasure — QR fix (LAST BUILD)
====================================

Ce dossier contient 2 fichiers à pousser DIRECTEMENT :
1) modes.js  — remplace le fichier existant
   - QR JSON PLAT sans millisecondes
   - "Temps intermédiaire" + tps_XXX *et* tpsXXX (alias)
   - "Demi Cooper" / "Cooper" + alias (distance_m, vitesse_kmh, vma_kmh)
   - Lib qrcodejs chargée automatiquement
   - Cache l’affichage de version (injection CSS)
   - Export CSV conservé

2) README_QR.txt — documentation rapide

Clés JSON par mode :
- Intermédiaires :
  test="Temps intermédiaire", distance_cible_m, intervalle_m (alias pas_intermediaire_m),
  tps_200 / tps200, tps_400 / tps400, ..., temps_total_s, temps_total_hms

- Chrono + vitesse :
  test="Chrono + vitesse", distance_m, temps_total_s, temps_total_hms, vitesse_kmh

- Minuteur + distance :
  test="Minuteur + distance", duree_minuteur_s, duree_minuteur_hms, distance_realisee_m (alias distance_m), vitesse_kmh

- Demi Cooper / Cooper :
  test="Demi Cooper" ou "Cooper", duree_s, duree_hms, distance_realisee_m (alias distance_m),
  vitesse_moy_kmh (alias vitesse_kmh), vma_kmh (alias vma_estimee_kmh)
