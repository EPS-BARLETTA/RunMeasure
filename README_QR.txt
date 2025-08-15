RunMeasure — patch modes (minuscules)
======================================

Ce ZIP contient :
- mode.html (minuscule) : page de modes avec tous les éléments requis
- modes.js (minuscule) : logique + QR JSON plats (sans millisecondes) + export CSV

Clés QR selon les modes :
- Intervalles : test, distance_cible_m, pas_intermediaire_m, tps_XXX (cumulés), temps_total_s, temps_total_hms
- Chrono + vitesse : test, distance_m, temps_total_s, temps_total_hms, vitesse_kmh
- Minuteur + distance : test, duree_minuteur_s, duree_minuteur_hms, distance_realisee_m, vitesse_kmh
- Demi-Cooper / Cooper : test, duree_s, duree_hms, distance_realisee_m, vitesse_moy_kmh, vma_estimee_kmh
