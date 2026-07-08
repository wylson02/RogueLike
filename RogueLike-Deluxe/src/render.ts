// ===== Rendu : tiles, éclairage dynamique, particules, HUD =====
import { Tile, Pos, P, key, lerp, clamp } from "./core";
import { GameContext, LogKind } from "./context";
import { Monster, MonsterRank, Chest, ChestType } from "./entities";
import { boonById, ELEMENT_COLOR, hasResonance, elementStacks, Element } from "./boons";
import { getSprite } from "./sprites";
import { T } from "./i18n";

export const VW = 960, VH = 540;
export const TS = 40; // taille d'une tuile à l'écran

export const FONT = "'Courier New',monospace";
export function text(g: CanvasRenderingContext2D, s: string, x: number, y: number,
  size: number, color: string, align: CanvasTextAlign = "left", bold = true) {
  g.font = `${bold ? "bold " : ""}${size}px ${FONT}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = "middle";
  g.fillText(s, x, y);
}

export function textShadow(g: CanvasRenderingContext2D, s: string, x: number, y: number,
  size: number, color: string, align: CanvasTextAlign = "left") {
  g.font = `bold ${size}px ${FONT}`;
  g.textAlign = align; g.textBaseline = "middle";
  g.fillStyle = "rgba(0,0,0,.8)";
  g.fillText(s, x + 2, y + 2);
  g.fillStyle = color;
  g.fillText(s, x, y);
}

// Découpe un texte aux espaces pour tenir dans maxW (mesure au pixel), plafonné à maxLines.
// La dernière ligne est tronquée avec … seulement si le texte déborde encore. Police déjà réglée.
export function wrapLine(g: CanvasRenderingContext2D, s: string, maxW: number, maxLines: number): string[] {
  if (g.measureText(s).width <= maxW) return [s];
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (g.measureText(next).width <= maxW) { cur = next; continue; }
    if (cur) lines.push(cur);
    cur = w;
    if (lines.length === maxLines - 1) break; // le reste ira sur la dernière ligne
  }
  // ce qui reste (mot courant + mots non traités) sur la dernière ligne, tronqué au pixel si besoin
  const usedWords = lines.join(" ").split(" ").filter(Boolean).length;
  let last = words.slice(usedWords).join(" ");
  if (g.measureText(last).width > maxW) {
    while (last.length > 1 && g.measureText(last + "…").width > maxW) last = last.slice(0, -1);
    last += "…";
  }
  lines.push(last);
  return lines;
}

// ===== Palettes par niveau =====
interface Biome { floorA: string; floorB: string; wallTop: string; wallFace: string; wallLine: string; deco: string; }
const BIOMES: Record<number, Biome> = {
  1: { floorA: "#2e2b33", floorB: "#343039", wallTop: "#524d61", wallFace: "#3b3746", wallLine: "#2e2a38", deco: "#3f5138" },
  2: { floorA: "#262b36", floorB: "#2b303d", wallTop: "#46506a", wallFace: "#333c52", wallLine: "#28304a", deco: "#2e4258" },
  3: { floorA: "#37322a", floorB: "#3d372e", wallTop: "#6a5a40", wallFace: "#4e4230", wallLine: "#3e3426", deco: "#5a5038" },
  4: { floorA: "#221a24", floorB: "#281e2a", wallTop: "#48283a", wallFace: "#341c2a", wallLine: "#26141e", deco: "#6e2230" },
  5: { floorA: "#170d14", floorB: "#1c1018", wallTop: "#3e1420", wallFace: "#2a0e18", wallLine: "#1c0810", deco: "#8a1a28" },
};

const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177 | 0;
  return ((h ^ (h >> 16)) >>> 0) / 0xffffffff;
};

// ===== Particules =====
export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
  grav?: number; glow?: boolean;
}
export class Particles {
  list: Particle[] = [];
  spawn(p: Partial<Particle> & { x: number; y: number; color: string }) {
    const life = p.life ?? 1;
    this.list.push({ vx: 0, vy: 0, size: 3, ...p, life, maxLife: p.maxLife ?? life } as Particle);
  }
  burst(x: number, y: number, color: string, n: number, speed = 60, life = 0.7, size = 3, glow = false) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.spawn({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.5 + Math.random() * 0.5), maxLife: life, size: size * (0.5 + Math.random()), color, glow });
    }
  }
  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.grav) p.vy += p.grav * dt;
      p.vx *= 1 - dt * 1.5; p.vy *= 1 - dt * 1.5;
    }
  }
  draw(g: CanvasRenderingContext2D, offX = 0, offY = 0) {
    for (const p of this.list) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      g.globalAlpha = a;
      if (p.glow) { g.shadowColor = p.color; g.shadowBlur = 8; }
      g.fillStyle = p.color;
      const s = p.size * (0.5 + a * 0.5);
      g.fillRect(p.x - offX - s / 2, p.y - offY - s / 2, s, s);
      g.shadowBlur = 0;
    }
    g.globalAlpha = 1;
  }
}

// ===== Tweens de position des entités =====
const tweenMap = new Map<object, { x: number; y: number }>();
export function renderPos(ent: object, logical: Pos, dt: number, snap = false): { x: number; y: number } {
  let t = tweenMap.get(ent);
  if (!t || snap) { t = { x: logical.x, y: logical.y }; tweenMap.set(ent, t); }
  const sp = 14; // tuiles/s
  t.x = Math.abs(t.x - logical.x) < 0.01 ? logical.x : lerp(t.x, logical.x, clamp(dt * sp, 0, 1));
  t.y = Math.abs(t.y - logical.y) < 0.01 ? logical.y : lerp(t.y, logical.y, clamp(dt * sp, 0, 1));
  return t;
}
export function clearTweens() { tweenMap.clear(); }

// ===== Renderer monde =====
export class WorldRenderer {
  cam = { x: 0, y: 0 };
  particles = new Particles();
  private lightCanvas = document.createElement("canvas");
  time = 0;
  private shake = 0;         // secousse caméra (exploration)
  private nightBlend = 0;    // fondu jour ↔ nuit (0 = jour, 1 = nuit)
  private lastPPos = { x: -1, y: -1 }; // poussière de pas
  private heroFacingLeft = false;      // orientation du héros
  private heroLastX = 0;

  addShake(power: number) { this.shake = Math.min(2, this.shake + power); }

  snapCamera(ctx: GameContext) {
    const px = ctx.player.pos.x * TS, py = ctx.player.pos.y * TS;
    this.cam.x = clamp(px - VW / 2, -TS, ctx.map.width * TS - VW + TS);
    this.cam.y = clamp(py - VH / 2, -TS, ctx.map.height * TS - VH + TS);
    this.nightBlend = ctx.time.isNight ? 1 : 0;
  }

  draw(g: CanvasRenderingContext2D, ctx: GameContext, dt: number) {
    this.time += dt;
    const t = this.time;
    // Les biomes cyclent au-delà de l'étage 5 (Descente Infinie).
    const biome = BIOMES[((ctx.currentLevel - 1) % 5) + 1] ?? BIOMES[1];

    // Caméra suit le joueur (tweené) + secousse
    const pt = renderPos(ctx.player, ctx.player.pos, dt);
    const targX = clamp(pt.x * TS + TS / 2 - VW / 2, -TS, Math.max(-TS, ctx.map.width * TS - VW + TS));
    const targY = clamp(pt.y * TS + TS / 2 - VH / 2, -TS, Math.max(-TS, ctx.map.height * TS - VH + TS));
    this.cam.x = lerp(this.cam.x, targX, clamp(dt * 6, 0, 1));
    this.cam.y = lerp(this.cam.y, targY, clamp(dt * 6, 0, 1));
    this.shake = Math.max(0, this.shake - dt * 3.5);
    const shX = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 9 : 0;
    const shY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 9 : 0;
    const cx = Math.round(this.cam.x + shX), cy = Math.round(this.cam.y + shY);

    // Poussière de pas : le déplacement laisse une trace
    if (this.lastPPos.x !== ctx.player.pos.x || this.lastPPos.y !== ctx.player.pos.y) {
      if (this.lastPPos.x >= 0) {
        for (let i = 0; i < 3; i++)
          this.particles.spawn({
            x: this.lastPPos.x * TS + TS / 2 + (Math.random() - 0.5) * 10,
            y: this.lastPPos.y * TS + TS - 8 + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 16, vy: -6 - Math.random() * 10,
            life: 0.4 + Math.random() * 0.25, maxLife: 0.65, size: 2.2, color: "rgba(180,170,160,.5)",
          });
      }
      this.lastPPos = { x: ctx.player.pos.x, y: ctx.player.pos.y };
    }

    // Ambiance de biome : braises/spores flottantes autour du joueur
    if (Math.random() < dt * 8) {
      const emberCol = ctx.currentLevel >= 4 ? (Math.random() < 0.6 ? "#c04030" : "#802020")
        : ctx.currentLevel === 2 ? "#4a7ab0" : ctx.currentLevel === 3 ? "#b09a60" : "#7a708a";
      this.particles.spawn({
        x: cx + Math.random() * VW, y: cy + VH + 6,
        vx: (Math.random() - 0.5) * 8, vy: -10 - Math.random() * 16,
        life: 4 + Math.random() * 3, maxLife: 7, size: 1.6 + Math.random() * 1.4,
        color: emberCol, glow: ctx.currentLevel >= 4,
      });
    }

    g.fillStyle = "#0a0810";
    g.fillRect(0, 0, VW, VH);

    const x0 = Math.max(0, Math.floor(cx / TS) - 1), x1 = Math.min(ctx.map.width - 1, Math.ceil((cx + VW) / TS) + 1);
    const y0 = Math.max(0, Math.floor(cy / TS) - 1), y1 = Math.min(ctx.map.height - 1, Math.ceil((cy + VH) / TS) + 1);

    // ---- Sol / murs ----
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const k = x + "," + y;
        if (!ctx.discovered.has(k)) continue;
        const tile = ctx.map.tiles[y][x];
        const sx = x * TS - cx, sy = y * TS - cy;
        const h = hash(x, y);

        if (tile === Tile.Wall || tile === Tile.Cracked) {
          const below = y + 1 < ctx.map.height ? ctx.map.tiles[y + 1][x] : Tile.Wall;
          if (below !== Tile.Wall) {
            // face du mur
            g.fillStyle = biome.wallFace;
            g.fillRect(sx, sy, TS, TS);
            g.fillStyle = biome.wallLine;
            g.fillRect(sx, sy + TS * 0.3, TS, 2);
            g.fillRect(sx, sy + TS * 0.65, TS, 2);
            g.fillRect(sx + (h > 0.5 ? TS * 0.3 : TS * 0.6), sy + TS * 0.32, 2, TS * 0.33);
            g.fillStyle = biome.wallTop;
            g.fillRect(sx, sy, TS, TS * 0.22);
          } else {
            g.fillStyle = biome.wallTop;
            g.fillRect(sx, sy, TS, TS);
            g.fillStyle = biome.wallLine;
            if (h > 0.75) g.fillRect(sx + TS * 0.2, sy + TS * 0.3, TS * 0.25, TS * 0.18);
            else if (h > 0.5) g.fillRect(sx + TS * 0.55, sy + TS * 0.5, TS * 0.2, TS * 0.15);
          }
          // Mur fissuré : les lézardes luisent faiblement — l'œil attentif est récompensé
          if (tile === Tile.Cracked) {
            const pulse = 0.5 + Math.sin(t * 2.2 + x * 2) * 0.25;
            g.strokeStyle = `rgba(255,220,150,${pulse * 0.55})`;
            g.lineWidth = 2;
            g.beginPath();
            g.moveTo(sx + TS * 0.5, sy + TS * 0.12);
            g.lineTo(sx + TS * 0.36, sy + TS * 0.4);
            g.lineTo(sx + TS * 0.56, sy + TS * 0.58);
            g.lineTo(sx + TS * 0.42, sy + TS * 0.9);
            g.moveTo(sx + TS * 0.36, sy + TS * 0.4);
            g.lineTo(sx + TS * 0.2, sy + TS * 0.62);
            g.stroke();
          }
        } else {
          // sol + joints de dalles pour casser la platitude
          g.fillStyle = h > 0.5 ? biome.floorA : biome.floorB;
          g.fillRect(sx, sy, TS, TS);
          g.fillStyle = biome.wallLine;
          g.globalAlpha = 0.22;
          g.fillRect(sx, sy + TS - 1, TS, 1); g.fillRect(sx + TS - 1, sy, 1, TS); // joints subtils
          g.globalAlpha = 1;
          // détails procéduraux variés (fissures, mousse, dalles, taches, gravats)
          const h2 = hash(x * 7 + 3, y * 13 + 1);
          if (h > 0.95) { g.fillStyle = biome.deco; g.globalAlpha = 0.7; g.fillRect(sx + TS * 0.28, sy + TS * 0.4, 4, 3); g.fillRect(sx + TS * 0.58, sy + TS * 0.55, 3, 3); g.fillRect(sx + TS * 0.42, sy + TS * 0.68, 2, 2); g.globalAlpha = 1; }
          else if (h > 0.9) { g.strokeStyle = biome.wallLine; g.globalAlpha = 0.5; g.lineWidth = 1; g.beginPath(); g.moveTo(sx + TS * 0.25, sy + TS * 0.3); g.lineTo(sx + TS * 0.5, sy + TS * 0.55); g.lineTo(sx + TS * 0.4, sy + TS * 0.75); g.stroke(); g.globalAlpha = 1; } // fissure
          else if (h < 0.05) { g.fillStyle = biome.wallLine; g.globalAlpha = 0.6; g.fillRect(sx + TS * 0.4, sy + TS * 0.35, 5, 4); g.fillRect(sx + TS * 0.55, sy + TS * 0.5, 3, 3); g.globalAlpha = 1; } // gravats
          else if (h2 > 0.92) { g.fillStyle = biome.deco; g.globalAlpha = 0.28; g.fillRect(sx + TS * 0.15, sy + TS * 0.6, 8, 5); g.globalAlpha = 1; } // tache de mousse

          if (tile === Tile.Exit) this.drawPortal(g, sx, sy, t);
          else if (tile === Tile.DoorClosed) g.drawImage(getSprite("door_closed"), sx + 2, sy + 2, TS - 4, TS - 4);
          else if (tile === Tile.DoorOpen) g.drawImage(getSprite("door_open"), sx + 2, sy + 2, TS - 4, TS - 4);
        }
      }
    }

    // ---- Sceaux ----
    for (const s of ctx.seals) {
      const k = key(s.pos);
      if (!ctx.discovered.has(k)) continue;
      const sx = s.pos.x * TS - cx, sy = s.pos.y * TS - cy;
      this.drawSeal(g, sx, sy, t, s.isActivated);
      if (!s.isActivated && ctx.visible.has(k) && Math.random() < dt * 4)
        this.particles.spawn({ x: s.pos.x * TS + TS / 2 + (Math.random() - 0.5) * 20, y: s.pos.y * TS + TS / 2, vx: 0, vy: -22, life: 0.9, maxLife: 0.9, size: 2.5, color: "#5adfe8", glow: true });
    }

    // ---- Autels maudits & sanctuaires ----
    for (const a of ctx.altars) {
      if (!ctx.discovered.has(key(a.pos))) continue;
      const sx = a.pos.x * TS - cx, sy = a.pos.y * TS - cy;
      this.drawAltar(g, sx, sy, t, a.used);
      if (!a.used && ctx.visible.has(key(a.pos)) && Math.random() < dt * 5)
        this.particles.spawn({ x: a.pos.x * TS + TS / 2 + (Math.random() - 0.5) * 18, y: a.pos.y * TS + TS / 2, vx: 0, vy: -18, life: 1, maxLife: 1, size: 2.2, color: "#c04888", glow: true });
    }
    for (const s of ctx.shrines) {
      if (!ctx.discovered.has(key(s.pos))) continue;
      const sx = s.pos.x * TS - cx, sy = s.pos.y * TS - cy;
      this.drawShrine(g, sx, sy, t, s.used);
      if (!s.used && ctx.visible.has(key(s.pos)) && Math.random() < dt * 5)
        this.particles.spawn({ x: s.pos.x * TS + TS / 2 + (Math.random() - 0.5) * 14, y: s.pos.y * TS + TS / 2, vx: 0, vy: -16, life: 0.9, maxLife: 0.9, size: 2, color: "#7ae8c8", glow: true });
    }

    // ---- Décor (props) : ossements, colonnes, toiles, flaques, torches ----
    for (const pr of ctx.props) {
      const k = key(pr.pos);
      if (!ctx.discovered.has(k)) continue;
      const sx = pr.pos.x * TS - cx, sy = pr.pos.y * TS - cy;
      const spr = getSprite("prop_" + pr.kind);
      if (spr) g.drawImage(spr, sx, sy, TS, TS);
      // flamme vacillante des torches
      if (pr.kind === "torch" && ctx.visible.has(k) && Math.random() < dt * 20)
        this.particles.spawn({ x: pr.pos.x * TS + TS / 2, y: pr.pos.y * TS + TS * 0.32, vx: (Math.random() - 0.5) * 6, vy: -20 - Math.random() * 16, life: 0.5 + Math.random() * 0.4, maxLife: 0.9, size: 2 + Math.random() * 1.5, color: Math.random() < 0.6 ? "#ff9d2e" : "#ffd84a", glow: true });
    }

    // ---- Points de lore (découvrables) ----
    for (const lm of ctx.loreMarks) {
      const k = key(lm.pos);
      if (!ctx.discovered.has(k)) continue;
      const sx = lm.pos.x * TS - cx, sy = lm.pos.y * TS - cy;
      const spr = getSprite(lm.sprite);
      if (spr) { g.shadowColor = "#8a5fd0"; g.shadowBlur = 10; g.drawImage(spr, sx + 2, sy + 2, TS - 4, TS - 4); g.shadowBlur = 0; }
      if (!lm.seen && ctx.visible.has(k) && Math.random() < dt * 6)
        this.particles.spawn({ x: lm.pos.x * TS + TS / 2 + (Math.random() - 0.5) * 18, y: lm.pos.y * TS + TS / 2, vx: 0, vy: -16, life: 1, maxLife: 1, size: 2.2, color: "#b088e8", glow: true });
    }

    // ---- Pièges du labyrinthe ----
    for (const tr of ctx.traps) {
      const k = key(tr.pos);
      if (!ctx.discovered.has(k)) continue;
      const sx = tr.pos.x * TS - cx, sy = tr.pos.y * TS - cy;
      const name = (tr.kind === "spikes" ? "trap_spikes" : "trap_gas") + (tr.sprung ? "_on" : "");
      const spr = getSprite(name);
      if (spr) g.drawImage(spr, sx, sy, TS, TS);
      // avertissement discret quand le piège est visible et armé (reflet des pointes / gaz qui suinte)
      if (!tr.sprung && ctx.visible.has(k) && Math.random() < dt * 4)
        this.particles.spawn({ x: tr.pos.x * TS + TS / 2 + (Math.random() - 0.5) * 16, y: tr.pos.y * TS + TS / 2, vx: 0, vy: -14, life: 0.8, maxLife: 0.8, size: 2, color: tr.kind === "gas" ? "#7ae87a" : "#c8b0a0", glow: true });
    }

    // ---- Objets ----
    for (const it of ctx.items) {
      const k = key(it.pos);
      if (!ctx.visible.has(k)) continue;
      const sx = it.pos.x * TS - cx, sy = it.pos.y * TS - cy;
      const bob = Math.sin(t * 3 + it.pos.x) * 3;
      if (it.id === "LegendarySword") {
        g.drawImage(getSprite("pedestal"), sx, sy, TS, TS);
        g.shadowColor = "#ffd84a"; g.shadowBlur = 14;
        g.drawImage(getSprite("it_legend"), sx + 2, sy - 8 + bob, TS - 4, TS - 4);
        g.shadowBlur = 0;
        if (Math.random() < dt * 8)
          this.particles.spawn({ x: it.pos.x * TS + TS / 2 + (Math.random() - 0.5) * 24, y: it.pos.y * TS + 10, vx: 0, vy: -28, life: 1, maxLife: 1, size: 2.5, color: "#ffd84a", glow: true });
      } else {
        g.shadowColor = "#fff"; g.shadowBlur = 5;
        g.drawImage(getSprite("it_" + spriteForItem(it.id)), sx + 4, sy + bob, TS - 8, TS - 8);
        g.shadowBlur = 0;
      }
    }

    // ---- Coffres ----
    for (const c of ctx.chests) {
      const k = key(c.pos);
      if (!ctx.discovered.has(k)) continue;
      const sx = c.pos.x * TS - cx, sy = c.pos.y * TS - cy;
      const spr = c.isOpened ? "chest_open" : c.type === ChestType.Legendary ? "chest_leg" : "chest";
      if (!c.isOpened && c.type === ChestType.Legendary) { g.shadowColor = "#8a5fd0"; g.shadowBlur = 10; }
      g.drawImage(getSprite(spr), sx + 3, sy + 3, TS - 6, TS - 6);
      g.shadowBlur = 0;
    }

    // ---- Marchand ----
    if (ctx.merchant && ctx.visible.has(key(ctx.merchant.pos))) {
      const sx = ctx.merchant.pos.x * TS - cx, sy = ctx.merchant.pos.y * TS - cy;
      const bob = Math.sin(t * 2.2) * 1.5;
      g.drawImage(getSprite("merchant"), sx + 2, sy + bob, TS - 4, TS - 4);
      textShadow(g, "$", sx + TS - 8, sy + 6 + bob, 13, "#ffd84a", "center");
    }

    // ---- PNJ ----
    for (const n of ctx.pnjs) {
      if (!ctx.visible.has(key(n.pos))) continue;
      const rp = renderPos(n, n.pos, dt);
      const sx = rp.x * TS - cx, sy = rp.y * TS - cy;
      const sprName = "pnj_" + n.name.toLowerCase().split(" ")[0];
      const spr = getSprite(sprName) ?? getSprite("pnj_orin");
      g.drawImage(spr, sx + 2, sy + Math.sin(t * 2 + rp.x * 3) * 1.5, TS - 4, TS - 4);
    }

    // ---- Monstres ----
    for (const m of ctx.monsters) {
      if (m.isDead) continue;
      if (!ctx.visible.has(key(m.pos))) continue;
      const rp = renderPos(m, m.pos, dt);
      const sx = rp.x * TS - cx, sy = rp.y * TS - cy;
      this.drawMonster(g, m, sx, sy, t);
    }

    // ---- Joueur (s'oriente dans le sens de la marche) ----
    {
      const sx = pt.x * TS - cx, sy = pt.y * TS - cy;
      const bob = Math.sin(t * 4) * 1.5;
      if (pt.x < this.heroLastX - 0.01) this.heroFacingLeft = true;
      else if (pt.x > this.heroLastX + 0.01) this.heroFacingLeft = false;
      this.heroLastX = pt.x;
      // ombre
      g.fillStyle = "rgba(0,0,0,.35)";
      g.beginPath(); g.ellipse(sx + TS / 2, sy + TS - 4, TS * 0.3, TS * 0.12, 0, 0, Math.PI * 2); g.fill();
      if (this.heroFacingLeft) {
        g.save();
        g.translate(sx + TS / 2, 0); g.scale(-1, 1); g.translate(-(sx + TS / 2), 0);
        g.drawImage(getSprite("player"), sx + 2, sy - 2 + bob, TS - 4, TS - 4);
        g.restore();
      } else {
        g.drawImage(getSprite("player"), sx + 2, sy - 2 + bob, TS - 4, TS - 4);
      }
    }

    // ---- Particules ----
    this.particles.update(dt);
    this.particles.draw(g, cx, cy);

    // ---- Éclairage ----
    this.drawLighting(g, ctx, cx, cy, t);

    // ---- Teinte de nuit (fondue : le crépuscule s'installe, l'aube dissipe) ----
    this.nightBlend = lerp(this.nightBlend, ctx.time.isNight ? 1 : 0, clamp(dt * 1.2, 0, 1));
    if (this.nightBlend > 0.01) {
      g.fillStyle = `rgba(30,40,110,${(0.18 * this.nightBlend).toFixed(3)})`;
      g.fillRect(0, 0, VW, VH);
    }

    // ---- Brume ambiante : deux nappes qui dérivent lentement ----
    g.save();
    g.globalAlpha = 0.05 + this.nightBlend * 0.03;
    for (let i = 0; i < 2; i++) {
      const off = (t * (8 + i * 5)) % (VW * 2);
      const fogY = VH * (0.3 + i * 0.35) + Math.sin(t * 0.4 + i * 2) * 24;
      const grad2 = g.createLinearGradient(0, fogY - 70, 0, fogY + 70);
      grad2.addColorStop(0, "rgba(160,150,190,0)");
      grad2.addColorStop(0.5, "rgba(160,150,190,1)");
      grad2.addColorStop(1, "rgba(160,150,190,0)");
      g.fillStyle = grad2;
      g.fillRect(-off % VW, fogY - 70, VW * 2, 140);
    }
    g.restore();

    // ---- Vignette de danger : les bords saignent quand la vie s'épuise ----
    const hpRatio = ctx.player.maxHp > 0 ? ctx.player.hp / ctx.player.maxHp : 1;
    if (hpRatio < 0.3) {
      const pulse = 0.5 + Math.sin(t * 5) * 0.3;
      const a = (0.3 - hpRatio) / 0.3 * 0.45 * pulse;
      const dv = g.createRadialGradient(VW / 2, VH / 2, VH * 0.32, VW / 2, VH / 2, VH * 0.75);
      dv.addColorStop(0, "rgba(160,10,20,0)");
      dv.addColorStop(1, `rgba(160,10,20,${a.toFixed(3)})`);
      g.fillStyle = dv;
      g.fillRect(0, 0, VW, VH);
    }
  }

  // Autel maudit : monolithe sombre à lueur pourpre
  private drawAltar(g: CanvasRenderingContext2D, sx: number, sy: number, t: number, used: boolean) {
    const cx = sx + TS / 2;
    g.save();
    if (!used) { g.shadowColor = "#c04888"; g.shadowBlur = 12 + Math.sin(t * 3) * 4; }
    g.fillStyle = used ? "#2a2230" : "#3a2038";
    g.beginPath();
    g.moveTo(cx - 9, sy + TS - 5); g.lineTo(cx - 6, sy + 8); g.lineTo(cx, sy + 4);
    g.lineTo(cx + 6, sy + 8); g.lineTo(cx + 9, sy + TS - 5);
    g.closePath(); g.fill();
    g.fillStyle = used ? "#3a3244" : `rgba(220,90,160,${0.6 + Math.sin(t * 3) * 0.3})`;
    g.fillRect(cx - 2, sy + 12, 4, 4);
    g.fillRect(cx - 1, sy + 20, 2, 8);
    g.restore();
  }

  // Sanctuaire : vasque d'eau claire
  private drawShrine(g: CanvasRenderingContext2D, sx: number, sy: number, t: number, used: boolean) {
    const cx = sx + TS / 2, cy2 = sy + TS / 2 + 4;
    g.save();
    g.fillStyle = "#4a4458";
    g.beginPath(); g.ellipse(cx, cy2 + 6, 13, 6, 0, 0, Math.PI * 2); g.fill();
    if (!used) { g.shadowColor = "#7ae8c8"; g.shadowBlur = 10; }
    g.fillStyle = used ? "#33404a" : "#5adfc8";
    g.beginPath(); g.ellipse(cx, cy2 + 3, 10, 4.4, 0, 0, Math.PI * 2); g.fill();
    if (!used) {
      g.strokeStyle = `rgba(200,255,240,${0.4 + Math.sin(t * 4) * 0.25})`;
      g.lineWidth = 1.4;
      g.beginPath(); g.ellipse(cx, cy2 + 3, 5 + Math.sin(t * 2.4) * 2.5, 2.4, 0, 0, Math.PI * 2); g.stroke();
    }
    g.restore();
  }

  private drawPortal(g: CanvasRenderingContext2D, sx: number, sy: number, t: number) {
    const cx = sx + TS / 2, cy = sy + TS / 2;
    g.save();
    const grad = g.createRadialGradient(cx, cy, 2, cx, cy, TS * 0.45);
    grad.addColorStop(0, "#c8f0ff");
    grad.addColorStop(0.5, "#3a9ad8");
    grad.addColorStop(1, "#10203a");
    g.fillStyle = grad;
    g.beginPath(); g.arc(cx, cy, TS * 0.42, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#7adfff";
    g.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a0 = t * (1.5 + i * 0.5) + i * 2.1;
      g.beginPath();
      g.arc(cx, cy, TS * (0.15 + i * 0.1), a0, a0 + 1.8);
      g.stroke();
    }
    g.restore();
  }

  private drawSeal(g: CanvasRenderingContext2D, sx: number, sy: number, t: number, active: boolean) {
    const cx = sx + TS / 2, cy = sy + TS / 2;
    const col = active ? "#3a4a52" : "#5adfe8";
    const pulse = active ? 0.4 : 0.7 + Math.sin(t * 3) * 0.3;
    g.save();
    g.globalAlpha = pulse;
    if (!active) { g.shadowColor = "#5adfe8"; g.shadowBlur = 12; }
    g.strokeStyle = col;
    g.lineWidth = 2.5;
    g.beginPath(); g.arc(cx, cy, TS * 0.32, 0, Math.PI * 2); g.stroke();
    g.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / 3);
      const x = cx + Math.cos(a) * TS * 0.32, y = cy + Math.sin(a) * TS * 0.32;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath(); g.stroke();
    g.restore();
  }

  drawMonster(g: CanvasRenderingContext2D, m: Monster, sx: number, sy: number, t: number) {
    const frame2 = Math.floor(t * 3 + m.pos.x) % 2 === 1;
    let spr = getSprite(m.sprite + (frame2 && getSprite(m.sprite + "_2") ? "_2" : ""));
    if (!spr) spr = getSprite("slime");
    // ombre
    g.fillStyle = "rgba(0,0,0,.35)";
    g.beginPath(); g.ellipse(sx + TS / 2, sy + TS - 4, TS * 0.32, TS * 0.12, 0, 0, Math.PI * 2); g.fill();
    if (m.elite) { g.shadowColor = "#ffca3a"; g.shadowBlur = 14 + Math.sin(t * 4) * 4; }
    if (m.rank === MonsterRank.MiniBoss) { g.shadowColor = "#8a5fd0"; g.shadowBlur = 12; }
    if (m.rank === MonsterRank.Boss) { g.shadowColor = "#ff3b3b"; g.shadowBlur = 16; }
    const bob = m.rank === MonsterRank.Normal && !m.elite ? 0 : Math.sin(t * 2.5) * 2;
    g.drawImage(spr, sx + 2, sy - 2 + bob, TS - 4, TS - 4);
    g.shadowBlur = 0;
    // Couronne d'élite
    if (m.elite) {
      g.fillStyle = "#ffd84a";
      const cxp = sx + TS / 2, cyp = sy - 4 + bob;
      g.beginPath();
      g.moveTo(cxp - 7, cyp); g.lineTo(cxp - 5, cyp - 6); g.lineTo(cxp - 2, cyp - 2);
      g.lineTo(cxp, cyp - 7); g.lineTo(cxp + 2, cyp - 2); g.lineTo(cxp + 5, cyp - 6);
      g.lineTo(cxp + 7, cyp); g.closePath(); g.fill();
    }
    // barre de vie si blessé
    if (m.hp < m.maxHp) {
      const w = TS - 10;
      g.fillStyle = "rgba(0,0,0,.6)";
      g.fillRect(sx + 5, sy - 7, w, 4);
      g.fillStyle = m.rank === MonsterRank.Normal ? "#e04848" : "#c85adf";
      g.fillRect(sx + 5, sy - 7, w * clamp(m.hp / m.maxHp, 0, 1), 4);
    }
  }

  private drawLighting(g: CanvasRenderingContext2D, ctx: GameContext, cx: number, cy: number, t: number) {
    const lw = ctx.map.width, lh = ctx.map.height;
    if (this.lightCanvas.width !== lw || this.lightCanvas.height !== lh) {
      this.lightCanvas.width = lw; this.lightCanvas.height = lh;
    }
    const lg = this.lightCanvas.getContext("2d")!;
    const img = lg.createImageData(lw, lh);
    const radius = Math.max(1, ctx.player.visionRadius + ctx.player.lightBonus);
    const flicker = 1 + Math.sin(t * 9) * 0.04 + Math.sin(t * 23.7) * 0.025;
    const px = ctx.player.pos.x, py = ctx.player.pos.y;
    const ambient = ctx.time.isNight ? 0.30 : 0.16;
    // Torches découvertes : halos lumineux persistants (vacillants)
    const torchR = 3.4 * flicker;
    const torches = ctx.props.filter(p => p.kind === "torch" && ctx.discovered.has(p.pos.x + "," + p.pos.y));
    for (let y = 0; y < lh; y++) {
      for (let x = 0; x < lw; x++) {
        const k = x + "," + y;
        let a: number;
        if (!ctx.discovered.has(k)) a = 1;
        else if (!ctx.visible.has(k)) a = 0.78;
        else {
          const d = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py)) / (radius * flicker);
          a = clamp(ambient + d * d * 0.55, 0, 0.75);
        }
        // Une torche proche éclaire (baisse l'obscurité), même hors du halo du joueur
        if (a > ambient && ctx.discovered.has(k)) {
          for (const tr of torches) {
            const td = Math.sqrt((x - tr.pos.x) * (x - tr.pos.x) + (y - tr.pos.y) * (y - tr.pos.y)) / torchR;
            if (td < 1) { a = Math.min(a, clamp(ambient + td * td * 0.5, 0, a)); }
          }
        }
        const idx = (y * lw + x) * 4;
        img.data[idx] = 6; img.data[idx + 1] = 4; img.data[idx + 2] = 12;
        img.data[idx + 3] = Math.round(a * 255);
      }
    }
    lg.putImageData(img, 0, 0);
    g.save();
    g.imageSmoothingEnabled = true;
    g.drawImage(this.lightCanvas, -cx - TS / 2, -cy - TS / 2, lw * TS, lh * TS);
    g.imageSmoothingEnabled = false;
    g.restore();

    // halo chaud autour du joueur
    const hx = px * TS - cx + TS / 2, hy = py * TS - cy + TS / 2;
    const halo = g.createRadialGradient(hx, hy, 10, hx, hy, TS * (radius * 0.9));
    halo.addColorStop(0, "rgba(255,180,80,.10)");
    halo.addColorStop(1, "rgba(255,180,80,0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, VW, VH);
  }
}

function spriteForItem(id: string): string {
  switch (id) {
    case "Sword": return "sword";
    case "Armor": return "armor";
    case "LifeGem": return "gem";
    case "CritCharm": return "charm";
    case "VampRing": return "ring";
    case "Torch": return "torch";
    case "Lantern": return "lantern";
    case "LegendarySword": return "legend";
    case "Map1ArmoryKey": return "key";
    default: return "gem";
  }
}

// ===== HUD =====
const LOG_COLORS: Record<LogKind, string> = {
  [LogKind.Info]: "#c8c4d4",
  [LogKind.Loot]: "#ffd84a",
  [LogKind.Combat]: "#ff7a6e",
  [LogKind.Warning]: "#ff9d4a",
  [LogKind.System]: "#8fd4ff",
};

export function drawHud(g: CanvasRenderingContext2D, ctx: GameContext, t: number) {
  const p = ctx.player;

  // ---- panneau haut-gauche ----
  g.fillStyle = "rgba(8,6,14,.72)";
  g.beginPath(); g.roundRect(10, 10, 250, 74, 8); g.fill();
  g.strokeStyle = "rgba(140,130,170,.35)"; g.lineWidth = 1;
  g.beginPath(); g.roundRect(10, 10, 250, 74, 8); g.stroke();

  // Barre PV
  const hpw = 160;
  const hpr = clamp(p.hp / p.maxHp, 0, 1);
  g.fillStyle = "#25141c";
  g.beginPath(); g.roundRect(58, 20, hpw, 14, 4); g.fill();
  const hpGrad = g.createLinearGradient(58, 0, 58 + hpw, 0);
  hpGrad.addColorStop(0, hpr > 0.35 ? "#b83a3a" : "#e02222");
  hpGrad.addColorStop(1, hpr > 0.35 ? "#e06848" : "#ff5050");
  g.fillStyle = hpGrad;
  g.beginPath(); g.roundRect(58, 20, hpw * hpr, 14, 4); g.fill();
  textShadow(g, `${p.hp}/${p.maxHp}`, 58 + hpw / 2, 28, 11, "#fff", "center");
  text(g, "PV", 22, 28, 12, "#ff8a8a");

  // Barre XP
  const xpr = clamp(p.xp / p.xpToNext, 0, 1);
  g.fillStyle = "#141c25";
  g.beginPath(); g.roundRect(58, 40, hpw, 8, 3); g.fill();
  g.fillStyle = "#4a9ad8";
  g.beginPath(); g.roundRect(58, 40, hpw * xpr, 8, 3); g.fill();
  text(g, "XP", 22, 44, 12, "#7ab8e8");
  textShadow(g, `${T("hud.lvl")} ${p.level}`, 228, 44, 11, "#bfe0ff", "center");

  // Or + stats
  textShadow(g, `⬤ ${p.gold}`, 22, 66, 13, "#ffd84a");
  text(g, `ATK ${p.attack}  ARM ${p.armor}  CRIT ${p.critChancePercent}%`, 100, 66, 11, "#a8a4b8");

  // ---- LE SERMENT : sceau moral (campagne uniquement) — se teinte selon ta voie ----
  // Cyan = tu brises la Boucle • Rouge = tu la perpétues. Le halo croît avec ta conviction.
  if (!ctx.endless && ctx.oath !== 0) {
    const breaking = ctx.oath > 0;
    const conv = clamp(Math.abs(ctx.oath) / 8, 0.25, 1);
    const col = breaking ? "#5ac8ff" : "#ff5a6a";
    const sx = 244, sy = 20;
    g.save();
    g.translate(sx, sy); g.rotate(Math.PI / 4);
    g.shadowColor = col; g.shadowBlur = 6 + conv * 10 * (0.7 + 0.3 * Math.sin(t * 3));
    g.fillStyle = col; g.globalAlpha = 0.55 + conv * 0.45;
    const r = 5;
    g.fillRect(-r, -r, r * 2, r * 2);
    g.restore();
  }

  // ---- jour/nuit + étage (haut-droite, sous minimap) ----
  const mmW = drawMinimap(g, ctx);
  const dialX = VW - 30, dialY = mmW + 38;
  g.fillStyle = "rgba(8,6,14,.72)";
  g.beginPath(); g.arc(dialX, dialY, 17, 0, Math.PI * 2); g.fill();
  g.strokeStyle = ctx.time.isNight ? "#7a8ad8" : "#ffd84a";
  g.lineWidth = 3;
  g.beginPath(); g.arc(dialX, dialY, 17, -Math.PI / 2, -Math.PI / 2 + ctx.time.progress01 * Math.PI * 2); g.stroke();
  text(g, ctx.time.isNight ? "☾" : "☀", dialX, dialY + 1, 16, ctx.time.isNight ? "#aab8ff" : "#ffd84a", "center");
  textShadow(g, ctx.endless ? T("hud.depth", { n: ctx.runDepth }) : T("hud.floor", { n: ctx.currentLevel }), dialX - 28, dialY, 12, "#c8c4d4", "right");
  if (ctx.endless) textShadow(g, `✦ ${ctx.runEssence}`, dialX - 28, dialY + 20, 13, "#c8a0ff", "right");

  // ---- journal (bas-gauche) : retour à la ligne des longs messages (dialogues PNJ) ----
  const lx = 10, lh = 16, boxW = 560, maxTextW = boxW - 20;
  g.font = `bold 12px ${FONT}`;
  // pré-calcule les lignes wrappées (chaque entrée sur 2 lignes max), puis budget global
  const wrapped: { text: string; kind: LogKind; time: number }[] = [];
  for (const e of ctx.log.slice(-4)) {
    const lines = wrapLine(g, e.text, maxTextW, 2);
    for (const ln of lines) wrapped.push({ text: ln, kind: e.kind, time: e.time });
  }
  const shown = wrapped.slice(-6); // plafond de lignes affichées : la boîte ne mange pas l'écran
  const ly0 = VH - 14 - shown.length * lh;
  if (shown.length) {
    g.fillStyle = "rgba(8,6,14,.66)";
    g.beginPath(); g.roundRect(lx, ly0 - 10, boxW, shown.length * lh + 16, 8); g.fill();
    shown.forEach((e, i) => {
      const age = (performance.now() - e.time) / 1000;
      g.globalAlpha = clamp(1.3 - age / 14, 0.45, 1);
      text(g, e.text, lx + 10, ly0 + i * lh, 12, LOG_COLORS[e.kind]);
      g.globalAlpha = 1;
    });
  }

  // ---- aide touches (bas-droite) ----
  text(g, T("hud.keys"), VW - 12, VH - 12, 11, "rgba(170,165,190,.75)", "right");

  // ---- Build de Descente : éléments investis + résonances + malédictions (bas-droite) ----
  if (ctx.endless) {
    const els: Element[] = ["fire", "frost", "blood", "storm"];
    let bx = VW - 12;
    const by = VH - 36;
    // malédictions (à droite, en rouge)
    for (const c of ctx.runCurses) {
      bx -= 24;
      const pulse = 0.7 + Math.sin(t * 3) * 0.2;
      g.globalAlpha = pulse;
      textShadow(g, "☠", bx, by, 15, "#ff5060", "center");
      g.globalAlpha = 1;
    }
    if (ctx.runCurses.length) bx -= 12;
    for (const el of [...els].reverse()) {
      const n = elementStacks(ctx.player, el);
      if (n <= 0) continue;
      bx -= 46;
      const res = hasResonance(ctx.player, el);
      const col = ELEMENT_COLOR[el];
      g.fillStyle = "rgba(8,6,14,.72)";
      g.beginPath(); g.roundRect(bx - 4, by - 12, 44, 24, 6); g.fill();
      if (res) {
        g.strokeStyle = col; g.lineWidth = 1.5;
        g.shadowColor = col; g.shadowBlur = 6 + Math.sin(t * 4) * 3;
        g.beginPath(); g.roundRect(bx - 4, by - 12, 44, 24, 6); g.stroke();
        g.shadowBlur = 0;
      }
      const icon = el === "fire" ? "🔥" : el === "frost" ? "❄" : el === "blood" ? "🩸" : "⚡";
      text(g, icon, bx + 8, by, 13, col, "center");
      textShadow(g, "×" + n, bx + 28, by, 12, res ? col : "#c8c0d4", "center");
    }
  }

  // ---- points de stat dispo ----
  if (p.statPoints > 0) {
    const pulse = 0.75 + Math.sin(t * 5) * 0.25;
    g.globalAlpha = pulse;
    textShadow(g, T("hud.statpts", { n: p.statPoints }), VW / 2, 24, 14, "#7ae87a", "center");
    g.globalAlpha = 1;
  }

  // ---- toast ----
  if (ctx.toast) {
    const tw = g.measureText(ctx.toast.text).width + 60;
    g.fillStyle = ctx.toast.bg;
    g.beginPath(); g.roundRect(VW / 2 - tw / 2, 44, tw, 32, 6); g.fill();
    g.strokeStyle = "rgba(255,255,255,.3)";
    g.beginPath(); g.roundRect(VW / 2 - tw / 2, 44, tw, 32, 6); g.stroke();
    textShadow(g, ctx.toast.text, VW / 2, 60, 14, ctx.toast.color, "center");
  }
}

function drawMinimap(g: CanvasRenderingContext2D, ctx: GameContext): number {
  const scale = Math.min(3, 130 / ctx.map.width);
  const w = ctx.map.width * scale, h = ctx.map.height * scale;
  const mx = VW - w - 12, my = 12;
  g.fillStyle = "rgba(8,6,14,.72)";
  g.beginPath(); g.roundRect(mx - 4, my - 4, w + 8, h + 8, 6); g.fill();
  for (let y = 0; y < ctx.map.height; y++)
    for (let x = 0; x < ctx.map.width; x++) {
      if (!ctx.discovered.has(x + "," + y)) continue;
      const tile = ctx.map.tiles[y][x];
      g.fillStyle = tile === Tile.Wall || tile === Tile.Cracked ? "#4a4658"
        : tile === Tile.Exit ? "#5adfff"
        : tile === Tile.DoorClosed ? "#c8873a"
        : "#211d2c";
      g.fillRect(mx + x * scale, my + y * scale, scale, scale);
    }
  for (const s of ctx.seals) if (!s.isActivated && ctx.discovered.has(key(s.pos))) {
    g.fillStyle = "#5adfe8";
    g.fillRect(mx + s.pos.x * scale - 1, my + s.pos.y * scale - 1, scale + 2, scale + 2);
  }
  g.fillStyle = "#ffd84a";
  g.fillRect(mx + ctx.player.pos.x * scale - 1, my + ctx.player.pos.y * scale - 1, scale + 2, scale + 2);
  return h;
}
