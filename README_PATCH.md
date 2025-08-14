
# Patch QR/CSV pour RunMeasure

Ce ZIP ajoute **génération de QR JSON plats** et **export CSV** sans changer l’UI existante.

## 1) Ajouter les `<script>` dans `mode.html` (le plus bas possible avant `</body>`)

```html
<!-- QRCode.js (obligatoire) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js" defer></script>
<!-- Helpers QR/CSV (ce fichier du ZIP) -->
<script src="./rm-qrcode.js" defer></script>
```

> *Astuce* : si tu ne veux **rien** modifier de l’HTML, tu peux seulement ajouter ces 2 balises.
> Le bloc récap (QR + JSON + boutons) se crée **dynamiquement** et reste **caché** tant que tu n’émets rien.

## 2) Appeler les helpers à la fin de chaque mode (dans `modes.js` déjà en place)

- **Intermédiaires (temps cumulés)**  
  ```js
  // distances[] en mètres (ex: [200,400,600,800])
  // cumulSecs[] en secondes cumulées (arrondies) pour chaque distance
  RM.emitIntermediaires(distanceCibleM, pasM, distances, cumulSecs, {
    temps_total_s,                // optionnel
    distance_realisee_m,          // optionnel
    vitesse_kmh                   // optionnel
  });
  ```

- **Chrono + vitesse**  
  ```js
  RM.emitChronoVitesse(distanceM, tempsTotalSec);
  ```

- **Minuteur + distance**  
  ```js
  RM.emitMinuteurDistance(dureeSec, distanceM);
  ```

- **Cooper 12 min**  
  ```js
  RM.emitCooper12(distanceM);
  ```

- **Demi‑Cooper 6 min**  
  ```js
  RM.emitDemiCooper6(distanceM);
  ```

## 3) CSV
Le bouton **Exporter en CSV** apparaît dans le bloc récap une fois un premier résultat émis.
Le CSV contient l’union des colonnes rencontrées pendant la session.

## 4) ScanProf
Le contenu du QR est un JSON **plat** contenant toujours :
`version, app, date_iso, nom, prenom, classe, sexe, test, ...infos du test...`  
Les temps sont formatés **HH:MM:SS** (sans millisecondes).
