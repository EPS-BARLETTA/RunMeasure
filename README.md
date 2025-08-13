# Chrono Vitesse EPS — version tablette

- Chrono/minuteur **digital** (pas de cadran rond), lisible sur tablette.
- **Intermédiaires**: temps au passage, cumulé, total (millièmes masqués en live).
- Tests **VMA 6'** et **12'**: barre de progression + VMA et vitesse mises à jour **à chaque tour** (tour par défaut = 200 m).
- **Élève**: sélecteur `Sexe = choisir / fille / garcon / autre`, QR code JSON compatible **ScanProf** (avec clés doublées Nom/Prénom/Classe/Sexe/VMA).
- **Prof**: importer CSV, cliquer un élève pour lui affecter la VMA courante, trier (alpha, VMA↑↓), **export CSV** et **PDF**.

## Fichiers
- `index.html` — accueil
- `eleve.html` — espace élève + QR
- `prof.html` — espace prof + tri/export
- `assets/styles.css` — styles
- `assets/app.js` — timer + VMA + CSV utils

## QR JSON (compatible ScanProf)
```json
{"nom":"Martin","prenom":"Julie","classe":"2A","sexe":"F","vma":12.8,"Nom":"Martin","Prénom":"Julie","Classe":"2A","Sexe":"F","VMA":12.8}
```

## Déploiement
Pousse ce dossier sur GitHub puis active GitHub Pages (branch `main`, `/` root). Ouvre `index.html`.
