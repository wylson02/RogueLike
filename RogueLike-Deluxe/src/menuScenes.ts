// ===== Menu principal, options, crédits =====
import { Scene, SceneManager, panel, dimBackground } from "./scenes";
import { VW, VH, text, textShadow, Particles, FONT, wrapLine } from "./render";
import { Input, BIND_ORDER, codeLabel } from "./input";
import { Audio } from "./audio";
import { T, setLang, Lang } from "./i18n";
import { hasSave, savedLevel, saveSettings, resetAllData } from "./save";
import { G, Flow } from "./game";
import { getSprite } from "./sprites";
import { ClassId, ClassCatalog } from "./entities";
import { clamp } from "./core";
import { BESTIARY, BestiaryEntry, codexKills, codexLoreFound, LORE_KEYS } from "./codex";

export class MainMenuScene implements Scene {
  private sel = 0;
  private t = 0;
  private particles = new Particles();
  private items: { key: string; action: () => void; args?: any; desc?: string }[] = [];

  enter() {
    Audio.setMode("menu");
    this.buildItems();
  }

  private buildItems() {
    this.items = [];
    if (hasSave())
      this.items.push({ key: "menu.continue", args: { level: savedLevel() }, desc: "menu.continue.desc", action: () => Flow.continueGame() });
    this.items.push({ key: "menu.new", desc: "menu.new.desc", action: () => SceneManager.push(new ClassSelectScene()) });
    this.items.push({ key: "menu.endless", desc: "menu.endless.desc", action: () => Flow.endlessHub() });
    this.items.push({ key: "menu.epic", desc: "menu.epic.desc", action: () => Flow.epicHub() });
    this.items.push({ key: "menu.codex", desc: "menu.codex.desc", action: () => SceneManager.push(new CodexScene()) });
    this.items.push({ key: "menu.options", desc: "menu.options.desc", action: () => SceneManager.push(new OptionsScene()) });
    this.items.push({ key: "menu.credits", desc: "menu.credits.desc", action: () => SceneManager.push(new CreditsScene()) });
    this.items.push({ key: "menu.quit", desc: "menu.quit.desc", action: () => { try { window.close(); } catch { } } });
  }

  private lightning = 0; // éclair d'ambiance occasionnel
  private shine = -0.4;  // reflet balayant sur le titre (cohérent avec l'écran-titre)

  update(dt: number) {
    this.t += dt;
    this.shine += dt * 0.42;
    if (this.shine > 1.6) this.shine = -0.5;
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

    // titre (taille auto pour tenir dans la largeur, halo pulsé, reflet balayant)
    const title = T("title");
    const ty = 108 + Math.sin(this.t * 1.1) * 3;
    let fs = 54;
    g.font = `bold ${fs}px ${FONT}`;
    while (g.measureText(title).width > VW - 220 && fs > 28) { fs -= 2; g.font = `bold ${fs}px ${FONT}`; }
    const tw = g.measureText(title).width;
    g.save();
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `bold ${fs}px ${FONT}`;
    g.shadowColor = "#c02828"; g.shadowBlur = 26 + Math.sin(this.t * 2) * 8;
    g.fillStyle = "#7a1414"; g.fillText(title, VW / 2, ty);
    g.shadowBlur = 0;
    // corps du titre avec reflet balayant (même langage que l'écran-titre)
    const p = this.shine;
    const sg = g.createLinearGradient(VW / 2 - tw / 2, 0, VW / 2 + tw / 2, 0);
    const base = "#f0e2c8";
    sg.addColorStop(0, base);
    sg.addColorStop(clamp(p - 0.16, 0.001, 0.999), base);
    sg.addColorStop(clamp(p, 0.002, 0.999), "#fffcec");
    sg.addColorStop(clamp(p + 0.16, 0.003, 1), base);
    g.fillStyle = sg;
    g.fillText(title, VW / 2, ty);
    g.restore();
    text(g, T("subtitle"), VW / 2, ty + fs * 0.62 + 12, 15, "#9a8fae", "center");

    // épées décoratives : TOUJOURS en dehors du titre (position mesurée, plus de chevauchement)
    const sw = getSprite("it_legend");
    if (sw) {
      const off = tw / 2 + 58;
      const bob = Math.sin(this.t * 1.6) * 3;
      g.save();
      g.imageSmoothingEnabled = false;
      g.shadowColor = "#ffd84a"; g.shadowBlur = 12 + Math.sin(this.t * 2.4) * 5;
      g.drawImage(sw, VW / 2 - off - 32, ty - 36 + bob, 64, 64);
      g.drawImage(sw, VW / 2 + off - 32, ty - 36 + bob, 64, 64);
      g.restore();
    }

    // menu (resserré pour laisser la place au panneau de description)
    const my0 = 214, mh = 38;
    this.items.forEach((it, i) => {
      const y = my0 + i * mh;
      const selected = i === this.sel;
      const label = T(it.key, it.args);
      if (selected) {
        const w = 360;
        g.fillStyle = "rgba(120,25,25,.85)";
        g.beginPath(); g.roundRect(VW / 2 - w / 2, y - 16, w, 34, 8); g.fill();
        g.strokeStyle = "#e8b0a0";
        g.lineWidth = 1.5;
        g.beginPath(); g.roundRect(VW / 2 - w / 2, y - 16, w, 34, 8); g.stroke();
        textShadow(g, "▶ " + label, VW / 2, y + 1, 18, "#fff", "center");
      } else {
        text(g, label, VW / 2, y + 1, 16, "#9a92ac", "center");
      }
    });

    // panneau de description du mode sélectionné (pour les nouveaux joueurs)
    const desc = this.items[this.sel]?.desc;
    if (desc) {
      const bw = 640, bx = VW / 2 - bw / 2, by = VH - 78, bh = 46;
      g.fillStyle = "rgba(12,9,20,.72)";
      g.beginPath(); g.roundRect(bx, by, bw, bh, 8); g.fill();
      g.strokeStyle = "rgba(150,140,190,.3)"; g.lineWidth = 1;
      g.beginPath(); g.roundRect(bx, by, bw, bh, 8); g.stroke();
      g.font = `bold 13px ${FONT}`;
      const lines = wrapLine(g, T(desc), bw - 32, 2);
      let ly = by + (bh - (lines.length - 1) * 17) / 2;
      for (const ln of lines) { text(g, ln, VW / 2, ly, 13, "#c8c0d8", "center"); ly += 17; }
    }

    const blink = Math.sin(this.t * 4) > -0.3;
    if (blink) text(g, T("menu.hint"), VW / 2, VH - 20, 12, "#6e6584", "center");
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
  private confirmReset = false; // demande de confirmation avant la remise à zéro
  private static readonly N = 6; // musique, sfx, langue, contrôles, réinitialiser, retour
  update(dt: number) {
    if (Input.consume("cancel")) {
      if (this.confirmReset) { this.confirmReset = false; Audio.sfx("back"); return; }
      Audio.sfx("back"); saveSettings(G.settings); SceneManager.pop(); return;
    }
    if (Input.consume("up")) { this.sel = (this.sel + OptionsScene.N - 1) % OptionsScene.N; this.confirmReset = false; Audio.sfx("ui"); }
    if (Input.consume("down")) { this.sel = (this.sel + 1) % OptionsScene.N; this.confirmReset = false; Audio.sfx("ui"); }
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
      if (this.sel === 3) { Audio.sfx("confirm"); SceneManager.push(new KeybindScene()); }
      if (this.sel === 4) {
        // Réinitialiser le jeu : demande confirmation, puis efface tout et recharge.
        if (!this.confirmReset) { this.confirmReset = true; Audio.sfx("locked"); }
        else { Audio.sfx("confirm"); resetAllData(); try { location.reload(); } catch { } }
      }
      if (this.sel === 5) { Audio.sfx("back"); saveSettings(G.settings); SceneManager.pop(); }
    }
  }

  draw(g: CanvasRenderingContext2D) {
    dimBackground(g, 0.72);
    const w = 460, h = 360, x = VW / 2 - w / 2, y = VH / 2 - h / 2;
    panel(g, x, y, w, h, T("options.title"));

    const rows = [
      { label: T("options.music"), value: G.settings.musicVol },
      { label: T("options.sfx"), value: G.settings.sfxVol },
      { label: T("options.lang"), value: -1 },
      { label: T("options.controls"), value: -3 },
      { label: this.confirmReset ? T("options.reset.confirm") : T("options.reset"), value: -4 },
      { label: T("options.back"), value: -2 },
    ];
    rows.forEach((r, i) => {
      const ry = y + 54 + i * 48;
      const selected = i === this.sel;
      const isReset = r.value === -4;
      if (selected) {
        g.fillStyle = isReset ? "rgba(150,30,30,.6)" : "rgba(120,25,25,.5)";
        g.beginPath(); g.roundRect(x + 16, ry - 17, w - 32, 36, 6); g.fill();
      }
      text(g, r.label, x + 34, ry, isReset ? 15 : 16, isReset ? (selected ? "#ff9090" : "#c88888") : (selected ? "#fff" : "#a89ec0"));
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
      } else if (r.value === -3) {
        text(g, T("options.controls.open"), x + 250, ry, 14, selected ? "#ffd84a" : "#8a8098");
      }
    });
  }
}

// ===== Remappage des touches (overlay) =====
export class KeybindScene implements Scene {
  private sel = 0;
  private waiting = false; // en attente de la nouvelle touche
  private t = 0;
  private rejected = 0;    // clignote si un remappage a été refusé (touche essentielle)
  private static readonly ROWS_VISIBLE = 8;

  private applyAndSave(overrides: Record<string, string>) {
    G.settings.binds = overrides;
    Input.applyBindings(overrides);
    saveSettings(G.settings);
  }

  update(dt: number) {
    this.t += dt;
    this.rejected = Math.max(0, this.rejected - dt);
    if (this.waiting) return; // la capture est gérée par Input.captureNext

    const n = BIND_ORDER.length + 1; // + ligne "Réinitialiser"
    if (Input.consume("cancel")) { Audio.sfx("back"); SceneManager.pop(); return; }
    if (Input.consume("up")) { this.sel = (this.sel + n - 1) % n; Audio.sfx("ui"); }
    if (Input.consume("down")) { this.sel = (this.sel + 1) % n; Audio.sfx("ui"); }
    if (Input.consume("confirm")) {
      if (this.sel === BIND_ORDER.length) {
        // Réinitialiser
        Audio.sfx("confirm");
        this.applyAndSave({});
        return;
      }
      // Remapper l'action sélectionnée : capture la prochaine touche.
      Audio.sfx("ui");
      this.waiting = true;
      const action = BIND_ORDER[this.sel];
      Input.captureNext((code) => {
        this.waiting = false;
        Input.clear();
        if (code === "Escape") { Audio.sfx("back"); return; } // annule
        const binds = { ...(G.settings.binds ?? {}), [action]: code };
        // Refuse si ça priverait une touche essentielle (Valider/Annuler/Haut/Bas) de sa dernière touche.
        if (!Input.validateBinds(binds)) { Audio.sfx("locked"); this.rejected = 1.4; return; }
        this.applyAndSave(binds);
        Audio.sfx("confirm");
      });
    }
  }

  draw(g: CanvasRenderingContext2D) {
    dimBackground(g, 0.8);
    const w = 520, h = 400, x = VW / 2 - w / 2, y = VH / 2 - h / 2;
    panel(g, x, y, w, h, T("keybind.title"));

    const total = BIND_ORDER.length + 1;
    // fenêtre de défilement qui suit la sélection
    let top = Math.max(0, Math.min(this.sel - Math.floor(KeybindScene.ROWS_VISIBLE / 2), total - KeybindScene.ROWS_VISIBLE));
    top = Math.max(0, top);
    for (let vi = 0; vi < KeybindScene.ROWS_VISIBLE && top + vi < total; vi++) {
      const i = top + vi;
      const ry = y + 52 + vi * 36;
      const selected = i === this.sel;
      if (selected) {
        g.fillStyle = "rgba(120,25,25,.5)";
        g.beginPath(); g.roundRect(x + 14, ry - 15, w - 28, 32, 6); g.fill();
      }
      if (i === BIND_ORDER.length) {
        text(g, T("keybind.reset"), x + 30, ry, 15, selected ? "#ffd0d0" : "#c89a9a");
      } else {
        const action = BIND_ORDER[i];
        text(g, T("key." + action), x + 30, ry, 15, selected ? "#fff" : "#a89ec0");
        const capturing = selected && this.waiting;
        const label = capturing ? (Math.sin(this.t * 8) > 0 ? T("keybind.press") : "…") : codeLabel(Input.boundCode(action));
        g.fillStyle = "rgba(20,16,34,.8)";
        const bw2 = 130;
        g.beginPath(); g.roundRect(x + w - bw2 - 30, ry - 13, bw2, 26, 6); g.fill();
        g.strokeStyle = capturing ? "#ffd84a" : "rgba(150,140,190,.4)"; g.lineWidth = 1.4;
        g.beginPath(); g.roundRect(x + w - bw2 - 30, ry - 13, bw2, 26, 6); g.stroke();
        text(g, label, x + w - bw2 / 2 - 30, ry, 13, capturing ? "#ffd84a" : "#c8d0e8", "center");
      }
    }

    if (this.rejected > 0) textShadow(g, T("keybind.locked"), VW / 2, y + h - 36, 13, "#ff8080", "center");
    text(g, T("keybind.hint"), VW / 2, y + h - 16, 12, "#8a8098", "center");
  }
}

// ===== Crédits =====
// ===== LE CODEX : bestiaire + échos de lore, consignés au fil des parties =====
export class CodexScene implements Scene {
  private sel = 0;
  private t = 0;

  update(dt: number) {
    this.t += dt;
    if (Input.consume("cancel")) { Audio.sfx("back"); SceneManager.pop(); return; }
    const n = BESTIARY.length;
    if (Input.consume("left")) { this.sel = (this.sel + n - 1) % n; Audio.sfx("ui"); }
    if (Input.consume("right")) { this.sel = (this.sel + 1) % n; Audio.sfx("ui"); }
    if (Input.consume("up")) { this.sel = (this.sel + n - 6) % n; Audio.sfx("ui"); }
    if (Input.consume("down")) { this.sel = (this.sel + 6) % n; Audio.sfx("ui"); }
  }

  // cumule les variantes (le Gardien enragé compte avec le Gardien)
  private killsFor(e: BestiaryEntry): number {
    let k = codexKills(e.nameKey);
    if (e.nameKey === "mob.warden") k += codexKills("mob.warden.enraged");
    return k;
  }

  draw(g: CanvasRenderingContext2D) {
    dimBackground(g);
    const w = 760, h = 470, x = VW / 2 - w / 2, y = VH / 2 - h / 2;
    panel(g, x, y, w, h, T("codex.title"));

    // ---- grille du bestiaire (6 × 2) ----
    const cols = 6, cell = 92, gx = x + (w - cols * cell) / 2, gy = y + 52;
    BESTIARY.forEach((e, i) => {
      const cx2 = gx + (i % cols) * cell, cy2 = gy + Math.floor(i / cols) * cell;
      const known = this.killsFor(e) > 0;
      const selected = i === this.sel;
      g.fillStyle = selected ? "rgba(120,30,40,.55)" : "rgba(20,14,28,.75)";
      g.beginPath(); g.roundRect(cx2 + 4, cy2 + 4, cell - 8, cell - 8, 8); g.fill();
      g.strokeStyle = selected ? "#ffb0a0" : e.boss && known ? "rgba(200,120,140,.55)" : "rgba(130,120,155,.3)";
      g.lineWidth = selected ? 2 : 1;
      g.beginPath(); g.roundRect(cx2 + 4, cy2 + 4, cell - 8, cell - 8, 8); g.stroke();
      const spr = getSprite(e.sprite);
      if (spr) {
        g.save();
        g.imageSmoothingEnabled = false;
        if (!known) g.filter = "brightness(0.12)"; // silhouette : encore à découvrir
        else if (e.boss) { g.shadowColor = "#ff5060"; g.shadowBlur = 10; }
        g.drawImage(spr, cx2 + cell / 2 - 28, cy2 + cell / 2 - 30, 56, 56);
        g.restore();
      }
      if (!known) textShadow(g, "?", cx2 + cell / 2, cy2 + cell - 16, 13, "#7a7090", "center");
    });

    // ---- fiche de l'entrée sélectionnée ----
    const e = BESTIARY[this.sel];
    const known = this.killsFor(e) > 0;
    const fy = gy + 2 * cell + 12;
    g.strokeStyle = "rgba(150,130,180,.25)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x + 20, fy - 4); g.lineTo(x + w - 20, fy - 4); g.stroke();
    if (known) {
      textShadow(g, T(e.nameKey) + (e.boss ? "   ✦" : ""), x + w / 2, fy + 12, 16, e.boss ? "#ff9aa4" : "#f0e2c8", "center");
      text(g, T("codex.kills", { n: this.killsFor(e) }), x + w / 2, fy + 32, 12, "#c8a86a", "center");
      g.font = `bold 12px ${FONT}`;
      const lines = wrapLine(g, T(e.descKey), w - 80, 3);
      let ly = fy + 52;
      for (const ln of lines) { text(g, ln, x + w / 2, ly, 12, "#b8b0c8", "center"); ly += 16; }
    } else {
      textShadow(g, "???", x + w / 2, fy + 12, 16, "#7a7090", "center");
      text(g, T("codex.unknown"), x + w / 2, fy + 40, 12, "#8a8098", "center");
    }

    // ---- échos de lore ----
    const found = codexLoreFound().filter(k => LORE_KEYS.includes(k));
    textShadow(g, T("codex.lore", { n: found.length, total: LORE_KEYS.length }), x + w / 2, y + h - 42, 13, "#c8a8ff", "center");
    text(g, T("codex.nav"), x + w / 2, y + h - 20, 11, "#8a8098", "center");
  }
}

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
