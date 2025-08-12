# ChronoVitesse — pack accessible (UI claire)

Ce pack met à jour l'interface (fond clair, contrastée) et fournit :
- `index.html` : accueil simple avec 3 boutons.
- `chrono.html` : **chronos fonctionnels** (simple, tours/fractions, duel) + aide.
- `tests-eleves.html` : Cooper, Demi‑Cooper, VAMEVAL (palier +/-) + **QR JSON compatible ScanProf**.
- `vma-prof.html` : **VAMEVAL enseignant** (départ 8,0 km/h, +0,5 km/h/min, bip ~20 m), plein écran, anneau/barre de progression, pré‑départ.
- `styles.css` : thème clair accessible.

## Intégration
1. Copiez ces fichiers à la racine de votre dépôt.
2. Ouvrez `index.html` pour tester.
3. Adaptez au besoin les liens de `chrono.html` si vous avez déjà des pages chrono spécifiques.

> QR exporte le format :  
> `[{"nom":"…","prenom":"…","classe":"…","sexe":"M|F","distance":580,"vitesse":13.5,"vma":15.2}]`
