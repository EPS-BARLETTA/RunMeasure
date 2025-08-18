# Couche Mobile/Tablet — Chrono Intervalles EPS

> **Objectif :** rendre l'application confortable sur tablette/smartphone **sans modifier le QR code** (format, librairie, conteneur, timing).

## Fichiers ajoutés
- `mobile.css` — styles responsive (gros boutons, grille, dark mode auto).
- `ergonomie.js` — plein écran, wake lock, latence tactile réduite, audio primé.
- `manifest.json` — PWA (installable).
- `sw.js` — service worker basique (cache statique).
- `assets/icons/icon-192.png` et `icon-512.png` — icônes PWA.

## Intégration (HTML)
Dans vos pages (ex. `index.html` / `chrono.html` …) :

1. **Viewport**
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

2. **Styles + Script d'ergonomie** (ajoutez en bas de `<head>` et juste avant `</body>`)
```html
<link rel="stylesheet" href="mobile.css">
```
… et juste avant `</body>` :
```html
<script src="ergonomie.js" defer></script>
```

3. **PWA (optionnel mais recommandé)**
Dans `<head>` :
```html
<link rel="manifest" href="manifest.json">
```
Avant `</body>` :
```html
<script>
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js');
  }
</script>
```

4. **Zone QR** — **ne rien changer** (conservez votre conteneur et votre logique actuelle).

## Exemple de structure pour une page
```html
<body>
  <div class="app">
    <section class="card">
      <h2>Paramètres</h2>
      <!-- vos champs existants -->
    </section>

    <section class="card">
      <div class="timer-big" id="display">00:00.0</div>

      <div class="stats-row">
        <div class="stat"><div class="k">Tours</div><div class="v" id="tours">0</div></div>
        <div class="stat"><div class="k">Distance totale (m)</div><div class="v" id="distTotal">0</div></div>
        <div class="stat"><div class="k">Vitesse moy.</div><div class="v" id="vitesse">0</div></div>
        <div class="stat"><div class="k">VMA estimée</div><div class="v" id="vma">0</div></div>
      </div>

      <div class="controls">
        <button id="start" class="primary">Lancer</button>
        <button id="lap">+1 tour</button>
        <button id="pause">Pause</button>
        <button id="reset" class="warn">Réinitialiser</button>
        <button id="fullscreen">Plein écran</button>
      </div>

      <!-- 🔒 Zone QR non modifiée -->
      <div id="qr-wrap">
        <div id="qr"></div>
      </div>
    </section>
  </div>
</body>
```

## Rappel compatibilité ScanProf
- Conserver **exactement** le format JSON et les clés actuelles.
- Ne pas renommer l'ID du conteneur QR ni la fonction de génération.
- Ne pas changer la librairie (`qrcode.min.js`) ni son ordre de chargement.
- Générer le QR au même moment que dans votre logique existante.

## Création du ZIP
- **macOS/Linux** : `zip -r chrono-mobile-layer.zip .`
- **Windows** : clic droit sur le dossier → *Envoyer vers* → *Dossier compressé*.

Bon tests !
