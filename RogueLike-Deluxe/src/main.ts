// ===== Point d'entrée : boucle de jeu, câblage des scènes =====
import { VW, VH, WorldRenderer, text, textShadow, FONT } from "./render";
import { initSprites } from "./sprites";
import { Input } from "./input";
import { Audio } from "./audio";
import { setLang, T } from "./i18n";
import { GameContext, LogKind } from "./context";
import { SceneManager, Scene } from "./scenes";
import { MainMenuScene } from "./menuScenes";
import { ExploreScene, MerchantScene } from "./exploreScene";
import { CombatScene } from "./combatScene";
import { CinematicScene, introPages, swordPages, bossIntroPages, depthsIntroPages, bossEncounterPages, loreMarkPages, EndScene } from "./cinematics";
import { EndlessHubScene, RelicDraftScene, RunSummaryScene } from "./endlessScenes";
import { G, Flow } from "./game";
import { loadSettings, loadGame, clearSave, saveGame } from "./save";
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
Input.onAny = () => { Audio.ensure(); Audio.setMusicVol(G.settings.musicVol); Audio.setSfxVol(G.settings.sfxVol); };

// ===== Navigation =====
Flow.toMenu = () => SceneManager.switchTo(() => new MainMenuScene());
Flow.toExplore = () => SceneManager.switchTo(() => new ExploreScene());

Flow.startNew = (classId: ClassId) => {
  clearSave();
  G.ctx = new GameContext();
  applyClass(G.ctx.player, classId);
  SceneManager.switchTo(() => new CinematicScene(introPages(), () => {
    G.ctx.pushLog(T("level.enter1"), LogKind.System);
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
  const pages = bossEncounterPages(monster.nameKey);
  if (!pages) { Flow.startCombat(monster); return; }
  Audio.setMode("boss");
  SceneManager.switchTo(() => new CinematicScene(pages, () => Flow.startCombat(monster), "#c02840"));
};

// Découverte d'un point de lore : courte cinématique atmosphérique, puis retour au jeu.
Flow.loreCinematic = (cineKey: string) => {
  SceneManager.switchTo(() => new CinematicScene(loreMarkPages(cineKey), () => Flow.toExplore(), "#8a5fd0"));
  Audio.setMode("none");
};

Flow.merchant = (merchant: Merchant) => SceneManager.switchTo(() => new MerchantScene(merchant));

Flow.swordCinematic = () => {
  SceneManager.switchTo(() => new CinematicScene(swordPages(), () => Flow.toExplore(), "#e0a030"));
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
  SceneManager.switchTo(() => new CinematicScene(depthsIntroPages(), () => {
    G.ctx.loadLevel(5);
    G.ctx.drainEvents();
    saveGame(G.ctx);
    Flow.toExplore();
  }, "#6a2fa0"));
  Audio.setMode("none");
};

Flow.endScreen = (victory: boolean, trueEnding = false) => {
  if (victory) clearSave();
  SceneManager.switchTo(() => new EndScene(victory, () => Flow.toMenu(), trueEnding));
};

// ===== Descente Infinie =====
Flow.endlessHub = () => SceneManager.switchTo(() => new EndlessHubScene());

Flow.startEndless = (classId: ClassId) => {
  G.ctx = new GameContext();
  applyClass(G.ctx.player, classId);
  const meta = loadMeta();
  applyMetaToPlayer(G.ctx.player, meta);
  G.ctx.startEndlessRun(essenceMultiplier(meta));
  G.ctx.drainEvents();
  Flow.toExplore();
  Audio.setMode("explore");
};

Flow.relicDraft = () => SceneManager.switchTo(() => new RelicDraftScene());

Flow.runSummary = () => SceneManager.switchTo(() => new RunSummaryScene());

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

// ===== Boucle =====
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  Input.pollGamepad();
  SceneManager.update(dt);
  g.setTransform(1, 0, 0, 1, 0, 0);
  SceneManager.draw(g);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
