
# Auto-patch Chrono ➜ QR ScanProf (minimal, zéro modif HTML)

Ce fichier **ajoute tout seul** un bouton flottant **QR ScanProf**, lit vos champs d'identité (nom, prénom, classe, sexe),
récupère les **temps intermédiaires** (laps/splits), calcule les **cumuls** et génère un **QR compatible ScanProf**
(avec **uniquement** `nom`, `prenom`, `classe`, `sexe`, `cumul_01..N`).

## Installation

1. Copiez **`scanprof-qr-auto.js`** dans votre projet (à la racine ou dans `/js`).
2. Ajoutez **UNE SEULE** balise pour l'inclure (n'importe où, idéalement en bas) :
   ```html
   <script src="./scanprof-qr-auto.js" defer></script>
   ```
   > Si vous ne voulez **rien** éditer, vous pouvez aussi l'injecter via votre bundler/outillage actuel.

C'est tout. Le script injecte automatiquement la librairie **QRCode** via CDN si elle est absente.

## Utilisation

- Un bouton rond **"QR ScanProf"** apparaît en bas à droite.
- Cliquez → un panneau s'ouvre avec le **QR**.
- Bouton **Régénérer** pour recalculer après de nouveaux laps.
- Bouton **Télécharger PNG** pour enregistrer l'image.

## Détection auto

- **Identité** : essaie `#nom`, `#prenom`, `#classe`, `#sexe`, sinon par placeholders/labels proches.
- **Splits** : cherche `.split1`, `.split`, `.lap`, `.inter`, ou un tableau dont l'entête contient *Inter/Lap/Tour*.
  - Lit `data-sec` si présent ; sinon lit le **texte** (formats `mm:ss` ou `ss.s`).

## JSON encodé dans le QR

```json
[
  { "nom": "...", "prenom": "...", "classe": "...", "sexe": "F",
    "cumul_01": "0:42", "cumul_02": "1:24", "cumul_03": "2:06" }
]
```

---

© Équipe EPS – Vauban – JB
