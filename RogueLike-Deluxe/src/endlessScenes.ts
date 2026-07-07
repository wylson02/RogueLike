// ===== Scènes du mode Descente Infinie : Hub méta, draft de relique, résumé de run =====
import { Scene, SceneManager, panel, dimBackground } from "./scenes";
import { VW, VH, text, textShadow, Particles, FONT } from "./render";
import { Input } from "./input";
import { Audio } from "./audio";
import { T } from "./i18n";
import { LogKind } from "./context";
import { G, Flow } from "./game";
import { getSprite } from "./sprites";
import { clamp } from "./core";
import { Boon, draftBoons, RARITY_COLOR } from "./boons";
import { loadMeta, saveMeta, META_UPGRADES, nextUpgradeCost, buyUpgrade, upgradeLevel, MetaData } from "./meta";
import { ClassSelectScene } from "./menuScenes";

// ===== Hub : sanctuaire entre les runs, où l'Essence achète des pouvoirs permanents =====
export class EndlessHubScene implements Scene {
  private sel = 0;
  private t = 0;
  private meta: MetaData;
  private particles = new Particles();
  private flash = ""; private flashT = 0;

  constructor() { this.meta = loadMeta(); }
  enter() { Audio.setMode("menu"); }

  private get rows() { return META_UPGRADES.length + 1; } // +1 = "commencer la descente"

  update(dt: number) {
    this.t += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    if (Math.random() < dt * 14)
      this.particles.spawn({ x: Math.random() * VW, y: VH + 8, vx: (Math.random() - 0.5) * 10, vy: -18 - Math.random() * 24, life: 5, maxLife: 5, size: 2, color: Math.random() < 0.6 ? "#8a5fd0" : "#c8a0ff", glow: true });
    this.particles.update(dt);

    if (Input.consume("cancel")) { Audio.sfx("back"); Flow.toMenu(); return; }
    if (Input.consume("up")) { this.sel = (this.sel - 1 + this.rows) % this.rows; Audio.sfx("ui"); }
    if (Input.consume("down")) { this.sel = (this.sel + 1) % this.rows; Audio.sfx("ui"); }

    if (Input.consume("confirm")) {
      if (this.sel === META_UPGRADES.length) {
        // Commencer la descente : choix de classe → run.
        Audio.sfx("confirm");
        saveMeta(this.meta);
        SceneManager.push(new ClassSelectScene((cls) => Flow.startEndless(cls)));
        return;
      }
      const u = META_UPGRADES[this.sel];
      const cost = nextUpgradeCost(this.meta, u.id);
      if (cost === null) { this.flash = T("meta.maxed"); this.flashT = 1.3; Audio.sfx("locked"); }
      else if (this.meta.essence < cost) { this.flash = T("meta.poor"); this.flashT = 1.3; Audio.sfx("locked"); }
      else { buyUpgrade(this.meta, u.id); saveMeta(this.meta); this.flash = T("meta.bought", { name: T(u.nameKey) }); this.flashT = 1.3; Audio.sfx("levelup"); }
    }
  }

  draw(g: CanvasRenderingContext2D) {
    const grad = g.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, "#0a0818"); grad.addColorStop(1, "#180f28");
    g.fillStyle = grad; g.fillRect(0, 0, VW, VH);
    this.particles.draw(g);

    const w = 720, h = 460, x = VW / 2 - w / 2, y = VH / 2 - h / 2;
    panel(g, x, y, w, h, T("endless.hub.title"));
    textShadow(g, `✦ ${this.meta.essence}`, x + w - 30, y + 30, 20, "#c8a0ff", "right");
    text(g, T("endless.hub.best", { n: this.meta.bestDepth }), x + 28, y + 30, 13, "#a89ec0");

    const rowY = y + 66;
    META_UPGRADES.forEach((u, i) => {
      const ry = rowY + i * 46;
      const selected = i === this.sel;
      const lvl = upgradeLevel(this.meta, u.id);
      const cost = nextUpgradeCost(this.meta, u.id);
      if (selected) { g.fillStyle = "rgba(90,50,140,.5)"; g.beginPath(); g.roundRect(x + 20, ry - 17, w - 40, 40, 6); g.fill(); }
      text(g, (selected ? "▶ " : "  ") + T(u.nameKey), x + 34, ry - 2, 15, selected ? "#fff" : "#c0b6d8");
      text(g, T(u.descKey), x + 34, ry + 15, 11, "#8a80a8");
      // pips de niveau
      for (let k = 0; k < u.maxLevel; k++) {
        g.fillStyle = k < lvl ? "#c8a0ff" : "rgba(120,110,150,.35)";
        g.beginPath(); g.arc(x + w - 150 + k * 13, ry, 4, 0, Math.PI * 2); g.fill();
      }
      textShadow(g, cost === null ? T("meta.max") : `✦ ${cost}`, x + w - 34, ry, 13, cost === null ? "#7ae87a" : (this.meta.essence >= cost ? "#ffd84a" : "#8a5050"), "right");
    });

    // Bouton "commencer"
    const sy = rowY + META_UPGRADES.length * 46 + 6;
    const startSel = this.sel === META_UPGRADES.length;
    g.fillStyle = startSel ? "rgba(150,60,60,.85)" : "rgba(60,40,40,.7)";
    g.beginPath(); g.roundRect(x + w / 2 - 150, sy, 300, 38, 8); g.fill();
    if (startSel) { g.strokeStyle = "#ffb0a0"; g.lineWidth = 2; g.beginPath(); g.roundRect(x + w / 2 - 150, sy, 300, 38, 8); g.stroke(); }
    textShadow(g, T("endless.hub.start"), VW / 2, sy + 19, 17, startSel ? "#fff" : "#c8b0b0", "center");

    if (this.flashT > 0) { g.globalAlpha = Math.min(1, this.flashT * 2); textShadow(g, this.flash, VW / 2, y + h - 40, 13, "#ffd84a", "center"); g.globalAlpha = 1; }
    text(g, T("endless.hub.hint"), VW / 2, y + h - 18, 11, "#6e6584", "center");
  }
}

// ===== Draft de relique : choisir 1 boon parmi 3, entre deux étages =====
export class RelicDraftScene implements Scene {
  private choices: Boon[];
  private sel = 0;
  private t = 0;

  constructor() { this.choices = draftBoons(G.ctx.rng, G.ctx.runDepth, 3); }
  enter() { Audio.sfx("chest"); }

  update(dt: number) {
    this.t += dt;
    const n = this.choices.length;
    if (Input.consume("left") || Input.consume("up")) { this.sel = (this.sel - 1 + n) % n; Audio.sfx("ui"); }
    if (Input.consume("right") || Input.consume("down")) { this.sel = (this.sel + 1) % n; Audio.sfx("ui"); }
    if (Input.consume("confirm")) {
      const boon = this.choices[this.sel];
      boon.apply(G.ctx.player);
      G.ctx.pushLog(T("boon.gained", { name: T(boon.nameKey) }), LogKind.Loot);
      Audio.sfx("levelup");
      G.ctx.advanceEndlessFloor();
      G.ctx.drainEvents();
      Flow.toExplore();
    }
  }

  draw(g: CanvasRenderingContext2D) {
    const grad = g.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, "#0c0a1a"); grad.addColorStop(1, "#1a1230");
    g.fillStyle = grad; g.fillRect(0, 0, VW, VH);

    textShadow(g, T("draft.title"), VW / 2, 80, 30, "#e8d8ff", "center");
    text(g, T("draft.sub", { depth: G.ctx.runDepth + 1 }), VW / 2, 118, 15, "#a89ec0", "center");

    const cardW = 220, cardH = 260, gap = 30;
    const startX = VW / 2 - (cardW * 3 + gap * 2) / 2, cy = 170;
    this.choices.forEach((b, i) => {
      const cx = startX + i * (cardW + gap);
      const selected = i === this.sel;
      const col = RARITY_COLOR[b.rarity];
      const lift = selected ? -10 : 0;
      g.fillStyle = selected ? "rgba(40,30,60,.95)" : "rgba(24,20,38,.9)";
      g.beginPath(); g.roundRect(cx, cy + lift, cardW, cardH, 12); g.fill();
      g.strokeStyle = col; g.lineWidth = selected ? 3 : 1.5;
      if (selected) { g.shadowColor = col; g.shadowBlur = 20; }
      g.beginPath(); g.roundRect(cx, cy + lift, cardW, cardH, 12); g.stroke();
      g.shadowBlur = 0;

      // rareté
      textShadow(g, T("rarity." + b.rarity).toUpperCase(), cx + cardW / 2, cy + lift + 24, 12, col, "center");
      // icône
      const spr = getSprite(b.sprite);
      if (spr) { g.imageSmoothingEnabled = false; if (selected) { g.shadowColor = col; g.shadowBlur = 16; } g.drawImage(spr, cx + cardW / 2 - 32, cy + lift + 40, 64, 64); g.shadowBlur = 0; }
      // nom + desc
      textShadow(g, T(b.nameKey), cx + cardW / 2, cy + lift + 130, 17, "#fff", "center");
      wrapText(g, T(b.descKey), cx + cardW / 2, cy + lift + 158, cardW - 24, 13, "#c0b6d8");
    });

    const blink = Math.sin(this.t * 4) > -0.3;
    if (blink) text(g, T("draft.hint"), VW / 2, VH - 40, 13, "#8a80a0", "center");
  }
}

// ===== Résumé de run : banque l'essence, met à jour le record, retour au hub =====
export class RunSummaryScene implements Scene {
  private t = 0;
  private particles = new Particles();
  private banked: number;
  private newBest: boolean;

  constructor() {
    const meta = loadMeta();
    this.banked = G.ctx.runEssence;
    meta.essence += this.banked;
    meta.runs += 1;
    this.newBest = G.ctx.runDepth > meta.bestDepth;
    if (this.newBest) meta.bestDepth = G.ctx.runDepth;
    saveMeta(meta);
  }

  enter() { Audio.setMode("none"); Audio.sfx("defeat"); }

  update(dt: number) {
    this.t += dt;
    if (Math.random() < dt * 16)
      this.particles.spawn({ x: Math.random() * VW, y: -5, vx: (Math.random() - 0.5) * 20, vy: 26 + Math.random() * 40, life: 4, maxLife: 4, size: 2.4, color: "#c8a0ff", glow: true });
    this.particles.update(dt);
    if (this.t > 1 && Input.consume("confirm")) { Audio.sfx("confirm"); Flow.endlessHub(); }
  }

  draw(g: CanvasRenderingContext2D) {
    const grad = g.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, "#160a1e"); grad.addColorStop(1, "#0a0612");
    g.fillStyle = grad; g.fillRect(0, 0, VW, VH);
    this.particles.draw(g);

    const a = clamp(this.t / 1.1, 0, 1);
    g.globalAlpha = a;
    g.save();
    g.shadowColor = "#c060ff"; g.shadowBlur = 28;
    g.font = `bold 50px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#e8c8ff";
    g.fillText(T("runsummary.title"), VW / 2, 130);
    g.restore();

    textShadow(g, T("runsummary.depth", { n: G.ctx.runDepth }), VW / 2, 210, 22, "#fff", "center");
    if (this.newBest) textShadow(g, T("runsummary.best"), VW / 2, 246, 15, "#ffd84a", "center");
    text(g, T("runsummary.kills", { n: G.ctx.runKills }), VW / 2, 292, 15, "#c8c0d4", "center");
    textShadow(g, T("runsummary.essence", { n: this.banked }), VW / 2, 340, 20, "#c8a0ff", "center");

    if (this.t > 1 && Math.sin(this.t * 4) > -0.2)
      text(g, T("runsummary.continue"), VW / 2, VH - 44, 13, "#8a80a0", "center");
    g.globalAlpha = 1;
  }
}

function wrapText(g: CanvasRenderingContext2D, s: string, cx: number, y: number, maxW: number, size: number, color: string) {
  g.font = `bold ${size}px ${FONT}`;
  const words = s.split(" ");
  let line = ""; const lines: string[] = [];
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => text(g, l, cx, y + i * (size + 4), size, color, "center"));
}
