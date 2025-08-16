
# Patch Chrono ➜ QR ScanProf (minimal)

But : modifier *l'application Chrono Intervalles* pour qu'elle envoie à ScanProf **uniquement**
`nom, prenom, classe, sexe` + `cumul_01..N` (MM:SS), **sans changer ScanProf**.

## Fichiers à ajouter dans votre app
- `scanprof-qr-min.js` (génération JSON minimal + QR)
- `chrono-wire.js` (lit votre DOM et fabrique le QR à partir des splits affichés)

## 1) Inclure les scripts (tout en bas de votre HTML)

```html
<!-- Librairie QRCode (si absente) -->
<script src="https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs/qrcode.min.js" defer></script>

<!-- Pack ScanProf minimal -->
<script src="./scanprof-qr-min.js" defer></script>
<script src="./chrono-wire.js" defer></script>
```

> Conservez **un seul** chargement de `qrcode.min.js`.

## 2) Branchez l'appel (bouton ou fin de course)

Ajoutez un bouton (ou appelez à l'endroit où vos résultats sont prêts) :

```html
<button id="btn-qr">Générer le QR (ScanProf)</button>
<div id="qr1"></div>
<div id="qr2"></div>

<script>
document.getElementById('btn-qr').addEventListener('click', ()=> wireScanProfQR());
// ou directement : wireScanProfQR(); à la fin de votre calcul d'intervalles
</script>
```

## 3) Adaptez éventuellement les sélecteurs (si vos classes diffèrent)

Dans `chrono-wire.js`, modifiez la section CONFIG en haut :
```js
const CFG = {
  id: { nom:'#nom', prenom:'#prenom', classe:'#classe', sexe:'#sexe' },
  splitsSel1: '.split1',
  splitsSel2: '.split2',
  readFromCellIndex: 0,
  qr1: '#qr1', qr2: '#qr2',
};
```
- `splitsSel1` / `splitsSel2` : doivent cibler les **lignes** des temps intermédiaires.
- Si vos durées sont affichées dans un tableau, par ex. colonne 2, mettez `readFromCellIndex: 1`.
- Si vous avez les secondes en attribut, mettez `data-sec="42.3"` sur la ligne (`<tr ...>`).

## 4) Résultat QR (exemple)

```json
[
  {
    "nom": "Martin",
    "prenom": "Julie",
    "classe": "4C",
    "sexe": "F",
    "cumul_01": "0:42",
    "cumul_02": "1:24",
    "cumul_03": "2:06"
  }
]
```

## 5) Débogage

- **Rien ne s'affiche** → vérifiez les sélecteurs de `splitsSel1/splitsSel2` et la présence de `#qr1`, `#qr2`.
- **QRCode is not defined** → ajoutez la balise CDN (voir étape 1).
- **Champs vides** → vérifiez les IDs pour identité : `#nom #prenom #classe #sexe` (texte ou input).

---

© Équipe EPS – Vauban – JB
