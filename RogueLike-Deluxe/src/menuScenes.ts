// ===== Menu principal, options, crédits =====
import { Scene, SceneManager, panel, dimBackground } from "./scenes";
import { VW, VH, text, textShadow, Particles, FONT } from "./render";
import { Input } from "./input";
import { Audio } from "./audio";
import { T, setLang, Lang } from "./i18n";
import { hasSave, savedLevel, saveSettings } from "./save";
import { G, Flow } from "./game";
import { getSprite } from "./sprites";
import { ClassId, ClassCatalog } from "./entities";

export class MainMenuScene implements Scene {
  private sel = 0;
  private t = 0;
  private particles = new Particles();
  private items: { key: string; action: () => void; args?: any }[] = [];

  enter() {
    Audio.setMode("menu");
    this.buildItems();
  }

  private buildItems() {
    this.items = [];
    if (hasSave())
      this.items.push({ key: "menu.continue", args: { level: savedLevel() }, action: () => Flow.continueGame() });
    this.items.push({ key: "menu.new", action: () => SceneManager.push(new ClassSelectScene()) });
    this.items.push({ key: "menu.endless", action: () => Flow.endlessHub() });
    this.items.push({ key: "menu.options", action: () => SceneManager.push(new OptionsScene()) });
    this.items.push({ key: "menu.credits", action: () => SceneManager.push(new CreditsScene()) });
    this.items.push({ key: "menu.quit", action: () => { try { window.close(); } catch { } } });
  }

  private lightning = 0; // éclair d'ambiance occasionnel

  update(dt: number) {
    this.t += dt;
    this.lightning = Math.max(0, this.lightning - dt * 4);
    if (Math.random() < dt * 0.12) this.lightning = 0.6 + Math.random() * 0.4;
    // braises
    if (Math.random() < dt * 22)
      this.particles.spawn({
        x: Math.random() * VW, y: VH + 8,
        vx: (Math.random() - 0.5) * 12, vy: -22 - Math.random() * 30,
        life: 4 + Math.random() * 3, maxLife: 7, size: 2 + Math.random() * 2,
        color: Math.random() < 0.7 ? "#c0502a" : "#e8a03a", glow: true,
      });
    // runes violettes qui montent de la porte
    if (Math.random() < dt * 6)
      this.particles.spawn({
        x: VW / 2 + (Math.random() - 0.5) * 160, y: VH - 40 - Math.random() * 120,
        vx: (Math.random() - 0.5) * 6, vy: -14 - Math.random() * 14,
        life: 3 + Math.random() * 2, maxLife: 5, size: 2,
        color: Math.random() < 0.5 ? "#8a5fd0" : "#c8a0ff", glow: true,
      });
    this.particles.update(dt);

    if (Input.consume("up")) { this.sel = (this.sel - 1 + this.items.length) % this.items.length; Audio.sfx("ui"); }
    if (Input.consume("down")) { this.sel = (this.sel + 1) % this.items.length; Audio.sfx("ui"); }
    if (Input.consume("confirm")) { Audio.sfx("confirm"); this.items[this.sel].action(); }
  }

  draw(g: CanvasRenderingContext2D) {
    // fond dégradé
    const grad = g.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, "#0c0716");
    grad.addColorStop(0.6, "#160b20");
    grad.addColorStop(1, "#251020");
    g.fillStyle = grad;
    g.fillRect(0, 0, VW, VH);

    // éclair d'ambiance : la salle blêmit un instant
    if (this.lightning > 0) {
      g.fillStyle = `rgba(150,140,200,${(this.lightning * 0.08).toFixed(3)})`;
      g.fillRect(0, 0, VW, VH);
    }

    // nappes de brume dérivantes
    g.save();
    g.globalAlpha = 0.06;
    for (let i = 0; i < 2; i++) {
      const fy = VH * (0.55 + i * 0.25) + Math.sin(this.t * 0.35 + i * 2.4) * 20;
      const fgrad = g.createLinearGradient(0, fy - 60, 0, fy + 60);
      fgrad.addColorStop(0, "rgba(150,130,190,0)");
      fgrad.addColorStop(0.5, "rgba(150,130,190,1)");
      fgrad.addColorStop(1, "rgba(150,130,190,0)");
      g.fillStyle = fgrad;
      g.fillRect(0, fy - 60, VW, 120);
    }
    g.restore();

    // silhouette de porte au fond
    g.save();
    g.globalAlpha = 0.25;
    const dw = 240, dh = 340, dx = VW / 2 - dw / 2, dy = VH - dh;
    g.fillStyle = "#000";
    g.beginPath();
    g.moveTo(dx, VH); g.lineTo(dx, dy + 90);
    g.arc(VW / 2, dy + 90, dw / 2, Math.PI, 0);
    g.lineTo(dx + dw, VH);
    g.fill();
    g.strokeStyle = "#3a2545";
    g.lineWidth = 4;
    g.stroke();
    // lueur rouge au centre de la porte
    const gl = g.createRadialGradient(VW / 2, dy + 190, 5, VW / 2, dy + 190, 130);
    gl.addColorStop(0, `rgba(200,40,40,${0.28 + Math.sin(this.t * 1.4) * 0.1})`);
    gl.addColorStop(1, "rgba(200,40,40,0)");
    g.fillStyle = gl;
    g.fillRect(dx, dy, dw, dh);
    g.restore();

    this.particles.draw(g);

    // titre
    const ty = 108 + Math.sin(this.t * 1.1) * 3;
    g.save();
    g.shadowColor = "#c02828"; g.shadowBlur = 26;
    g.font = `bold 54px ${FONT}`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#f0e2c8";
    g.fillText(T("title"), VW / 2, ty);
    g.shadowBlur = 0;
    g.restore();
    text(g, T("subtitle"), VW / 2, ty + 44, 15, "#9a8fae", "center");

    // épée décorative
    const sw = getSprite("it_legend");
    if (sw) {
      g.save();
      g.imageSmoothingEnabled = false;
      g.shadowColor = "#ffd84a"; g.shadowBlur = 12;
      g.drawImage(sw, VW / 2 - 190 - 32, ty - 36, 64, 64);
      g.drawImage(sw, VW / 2 + 190 - 32, ty - 36, 64, 64);
      g.restore();
    }

    // menu
    const my0 = 240, mh = 44;
    this.items.forEach((it, i) => {
      const y = my0 + i * mh;
      const selected = i === this.sel;
      const label = T(it.key, it.args);
      if (selected) {
        const w = 360;
        g.fillStyle = "rgba(120,25,25,.85)";
        g.beginPath(); g.roundRect(VW / 2 - w / 2, y - 17, w, 36, 8); g.fill();
        g.strokeStyle = "#e8b0a0";
        g.lineWidth = 1.5;
        g.beginPath(); g.roundRect(VW / 2 - w / 2, y - 17, w, 36, 8); g.stroke();
        textShadow(g, "▶ " + label, VW / 2, y + 1, 19, "#fff", "center");
      } else {
        text(g, label, VW / 2, y + 1, 17, "#9a92ac", "center");
      }
    });

    const blink = Math.sin(this.t * 4) > -0.3;
    if (blink) text(g, T("menu.hint"), VW / 2, VH - 26, 12, "#6e6584", "center");
  }
}

// ===== Sélection de classe (overlay, avant la nouvelle partie) =====
const CLASS_ORDER: ClassId[] = ["warrior", "mage", "rogue"];

export class ClassSelectScene implements Scene {
  private sel = 0;
  private onConfirm: (id: ClassId) => void;

  // Par défaut lance une nouvelle partie histoire ; le mode Descente passe son propre callback.
  constructor(onConfirm?: (id: ClassId) => void) {
    this.onConfirm = onConfirm ?? ((id) => Flow.startNew(id));
  }

  update(dt: number) {
    if (Input.consume("cancel")) { Audio.sfx("back"); SceneManager.pop(); return; }
    if (Input.consume("left") || Input.consume("up")) { this.sel = (this.sel + 2) % 3; Audio.sfx("ui"); }
    if (Input.consume("right") || Input.consume("down")) { this.sel = (this.sel + 1) % 3; Audio.sfx("ui"); }
    if (Input.consume("confirm")) { Audio.sfx("confirm"); this.onConfirm(CLASS_ORDER[this.sel]); }
  }

  draw(g: CanvasRenderingContext2D) {
    dimBackground(g, 0.78);
    const w = 640, h = 300, x = VW / 2 - w / 2, y = VH / 2 - h / 2;
    panel(g, x, y, w, h, T("classselect.title"));

    const cardW = 180, cardH = 210, gap = 20;
    const startX = x + (w - (cardW * 3 + gap * 2)) / 2;
    CLASS_ORDER.forEach((id, i) => {
      const def = ClassCatalog[id];
      const cx = startX + i * (cardW + gap), cy = y + 46;
      const selected = i === this.sel;
      g.fillStyle = selected ? "rgba(120,25,25,.55)" : "rgba(30,24,44,.6)";
      g.beginPath(); g.roundRect(cx, cy, cardW, cardH, 8); g.fill();
      g.strokeStyle = selected ? "#ffb0a0" : "rgba(140,130,170,.35)";
      g.lineWidth = selected ? 2 : 1;
      g.beginPath(); g.roundRect(cx, cy, cardW, cardH, 8); g.stroke();
      textShadow(g, T(def.nameKey), cx + cardW / 2, cy + 28, 18, selected ? "#fff" : "#c8c0d4", "center");
      text(g, T(def.descKey), cx + cardW / 2, cy + 60, 12, selected ? "#e8dfc8" : "#9a92ac", "center");
      textShadow(g, "★", cx + cardW / 2, cy + cardH - 40, 16, "#ffd84a", "center");
      text(g, T(def.abilityNameKey), cx + cardW / 2, cy + cardH - 18, 12, "#ffd84a", "center");
    });

    text(g, T("classselect.hint"), VW / 2, y + h - 12, 12, "#8a8098", "center");
  }
}

// ===== Options (overlay) =====
export class OptionsScene implements Scene {
  private sel = 0;
  update(dt: number) {
    if (Input.consume("cancel")) { Audio.sfx("back"); saveSettings(G.settings); SceneManager.pop(); return; }
    if (Input.consume("up")) { this.sel = (this.sel + 3) % 4; Audio.sfx("ui"); }
    if (Input.consume("down")) { this.sel = (this.sel + 1) % 4; Audio.sfx("ui"); }
    const dir = Input.consume("right") ? 1 : Input.consume("left") ? -1 : 0;
    if (dir !== 0) {
      if (this.sel === 0) { G.settings.musicVol = Math.round((G.settings.musicVol + dir * 0.1) * 10) / 10; G.settings.musicVol = Math.max(0, Math.min(1, G.settings.musicVol)); Audio.setMusicVol(G.settings.musicVol); Audio.sfx("ui"); }
      if (this.sel === 1) { G.settings.sfxVol = Math.round((G.settings.sfxVol + dir * 0.1) * 10) / 10; G.settings.sfxVol = Math.max(0, Math.min(1, G.settings.sfxVol)); Audio.setSfxVol(G.settings.sfxVol); Audio.sfx("confirm"); }
      if (this.sel === 2) {
        G.settings.lang = (G.settings.lang === "fr" ? "en" : "fr") as Lang;
        setLang(G.settings.lang);
        Audio.sfx("ui");
      }
    }
    if (Input.consume("confirm")) {
      if (this.sel === 2) { G.settings.lang = (G.settings.lang === "fr" ? "en" : "fr") as Lang; setLang(G.settings.lang); Audio.sfx("ui"); }
      if (this.sel === 3) { Audio.sfx("back"); saveSettings(G.settings); SceneManager.pop(); }
    }
  }

  draw(g: CanvasRenderingContext2D) {
    dimBackground(g, 0.72);
    const w = 460, h = 280, x = VW / 2 - w / 2, y = VH / 2 - h / 2;
    panel(g, x, y, w, h, T("options.title"));

    const rows = [
      { label: T("options.music"), value: G.settings.musicVol },
      { label: T("options.sfx"), value: G.settings.sfxVol },
      { label: T("options.lang"), value: -1 },
      { label: T("options.back"), value: -2 },
    ];
    rows.forEach((r, i) => {
      const ry = y + 62 + i * 52;
      const selected = i === this.sel;
      if (selected) {
        g.fillStyle = "rgba(120,25,25,.5)";
        g.beginPath(); g.roundRect(x + 16, ry - 18, w - 32, 38, 6); g.fill();
      }
      text(g, r.label, x + 34, ry, 16, selected ? "#fff" : "#a89ec0");
      if (r.value >= 0) {
        // slider
        const sx = x + 220, sw = 180;
        g.fillStyle = "#241c34";
        g.beginPath(); g.roundRect(sx, ry - 6, sw, 12, 5); g.fill();
        g.fillStyle = selected ? "#e07848" : "#8a6ab0";
        g.beginPath(); g.roundRect(sx, ry - 6, sw * r.value, 12, 5); g.fill();
        text(g, Math.round(r.value * 100) + "%", sx + sw + 14, ry, 13, "#c8c0d8");
      } else if (r.value === -1) {
        text(g, G.settings.lang === "fr" ? T("options.lang.fr") : T("options.lang.en"), x + 250, ry, 16, selected ? "#ffd84a" : "#c8b060");
        if (selected) text(g, "◀ ▶", x + 380, ry, 13, "#8a8098");
      }
    });
  }
}

// ===== Crédits =====
export class CreditsScene implements Scene {
  update(dt: number) {
    if (Input.consume("cancel") || Input.consume("confirm")) { Audio.sfx("back"); SceneManager.pop(); }
  }
  draw(g: CanvasRenderingContext2D) {
    dimBackground(g, 0.72);
    const w = 520, h = 240, x = VW / 2 - w / 2, y = VH / 2 - h / 2;
    panel(g, x, y, w, h, T("menu.credits").toUpperCase());
    textShadow(g, T("credits.1"), VW / 2, y + 66, 20, "#f0e2c8", "center");
    text(g, T("credits.2"), VW / 2, y + 110, 15, "#b8aed0", "center");
    text(g, T("credits.3"), VW / 2, y + 140, 13, "#8a80a0", "center");
    text(g, T("credits.4"), VW / 2, y + 186, 14, "#ffd84a", "center");
  }
}
