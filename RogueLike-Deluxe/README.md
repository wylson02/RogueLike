# Les Sceaux de l'Abîme — Édition Deluxe

Portage complet du RogueLike console (C#) en **jeu de bureau pixel art**, prêt pour un
empaquetage Steam via Tauri. Moteur TypeScript, rendu Canvas, audio WebAudio — zéro
dépendance à l'exécution, un seul fichier `dist/index.html`.

## 🎮 Jouer immédiatement

Ouvre simplement **`dist/index.html`** dans un navigateur (double-clic). C'est le jeu
complet : les 4 niveaux, les 3 sceaux, l'Épée de Légende, le Gardien des Sceaux, le
Roi de l'Abîme et sa phase 2.

### Contrôles

| Action | Clavier | Manette |
|---|---|---|
| Se déplacer | Flèches / ZQSD (ou WASD) | Croix / stick gauche |
| Valider | Entrée / Espace | A |
| Retour / Pause | Échap | B |
| Inventaire | I | X |
| Progression (stats) | C ou P | Y |
| Actions de combat | 1-4 (ou A/H/E/F) | Croix + A |

## ✅ Contenu du portage (fidèle au jeu C#)

- Machine à états complète : exploration, combat tour par tour, inventaire, progression,
  marchand, cinématiques, écrans de fin.
- Les 4 cartes reproduites tuile par tuile (mêmes `MapBuilder` rects), mêmes stats de
  monstres, mêmes récompenses, mêmes prix marchand, même table de butin.
- Scénario intégral : Kael et l'épée, Lysa et la clé d'armurerie, la Sentinelle,
  les 3 sceaux, l'Épée de Légende qui referme les portes, le Gardien des Sceaux
  (10 % enragé), l'intro du boss, la phase 2 du Roi de l'Abîme.
- Système jour/nuit (24 ticks) avec spawns nocturnes et buff des monstres.
- i18n FR/EN complet (menu Options).

### Nouveautés version Deluxe

- Rendu pixel art procédural : tileset par niveau, éclairage dynamique avec scintillement
  de torche, particules, ombres, minimap, HUD graphique, transitions de scène.
- Musique d'ambiance et effets sonores procéduraux (WebAudio) : thèmes exploration /
  nuit / combat / boss.
- Sauvegarde automatique (à chaque niveau + après combat), reprise depuis le menu.
- Menu options : volumes musique/SFX, langue FR/EN.
- Support manette + clavier (AZERTY et QWERTY).
- Deux corrections d'équilibrage documentées :
  1. Le buff nocturne (+1 ATK *à chaque pas* en C#, qui rendait la nuit injouable)
     devient **+2 ATK une seule fois par nuit**, retiré au matin.
  2. Les spawns nocturnes ne peuvent plus apparaître dans l'armurerie verrouillée du
     niveau 1 (softlock possible : Lysa exige que tous les monstres soient morts).

## 🔨 Développement

```bash
npm install        # esbuild uniquement
npm run build      # → dist/index.html (fichier unique)
npm test           # simulation headless : traverse tout le jeu et vérifie la logique
```

## 🖥️ Application de bureau (Tauri)

Prérequis (une fois) : [Rust](https://rustup.rs) puis `cargo install tauri-cli --version "^2"`.
Sous Windows il faut aussi les "Desktop development with C++" Build Tools.

```bash
npm run build              # génère dist/
cargo tauri dev            # lancer en mode dev (depuis la racine du projet)
cargo tauri build          # produit l'installeur (.msi/.exe, .dmg, .deb/.AppImage)
```

Les icônes sont déjà générées dans `src-tauri/icons/` (régénérables :
`node tools/make-icons.mjs`).

## 🚂 Checklist Steam

1. `cargo tauri build` sur chaque OS cible (Windows d'abord — 96 % des ventes de ce genre).
2. Compte [Steamworks](https://partner.steamgames.com) + 100 $ de frais Steam Direct.
3. Page magasin : capsule 616×353, header 460×215, captures 1920×1080, trailer 30-60 s
   (OBS sur la version Tauri plein écran).
4. Uploader le build via `steamcmd` / SteamPipe (le dossier de `cargo tauri build` →
   `src-tauri/target/release/`).
5. La version web `dist/index.html` peut servir de **démo marketing** hébergée
   (itch.io, GitHub Pages) — c'est la stratégie Vampire Survivors.
6. Avant la review Steam : tester l'overlay Steam, le mode hors-ligne et la manette.

## 🏗️ Architecture

```
src/
  core.ts          types, RNG, carte, jour/nuit
  entities.ts      joueur, monstres, PNJ, coffres, sceaux
  items.ts         objets, catalogue, butin, prix
  maps.ts          les 4 cartes (port 1:1 de MapCatalog.cs)
  levels.ts        composition des niveaux (LevelCatalog.cs)
  context.ts       GameContext : exploration, vision, portes, scripting Map3
  combat.ts        combat tour par tour + phase 2 du boss
  sprites.ts       pixel art procédural (aucun asset externe)
  render.ts        rendu monde, éclairage, particules, HUD
  audio.ts         musique + SFX procéduraux (WebAudio)
  input.ts         clavier + manette
  i18n.ts          FR/EN
  save.ts          sauvegarde localStorage
  scenes.ts / *Scene(s).ts   menu, cinématiques, exploration, combat, marchand…
test/sim.ts        bot de test : finit le jeu en entier et vérifie chaque étape
src-tauri/         projet Tauri 2 prêt à compiler
```

Jeu original : Wylson, Baptiste, Ebubekir.
