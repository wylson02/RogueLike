# Les Sceaux de l'Abîme — Édition Deluxe : REBIRTH

Portage complet du RogueLike console (C#) en **jeu de bureau pixel art**, refondu en
profondeur (combat à télégraphes, builds élémentaires émergents, événements d'étage,
game feel moderne), prêt pour un empaquetage Steam via Tauri. Moteur TypeScript,
rendu Canvas, audio WebAudio — zéro dépendance à l'exécution, un seul fichier
`dist/index.html`.

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

## ⚡ La refonte REBIRTH

### Combat à télégraphes (intents)

Chaque ennemi **annonce son prochain coup** au-dessus de sa barre de vie
(attaque ~n, coup dévastateur, charge, garde, drain, venin, perce-armure).
Chaque espèce suit un **pattern cyclique** lisible ; les gros coups passent par un
tour de **charge** que le joueur peut mitiger (la garde amortit un coup lourd de
moitié, la Brume l'évite totalement). Les boss changent de pattern en **phase 2**.
Les capacités spéciales historiques (seuils de PV) déclenchent désormais des
télégraphes au lieu de coups surprises.

### Builds élémentaires émergents (Descente Infinie)

Les reliques draftées entre les étages appartiennent à 4 éléments qui se **combinent** :

| Élément | Mécanique | Résonance (3 cumuls) |
|---|---|---|
| 🔥 Braise | brûlures qui s'empilent, bonus vs ennemis en feu | frapper un ennemi en feu fait **détoner** sa brûlure |
| ❄ Givre | givre (−ATK ennemie), gel, armure conditionnelle | les ennemis givrés infligent −20% de dégâts |
| 🩸 Sang | vol de vie, saignement, puissance à bas PV | le saignement infligé **te soigne** d'autant |
| ⚡ Tempête | crits, échos (la frappe se rejoue), foudre perce-armure | +15% d'écho, et les échos peuvent critiquer |

Exemple de synergie : *Tempo* (1er coup crit garanti) + *Embrasement* (les crits
brûlent) + *Foudre* (les crits foudroient) + résonance de Braise = chaque ouverture
de combat est une détonation en chaîne.

### Économie du risque

- **Autels maudits** : un boon épique immédiat… contre une malédiction de run
  (Fragilité, Famine, Pénombre, Attrition).
- **Sanctuaires** : soin unique de 40%.
- **Salles secrètes** : des murs fissurés (lueur discrète) cachent des trésors
  légendaires — foncez dedans.
- **Élites à affixes** : Épines, Vampirique, Véloce, Brute, Blindé — chaque élite
  change les règles du combat.

### Game feel

Hitstop à l'impact, lunges avec traînées fantômes, arcs de taille, ondes de choc,
chiffres de dégâts qui popent, flashs de palette (crit / phase 2), screenshake en
combat **et** en exploration, héros présent sur le champ de bataille, fond de combat
en parallaxe, bannières d'étage, brouillard ambiant par biome, poussière de pas,
vignette de danger à PV bas, transition jour/nuit fondue, menu titre orageux.

### Nouveautés version Deluxe (historique)

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
  core.ts          types, RNG, carte (dont murs fissurés), jour/nuit
  entities.ts      joueur (boons de run), monstres (affixes d'élites), statuts
                   empilables (brûlure/saignement/givre), PNJ, coffres, autels, sanctuaires
  items.ts         objets, catalogue, butin, prix
  boons.ts         boons élémentaires (Braise/Givre/Sang/Tempête), résonances, malédictions
  maps.ts          les 4 cartes (port 1:1 de MapCatalog.cs)
  levels.ts        composition des niveaux (LevelCatalog.cs)
  context.ts       GameContext : exploration, vision, portes, autels/sanctuaires/secrets
  combat.ts        combat à INTENTS : patterns par espèce, télégraphes, charges,
                   hooks de boons (à-la-frappe / au-crit / au-kill / au-subi), affixes
  procgen.ts       étages procéduraux : salles, élites à affixes, autels, secrets
  sprites.ts       pixel art procédural (aucun asset externe)
  render.ts        rendu monde, éclairage, screenshake, ambiance, HUD (build élémentaire)
  audio.ts         musique + SFX procéduraux (WebAudio)
  input.ts         clavier + manette
  i18n.ts          FR/EN (intégral, nouvelles mécaniques comprises)
  save.ts          sauvegarde localStorage (format inchangé — saves compatibles)
  scenes.ts / *Scene(s).ts   menu, cinématiques, exploration (autel), combat, marchand…
test/sim.ts        bot de test : finit le jeu en entier + vérifie intents, hooks de
                   boons, résonances, autels/malédictions, salles secrètes, affixes
src-tauri/         projet Tauri 2 prêt à compiler
```

Jeu original : Wylson, Baptiste, Ebubekir.
