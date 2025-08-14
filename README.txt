# RunMeasure — ZIP prêt à pousser (QR + CSV intégrés)

Ce paquet ajoute la génération de **QR JSON plats** (nom, prenom, classe, sexe, test + infos de test, temps sans ms) et l'**export CSV** sans changer votre visuel.

## Contenu
- `mode.html` : version équipée des 3 scripts nécessaires (ne modifie pas l'UI).
- `rm-qrcode.js` : moteur QR/CSV. Crée dynamiquement un bloc récap invisible par défaut.
- `modes.qr-bridge.js` : pont non intrusif. Expose des fonctions globales pour émettre les QR.

## Intégration
1. Remplacez **uniquement** ces fichiers dans votre dépôt :
   - `mode.html`
   - `rm-qrcode.js`
   - `modes.qr-bridge.js` (nouveau fichier)

2. Aucun autre fichier à toucher. L'UI reste identique.
3. Si vos modes appellent déjà une fin de test, utilisez simplement :
   - `RM_emitChronoVitesse(distanceM, tempsTotalSec)`
   - `RM_emitMinuteurDistance(dureeSec, distanceM)`
   - `RM_emitCooper12(distanceM)`
   - `RM_emitDemiCooper6(distanceM)`
   - `RM_emitInter(distanceCibleM, pasM, distances[], cumulSecs[], { temps_total_s, distance_realisee_m, vitesse_kmh })`

> Si vous ne modifiez pas votre JS, vous pouvez au moins vérifier rapidement dans la console que tout fonctionne avec les exemples affichés au chargement de la page.

## QR lisibles par ScanProf
- JSON plat
- Temps formatés `HH:MM:SS` (sans millisecondes)
- Clés par mode : voir la console ou le code de `rm-qrcode.js`
