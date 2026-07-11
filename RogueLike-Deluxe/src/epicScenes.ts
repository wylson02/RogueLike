// ===== LE PANTHÉON — menu de sélection des Colosses (niveaux à cadenas) + révélation secrète =====
import { Scene } from "./scenes";
import { VW, VH, text, textShadow, Particles, wrapLine, FONT } from "./render";
import { Input } from "./input";
import { Audio } from "./audio";
import { T } from "./i18n";
import { Flow } from "./game";
import { getSprite } from "./sprites";
import { clamp } from "./core";
import {
  EPIC_BOSSES, EPIC_SECRET_START, isEpicUnlocked, isEpicCleared, epicClearedCount,
  epicVisibleCount, markEpicRevealed, epicBestRank, EPIC_VOWS, toggleVow, isVowActive, activeVowCount,
} from "./epicMode";

export class EpicSelectScene implements Scene {
  private sel = 0;
  private t = 0;
  private particles = new Particles();

  enter() {
    Audio.setMode("menu");
    // sélection par défaut : le prochain Colosse à affronter (le premier non vaincu débloqué)
    this.sel = Math.min(epicVisibleCount() - 1, epicClearedCount());
  }

  update(dt: number) {
    this.t += dt;
    if (Math.random() < dt * 14)
      this.particles.spawn({
        x: Math.random() * VW, y: VH + 8,
        vx: (Math.random() - 0.5) * 10, vy: -18 - Math.random() * 26,
        life: 4 + Math.random() * 3, maxLife: 7, size: 2 + Math.random() * 2,
        color: Math.random() < 0.6 ? "#8a2a4a" : "#c85068", glow: true,
      });
    this.particles.update(dt);

    if (Input.consume("cancel")) { Audio.sfx("back"); Flow.toMenu(); return; }
    const n = epicVisibleCount();
    if (Input.consume("left")) { this.sel = (this.sel + n - 1) % n; Audio.sfx("ui"); }
    if (Input.consume("right")) { this.sel = (this.sel + 1) % n; Audio.sfx("ui"); }
    // Serments du Panthéon : touches 1-3 pour jurer/renoncer (rang SS à la clé)
    if (Input.consume("act1")) { toggleVow(EPIC_VOWS[0].id); Audio.sfx(isVowActive(EPIC_VOWS[0].id) ? "seal" : "back"); }
    if (Input.consume("act2")) { toggleVow(EPIC_VOWS[1].id); Audio.sfx(isVowActive(EPIC_VOWS[1].id) ? "seal" : "back"); }
    if (Input.consume("act3")) { toggleVow(EPIC_VOWS[2].id); Audio.sfx(isVowActive(EPIC_VOWS[2].id) ? "seal" : "back"); }
    if (Input.consume("confirm")) {
      if (isEpicUnlocked(this.sel)) { Audio.sfx("confirm"); Flow.epicStart(this.sel); }
      else { Audio.sfx("locked"); }
    }
  }

  draw(g: CanvasRenderingContext2D) {
    // fond
    const grad = g.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, "#140812"); grad.addColorStop(0.6, "#20101a"); grad.addColorStop(1, "#0c0610");
    g.fillStyle = grad; g.fillRect(0, 0, VW, VH);
    this.particles.draw(g);

    // titre
    g.save();
    g.shadowColor = "#c02840"; g.shadowBlur = 22;
    textShadow(g, T("epic.title"), VW / 2, 66, 44, "#f0d8c8", "center");
    g.restore();
    text(g, T("epic.subtitle"), VW / 2, 106, 15, "#c89aa8", "center");
    text(g, T("epic.progress", { n: epicClearedCount(), total: EPIC_BOSSES.length }), VW / 2, 130, 13, "#9a8090", "center");

    // rangée de nœuds — layout responsive (5 cartes larges, ou 8 plus compactes après révélation)
    const n = epicVisibleCount();
    const avail = 900;
    const gap = n > 5 ? 12 : 22;
    const cardW = Math.min(140, (avail - (n - 1) * gap) / n);
    const cardH = 172;
    const portSize = Math.min(80, cardW - 24);
    const totalW = n * cardW + (n - 1) * gap;
    const startX = VW / 2 - totalW / 2;
    const cy = 176;

    for (let i = 0; i < n; i++) {
      const b = EPIC_BOSSES[i];
      const cx = startX + i * (cardW + gap);
      const midX = cx + cardW / 2;
      const unlocked = isEpicUnlocked(i);
      const cleared = isEpicCleared(i);
      const selected = i === this.sel;
      const secret = i >= EPIC_SECRET_START;

      // liaison entre nœuds (chaîne)
      if (i > 0) {
        g.strokeStyle = isEpicUnlocked(i - 1) && unlocked ? "rgba(200,120,90,.5)" : "rgba(90,80,100,.3)";
        g.lineWidth = 3;
        g.beginPath(); g.moveTo(cx - gap, cy + cardH / 2); g.lineTo(cx, cy + cardH / 2); g.stroke();
      }

      // carte (les secrets ont un liseré doré distinctif)
      g.fillStyle = selected ? "rgba(120,30,45,.6)" : secret ? "rgba(34,22,14,.72)" : "rgba(28,20,34,.7)";
      g.beginPath(); g.roundRect(cx, cy, cardW, cardH, 10); g.fill();
      g.strokeStyle = selected ? "#ffb0a0" : cleared ? "rgba(200,170,90,.6)" : secret ? "rgba(200,150,80,.5)" : "rgba(140,120,150,.35)";
      g.lineWidth = selected ? 2.5 : 1.5;
      g.beginPath(); g.roundRect(cx, cy, cardW, cardH, 10); g.stroke();

      // numéro
      textShadow(g, "" + (i + 1), cx + 12, cy + 18, 17, cleared ? "#ffd84a" : "#c8c0d4", "left");
      // meilleur rang obtenu (badge haut-droite : S doré, A violet, B bleu, C gris)
      const rank = epicBestRank(i);
      if (rank && cleared) {
        const RC: Record<string, string> = { SS: "#fff2c0", S: "#ffd84a", A: "#c8a8ff", B: "#8fd4ff", C: "#a8a4b8" };
        g.save();
        g.fillStyle = "rgba(8,6,14,.9)"; g.beginPath(); g.roundRect(cx + cardW - 26, cy + 6, 20, 20, 5); g.fill();
        g.strokeStyle = RC[rank] ?? "#a8a4b8"; g.lineWidth = 1.4;
        g.beginPath(); g.roundRect(cx + cardW - 26, cy + 6, 20, 20, 5); g.stroke();
        textShadow(g, rank, cx + cardW - 16, cy + 16, 13, RC[rank] ?? "#a8a4b8", "center");
        g.restore();
      }

      // portrait
      const spr = getSprite(b.sprite);
      g.save();
      g.imageSmoothingEnabled = false;
      if (!unlocked) g.globalAlpha = 0.25;
      if (spr) {
        if (unlocked) { g.shadowColor = b.glow; g.shadowBlur = selected ? 18 : 10; }
        g.drawImage(spr, midX - portSize / 2, cy + 28, portSize, portSize);
      }
      g.restore();

      if (!unlocked) {
        g.save();
        textShadow(g, "🔒", midX, cy + 66, 38, "#b0a0b8", "center");
        g.restore();
        text(g, T("epic.locked"), midX, cy + cardH - 20, 12, "#8a8098", "center");
      } else {
        // nom sur 1-2 lignes, borné à la largeur de carte (fini les débordements)
        const maxW = cardW - 14;
        g.font = `bold 13px ${FONT}`;
        const nameLines = wrapLine(g, T(b.nameKey), maxW, 2);
        let ny = cy + 120 - (nameLines.length - 1) * 7;
        for (const ln of nameLines) { textShadow(g, ln, midX, ny, 13, selected ? "#fff" : "#e0d0d8", "center"); ny += 15; }
        g.font = `bold 10px ${FONT}`;
        const titleLine = wrapLine(g, T(b.titleKey), maxW, 1)[0];
        text(g, titleLine, midX, cy + 140, 10, "#b09aa8", "center");
        if (cleared) textShadow(g, "✓ " + T("epic.done"), midX, cy + cardH - 12, 11, "#ffd84a", "center");
      }
    }

    // panneau d'infos du Colosse sélectionné
    const b = EPIC_BOSSES[this.sel];
    const unlocked = isEpicUnlocked(this.sel);
    const py = cy + cardH + 44;
    if (unlocked) {
      textShadow(g, T(b.nameKey) + "  —  " + T(b.titleKey), VW / 2, py, 18, b.glow, "center");
      text(g, T("epic.hint.fight"), VW / 2, py + 32, 14, "#c8c0d4", "center");
    } else {
      text(g, T("epic.hint.locked"), VW / 2, py + 8, 15, "#a89ec0", "center");
    }

    // ===== Les Serments du Panthéon : malus volontaires, rang SS à la clé =====
    {
      const vy = py + 58;
      const label = activeVowCount() > 0 ? T("vow.header.on", { n: activeVowCount() }) : T("vow.header");
      textShadow(g, label, VW / 2, vy, 12, activeVowCount() > 0 ? "#ffd84a" : "#9a8090", "center");
      let vx = VW / 2 - 280;
      EPIC_VOWS.forEach((v, i) => {
        const on = isVowActive(v.id);
        g.save();
        g.fillStyle = on ? "rgba(120,90,20,.5)" : "rgba(20,14,26,.7)";
        g.beginPath(); g.roundRect(vx, vy + 10, 180, 26, 6); g.fill();
        g.strokeStyle = on ? "#ffd84a" : "rgba(140,120,150,.35)"; g.lineWidth = on ? 1.6 : 1;
        g.beginPath(); g.roundRect(vx, vy + 10, 180, 26, 6); g.stroke();
        textShadow(g, `${i + 1} · ${T(v.nameKey)}`, vx + 90, vy + 23, 12, on ? "#ffe6a0" : "#a8a0b8", "center");
        g.restore();
        vx += 190;
      });
    }

    text(g, T("epic.nav"), VW / 2, VH - 22, 12, "#7e7490", "center");
  }
}

// ===== Cinématique de RÉVÉLATION : après avoir vaincu les 5 premiers, l'Abîme dévoile les 3 secrets =====
export class EpicRevealScene implements Scene {
  private t = 0;
  private particles = new Particles();
  private shake = 0;
  private shattered = new Set<number>();
  private done: () => void;
  private ended = false;

  constructor(done: () => void) { this.done = done; }

  enter() {
    Audio.setMode("boss");
    Audio.sfx("roar");
    markEpicRevealed(); // marqué dès l'entrée : la surprise ne se rejoue pas
  }

  private finish() { if (!this.ended) { this.ended = true; this.done(); } }

  update(dt: number) {
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt * 3);
    this.particles.update(dt);

    // éclatement échelonné des cinq sceaux (1.6 → 2.8)
    if (this.t > 1.6) {
      const idx = Math.floor((this.t - 1.6) / 0.22);
      if (idx < 5 && !this.shattered.has(idx)) {
        this.shattered.add(idx);
        this.shake = 0.8;
        const sx = VW / 2 + (idx - 2) * 96;
        this.particles.burst(sx, 190, "#c85068", 24, 180, 0.8, 3.6, true);
        Audio.sfx("crit");
      }
    }
    // ouverture de la faille (2.9)
    if (this.t > 2.9 && this.t < 3.1) { this.shake = Math.max(this.shake, 1.6); Audio.sfx("phase2"); }
    // montée des trois présences : braises continues
    if (this.t > 3.2 && Math.random() < dt * 40) {
      this.particles.spawn({ x: VW / 2 + (Math.random() - 0.5) * 620, y: VH / 2 + 60, vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 40, life: 1.2, maxLife: 1.2, size: 2 + Math.random() * 2, color: Math.random() < 0.5 ? "#ffd84a" : "#ff6a40", glow: true });
    }

    if (this.t > 2.6 && Input.consume("confirm")) this.finish();
    if (this.t > 8.5) this.finish();
  }

  draw(g: CanvasRenderingContext2D) {
    g.save();
    if (this.shake > 0) g.translate((Math.random() - 0.5) * this.shake * 12, (Math.random() - 0.5) * this.shake * 12);

    g.fillStyle = "#05040a"; g.fillRect(-16, -16, VW + 32, VH + 32);

    // faille de lumière qui s'ouvre au centre (à partir de 2.9)
    if (this.t > 2.9) {
      const p = clamp((this.t - 2.9) / 1.0, 0, 1);
      const h = p * 60;
      const grad = g.createLinearGradient(0, VH / 2 - h, 0, VH / 2 + h);
      grad.addColorStop(0, "rgba(255,180,90,0)"); grad.addColorStop(0.5, `rgba(255,220,140,${0.5 * p})`); grad.addColorStop(1, "rgba(255,180,90,0)");
      g.fillStyle = grad; g.fillRect(0, VH / 2 - h, VW, h * 2);
    }

    // les cinq sceaux (glyphes) qui pulsent puis éclatent
    for (let i = 0; i < 5; i++) {
      if (this.shattered.has(i)) continue;
      const sx = VW / 2 + (i - 2) * 96, sy = 190;
      const pulse = 0.7 + Math.sin(this.t * 4 + i) * 0.3;
      g.save();
      g.globalAlpha = clamp(this.t / 1.2, 0, 1) * pulse;
      g.shadowColor = "#ff6a80"; g.shadowBlur = 20;
      textShadow(g, "✦", sx, sy, 40, "#ffd0d8", "center");
      text(g, "" + (i + 1), sx, sy + 2, 14, "#7a1020", "center");
      g.restore();
    }

    // les trois présences secrètes qui s'élèvent de la faille (à partir de 3.2)
    if (this.t > 3.2) {
      const secrets = EPIC_BOSSES.slice(EPIC_SECRET_START, EPIC_SECRET_START + 3);
      secrets.forEach((b, k) => {
        const rise = clamp((this.t - 3.2 - k * 0.4) / 1.1, 0, 1);
        if (rise <= 0) return;
        const ease = 1 - Math.pow(1 - rise, 3);
        const bx = VW / 2 + (k - 1) * 240;
        const by = VH / 2 + 40 - ease * 40;
        const size = 150;
        const spr = getSprite(b.sprite);
        g.save();
        g.globalAlpha = ease;
        g.imageSmoothingEnabled = false;
        g.shadowColor = b.glow; g.shadowBlur = 30 + Math.sin(this.t * 3 + k) * 12;
        if (spr) g.drawImage(spr, bx - size / 2, by - size, size, size);
        g.restore();
      });
    }

    this.particles.draw(g);
    g.restore();

    // textes
    if (this.t < 1.6) {
      textShadow(g, T("epic.reveal.1"), VW / 2, 300, 22, "#e8d0d8", "center");
    } else if (this.t < 3.2) {
      textShadow(g, T("epic.reveal.2"), VW / 2, 300, 20, "#ffb0a0", "center");
    } else {
      const a = clamp((this.t - 4.4) / 1.0, 0, 1);
      g.globalAlpha = a;
      g.save();
      g.shadowColor = "#ffd84a"; g.shadowBlur = 26;
      textShadow(g, T("epic.reveal.3"), VW / 2, VH - 96, 34, "#ffe6a0", "center");
      g.restore();
      g.globalAlpha = a;
      textShadow(g, T("epic.reveal.names"), VW / 2, VH - 58, 15, "#c8b0a0", "center");
      g.globalAlpha = 1;
    }

    if (this.t > 2.6 && Math.sin(this.t * 5) > -0.3)
      text(g, T("epic.reveal.skip"), VW / 2, VH - 24, 12, "#8a8098", "center");
  }
}
