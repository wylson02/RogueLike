// ===== Lancement du jeu : mini-cinématique d'accueil (skippable) + écran-titre stylé =====
import { Scene } from "./scenes";
import { VW, VH, text, textShadow, Particles, FONT } from "./render";
import { Input } from "./input";
import { Audio } from "./audio";
import { T } from "./i18n";
import { Flow } from "./game";
import { getSprite } from "./sprites";
import { clamp } from "./core";
import type { CinePage } from "./cinematics";

// Mini-cinématique d'accueil : évocatrice, sans spoiler. ENTRÉE avance, ÉCHAP passe tout.
export function titleAttractPages(): CinePage[] {
  return [
    { bg: "#070510", sfx: "night", lines: [
      { text: T("attract.1a"), color: "#c8c0d4", size: 18 },
      { text: T("attract.1b"), color: "#8a80a0", size: 16 },
    ] },
    { bg: "#0a0612", lines: [
      { text: T("attract.2a"), color: "#c8c0d4", size: 18 },
      { text: T("attract.2b"), color: "#c04040", size: 17 },
    ] },
    { bg: "#0c0510", sfx: "seal", lines: [
      { text: T("attract.3a"), color: "#c8c0d4", size: 18 },
      { text: T("attract.3b"), color: "#ffd0d0", size: 20 },
    ] },
  ];
}

// ===== Écran-titre : le "wow" avant le menu =====
export class TitleScene implements Scene {
  private t = 0;
  private particles = new Particles();
  private lightning = 0;
  private shine = -0.4; // position du reflet balayant sur le titre (-0.4 → 1.4 en boucle)

  enter() { Audio.setMode("menu"); }

  update(dt: number) {
    this.t += dt;
    this.lightning = Math.max(0, this.lightning - dt * 4);
    if (Math.random() < dt * 0.14) this.lightning = 0.6 + Math.random() * 0.4;
    this.shine += dt * 0.42;
    if (this.shine > 1.6) this.shine = -0.5;

    // braises
    if (Math.random() < dt * 24)
      this.particles.spawn({
        x: Math.random() * VW, y: VH + 8,
        vx: (Math.random() - 0.5) * 12, vy: -22 - Math.random() * 34,
        life: 4 + Math.random() * 3, maxLife: 7, size: 2 + Math.random() * 2,
        color: Math.random() < 0.7 ? "#c0502a" : "#e8a03a", glow: true,
      });
    // runes violettes montant du portail
    if (Math.random() < dt * 7)
      this.particles.spawn({
        x: VW / 2 + (Math.random() - 0.5) * 200, y: VH - 40 - Math.random() * 140,
        vx: (Math.random() - 0.5) * 6, vy: -14 - Math.random() * 16,
        life: 3 + Math.random() * 2, maxLife: 5, size: 2,
        color: Math.random() < 0.5 ? "#8a5fd0" : "#c8a0ff", glow: true,
      });
    this.particles.update(dt);

    if (Input.consume("confirm") || Input.consume("cancel")) { Audio.sfx("confirm"); Flow.toMenu(); }
  }

  draw(g: CanvasRenderingContext2D) {
    const reveal = clamp(this.t / 0.9, 0, 1);          // fondu/zoom d'apparition
    const ease = 1 - Math.pow(1 - reveal, 3);

    // fond dégradé
    const grad = g.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, "#0c0716"); grad.addColorStop(0.6, "#160b20"); grad.addColorStop(1, "#251020");
    g.fillStyle = grad; g.fillRect(0, 0, VW, VH);

    // éclair d'ambiance
    if (this.lightning > 0) { g.fillStyle = `rgba(150,140,200,${(this.lightning * 0.09).toFixed(3)})`; g.fillRect(0, 0, VW, VH); }

    // nappes de brume
    g.save(); g.globalAlpha = 0.06;
    for (let i = 0; i < 2; i++) {
      const fy = VH * (0.55 + i * 0.25) + Math.sin(this.t * 0.35 + i * 2.4) * 20;
      const fgrad = g.createLinearGradient(0, fy - 60, 0, fy + 60);
      fgrad.addColorStop(0, "rgba(150,130,190,0)"); fgrad.addColorStop(0.5, "rgba(150,130,190,1)"); fgrad.addColorStop(1, "rgba(150,130,190,0)");
      g.fillStyle = fgrad; g.fillRect(0, fy - 60, VW, 120);
    }
    g.restore();

    // portail au fond avec lueur rouge
    g.save(); g.globalAlpha = 0.28;
    const dw = 260, dh = 360, dx = VW / 2 - dw / 2, dy = VH - dh;
    g.fillStyle = "#000";
    g.beginPath();
    g.moveTo(dx, VH); g.lineTo(dx, dy + 96);
    g.arc(VW / 2, dy + 96, dw / 2, Math.PI, 0);
    g.lineTo(dx + dw, VH); g.fill();
    g.strokeStyle = "#3a2545"; g.lineWidth = 4; g.stroke();
    const gl = g.createRadialGradient(VW / 2, dy + 200, 6, VW / 2, dy + 200, 150);
    gl.addColorStop(0, `rgba(200,40,40,${0.3 + Math.sin(this.t * 1.4) * 0.12})`); gl.addColorStop(1, "rgba(200,40,40,0)");
    g.fillStyle = gl; g.fillRect(dx, dy, dw, dh);
    g.restore();

    this.particles.draw(g);

    // ===== TITRE (apparition + flottement + reflet balayant) =====
    const title = T("title");
    const cx = VW / 2, cy = 190 + Math.sin(this.t * 1.1) * 4;
    // taille auto pour tenir dans la largeur
    let fs = 62;
    g.font = `bold ${fs}px ${FONT}`;
    while (g.measureText(title).width > VW - 150 && fs > 30) { fs -= 2; g.font = `bold ${fs}px ${FONT}`; }
    const tw = g.measureText(title).width;

    g.save();
    g.globalAlpha = ease;
    g.translate(cx, cy);
    g.scale(0.85 + ease * 0.15, 0.85 + ease * 0.15);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `bold ${fs}px ${FONT}`;
    // halo
    g.shadowColor = "#c02828"; g.shadowBlur = 30 + Math.sin(this.t * 2) * 10;
    g.fillStyle = "#7a1414"; g.fillText(title, 0, 0);
    g.shadowBlur = 0;
    // corps du titre avec reflet balayant (bande claire qui traverse les lettres)
    const p = this.shine;
    const sg = g.createLinearGradient(-tw / 2, 0, tw / 2, 0);
    const base = "#f0e2c8";
    sg.addColorStop(0, base);
    sg.addColorStop(clamp(p - 0.16, 0.001, 0.999), base);
    sg.addColorStop(clamp(p, 0.002, 0.999), "#fffcec");
    sg.addColorStop(clamp(p + 0.16, 0.003, 1), base);
    g.fillStyle = sg;
    g.fillText(title, 0, 0);
    g.restore();

    // sous-titre
    g.globalAlpha = ease;
    text(g, T("subtitle"), cx, cy + fs * 0.62 + 14, 15, "#9a8fae", "center");
    g.globalAlpha = 1;

    // épées décoratives
    const sw = getSprite("it_legend");
    if (sw) {
      g.save(); g.globalAlpha = ease; g.imageSmoothingEnabled = false;
      g.shadowColor = "#ffd84a"; g.shadowBlur = 14;
      const off = tw / 2 + 54;
      g.drawImage(sw, cx - off - 32, cy - 34, 64, 64);
      g.drawImage(sw, cx + off - 32, cy - 34, 64, 64);
      g.restore();
    }

    // invite clignotante "appuie pour commencer"
    if (reveal >= 1 && Math.sin(this.t * 4) > -0.35) {
      g.save();
      g.shadowColor = "#ffd0a0"; g.shadowBlur = 14;
      textShadow(g, T("title.start"), cx, VH - 96, 22, "#ffe6c8", "center");
      g.restore();
    }
    text(g, T("title.hint"), cx, VH - 40, 12, "#6e6584", "center");
  }
}
