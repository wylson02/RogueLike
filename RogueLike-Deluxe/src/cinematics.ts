// ===== Cinématiques : intro, épée légendaire, boss, écrans de fin =====
import { Scene, SceneManager } from "./scenes";
import { VW, VH, text, textShadow, Particles, FONT } from "./render";
import { Input } from "./input";
import { Audio } from "./audio";
import { T } from "./i18n";
import { G } from "./game";
import { getSprite } from "./sprites";
import { clamp } from "./core";

export interface CinePage {
  title?: string;
  lines: { text: string; color?: string; size?: number }[];
  sprite?: string;          // sprite affiché en grand au centre
  spriteGlow?: string;
  bg?: string;
  sfx?: string;
}

export class CinematicScene implements Scene {
  private pages: CinePage[];
  private page = 0;
  private chars = 0;      // caractères révélés (typewriter, toutes lignes confondues)
  private t = 0;
  private done: () => void;
  private particles = new Particles();
  private emberColor: string;

  constructor(pages: CinePage[], done: () => void, emberColor = "#c0502a") {
    this.pages = pages;
    this.done = done;
    this.emberColor = emberColor;
  }

  enter() {
    const p = this.pages[0];
    if (p.sfx) Audio.sfx(p.sfx);
  }

  private totalChars(p: CinePage) { return p.lines.reduce((a, l) => a + l.text.length, 0); }

  update(dt: number) {
    this.t += dt;
    this.chars += dt * 40;
    if (Math.random() < dt * 10)
      this.particles.spawn({
        x: Math.random() * VW, y: VH + 6,
        vx: (Math.random() - 0.5) * 10, vy: -18 - Math.random() * 22,
        life: 5, maxLife: 5, size: 2, color: this.emberColor, glow: true,
      });
    this.particles.update(dt);

    const p = this.pages[this.page];
    if (Input.consume("cancel")) { Audio.sfx("back"); this.finish(); return; }
    if (Input.consume("confirm")) {
      if (this.chars < this.totalChars(p)) {
        this.chars = this.totalChars(p); // révèle tout
      } else {
        Audio.sfx("confirm");
        this.page++;
        this.chars = 0;
        this.t = 0;
        if (this.page >= this.pages.length) { this.finish(); return; }
        const np = this.pages[this.page];
        if (np.sfx) Audio.sfx(np.sfx);
      }
    }
  }

  private finish() { this.done(); }

  draw(g: CanvasRenderingContext2D) {
    const p = this.pages[Math.min(this.page, this.pages.length - 1)];
    g.fillStyle = p.bg ?? "#080610";
    g.fillRect(0, 0, VW, VH);

    // vignette
    const v = g.createRadialGradient(VW / 2, VH / 2, VH * 0.3, VW / 2, VH / 2, VH * 0.85);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,.7)");
    g.fillStyle = v; g.fillRect(0, 0, VW, VH);

    this.particles.draw(g);

    if (p.title) {
      g.font = `bold 16px ${FONT}`;
      const tw = g.measureText(p.title).width + 40;
      g.fillStyle = "#2a1024";
      g.beginPath(); g.roundRect(VW / 2 - tw / 2, 52, tw, 32, 6); g.fill();
      g.strokeStyle = "#a05858";
      g.beginPath(); g.roundRect(VW / 2 - tw / 2, 52, tw, 32, 6); g.stroke();
      textShadow(g, p.title, VW / 2, 69, 16, "#e8c8a0", "center");
    }

    if (p.sprite) {
      const spr = getSprite(p.sprite);
      if (spr) {
        const size = 128;
        const bob = Math.sin(this.t * 2) * 5;
        g.save();
        g.imageSmoothingEnabled = false;
        if (p.spriteGlow) { g.shadowColor = p.spriteGlow; g.shadowBlur = 30; }
        g.drawImage(spr, VW / 2 - size / 2, 120 + bob, size, size);
        g.restore();
      }
    }

    // lignes en machine à écrire
    let remaining = Math.floor(this.chars);
    const y0 = p.sprite ? 300 : 190;
    p.lines.forEach((l, i) => {
      const shown = clamp(remaining, 0, l.text.length);
      remaining -= l.text.length;
      if (shown <= 0) return;
      textShadow(g, l.text.slice(0, shown), VW / 2, y0 + i * 34, l.size ?? 17, l.color ?? "#c8c0d4", "center");
    });

    // invite
    if (this.chars >= this.totalChars(p) && Math.sin(this.t * 4) > -0.2) {
      const last = this.page >= this.pages.length - 1;
      text(g, last ? T("cine.start") : T("cine.skip"), VW / 2, VH - 34, 12, "#7a7090", "center");
    }
  }
}

// ===== Pages prédéfinies =====
export function introPages(): CinePage[] {
  return [
    { lines: [{ text: T("intro.1a") }, { text: T("intro.1b") }], sfx: "night" },
    { lines: [{ text: T("intro.2a"), color: "#fff" }, { text: T("intro.2b"), color: "#d86060", size: 20 }], sfx: "seal" },
    {
      title: T("intro.3t"),
      lines: [
        { text: T("intro.3a") }, { text: T("intro.3b"), color: "#fff", size: 20 },
        { text: "" }, { text: T("intro.3c"), color: "#8a8098", size: 14 },
      ],
      sfx: "door",
    },
  ];
}

export function swordPages(): CinePage[] {
  return [
    {
      title: T("swordcine.t"), sprite: "it_legend", spriteGlow: "#ffd84a",
      lines: [{ text: T("swordcine.1"), color: "#8a8098" }, { text: T("swordcine.2") }],
      sfx: "sword",
    },
    {
      title: T("swordcine.4"), sprite: "it_legend", spriteGlow: "#ffd84a",
      lines: [
        { text: T("swordcine.3"), color: "#fff" },
        { text: "" },
        { text: [T("stat.atk", { n: 6 }), T("stat.crit", { n: 10 }), T("stat.ls", { n: 5 })].join("   "), color: "#ffd84a" },
        { text: "" },
        { text: T("swordcine.5"), color: "#c86060", size: 14 },
      ],
      sfx: "warden", bg: "#0c0508",
    },
  ];
}

export function bossIntroPages(): CinePage[] {
  const p = G.ctx.player;
  return [
    {
      title: T("bossintro.t"),
      lines: [
        { text: T("bossintro.1") },
        { text: T("bossintro.2") },
        { text: T("bossintro.3"), color: "#d8b868" },
      ],
      sfx: "door",
    },
    {
      title: T("mob.boss").toUpperCase(), sprite: "boss", spriteGlow: "#ff3b3b", bg: "#0c0508",
      lines: [
        { text: T("bossintro.4") },
        { text: T("bossintro.5"), color: "#ff8a8a" },
        { text: "" },
        { text: T("bossintro.stats", { hp: p.hp, maxhp: p.maxHp, atk: p.attack, arm: p.armor }), color: "#8fd4ff", size: 14 },
      ],
      sfx: "roar",
    },
  ];
}

// ===== Écran de fin =====
export class EndScene implements Scene {
  private victory: boolean;
  private t = 0;
  private particles = new Particles();
  private done: () => void;

  constructor(victory: boolean, done: () => void) {
    this.victory = victory;
    this.done = done;
  }

  enter() {
    Audio.setMode("none");
    Audio.sfx(this.victory ? "victory" : "defeat");
  }

  update(dt: number) {
    this.t += dt;
    if (this.victory && Math.random() < dt * 30)
      this.particles.spawn({
        x: Math.random() * VW, y: -5,
        vx: (Math.random() - 0.5) * 30, vy: 30 + Math.random() * 50,
        life: 4, maxLife: 4, size: 2.5,
        color: ["#ffd84a", "#7ae87a", "#8fd4ff", "#e88ae8"][Math.floor(Math.random() * 4)], glow: true,
      });
    this.particles.update(dt);
    if (this.t > 1.2 && Input.consume("confirm")) { Audio.sfx("confirm"); this.done(); }
  }

  draw(g: CanvasRenderingContext2D) {
    const grad = g.createLinearGradient(0, 0, 0, VH);
    if (this.victory) { grad.addColorStop(0, "#0a1420"); grad.addColorStop(1, "#1c2410"); }
    else { grad.addColorStop(0, "#180810"); grad.addColorStop(1, "#050308"); }
    g.fillStyle = grad;
    g.fillRect(0, 0, VW, VH);
    this.particles.draw(g);

    const a = clamp(this.t / 1.2, 0, 1);
    g.globalAlpha = a;
    g.save();
    g.shadowColor = this.victory ? "#ffd84a" : "#c02828";
    g.shadowBlur = 30;
    g.font = `bold 58px ${FONT}`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = this.victory ? "#f8e8b8" : "#d84848";
    g.fillText(T(this.victory ? "end.victory" : "end.defeat"), VW / 2, 150);
    g.restore();

    text(g, T(this.victory ? "end.v1" : "end.d1"), VW / 2, 240, 17, "#c8c0d4", "center");
    text(g, T(this.victory ? "end.v2" : "end.d2"), VW / 2, 274, 17, "#c8c0d4", "center");

    const p = G.ctx.player;
    textShadow(g, T("end.stats", { lvl: p.level, gold: p.gold, floor: G.ctx.currentLevel }), VW / 2, 350, 15, "#8fd4ff", "center");

    if (this.victory) {
      text(g, T("credits.2"), VW / 2, 410, 13, "#8a80a0", "center");
      text(g, T("credits.4"), VW / 2, 436, 13, "#ffd84a", "center");
    }

    if (this.t > 1.2 && Math.sin(this.t * 4) > -0.2)
      text(g, T("end.menu"), VW / 2, VH - 40, 13, "#7a7090", "center");
    g.globalAlpha = 1;
  }
}
