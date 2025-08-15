RunMeasure — QR JSON pour ScanProf
=====================================

Ce pack génère un QR JSON pour les modes :
- Temps intermédiaire
- Demi-Cooper (6′)
- Cooper (12′)

Le JSON suit la forme :
{
  "app":"RunMeasure",
  "mode":"cooper|demi_cooper|intermediaire",
  "nom":"...","prenom":"...","classe":"...","sexe":"...",
  "result": { ... }
}

Détails par mode
----------------
- intermediaire :
  result = { "type":"temps_intermediaire", "splits":[...], "total_ms":<int|null>, "total_hms":"MM:SS" }
- demi_cooper :
  result = { "type":"demi_cooper", "distance_m":<int|null>, "duree_s":360, "vitesse_kmh":<num|null> }
- cooper :
  result = { "type":"cooper", "distance_m":<int|null>, "duree_s":720, "vitesse_kmh":<num|null> }

QR Code
-------
La lib est chargée via CDN : https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js
Si vous préférez localement, placez le fichier qrcode.min.js à la racine et ajustez mode.html.
