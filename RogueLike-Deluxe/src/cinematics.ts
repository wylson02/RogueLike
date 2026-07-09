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

export function depthsIntroPages(): CinePage[] {
  return [
    {
      title: T("depthsintro.t"),
      lines: [
        { text: T("depthsintro.1") },
        { text: T("depthsintro.2") },
        { text: T("depthsintro.3"), color: "#c8a0e0" },
      ],
      sfx: "door", bg: "#0a0612",
    },
    {
      title: T("depthsintro.4t"), sprite: "rival", spriteGlow: "#8a3fd0", bg: "#0a0510",
      lines: [
        { text: T("depthsintro.4") },
        { text: T("depthsintro.5"), color: "#d0a0ff" },
      ],
      sfx: "warden",
    },
  ];
}

// ===== Dialogue de rencontre : le boss te parle avant le combat =====
// Renvoie null pour un monstre normal (pas de dialogue). Clé = nameKey du monstre.
export function bossEncounterPages(nameKey: string): CinePage[] | null {
  switch (nameKey) {
    case "mob.boss": // Roi de l'Abîme
      return [{
        title: T("mob.boss").toUpperCase(), sprite: "boss", spriteGlow: "#ff3b3b", bg: "#0c0508",
        lines: [
          { text: T("bossenc.king.1") },
          { text: T("bossenc.king.2"), color: "#ff9090" },
          { text: T("bossenc.king.3"), color: "#ffd0d0" },
        ],
        sfx: "roar",
      }];
    case "mob.superboss": // Dévoreur d'Âmes
      return [{
        title: T("mob.superboss").toUpperCase(), sprite: "avatar", spriteGlow: "#ff2040", bg: "#08040a",
        lines: [
          { text: T("bossenc.devourer.1") },
          { text: T("bossenc.devourer.2"), color: "#ff7090" },
          { text: T("bossenc.devourer.3"), color: "#e0c0ff" },
        ],
        sfx: "roar",
      }];
    case "mob.warden":
    case "mob.warden.enraged": // Gardien des Sceaux
      return [{
        title: T("mob.warden").toUpperCase(), sprite: "warden", spriteGlow: "#8a5fd0", bg: "#0a0714",
        lines: [
          { text: T("bossenc.warden.1") },
          { text: T("bossenc.warden.2"), color: "#c8a8ff" },
        ],
        sfx: "warden",
      }];
    case "mob.rival": { // Le Rival — sa transformation. Il te reconnaît selon LE SERMENT que tu portes.
      const tier = G.ctx.creedTier();
      // Selon ta voie, il te retrouve en frère d'armes, en étranger, ou en tyran jumeau.
      const meet = tier > 0
        ? { a: "bossenc.rival.break.1", b: "bossenc.rival.break.2" }
        : tier < 0
        ? { a: "bossenc.rival.perp.1", b: "bossenc.rival.perp.2" }
        : { a: "bossenc.rival.1", b: "bossenc.rival.2" };
      return [
        {
          title: T("bossenc.rival.t"), sprite: "rival", spriteGlow: tier < 0 ? "#c02840" : "#8a3fd0", bg: "#0a0510",
          lines: [
            { text: T(meet.a) },
            { text: T(meet.b), color: tier < 0 ? "#ff9090" : "#c0a0ff" },
          ],
          sfx: "warden",
        },
        {
          title: T("bossenc.rival.t2"), sprite: "rival", spriteGlow: "#c02840", bg: "#0c0408",
          lines: [
            { text: T("bossenc.rival.3") },
            { text: T("bossenc.rival.4"), color: "#ff9090" },
            { text: T("bossenc.rival.5"), color: "#e0c0ff" },
          ],
          sfx: "roar",
        },
      ];
    }
    default:
      return null;
  }
}

// ===== Cinématiques de découverte de lore (points de lore dans le monde) =====
export function loreMarkPages(cineKey: string): CinePage[] {
  switch (cineKey) {
    case "lore.rivaltrace": // Niveau 4 : la trace de la chute du Rival
      return [
        {
          title: T("lore.rivaltrace.t"), sprite: "rival_blade", spriteGlow: "#6a4a8a", bg: "#0c0508",
          lines: [
            { text: T("lore.rivaltrace.1") },
            { text: T("lore.rivaltrace.2"), color: "#c8a8ff" },
          ],
          sfx: "seal",
        },
        {
          title: T("lore.rivaltrace.t2"), bg: "#0a0408",
          lines: [
            { text: T("lore.rivaltrace.3") },
            { text: T("lore.rivaltrace.4"), color: "#ff9090" },
            { text: T("lore.rivaltrace.5"), color: "#8fd4ff", size: 14 },
          ],
          sfx: "warden",
        },
      ];
    // Inscriptions gravées disséminées : le fil de la boucle se resserre, niveau après niveau.
    case "lore.inscription1":
    case "lore.inscription2":
    case "lore.inscription3":
    case "lore.inscription5":
      return [{
        title: T("lore.inscription.t"), sprite: "lore_rune", spriteGlow: "#8a5fd0", bg: "#0a0710",
        lines: [
          { text: T(cineKey + ".1") },
          { text: T(cineKey + ".2"), color: "#c8a8ff" },
        ],
        sfx: "seal",
      }];
    default:
      return [{ lines: [{ text: cineKey }] }];
  }
}

// ===== Fins de campagne : de vrais mini-films animés, selon LE SERMENT tenu =====
export type EndingId = "redemption" | "balance" | "dominion";

// Un plan de film : durée, sous-titre, teinte, et une fonction de rendu paramétrée par u∈[0,1].
interface Shot {
  dur: number;
  captionKey?: string;
  captionColor?: string;
  sfx?: string;
  draw: (g: CanvasRenderingContext2D, u: number, t: number, film: EndingFilmScene) => void;
}

// ---- primitives de dessin ----
function drawThrone(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, glow: string) {
  g.save();
  g.shadowColor = glow; g.shadowBlur = 34;
  g.fillStyle = "#161020";
  g.fillRect(cx - 34 * s, cy, 68 * s, 44 * s);            // assise
  g.fillRect(cx - 30 * s, cy - 92 * s, 60 * s, 104 * s);  // dossier
  g.fillRect(cx - 42 * s, cy - 8 * s, 12 * s, 52 * s);    // accoudoirs
  g.fillRect(cx + 30 * s, cy - 8 * s, 12 * s, 52 * s);
  g.beginPath();                                          // pointes du dossier
  for (let i = -2; i <= 2; i++) {
    const x = cx + i * 20 * s;
    g.moveTo(x - 8 * s, cy - 90 * s);
    g.lineTo(x, cy - 118 * s - Math.abs(i) * 6 * s);
    g.lineTo(x + 8 * s, cy - 90 * s);
  }
  g.fill();
  g.restore();
  g.strokeStyle = glow; g.globalAlpha = 0.45; g.lineWidth = 2;
  g.strokeRect(cx - 30 * s, cy - 92 * s, 60 * s, 104 * s);
  g.globalAlpha = 1;
}

// Silhouette d'ombre (roi corrompu / champion lointain) avec yeux luisants.
function drawShadowFigure(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, eye: string, aura = 0) {
  g.save();
  if (aura > 0) { g.shadowColor = eye; g.shadowBlur = 20 * aura; }
  g.fillStyle = "#080510";
  g.beginPath();
  g.moveTo(cx, cy - 46 * s);
  g.quadraticCurveTo(cx - 28 * s, cy - 8 * s, cx - 22 * s, cy + 42 * s);
  g.lineTo(cx + 22 * s, cy + 42 * s);
  g.quadraticCurveTo(cx + 28 * s, cy - 8 * s, cx, cy - 46 * s);
  g.fill();
  g.beginPath(); g.arc(cx, cy - 52 * s, 13 * s, 0, Math.PI * 2); g.fill();
  g.restore();
  g.save();
  g.fillStyle = eye; g.shadowColor = eye; g.shadowBlur = 12;
  g.beginPath();
  g.arc(cx - 5 * s, cy - 53 * s, 2.4 * s, 0, Math.PI * 2);
  g.arc(cx + 5 * s, cy - 53 * s, 2.4 * s, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// Figure sprite (joueur / rival), avec voile sombre optionnel (corruption naissante).
function drawSpriteFigure(g: CanvasRenderingContext2D, key: string, cx: number, cy: number, size: number, alpha = 1, glow?: string) {
  const spr = getSprite(key);
  if (!spr) return;
  g.save();
  g.imageSmoothingEnabled = false;
  g.globalAlpha = alpha;
  if (glow) { g.shadowColor = glow; g.shadowBlur = 22; }
  g.drawImage(spr, cx - size / 2, cy - size / 2, size, size);
  g.restore();
}

// Veines de corruption qui rampent depuis un point, s'étendant avec grow∈[0,1].
function drawCorruptionVeins(g: CanvasRenderingContext2D, ox: number, oy: number, grow: number, len: number, color: string) {
  g.save();
  g.strokeStyle = color; g.shadowColor = color; g.shadowBlur = 8;
  g.lineWidth = 2;
  for (let b = 0; b < 7; b++) {
    const ang = -Math.PI / 2 + (b - 3) * 0.5;
    g.globalAlpha = 0.5 + 0.5 * grow;
    g.beginPath(); g.moveTo(ox, oy);
    let x = ox, y = oy;
    const steps = 8;
    for (let i = 1; i <= steps * grow; i++) {
      const t = i / steps;
      x = ox + Math.cos(ang + Math.sin(i * 1.3) * 0.4) * len * t;
      y = oy + Math.sin(ang + Math.sin(i * 1.7) * 0.4) * len * t;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.restore();
}

// Porte de lumière (le monde d'en haut), ouverture open∈[0,1].
function drawDoorOfLight(g: CanvasRenderingContext2D, cx: number, cy: number, h: number, open: number) {
  const w = 8 + open * 46;
  g.save();
  g.shadowColor = "#fff6d8"; g.shadowBlur = 40 * open;
  const grad = g.createLinearGradient(cx, cy - h / 2, cx, cy + h / 2);
  grad.addColorStop(0, "rgba(255,246,216,0)");
  grad.addColorStop(0.5, `rgba(255,248,224,${0.5 + 0.5 * open})`);
  grad.addColorStop(1, "rgba(255,246,216,0)");
  g.fillStyle = grad;
  g.fillRect(cx - w / 2, cy - h / 2, w, h);
  g.restore();
}

// ===== La scène de film : enchaîne les plans, fond noir cinéma, letterbox, sous-titre =====
export class EndingFilmScene implements Scene {
  private shots: Shot[];
  private idx = 0;
  private st = 0;   // temps dans le plan courant
  private t = 0;    // temps absolu
  private done: () => void;
  particles = new Particles();
  ending: EndingId;

  constructor(ending: EndingId, done: () => void) {
    this.ending = ending;
    this.done = done;
    this.shots = filmFor(ending, G.ctx.rivalSpared);
  }

  enter() { const s = this.shots[0]; if (s?.sfx) Audio.sfx(s.sfx); }

  private advance() {
    this.idx++;
    this.st = 0;
    if (this.idx >= this.shots.length) { this.done(); return; }
    const s = this.shots[this.idx];
    if (s.sfx) Audio.sfx(s.sfx);
  }

  update(dt: number) {
    this.t += dt;
    this.st += dt;
    this.particles.update(dt);
    if (Input.consume("cancel")) { Audio.sfx("back"); this.done(); return; } // sauter tout le film
    if (Input.consume("confirm")) { Audio.sfx("confirm"); this.advance(); return; } // plan suivant
    if (this.idx < this.shots.length && this.st >= this.shots[this.idx].dur) this.advance();
  }

  draw(g: CanvasRenderingContext2D) {
    g.fillStyle = "#05040a"; g.fillRect(0, 0, VW, VH);
    const shot = this.shots[Math.min(this.idx, this.shots.length - 1)];
    const u = clamp(this.st / shot.dur, 0, 1);

    shot.draw(g, u, this.t, this);
    this.particles.draw(g);

    // fondu au noir en entrée/sortie de plan (les plans se répondent à travers le noir)
    const fade = Math.max(clamp(1 - this.st / 0.6, 0, 1), clamp((this.st - (shot.dur - 0.6)) / 0.6, 0, 1));
    if (fade > 0) { g.globalAlpha = fade; g.fillStyle = "#05040a"; g.fillRect(0, 0, VW, VH); g.globalAlpha = 1; }

    // letterbox cinéma
    g.fillStyle = "#000";
    g.fillRect(0, 0, VW, 58); g.fillRect(0, VH - 58, VW, 58);

    // sous-titre (apparition en fondu)
    if (shot.captionKey) {
      const ca = clamp((this.st - 0.4) / 0.6, 0, 1) * (1 - clamp((this.st - (shot.dur - 0.5)) / 0.5, 0, 1));
      g.globalAlpha = ca;
      textShadow(g, T(shot.captionKey), VW / 2, VH - 34, 17, shot.captionColor ?? "#e8e0f0", "center");
      g.globalAlpha = 1;
    }

    // invite discrète
    if (Math.sin(this.t * 4) > 0.2) {
      const last = this.idx >= this.shots.length - 1;
      text(g, T(last ? "cine.start" : "cine.skip"), VW - 16, VH - 20, 11, "rgba(150,145,170,.7)", "right");
    }
  }
}

export function filmFor(ending: EndingId, spared: boolean): Shot[] {
  if (ending === "dominion") return dominionFilm();
  if (ending === "redemption") return redemptionFilm(spared);
  return balanceFilm();
}

// ── PERPÉTUER : le trône, la corruption, la boucle qui recommence ──
function dominionFilm(): Shot[] {
  const throneY = 250;
  return [
    { // 1. le trône appelle ; ta silhouette s'en approche
      dur: 4.5, captionKey: "end.dom.1", captionColor: "#ff9aa4", sfx: "roar",
      draw: (g, u, t, f) => {
        const rise = clamp(u * 1.6, 0, 1);
        drawThrone(g, VW / 2, throneY - (1 - rise) * 40, 1.1, "#5a1020");
        const walk = 0.2 + u * 0.3;
        drawSpriteFigure(g, "player", VW * walk, 400, 60 - u * 6, 0.9);
        if (Math.random() < 0.5) f.particles.spawn({ x: VW / 2 + (Math.random() - 0.5) * 200, y: 360, vx: (Math.random() - 0.5) * 10, vy: -16 - Math.random() * 20, life: 3, maxLife: 3, size: 2, color: "#7a1828", glow: true });
      },
    },
    { // 2. tu t'assieds ; l'Abîme se coule en toi
      dur: 4, captionKey: "end.dom.3", captionColor: "#ffb0b8", sfx: "phase2",
      draw: (g, u) => {
        const s = 1.3 + u * 0.15;
        drawThrone(g, VW / 2, throneY, s, "#7a1828");
        drawSpriteFigure(g, "player", VW / 2, throneY - 6, 66, 1 - u * 0.25);
        drawCorruptionVeins(g, VW / 2, throneY + 30, u, 120, "#c0203a");
      },
    },
    { // 3. ta chair se fait pierre et ténèbre — la corruption engloutit
      dur: 5, captionKey: "end.dom.4", captionColor: "#ff9aa4", sfx: "warden",
      draw: (g, u, t, f) => {
        const pulse = 0.5 + Math.sin(t * 4) * 0.5;
        // dégradé qui vire au cramoisi
        const grad = g.createRadialGradient(VW / 2, throneY, 30, VW / 2, throneY, 380);
        grad.addColorStop(0, `rgba(${80 + u * 100},10,30,${0.25 + u * 0.35})`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grad; g.fillRect(0, 0, VW, VH);
        drawThrone(g, VW / 2, throneY, 1.45, "#c0203a");
        drawCorruptionVeins(g, VW / 2, throneY + 30, 1, 150, "#e0304a");
        // la silhouette du joueur se change en ombre
        drawSpriteFigure(g, "player", VW / 2, throneY - 6, 66, (1 - u) * 0.8);
        drawShadowFigure(g, VW / 2, throneY - 6, 1.1 * (0.7 + u * 0.3), "#ff2a44", u * pulse);
        if (Math.random() < 0.7) f.particles.spawn({ x: VW / 2 + (Math.random() - 0.5) * 160, y: throneY + 40, vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 30, life: 2, maxLife: 2, size: 2 + Math.random() * 2, color: Math.random() < 0.5 ? "#c0203a" : "#3a0810", glow: true });
      },
    },
    { // 4. le nouveau roi : tu es devenu son cœur
      dur: 4, captionKey: "end.dom.5", captionColor: "#e0c0ff", sfx: "roar",
      draw: (g, u, t) => {
        drawThrone(g, VW / 2, throneY, 1.5, "#c0203a");
        drawShadowFigure(g, VW / 2, throneY - 8 + Math.sin(t * 1.4) * 2, 1.35, "#ff2a44", 0.8 + Math.sin(t * 3) * 0.2);
        // couronne d'ombre
        g.save(); g.strokeStyle = "#c0203a"; g.shadowColor = "#ff2a44"; g.shadowBlur = 14; g.lineWidth = 3;
        g.beginPath();
        for (let i = -2; i <= 2; i++) { const x = VW / 2 + i * 12; g.moveTo(x - 5, throneY - 74); g.lineTo(x, throneY - 90); g.lineTo(x + 5, throneY - 74); }
        g.stroke(); g.restore();
      },
    },
    { // 5. la prochaine boucle : un descendeur vient te trouver
      dur: 5.5, captionKey: "end.dom.7", captionColor: "#ff9090", sfx: "warden",
      draw: (g, u, t, f) => {
        drawDoorOfLight(g, VW / 2, 96, 150, clamp(u * 1.4, 0, 1));
        // le nouveau champion descend depuis la lumière
        const dy = 120 + u * 150;
        if (u > 0.2) drawShadowFigure(g, VW / 2, dy, 0.5, "#8fd4ff", 0.4);
        // toi, en bas, sur le trône cramoisi
        drawThrone(g, VW / 2, 400, 0.85, "#c0203a");
        drawShadowFigure(g, VW / 2, 392, 0.8, "#ff2a44", 0.7);
        if (Math.random() < 0.3) f.particles.spawn({ x: VW / 2 + (Math.random() - 0.5) * 40, y: 110, vx: (Math.random() - 0.5) * 8, vy: 24 + Math.random() * 30, life: 3, maxLife: 3, size: 1.6, color: "#fff2c8", glow: true });
      },
    },
  ];
}

// ── BRISER : tu refuses le trône, (le Rival t'aide,) l'aube se lève ──
function redemptionFilm(spared: boolean): Shot[] {
  return [
    { // 1. le trône appelle ; tu lui tournes le dos
      dur: 4.5, captionKey: "end.red.1", captionColor: "#ffe6a8", sfx: "phase2",
      draw: (g, u) => {
        drawThrone(g, VW * 0.72, 250, 1.05, "#5a1020");
        // le joueur s'éloigne vers la gauche (vers une lueur)
        drawDoorOfLight(g, VW * 0.12, VH / 2, 220, clamp(u, 0, 1) * 0.5);
        drawSpriteFigure(g, "player", VW * (0.62 - u * 0.34), 360, 60, 1);
      },
    },
    spared
      ? { // 2a. avec le Rival : vous brisez la chaîne à deux
          dur: 5, captionKey: "end.red.spared.2", captionColor: "#ffe6a8", sfx: "seal",
          draw: (g, u, t, f) => {
            // anneau/chaîne central qui se fissure
            g.save(); g.strokeStyle = "#c8a8ff"; g.shadowColor = "#c8a8ff"; g.shadowBlur = 16 + u * 20; g.lineWidth = 6 - u * 4;
            g.globalAlpha = 1 - u * 0.5;
            g.beginPath(); g.arc(VW / 2, 260, 70 - u * 10, u * 0.6, Math.PI * 2 - u * 0.6); g.stroke();
            g.restore();
            drawSpriteFigure(g, "player", VW / 2 - 70, 360, 58, 1, "#ffd76a");
            drawSpriteFigure(g, "rival", VW / 2 + 70, 360, 58, 1, "#8a5fd0");
            if (u > 0.7 && Math.random() < 0.6) f.particles.spawn({ x: VW / 2 + (Math.random() - 0.5) * 140, y: 260, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, life: 1.5, maxLife: 1.5, size: 2, color: "#e8d0ff", glow: true });
          },
        }
      : { // 2b. seul : les échos des tombés s'apaisent
          dur: 5, captionKey: "end.red.alone.2", captionColor: "#c8a8ff", sfx: "seal",
          draw: (g, u) => {
            drawSpriteFigure(g, "player", VW / 2, 360, 60, 1, "#ffd76a");
            for (let i = 0; i < 4; i++) {
              const a = (1 - u) * 0.4 * (1 - i * 0.2);
              drawShadowFigure(g, VW / 2 + (i - 1.5) * 90, 360, 0.7, "#8fb8ff", a);
            }
          },
        },
    { // 3. l'aube : les ténèbres refluent
      dur: 4.5, captionKey: "end.red.3", captionColor: "#ffe6c0", sfx: "victory",
      draw: (g, u, t, f) => {
        const grad = g.createLinearGradient(0, 0, 0, VH);
        grad.addColorStop(0, `rgba(255,224,160,${0.15 + u * 0.4})`);
        grad.addColorStop(1, "rgba(20,16,30,0)");
        g.fillStyle = grad; g.fillRect(0, 0, VW, VH);
        drawDoorOfLight(g, VW / 2, VH / 2 - 40, 300, clamp(u * 1.3, 0, 1));
        drawSpriteFigure(g, "player", VW / 2, 380 - u * 40, 58, 1);
        if (Math.random() < 0.6) f.particles.spawn({ x: Math.random() * VW, y: VH, vx: (Math.random() - 0.5) * 10, vy: -20 - Math.random() * 24, life: 3, maxLife: 3, size: 1.8, color: "#ffe6a8", glow: true });
      },
    },
    { // 4. la Boucle brisée : silence
      dur: 4.5, captionKey: "end.red.4", captionColor: "#8fd4ff",
      draw: (g, u) => {
        const grad = g.createRadialGradient(VW / 2, VH / 2, 20, VW / 2, VH / 2, 360);
        grad.addColorStop(0, `rgba(255,240,210,${0.3 * (1 - u)})`);
        grad.addColorStop(1, "rgba(10,10,18,0)");
        g.fillStyle = grad; g.fillRect(0, 0, VW, VH);
        // un anneau qui se dissout
        g.save(); g.globalAlpha = 1 - u; g.strokeStyle = "#c8f0ff"; g.shadowColor = "#c8f0ff"; g.shadowBlur = 18; g.lineWidth = 2;
        g.beginPath(); g.arc(VW / 2, VH / 2 - 10, 60 + u * 120, 0, Math.PI * 2); g.stroke(); g.restore();
      },
    },
  ];
}

// ── ÉQUILIBRE : la Boucle plie sans rompre (ambigu) ──
function balanceFilm(): Shot[] {
  return [
    {
      dur: 4.5, captionKey: "finalrev.1", captionColor: "#c8a8ff", sfx: "phase2",
      draw: (g, u, t) => {
        drawSpriteFigure(g, "rival_blade", VW / 2, 250, 120, 1, "#c8a0ff");
        g.save(); g.globalAlpha = 0.5; g.strokeStyle = "#8a5fd0"; g.lineWidth = 2;
        g.beginPath(); g.arc(VW / 2, 250, 90, t * 0.4, t * 0.4 + Math.PI * 1.6); g.stroke(); g.restore();
      },
    },
    {
      dur: 4.5, captionKey: "finalrev.4", captionColor: "#ff9090", sfx: "seal",
      draw: (g, u) => {
        // à un seuil : moitié sombre, moitié claire
        g.fillStyle = "rgba(255,232,180,.12)"; g.fillRect(0, 0, VW / 2, VH);
        drawSpriteFigure(g, "player", VW / 2, 340, 60, 1);
      },
    },
    {
      dur: 5, captionKey: "finalrev.6", captionColor: "#e0d0ff", sfx: "victory",
      draw: (g, u, t) => {
        // un anneau qui se fissure puis se referme : ni brisé, ni scellé
        const crack = Math.sin(u * Math.PI); // 0→1→0
        g.save(); g.strokeStyle = "#c8a8ff"; g.shadowColor = "#c8a8ff"; g.shadowBlur = 16; g.lineWidth = 4;
        g.beginPath(); g.arc(VW / 2, VH / 2 - 10, 80, crack * 0.5, Math.PI * 2 - crack * 0.5); g.stroke(); g.restore();
      },
    },
  ];
}

// ===== Films de moments-clés (prologue, Épée de Légende) — même langage que les fins =====
// Interface parallèle pour ne pas toucher au Shot des fins (typé sur EndingFilmScene).
interface FilmShot {
  dur: number; captionKey?: string; captionColor?: string; sfx?: string;
  draw: (g: CanvasRenderingContext2D, u: number, t: number, f: FilmScene) => void;
}

// Glyphe de sceau : anneau runique qui pulse.
function drawSeal(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, glow: string, pulse: number) {
  g.save();
  g.strokeStyle = glow; g.shadowColor = glow; g.shadowBlur = 10 + pulse * 18;
  g.globalAlpha = 0.5 + pulse * 0.5; g.lineWidth = 2.5;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(cx, cy, r * 0.6, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + pulse * 0.3;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6);
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    g.stroke();
  }
  g.restore();
}

// Socle de pierre.
function drawPedestal(g: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  g.save();
  g.fillStyle = "#2a2436";
  g.fillRect(cx - 34 * s, cy, 68 * s, 20 * s);
  g.fillStyle = "#221c30";
  g.fillRect(cx - 26 * s, cy + 20 * s, 52 * s, 40 * s);
  g.fillStyle = "#332a44";
  g.fillRect(cx - 40 * s, cy - 6 * s, 80 * s, 8 * s);
  g.restore();
}

// Grande arche / porte scellée, lueur rouge respirante.
function drawGreatDoor(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, pulse: number) {
  g.save();
  g.fillStyle = "#0d0912";
  g.beginPath();
  g.moveTo(cx - 70 * s, cy + 130 * s);
  g.lineTo(cx - 70 * s, cy - 40 * s);
  g.arc(cx, cy - 40 * s, 70 * s, Math.PI, 0);
  g.lineTo(cx + 70 * s, cy + 130 * s);
  g.closePath(); g.fill();
  g.strokeStyle = "#3a2545"; g.lineWidth = 4; g.stroke();
  // fente centrale + lueur rouge
  const gl = g.createRadialGradient(cx, cy + 30 * s, 4, cx, cy + 30 * s, 90 * s);
  gl.addColorStop(0, `rgba(200,40,40,${0.3 + pulse * 0.35})`);
  gl.addColorStop(1, "rgba(200,40,40,0)");
  g.fillStyle = gl; g.fillRect(cx - 90 * s, cy - 60 * s, 180 * s, 210 * s);
  g.restore();
}

// ---- Prologue : la descente, les sceaux, la porte ----
function introFilm(): FilmShot[] {
  return [
    { // 1. la gueule du temple s'ouvre ; tu descends
      dur: 4.5, captionKey: "film.intro.1", captionColor: "#c8bcd8", sfx: "night",
      draw: (g, u, t, f) => {
        drawGreatDoor(g, VW / 2, 250, 1.5, 0.2 + Math.sin(t * 1.2) * 0.15);
        drawSpriteFigure(g, "player", VW / 2, 380 + u * 40, 54 - u * 10, 0.9 - u * 0.3);
        if (Math.random() < 0.4) f.particles.spawn({ x: Math.random() * VW, y: VH, vx: (Math.random() - 0.5) * 8, vy: -14 - Math.random() * 22, life: 4, maxLife: 4, size: 2, color: "#6a3020", glow: true });
      },
    },
    { // 2. trois sceaux dorment sous la pierre
      dur: 4.5, captionKey: "film.intro.2", captionColor: "#8fd4ff", sfx: "seal",
      draw: (g, u, t) => {
        const p = (i: number) => 0.3 + Math.sin(t * 1.6 + i * 2) * 0.3 + u * 0.2;
        drawSeal(g, VW / 2 - 200, VH / 2, 42, "#5adfe8", p(0));
        drawSeal(g, VW / 2, VH / 2 - 20, 50, "#7a9fe8", p(1));
        drawSeal(g, VW / 2 + 200, VH / 2, 42, "#8a5fd0", p(2));
      },
    },
    { // 3. la dernière porte — et ce qui attend derrière
      dur: 5, captionKey: "film.intro.3", captionColor: "#d86060", sfx: "door",
      draw: (g, u, t) => {
        const pulse = 0.4 + Math.sin(t * 2) * 0.3 + u * 0.3;
        drawGreatDoor(g, VW / 2, 240, 1.8, pulse);
        drawSpriteFigure(g, "player", VW / 2, 420, 46, 0.85);
        if (u > 0.5) drawShadowFigure(g, VW / 2, 220, 0.4 + u * 0.2, "#ff3040", (u - 0.5) * pulse);
      },
    },
  ];
}

// ---- L'Épée de Légende : le socle, l'éveil, le temple qui se referme ----
function swordFilm(): FilmShot[] {
  return [
    { // 1. la lame attend sur son socle
      dur: 4, captionKey: "film.sword.1", captionColor: "#c8bca8", sfx: "sword",
      draw: (g, u, t) => {
        drawPedestal(g, VW / 2, 300, 1.2);
        const spr = getSprite("it_legend");
        if (spr) {
          g.save(); g.imageSmoothingEnabled = false;
          g.shadowColor = "#ffd84a"; g.shadowBlur = 10 + Math.sin(t * 2) * 6;
          const bob = Math.sin(t * 2) * 5;
          g.drawImage(spr, VW / 2 - 44, 190 + bob, 88, 88);
          g.restore();
        }
      },
    },
    { // 2. tu la saisis — la lame s'embrase
      dur: 4, captionKey: "film.sword.2", captionColor: "#fff", sfx: "sword",
      draw: (g, u, t, f) => {
        // rayons de lumière dorée
        g.save();
        const rays = g.createRadialGradient(VW / 2, 240, 8, VW / 2, 240, 60 + u * 320);
        rays.addColorStop(0, `rgba(255,232,150,${0.5 + u * 0.4})`);
        rays.addColorStop(1, "rgba(255,216,74,0)");
        g.fillStyle = rays; g.fillRect(0, 0, VW, VH);
        g.restore();
        drawPedestal(g, VW / 2, 300, 1.2);
        const spr = getSprite("it_legend");
        if (spr) {
          g.save(); g.imageSmoothingEnabled = false;
          g.shadowColor = "#fff6c8"; g.shadowBlur = 20 + u * 40;
          const sz = 88 + u * 26;
          g.drawImage(spr, VW / 2 - sz / 2, 234 - sz / 2 - u * 20, sz, sz);
          g.restore();
        }
        if (Math.random() < 0.8) f.particles.spawn({ x: VW / 2 + (Math.random() - 0.5) * 120, y: 240, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 40, life: 1.2, maxLife: 1.2, size: 2 + Math.random() * 2, color: Math.random() < 0.6 ? "#ffd84a" : "#fff6c8", glow: true });
      },
    },
    { // 3. le temple gronde, les portes claquent, le Gardien se dresse
      dur: 5, captionKey: "film.sword.3", captionColor: "#c8a8ff", sfx: "warden",
      draw: (g, u, t, f) => {
        const shake = clamp(1 - u * 1.5, 0, 1);
        g.save();
        g.translate((Math.random() - 0.5) * shake * 16, (Math.random() - 0.5) * shake * 16);
        // vignette de danger
        const v = g.createRadialGradient(VW / 2, VH / 2, VH * 0.2, VW / 2, VH / 2, VH * 0.9);
        v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, `rgba(90,10,40,${0.4 + u * 0.4})`);
        g.fillStyle = v; g.fillRect(-20, -20, VW + 40, VH + 40);
        // le Gardien se dresse depuis le bas
        const wy = VH + 120 - u * 340;
        drawSpriteFigure(g, "warden", VW / 2, wy, 150, 1, "#8a5fd0");
        drawShadowFigure(g, VW / 2, wy - 4, 1.2, "#c8a8ff", 0.4 + u * 0.5);
        g.restore();
        if (Math.random() < 0.6) f.particles.spawn({ x: VW / 2 + (Math.random() - 0.5) * 200, y: VH * 0.6, vx: (Math.random() - 0.5) * 24, vy: -18 - Math.random() * 30, life: 1.6, maxLife: 1.6, size: 2, color: Math.random() < 0.5 ? "#8a5fd0" : "#2c1d52", glow: true });
      },
    },
  ];
}

// ---- La Descente : derrière le trône fissuré, le gouffre vers l'Abîme et le Dévoreur ----
function depthsFilm(): FilmShot[] {
  // puits de veines qui défile (impression de chute)
  const shaft = (g: CanvasRenderingContext2D, t: number, glow: number) => {
    for (let i = 0; i < 5; i++) {
      const yy = ((t * 140 + i * 150) % (VH + 150)) - 75;
      drawCorruptionVeins(g, 40, yy, glow, 90, "#7a1020");
      drawCorruptionVeins(g, VW - 40, yy, glow, 90, "#7a1020");
    }
  };
  return [
    { // 1. le trône se fissure ; la lumière rouge sourd de dessous
      dur: 4.5, captionKey: "film.depths.1", captionColor: "#ff9aa4", sfx: "warden",
      draw: (g, u, t, f) => {
        const pulse = 0.4 + Math.sin(t * 2) * 0.3 + u * 0.3;
        const gl = g.createRadialGradient(VW / 2, 300, 10, VW / 2, 300, 260);
        gl.addColorStop(0, `rgba(160,20,40,${0.2 + u * 0.3})`); gl.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gl; g.fillRect(0, 0, VW, VH);
        drawThrone(g, VW / 2, 300, 1.25, "#7a1020");
        // fissures rouges qui s'ouvrent
        g.save(); g.strokeStyle = "#ff2a44"; g.shadowColor = "#ff2a44"; g.shadowBlur = 12; g.lineWidth = 2;
        for (let i = -2; i <= 2; i++) {
          g.beginPath(); g.moveTo(VW / 2 + i * 14, 300);
          g.lineTo(VW / 2 + i * 22 + Math.sin(i + t) * 6, 300 + 70 * (0.4 + u));
          g.stroke();
        }
        g.restore();
        drawCorruptionVeins(g, VW / 2, 330, u, 120, "#c0203a");
        if (Math.random() < 0.5) f.particles.spawn({ x: VW / 2 + (Math.random() - 0.5) * 180, y: 330, vx: (Math.random() - 0.5) * 14, vy: -18 - Math.random() * 26, life: 3, maxLife: 3, size: 2, color: Math.random() < 0.5 ? "#c0203a" : "#3a0810", glow: true });
      },
    },
    { // 2. le trône se soulève ; derrière lui, un passage béant vers le vide
      dur: 4, captionKey: "film.depths.2", captionColor: "#ffb0b8", sfx: "door",
      draw: (g, u, t, f) => {
        const rise = clamp(u * 1.4, 0, 1);
        drawGreatDoor(g, VW / 2, 250, 1.7, 0.5 + Math.sin(t * 2.4) * 0.3 + u * 0.2);
        // le trône glisse vers le haut en révélant la gueule
        drawThrone(g, VW / 2, 300 - rise * 220, 1.25 - rise * 0.4, "#7a1020");
        // toi, au bord du gouffre
        drawSpriteFigure(g, "player", VW / 2, 430, 46, 0.9 - u * 0.3);
        if (Math.random() < 0.4) f.particles.spawn({ x: VW / 2 + (Math.random() - 0.5) * 120, y: 300, vx: (Math.random() - 0.5) * 10, vy: -14 - Math.random() * 20, life: 3, maxLife: 3, size: 1.8, color: "#c0203a", glow: true });
      },
    },
    { // 3. la chute : le trône rétrécit au-dessus, tu t'enfonces dans le rouge
      dur: 5, captionKey: "film.depths.3", captionColor: "#ff9aa4", sfx: "roar",
      draw: (g, u, t, f) => {
        shaft(g, t * 1.4 + u * 4, 0.7 + Math.sin(t * 3) * 0.2);
        // point de lumière (le trône) qui s'éloigne vers le haut
        drawThrone(g, VW / 2, 70 - u * 40, 0.35 - u * 0.15, "#7a1020");
        // toi qui coules vers le bas-centre
        drawSpriteFigure(g, "player", VW / 2, 220 + u * 120, 44, 1);
        // cendres qui remontent (impression de vitesse)
        for (let i = 0; i < 2; i++) f.particles.spawn({ x: Math.random() * VW, y: VH, vx: (Math.random() - 0.5) * 12, vy: -80 - Math.random() * 80, life: 1.4, maxLife: 1.4, size: 1.6 + Math.random(), color: Math.random() < 0.5 ? "#c0203a" : "#5a1020", glow: true });
      },
    },
    { // 4. l'Abîme s'ouvre : une salle immense, un sol lointain, la pression du vide
      dur: 4, captionKey: "film.depths.4", captionColor: "#c8a8ff", sfx: "phase2",
      draw: (g, u, t) => {
        const v = g.createRadialGradient(VW / 2, VH * 0.7, 20, VW / 2, VH * 0.7, VH);
        v.addColorStop(0, `rgba(120,16,32,${0.16 + u * 0.14})`); v.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = v; g.fillRect(0, 0, VW, VH);
        // sol lointain
        g.save(); g.strokeStyle = `rgba(140,40,60,${0.3 + u * 0.3})`; g.lineWidth = 2;
        g.beginPath(); g.moveTo(VW / 2 - 260 * u, 430); g.lineTo(VW / 2 + 260 * u, 430); g.stroke(); g.restore();
        drawSpriteFigure(g, "player", VW / 2, 410, 40, 0.9);
        // lueur rouge à l'horizon
        const h = g.createLinearGradient(0, VH, 0, VH - 180);
        h.addColorStop(0, `rgba(160,20,40,${0.25 + u * 0.2})`); h.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = h; g.fillRect(0, VH - 180, VW, 180);
      },
    },
    { // 5. le Dévoreur veille : deux braises s'allument dans les ténèbres
      dur: 5.5, captionKey: "film.depths.5", captionColor: "#ff8a94", sfx: "roar",
      draw: (g, u, t, f) => {
        const pulse = 0.5 + Math.sin(t * 3) * 0.5;
        const grad = g.createRadialGradient(VW / 2, 250, 20, VW / 2, 250, 420);
        grad.addColorStop(0, `rgba(${60 + u * 90},10,26,${0.2 + u * 0.35})`); grad.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grad; g.fillRect(0, 0, VW, VH);
        drawCorruptionVeins(g, VW / 2, 320, 1, 160 * u, "#c0203a");
        // la silhouette colossale émerge du noir
        drawShadowFigure(g, VW / 2, 250, 1.6 * (0.6 + u * 0.4), "#ff2a44", u * pulse);
        // toi, minuscule, en bas
        drawSpriteFigure(g, "player", VW / 2, 460, 34, 0.8);
        if (Math.random() < 0.6) f.particles.spawn({ x: VW / 2 + (Math.random() - 0.5) * 220, y: 340, vx: (Math.random() - 0.5) * 18, vy: -16 - Math.random() * 28, life: 2, maxLife: 2, size: 2, color: Math.random() < 0.5 ? "#c0203a" : "#3a0810", glow: true });
      },
    },
  ];
}

// ---- LE RÉVEIL : face au Dévoreur d'Âmes, juste avant le dernier combat ----
// Plan 4 conditionnel : le Rival épargné surgit à tes côtés, sinon ton écho corrompu.
function devourerFilm(spared: boolean): FilmShot[] {
  const shots: FilmShot[] = [
    { // 1. le noir total ; deux braises s'allument très haut — il était là depuis le début
      dur: 4, captionKey: "film.dev.1", captionColor: "#ff8a94", sfx: "night",
      draw: (g, u, t) => {
        drawSpriteFigure(g, "player", VW / 2, 470, 34, 0.85);
        const glow = clamp((u - 0.35) * 2, 0, 1) * (0.7 + Math.sin(t * 3) * 0.3);
        if (glow > 0) {
          g.save(); g.fillStyle = "#ff2a44"; g.shadowColor = "#ff2a44"; g.shadowBlur = 26 * glow;
          g.globalAlpha = glow;
          g.beginPath(); g.ellipse(VW / 2 - 34, 120, 11, 15, 0, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.ellipse(VW / 2 + 34, 120, 11, 15, 0, 0, Math.PI * 2); g.fill();
          g.restore();
        }
      },
    },
    { // 2. il aspire la lumière : tout implose vers lui, les veines irradient
      dur: 4.5, captionKey: "film.dev.2", captionColor: "#ffb0b8", sfx: "charge",
      draw: (g, u, t, f) => {
        drawCorruptionVeins(g, VW / 2, 320, u, 200, "#c0203a");
        drawShadowFigure(g, VW / 2, 240, 1.2 * (0.5 + u * 0.5), "#ff2a44", u * 0.7);
        drawSpriteFigure(g, "player", VW / 2, 470, 34, 0.8);
        // implosion : les particules naissent au bord et foncent vers sa masse
        for (let i = 0; i < 3; i++) {
          const ang = Math.random() * Math.PI * 2, d = 280 + Math.random() * 200;
          const px = VW / 2 + Math.cos(ang) * d, py = 240 + Math.sin(ang) * d * 0.6;
          f.particles.spawn({ x: px, y: py, vx: (VW / 2 - px) * 0.9, vy: (240 - py) * 0.9, life: 1.1, maxLife: 1.1, size: 1.8 + Math.random() * 1.4, color: Math.random() < 0.5 ? "#c0203a" : "#8a8098", glow: true });
        }
        const vg = g.createRadialGradient(VW / 2, 240, 60, VW / 2, 240, 480);
        vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,0,${0.3 + u * 0.4})`);
        g.fillStyle = vg; g.fillRect(0, 0, VW, VH);
      },
    },
    { // 3. les âmes dévorées : des silhouettes spectrales tournoient vers sa gueule
      dur: 4.5, captionKey: "bossenc.devourer.2", captionColor: "#8fd4ff", sfx: "phase2",
      draw: (g, u, t, f) => {
        drawShadowFigure(g, VW / 2, 240, 1.3, "#ff2a44", 0.6 + Math.sin(t * 3) * 0.2);
        drawCorruptionVeins(g, VW / 2, 320, 1, 200, "#7a1020");
        // âmes en orbite qui spiralent vers le centre
        for (let i = 0; i < 5; i++) {
          const a = t * (0.6 + i * 0.13) + i * 1.4;
          const r = (170 - i * 22) * (1 - u * 0.45);
          drawShadowFigure(g, VW / 2 + Math.cos(a) * r, 250 + Math.sin(a) * r * 0.45, 0.28, "#8fd4ff", 0.35);
        }
        if (Math.random() < 0.7) f.particles.spawn({ x: VW / 2 + (Math.random() - 0.5) * 320, y: 250 + (Math.random() - 0.5) * 140, vx: (Math.random() - 0.5) * 20, vy: -14 - Math.random() * 18, life: 1.4, maxLife: 1.4, size: 1.8, color: "#8fd4ff", glow: true });
      },
    },
  ];
  if (spared) {
    shots.push({ // 4a. le Rival épargné surgit à tes côtés, lame levée — vous serez deux
      dur: 4.5, captionKey: "film.dev.ally", captionColor: "#c8a8ff", sfx: "sword",
      draw: (g, u) => {
        drawShadowFigure(g, VW / 2, 230, 1.35, "#ff2a44", 0.7);
        drawSpriteFigure(g, "player", VW / 2 - 60, 452, 44, 1);
        const rin = clamp(u * 1.8, 0, 1); // il entre par la droite
        drawSpriteFigure(g, "rival", VW / 2 + 60 + (1 - rin) * 260, 452, 44, rin, "#8a5fd0");
      },
    });
  } else {
    shots.push({ // 4b. dans sa masse : ton propre écho corrompu — ce que tu risques de devenir
      dur: 4.5, captionKey: "film.dev.echo", captionColor: "#ff9aa4", sfx: "warden",
      draw: (g, u, t) => {
        drawShadowFigure(g, VW / 2, 240, 1.4, "#ff2a44", 0.7);
        const pulse = 0.4 + Math.sin(t * 2.4) * 0.25;
        drawSpriteFigure(g, "player", VW / 2, 232, 52, clamp(u * 1.6, 0, 1) * 0.5, "#ff2a44");
        drawShadowFigure(g, VW / 2, 232, 0.5, "#ff2a44", pulse * u);
        drawSpriteFigure(g, "player", VW / 2, 470, 34, 0.85);
      },
    });
  }
  shots.push({ // 5. les yeux plein cadre — le noir avale tout
    dur: 3.6, captionKey: "film.dev.5", captionColor: "#ff2a44", sfx: "roar",
    draw: (g, u) => {
      const sh = (1 - u) * 8;
      g.save(); g.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
      const sc = 1 + u * 5; // les yeux foncent sur toi
      g.fillStyle = "#ff2a44"; g.shadowColor = "#ff2a44"; g.shadowBlur = 40;
      g.beginPath(); g.ellipse(VW / 2 - 40 * sc, VH / 2 - 20, 13 * sc, 18 * sc, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(VW / 2 + 40 * sc, VH / 2 - 20, 13 * sc, 18 * sc, 0, 0, Math.PI * 2); g.fill();
      g.restore();
      g.fillStyle = `rgba(0,0,0,${clamp((u - 0.55) * 2.3, 0, 1)})`; g.fillRect(0, 0, VW, VH);
    },
  });
  return shots;
}

export function devourerFilmShots(spared: boolean): FilmShot[] { return devourerFilm(spared); }

// ===== La scène de film générique (identique au moteur des fins, pour tout moment) =====
export class FilmScene implements Scene {
  private idx = 0; private st = 0; private t = 0;
  particles = new Particles();
  constructor(private shots: FilmShot[], private done: () => void) {}
  enter() { const s = this.shots[0]; if (s?.sfx) Audio.sfx(s.sfx); }
  private advance() {
    this.idx++; this.st = 0;
    if (this.idx >= this.shots.length) { this.done(); return; }
    const s = this.shots[this.idx]; if (s.sfx) Audio.sfx(s.sfx);
  }
  update(dt: number) {
    this.t += dt; this.st += dt; this.particles.update(dt);
    if (Input.consume("cancel")) { Audio.sfx("back"); this.done(); return; }
    if (Input.consume("confirm")) { Audio.sfx("confirm"); this.advance(); return; }
    if (this.idx < this.shots.length && this.st >= this.shots[this.idx].dur) this.advance();
  }
  draw(g: CanvasRenderingContext2D) {
    g.fillStyle = "#05040a"; g.fillRect(0, 0, VW, VH);
    const shot = this.shots[Math.min(this.idx, this.shots.length - 1)];
    const u = clamp(this.st / shot.dur, 0, 1);
    shot.draw(g, u, this.t, this);
    this.particles.draw(g);
    const fade = Math.max(clamp(1 - this.st / 0.6, 0, 1), clamp((this.st - (shot.dur - 0.6)) / 0.6, 0, 1));
    if (fade > 0) { g.globalAlpha = fade; g.fillStyle = "#05040a"; g.fillRect(0, 0, VW, VH); g.globalAlpha = 1; }
    g.fillStyle = "#000"; g.fillRect(0, 0, VW, 58); g.fillRect(0, VH - 58, VW, 58);
    if (shot.captionKey) {
      const ca = clamp((this.st - 0.4) / 0.6, 0, 1) * (1 - clamp((this.st - (shot.dur - 0.5)) / 0.5, 0, 1));
      g.globalAlpha = ca;
      textShadow(g, T(shot.captionKey), VW / 2, VH - 34, 17, shot.captionColor ?? "#e8e0f0", "center");
      g.globalAlpha = 1;
    }
    if (Math.sin(this.t * 4) > 0.2) {
      const last = this.idx >= this.shots.length - 1;
      text(g, T(last ? "cine.start" : "cine.skip"), VW - 16, VH - 20, 11, "rgba(150,145,170,.7)", "right");
    }
  }
}

export function introFilmShots(): FilmShot[] { return introFilm(); }
export function swordFilmShots(): FilmShot[] { return swordFilm(); }
export function depthsFilmShots(): FilmShot[] { return depthsFilm(); }
export function endlessFilmShots(): FilmShot[] { return endlessIntroFilm(); }

// ---- Descente Infinie : le plongeon sans fond ----
// Traînées verticales qui filent vers le HAUT = sensation de chute.
function fallStreaks(g: CanvasRenderingContext2D, t: number, speed: number, color: string) {
  g.save();
  g.strokeStyle = color; g.lineWidth = 2; g.globalAlpha = 0.5;
  for (let i = 0; i < 26; i++) {
    const x = (i * 137.5) % VW;
    const len = 40 + (i % 5) * 30;
    const y = (VH * 2 - (t * speed + i * 90)) % (VH + 200) - 100;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - len); g.stroke();
  }
  g.restore();
}

// Puits abyssal : ellipses concentriques qui s'enfoncent vers un point noir.
function drawPit(g: CanvasRenderingContext2D, cx: number, cy: number, rings: number, t: number, tint: string) {
  for (let i = rings; i >= 1; i--) {
    const rr = i / rings;
    const rx = 240 * rr, ry = 70 * rr;
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    const shade = Math.round(14 * rr);
    g.fillStyle = i === 1 ? "#000" : `rgb(${shade},${Math.round(shade*0.8)},${shade+6})`;
    g.fill();
  }
  g.save(); g.globalAlpha = 0.25; g.strokeStyle = tint;
  g.beginPath(); g.ellipse(cx, cy, 240, 70, 0, 0, Math.PI * 2); g.stroke(); g.restore();
}

// Tunnel de strates : anneaux qui défilent vers le fond (perspective de chute).
function drawStrataTunnel(g: CanvasRenderingContext2D, cx: number, cy: number, t: number) {
  const cols = ["#6a8fd0", "#4fb0a0", "#8a5fd0", "#b04f8a", "#c0403a", "#d8b038"];
  g.save();
  for (let i = 0; i < 9; i++) {
    const p = ((t * 0.35 + i / 9) % 1); // 0 (loin) → 1 (près)
    const r = 20 + p * p * 360;
    const col = cols[(i + Math.floor(t * 0.35)) % cols.length];
    g.globalAlpha = 0.15 + p * 0.5;
    g.strokeStyle = col; g.lineWidth = 1 + p * 3; g.shadowColor = col; g.shadowBlur = 8 * p;
    g.beginPath(); g.ellipse(cx, cy, r * 1.4, r, 0, 0, Math.PI * 2); g.stroke();
  }
  g.restore();
}

// Grand œil de l'Abîme qui s'entrouvre (open ∈ [0,1]).
function drawAbyssEye(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, open: number, t: number) {
  g.save();
  const h = 8 + open * 70 * s;
  g.fillStyle = "#050208";
  g.beginPath(); g.ellipse(cx, cy, 150 * s, h, 0, 0, Math.PI * 2); g.fill();
  // iris
  g.globalAlpha = open;
  g.shadowColor = "#ff2a44"; g.shadowBlur = 30 * open;
  g.fillStyle = "#c0203a";
  g.beginPath(); g.arc(cx, cy, Math.min(h * 0.8, 34 * s), 0, Math.PI * 2); g.fill();
  g.fillStyle = "#ffcf4a";
  g.beginPath(); g.arc(cx, cy, Math.min(h * 0.4, 12 * s) * (0.9 + Math.sin(t * 4) * 0.1), 0, Math.PI * 2); g.fill();
  g.restore();
}

function endlessIntroFilm(): FilmShot[] {
  return [
    { // 1. au bord du puits sans fond
      dur: 4.5, captionKey: "film.endless.1", captionColor: "#c8bcd8", sfx: "door",
      draw: (g, u, t, f) => {
        drawPit(g, VW / 2, 300, 8, t, "#8a5fd0");
        drawSpriteFigure(g, "player", VW / 2, 210 + Math.sin(t * 2) * 3, 52, 0.95);
        if (Math.random() < 0.5) f.particles.spawn({ x: VW / 2 + (Math.random() - 0.5) * 400, y: 320, vx: (Math.random() - 0.5) * 8, vy: -14 - Math.random() * 20, life: 4, maxLife: 4, size: 1.6, color: "#5a3a7a", glow: true });
      },
    },
    { // 2. le saut
      dur: 3.5, captionKey: "film.endless.2", captionColor: "#e8e0f0", sfx: "warden",
      draw: (g, u, t) => {
        fallStreaks(g, t, 520, "#3a2a55");
        // le héros bascule dans le vide, rapetissant
        drawSpriteFigure(g, "player", VW / 2, 180 + u * 160, 60 - u * 18, 1);
        for (let i = 0; i < 3; i++) drawSeal(g, VW / 2 + (i - 1) * 220, (t * 180 + i * 200) % (VH + 100) - 50, 30, "#5adfe8", 0.4);
      },
    },
    { // 3. la lumière se réduit à un point, tout là-haut
      dur: 4.5, captionKey: "film.endless.3", captionColor: "#8fd4ff", sfx: "night",
      draw: (g, u, t, f) => {
        fallStreaks(g, t, 700, "#2a2040");
        // halo de lumière au sommet qui rétrécit
        const lr = 220 * (1 - u) + 12;
        const lg = g.createRadialGradient(VW / 2, -40, 4, VW / 2, -40, lr);
        lg.addColorStop(0, "rgba(255,246,216,.5)"); lg.addColorStop(1, "rgba(255,246,216,0)");
        g.fillStyle = lg; g.fillRect(0, 0, VW, 260);
        drawShadowFigure(g, VW / 2, 300, 0.6, "#8fd4ff", 0.3);
        // yeux tapis sur les côtés
        for (let i = 0; i < 5; i++) {
          const ex = 60 + i * 210 + Math.sin(t + i) * 8, ey = 130 + (i % 2) * 260;
          if ((i + Math.floor(t)) % 2) { g.fillStyle = "#ff5060"; g.save(); g.shadowColor = "#ff2a44"; g.shadowBlur = 10; g.beginPath(); g.arc(ex, ey, 3, 0, Math.PI * 2); g.arc(ex + 10, ey, 3, 0, Math.PI * 2); g.fill(); g.restore(); }
        }
      },
    },
    { // 4. les profondeurs sans fin — le tunnel de strates
      dur: 5, captionKey: "film.endless.4", captionColor: "#c8a0ff", sfx: "seal",
      draw: (g, u, t) => {
        drawStrataTunnel(g, VW / 2, VH / 2, t);
        drawShadowFigure(g, VW / 2, VH / 2 + 4, 0.42 + Math.sin(t * 3) * 0.02, "#c8a0ff", 0.4);
      },
    },
    { // 5. l'Abîme se souvient — descends
      dur: 5, captionKey: "film.endless.5", captionColor: "#ff9aa4", sfx: "roar",
      draw: (g, u, t, f) => {
        drawAbyssEye(g, VW / 2, VH / 2 - 10, 1.1, clamp(u * 1.3, 0, 1), t);
        if (u > 0.55) textShadow(g, T("hud.depth", { n: 1 }).toUpperCase(), VW / 2, VH / 2 + 120, 20 + (u - 0.55) * 20, "#ffcf4a", "center");
        if (Math.random() < 0.4) f.particles.spawn({ x: VW / 2 + (Math.random() - 0.5) * 300, y: VH / 2 + 80, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30, life: 2, maxLife: 2, size: 2, color: Math.random() < 0.5 ? "#c0203a" : "#3a0810", glow: true });
      },
    },
  ];
}

// ===== Écran de fin =====
// Thème visuel par fin : dégradé de fond, halo/lueur du titre, teinte du titre, confettis.
interface EndTheme { titleKey: string; l1: string; l2: string; g0: string; g1: string; glow: string; ink: string; conf: string[]; }
const END_THEMES: Record<EndingId, EndTheme> = {
  redemption: {
    titleKey: "end.redemption", l1: "end.red.e1", l2: "end.red.e2",
    g0: "#141024", g1: "#3a2a14", glow: "#ffd76a", ink: "#ffe6b0",
    conf: ["#ffd84a", "#ffe6a8", "#8fd4ff", "#fff0c0"],
  },
  balance: {
    titleKey: "end.trueending", l1: "end.tv1", l2: "end.tv2",
    g0: "#160a24", g1: "#241030", glow: "#c060ff", ink: "#e8c8ff",
    conf: ["#c8a0ff", "#8fd4ff", "#e88ae8", "#c8f0ff"],
  },
  dominion: {
    titleKey: "end.dominion", l1: "end.dom.e1", l2: "end.dom.e2",
    g0: "#1a0308", g1: "#2a060c", glow: "#ff2a44", ink: "#ff9aa4",
    conf: ["#c0203a", "#ff5060", "#7a1020", "#e0c0ff"],
  },
};

export class EndScene implements Scene {
  private victory: boolean;
  private ending?: EndingId;
  private theme?: EndTheme;
  private t = 0;
  private particles = new Particles();
  private done: () => void;

  constructor(victory: boolean, done: () => void, ending?: EndingId) {
    this.victory = victory;
    this.ending = ending;
    this.theme = ending ? END_THEMES[ending] : undefined;
    this.done = done;
  }

  enter() {
    Audio.setMode("none");
    // La domination ne « sonne » pas comme un triomphe : c'est une prise de pouvoir sourde.
    Audio.sfx(this.ending === "dominion" ? "roar" : this.victory ? "victory" : "defeat");
  }

  update(dt: number) {
    this.t += dt;
    if (this.victory && Math.random() < dt * 30) {
      const pal = this.theme?.conf ?? ["#ffd84a", "#7ae87a", "#8fd4ff", "#e88ae8"];
      this.particles.spawn({
        x: Math.random() * VW, y: -5,
        vx: (Math.random() - 0.5) * 30, vy: 30 + Math.random() * 50,
        life: 4, maxLife: 4, size: 2.5,
        color: pal[Math.floor(Math.random() * pal.length)], glow: true,
      });
    }
    this.particles.update(dt);
    if (this.t > 1.2 && Input.consume("confirm")) { Audio.sfx("confirm"); this.done(); }
  }

  draw(g: CanvasRenderingContext2D) {
    const th = this.theme;
    const grad = g.createLinearGradient(0, 0, 0, VH);
    if (th) { grad.addColorStop(0, th.g0); grad.addColorStop(1, th.g1); }
    else if (this.victory) { grad.addColorStop(0, "#0a1420"); grad.addColorStop(1, "#1c2410"); }
    else { grad.addColorStop(0, "#180810"); grad.addColorStop(1, "#050308"); }
    g.fillStyle = grad;
    g.fillRect(0, 0, VW, VH);
    this.particles.draw(g);

    const a = clamp(this.t / 1.2, 0, 1);
    g.globalAlpha = a;
    g.save();
    g.shadowColor = th ? th.glow : this.victory ? "#ffd84a" : "#c02828";
    g.shadowBlur = 30;
    g.font = `bold 58px ${FONT}`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = th ? th.ink : this.victory ? "#f8e8b8" : "#d84848";
    g.fillText(T(th ? th.titleKey : this.victory ? "end.victory" : "end.defeat"), VW / 2, 150);
    g.restore();

    text(g, T(th ? th.l1 : this.victory ? "end.v1" : "end.d1"), VW / 2, 240, 17, "#c8c0d4", "center");
    text(g, T(th ? th.l2 : this.victory ? "end.v2" : "end.d2"), VW / 2, 274, 17, "#c8c0d4", "center");

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
