// ===== LE PANTHÉON — menu de sélection des Colosses (niveaux à cadenas) =====
import { Scene } from "./scenes";
import { VW, VH, text, textShadow, Particles, wrapLine, FONT } from "./render";
import { Input } from "./input";
import { Audio } from "./audio";
import { T } from "./i18n";
import { Flow } from "./game";
import { getSprite } from "./sprites";
import { EPIC_BOSSES, isEpicUnlocked, isEpicCleared, epicClearedCount } from "./epicMode";

export class EpicSelectScene implements Scene {
  private sel = 0;
  private t = 0;
  private particles = new Particles();

  enter() {
    Audio.setMode("menu");
    // sélection par défaut : le prochain Colosse à affronter (le premier non vaincu débloqué)
    this.sel = Math.min(EPIC_BOSSES.length - 1, epicClearedCount());
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
    const n = EPIC_BOSSES.length;
    if (Input.consume("left")) { this.sel = (this.sel + n - 1) % n; Audio.sfx("ui"); }
    if (Input.consume("right")) { this.sel = (this.sel + 1) % n; Audio.sfx("ui"); }
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
    textShadow(g, T("epic.title"), VW / 2, 70, 46, "#f0d8c8", "center");
    g.restore();
    text(g, T("epic.subtitle"), VW / 2, 112, 15, "#c89aa8", "center");
    text(g, T("epic.progress", { n: epicClearedCount(), total: EPIC_BOSSES.length }), VW / 2, 138, 13, "#9a8090", "center");

    // rangée de nœuds
    const n = EPIC_BOSSES.length;
    const cardW = 132, gap = 22;
    const totalW = n * cardW + (n - 1) * gap;
    const startX = VW / 2 - totalW / 2;
    const cy = 190;
    for (let i = 0; i < n; i++) {
      const b = EPIC_BOSSES[i];
      const cx = startX + i * (cardW + gap);
      const unlocked = isEpicUnlocked(i);
      const cleared = isEpicCleared(i);
      const selected = i === this.sel;
      const cardH = 172;

      // liaison entre nœuds (chaîne)
      if (i > 0) {
        g.strokeStyle = isEpicUnlocked(i - 1) && unlocked ? "rgba(200,120,90,.5)" : "rgba(90,80,100,.3)";
        g.lineWidth = 3;
        g.beginPath(); g.moveTo(cx - gap, cy + cardH / 2); g.lineTo(cx, cy + cardH / 2); g.stroke();
      }

      // carte
      g.fillStyle = selected ? "rgba(120,30,45,.6)" : "rgba(28,20,34,.7)";
      g.beginPath(); g.roundRect(cx, cy, cardW, cardH, 10); g.fill();
      g.strokeStyle = selected ? "#ffb0a0" : cleared ? "rgba(200,170,90,.6)" : "rgba(140,120,150,.35)";
      g.lineWidth = selected ? 2.5 : 1.5;
      g.beginPath(); g.roundRect(cx, cy, cardW, cardH, 10); g.stroke();

      // numéro
      textShadow(g, "" + (i + 1), cx + 16, cy + 18, 18, cleared ? "#ffd84a" : "#c8c0d4", "left");

      // portrait
      const spr = getSprite(b.sprite);
      g.save();
      g.imageSmoothingEnabled = false;
      if (!unlocked) g.globalAlpha = 0.25;
      if (spr) {
        if (unlocked) { g.shadowColor = b.glow; g.shadowBlur = selected ? 18 : 10; }
        g.drawImage(spr, cx + cardW / 2 - 40, cy + 30, 80, 80);
      }
      g.restore();

      if (!unlocked) {
        // cadenas
        g.save();
        textShadow(g, "🔒", cx + cardW / 2, cy + 70, 40, "#b0a0b8", "center");
        g.restore();
        text(g, T("epic.locked"), cx + cardW / 2, cy + cardH - 20, 12, "#8a8098", "center");
      } else {
        // nom sur 1-2 lignes, borné à la largeur de carte (fini les débordements)
        const midX = cx + cardW / 2, maxW = cardW - 16;
        g.font = `bold 13px ${FONT}`;
        const nameLines = wrapLine(g, T(b.nameKey), maxW, 2);
        let ny = cy + 118 - (nameLines.length - 1) * 7;
        for (const ln of nameLines) { textShadow(g, ln, midX, ny, 13, selected ? "#fff" : "#e0d0d8", "center"); ny += 15; }
        g.font = `bold 10px ${FONT}`;
        const titleLine = wrapLine(g, T(b.titleKey), maxW, 1)[0];
        text(g, titleLine, midX, cy + 138, 10, "#b09aa8", "center");
        if (cleared) textShadow(g, "✓ " + T("epic.done"), midX, cy + cardH - 12, 11, "#ffd84a", "center");
      }
    }

    // panneau d'infos du Colosse sélectionné
    const b = EPIC_BOSSES[this.sel];
    const unlocked = isEpicUnlocked(this.sel);
    const py = cy + 200;
    if (unlocked) {
      textShadow(g, T(b.nameKey) + "  —  " + T(b.titleKey), VW / 2, py, 18, b.glow, "center");
      text(g, T("epic.hint.fight"), VW / 2, py + 34, 14, "#c8c0d4", "center");
    } else {
      text(g, T("epic.hint.locked"), VW / 2, py + 10, 15, "#a89ec0", "center");
    }

    text(g, T("epic.nav"), VW / 2, VH - 24, 12, "#7e7490", "center");
  }
}
