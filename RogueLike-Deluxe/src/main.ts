// ===== Point d'entrée : boucle de jeu, câblage des scènes =====
import { VW, VH, WorldRenderer, text, textShadow, FONT } from "./render";
import { initSprites } from "./sprites";
import { Input } from "./input";
import { Audio } from "./audio";
import { setLang, T } from "./i18n";
import { GameContext, LogKind } from "./context";
import { SceneManager, Scene } from "./scenes";
import { MainMenuScene } from "./menuScenes";
import { ExploreScene, MerchantScene, CreedChoiceScene } from "./exploreScene";
import { CombatScene } from "./combatScene";
import { CinematicScene, bossIntroPages, bossEncounterPages, loreMarkPages, EndingFilmScene, FilmScene, introFilmShots, swordFilmShots, depthsFilmShots, endlessFilmShots, devourerFilmShots, abyssKingFilmShots, EndScene, EndingId } from "./cinematics";
import { EndlessHubScene, RelicDraftScene, RunSummaryScene } from "./endlessScenes";
import { EpicSelectScene, EpicRevealScene } from "./epicScenes";
import { EpicCombatScene } from "./epicCombat";
import { EPIC_BOSSES, markEpicCleared, epicShouldReveal, epicClearedCount } from "./epicMode";
import { G, Flow } from "./game";
import { loadSettings, loadGame, clearSave, saveGame, saveSettings, resetAllData } from "./save";
import { Monster, Merchant, ClassId, applyClass } from "./entities";
import { loadMeta, applyMetaToPlayer, essenceMultiplier } from "./meta";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const g = canvas.getContext("2d")!;
g.imageSmoothingEnabled = false;

// mise à l'échelle plein écran (letterbox, pixels nets)
function resize() {
  const scale = Math.min(window.innerWidth / VW, window.innerHeight / VH);
  canvas.style.width = Math.floor(VW * scale) + "px";
  canvas.style.height = Math.floor(VH * scale) + "px";
}
window.addEventListener("resize", resize);
resize();

// ===== Init =====
initSprites();
G.settings = loadSettings();
setLang(G.settings.lang);
G.ctx = new GameContext();
G.world = new WorldRenderer();
Input.attach(canvas);
// Auto-réparation : une config de touches héritée qui priverait Valider/Annuler de leur touche
// (soft-lock d'anciennes versions) est purgée au démarrage.
if (G.settings.binds && !Input.validateBinds(G.settings.binds)) { G.settings.binds = {}; saveSettings(G.settings); }
Input.applyBindings(G.settings.binds); // touches personnalisées du joueur
Input.onAny = () => { Audio.ensure(); Audio.setMusicVol(G.settings.musicVol); Audio.setSfxVol(G.settings.sfxVol); };

// ===== Navigation =====
Flow.toMenu = () => SceneManager.switchTo(() => new MainMenuScene());
Flow.toExplore = () => SceneManager.switchTo(() => new ExploreScene());

Flow.startNew = (classId: ClassId) => {
  clearSave();
  G.ctx = new GameContext();
  applyClass(G.ctx.player, classId);
  // Faveur du Panthéon : chaque Colosse vaincu endurcit tous tes héros (+2 PV max).
  const favor = epicClearedCount() * 2;
  if (favor > 0) { G.ctx.player.maxHp += favor; G.ctx.player.hp = G.ctx.player.maxHp; }
  SceneManager.switchTo(() => new FilmScene(introFilmShots(), () => {
    G.ctx.pushLog(T("level.enter1"), LogKind.System);
    if (favor > 0) G.ctx.pushLog(T("epic.favor", { n: favor }), LogKind.Loot);
    G.ctx.loadLevel(1);
    G.ctx.drainEvents();
    saveGame(G.ctx);
    Flow.toExplore();
  }));
  Audio.setMode("none");
};

Flow.continueGame = () => {
  G.ctx = new GameContext();
  const level = loadGame(G.ctx) ?? 1;
  G.ctx.loadLevel(level);
  G.ctx.drainEvents();
  Flow.toExplore();
};

Flow.startCombat = (monster: Monster) => {
  SceneManager.switchTo(() => new CombatScene(monster));
  SceneManager.fadeSpeed = 5;
};

// Rencontre de boss : la musique boss se lance, le boss prononce son dialogue,
// puis le combat démarre à la fin du dialogue.
Flow.bossEncounter = (monster: Monster) => {
  // LE RÉVEIL : face au Dévoreur (boss final, Aventure), un mini-film se joue — une seule fois.
  // Si on fuit/meurt et qu'on revient, on retombe sur le dialogue classique.
  if (monster.nameKey === "mob.superboss" && !G.ctx.endless && !G.ctx.devourerFilmSeen) {
    G.ctx.devourerFilmSeen = true;
    saveGame(G.ctx);
    Audio.setMode("boss");
    SceneManager.switchTo(() => new FilmScene(devourerFilmShots(G.ctx.rivalSpared), () => Flow.startCombat(monster)));
    return;
  }
  // LE FAUX ROI : même traitement pour le Roi de l'Abîme (plan 4 selon le Serment : Emprise/Clémence).
  if (monster.nameKey === "mob.boss" && !G.ctx.endless && !G.ctx.abyssKingFilmSeen) {
    G.ctx.abyssKingFilmSeen = true;
    saveGame(G.ctx);
    Audio.setMode("abyssking"); // son thème (orgue de cathédrale maudite) dès le film
    SceneManager.switchTo(() => new FilmScene(abyssKingFilmShots(G.ctx.oath < 0), () => Flow.startCombat(monster)));
    return;
  }
  const pages = bossEncounterPages(monster.nameKey);
  if (!pages) { Flow.startCombat(monster); return; }
  // Thèmes dédiés dès le dialogue : Gardien des Sceaux (warden.mp3), Roi de l'Abîme (abyssking.mp3).
  Audio.setMode(monster.nameKey.startsWith("mob.warden") ? "warden" : monster.nameKey === "mob.boss" ? "abyssking" : "boss");
  SceneManager.switchTo(() => new CinematicScene(pages, () => Flow.startCombat(monster), "#c02840"));
};

// Découverte d'un point de lore : courte cinématique atmosphérique, puis retour au jeu.
Flow.loreCinematic = (cineKey: string) => {
  SceneManager.switchTo(() => new CinematicScene(loreMarkPages(cineKey), () => Flow.toExplore(), "#8a5fd0"));
  Audio.setMode("none");
};

// LE SERMENT : ouvre une scène de choix moral (embuscade narrative). onDone permet à l'appelant
// (le Verdict après le combat du Rival) d'enchaîner ; sans onDone, la scène gère elle-même son retour.
Flow.creedChoice = (id: string, onDone?: () => void) => {
  SceneManager.switchTo(() => new CreedChoiceScene(id, onDone));
  Audio.setMode("none");
};

// Fin de campagne : la Boucle vaincue se referme selon le Serment tenu. Trois dénouements distincts.
Flow.campaignEnding = (ending: EndingId) => {
  clearSave();
  // Un vrai mini-film animé, puis l'écran-titre thématisé.
  SceneManager.switchTo(() => new EndingFilmScene(ending, () => Flow.endScreen(true, ending)));
  Audio.setMode(ending === "dominion" ? "boss" : "none");
};

Flow.merchant = (merchant: Merchant) => SceneManager.switchTo(() => new MerchantScene(merchant));

Flow.swordCinematic = () => {
  SceneManager.switchTo(() => new FilmScene(swordFilmShots(), () => Flow.toExplore()));
  Audio.setMode("none");
};

Flow.bossIntroThenLevel4 = () => {
  SceneManager.switchTo(() => new CinematicScene(bossIntroPages(), () => {
    G.ctx.loadLevel(4);
    G.ctx.drainEvents();
    saveGame(G.ctx);
    Flow.toExplore();
  }, "#a02030"));
  Audio.setMode("none");
};

Flow.depthsIntroThenLevel5 = () => {
  SceneManager.switchTo(() => new FilmScene(depthsFilmShots(), () => {
    G.ctx.loadLevel(5);
    G.ctx.drainEvents();
    saveGame(G.ctx);
    Flow.toExplore();
  }));
  Audio.setMode("none");
};

Flow.endScreen = (victory: boolean, ending?: EndingId) => {
  if (victory) clearSave();
  SceneManager.switchTo(() => new EndScene(victory, () => Flow.toMenu(), ending));
};

// ===== Descente Infinie =====
Flow.endlessHub = () => SceneManager.switchTo(() => new EndlessHubScene());

Flow.startEndless = (classId: ClassId) => {
  G.ctx = new GameContext();
  applyClass(G.ctx.player, classId);
  const meta = loadMeta();
  applyMetaToPlayer(G.ctx.player, meta);
  // Faveur du Panthéon : les Colosses vaincus endurcissent aussi les descendeurs.
  const favor = epicClearedCount() * 2;
  if (favor > 0) { G.ctx.player.maxHp += favor; G.ctx.player.hp = G.ctx.player.maxHp; }
  // Cinématique de plongeon dans l'Abîme, puis le run démarre (étage 1 chargé à la fin du film).
  SceneManager.switchTo(() => new FilmScene(endlessFilmShots(), () => {
    G.ctx.startEndlessRun(essenceMultiplier(meta));
    if (favor > 0) G.ctx.pushLog(T("epic.favor", { n: favor }), LogKind.Loot);
    G.ctx.drainEvents();
    Flow.toExplore();
    Audio.setMode("explore");
  }));
  Audio.setMode("none");
};

Flow.relicDraft = () => SceneManager.switchTo(() => new RelicDraftScene());

Flow.runSummary = () => SceneManager.switchTo(() => new RunSummaryScene());

// ===== Le Panthéon (boss-rush action) =====
// Si les 5 premiers Colosses viennent d'être vaincus, on joue d'abord la RÉVÉLATION des 3 secrets.
Flow.epicHub = () => {
  if (epicShouldReveal()) {
    SceneManager.switchTo(() => new EpicRevealScene(() => SceneManager.switchTo(() => new EpicSelectScene())));
    return;
  }
  SceneManager.switchTo(() => new EpicSelectScene());
  Audio.setMode("menu");
};

// Cinématique de rencontre du Colosse, puis le combat d'action. À l'issue : déblocage du suivant
// si victoire, et retour au menu de sélection dans tous les cas.
Flow.epicStart = (index: number) => {
  const boss = EPIC_BOSSES[index];
  const startFight = () => {
    SceneManager.switchTo(() => new EpicCombatScene(boss, (won) => {
      if (won) markEpicCleared(index);
      Flow.epicHub();
    }, index));
    SceneManager.fadeSpeed = 5;
  };
  SceneManager.switchTo(() => new CinematicScene(boss.intro(), startFight, boss.glow));
  Audio.setMode("boss");
};

// ===== Écran de démarrage (débloque l'audio au premier input) =====
class BootScene implements Scene {
  private t = 0;
  update(dt: number) {
    this.t += dt;
    if (Input.consume("confirm")) {
      Audio.ensure();
      Flow.toMenu();
    }
  }
  draw(gg: CanvasRenderingContext2D) {
    gg.fillStyle = "#080610";
    gg.fillRect(0, 0, VW, VH);
    gg.save();
    gg.shadowColor = "#c02828"; gg.shadowBlur = 24;
    gg.font = `bold 46px ${FONT}`;
    gg.textAlign = "center"; gg.textBaseline = "middle";
    gg.fillStyle = "#f0e2c8";
    gg.fillText(T("title"), VW / 2, VH / 2 - 40);
    gg.restore();
    if (Math.sin(this.t * 4) > -0.3)
      textShadow(gg, T("cine.start"), VW / 2, VH / 2 + 60, 16, "#c8c0d4", "center");
  }
}

SceneManager.switchNow(new BootScene());

// ===== Combo SECRET de réinitialisation (SÉQUENCE façon code Konami) =====
// Saisis ↑ ↑ ↓ ↓ ← → ← → (une touche après l'autre) : efface tout et relance.
// Séquence = zéro ghosting clavier (contrairement à un appui simultané), fiable sur tout clavier.
const RESET_SEQ = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight"];
let seqPos = 0, seqLast = 0;
let resetFlash = 0, resetPending = false;
window.addEventListener("keydown", (e) => {
  const now = performance.now();
  if (now - seqLast > 1500) seqPos = 0; // trop lent entre deux touches → on repart de zéro
  seqLast = now;
  if (e.code === RESET_SEQ[seqPos]) {
    seqPos++;
    if (seqPos >= RESET_SEQ.length) { seqPos = 0; resetPending = true; resetFlash = 1.0; }
  } else {
    seqPos = e.code === RESET_SEQ[0] ? 1 : 0; // tolère un faux départ qui recommence la séquence
  }
});
function updateReset(dt: number) {
  if (resetFlash > 0) {
    resetFlash -= dt;
    if (resetFlash <= 0 && resetPending) { resetPending = false; resetAllData(); try { location.reload(); } catch { } }
  }
}
function drawReset(gg: CanvasRenderingContext2D) {
  if (resetFlash <= 0) return;
  gg.save();
  gg.globalAlpha = Math.min(1, resetFlash * 2);
  gg.fillStyle = "rgba(110,8,8,.85)"; gg.fillRect(0, 0, VW, VH);
  gg.shadowColor = "#ff2020"; gg.shadowBlur = 24;
  textShadow(gg, T("reset.hold"), VW / 2, VH / 2, 32, "#fff", "center");
  gg.restore();
}

// ===== Boucle =====
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  Input.pollGamepad();
  updateReset(dt);
  SceneManager.update(dt);
  g.setTransform(1, 0, 0, 1, 0, 0);
  SceneManager.draw(g);
  drawReset(g);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
