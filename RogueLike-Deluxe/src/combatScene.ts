// ===== Scène de combat : mise en scène du CombatSession =====
import { Scene, SceneManager } from "./scenes";
import { FilmScene, regicideFilmShots } from "./cinematics";
import { epicSCount } from "./epicMode";
import { VW, VH, text, textShadow, Particles, AmbientFX, FONT, wrapLine } from "./render";
import { Input } from "./input";
import { Audio } from "./audio";
import { T } from "./i18n";
import { G, Flow } from "./game";
import { CombatSession, CombatActionId, INTENT_ICON } from "./combat";
import { Monster, MonsterRank } from "./entities";
import { SKILLS, Skill } from "./skills";
import { getSprite } from "./sprites";
import { clamp, lerp } from "./core";
import { saveGame } from "./save";

interface Floater { x: number; y: number; text: string; color: string; life: number; maxLife: number; size: number; }
interface AnimStep { at: number; fn: () => void; }

// Diagonale façon Pokémon : l'ennemi campe en haut-droite, l'équipe en bas-gauche.
const EX = 630, EY = 215;   // ancre de l'ennemi
const HX = 390, HY = 398;   // ancre du héros (remonté : le sprite agrandi garde ses pieds au-dessus du bandeau)
interface Slash { x: number; y: number; angle: number; life: number; color: string; }
interface Ring { x: number; y: number; r: number; maxR: number; life: number; color: string; }
interface Ghost { x: number; y: number; life: number; flip: boolean; size: number; }

const INTRO_DUR = 1.7; // intro façon Pokémon : volets, slide-in, bannière

function ItemSpriteFor(id: string): string {
  return id === "Bomb" ? "it_bomb" : id === "MistPotion" ? "it_mist" : "it_scroll";
}

export class CombatScene implements Scene {
  private session: CombatSession;
  private enemy: Monster;
  private t = 0;
  private sel = 0;
  private state: "intro" | "input" | "anim" | "done" = "intro";
  private itemMenu = false; // sous-menu Objet ouvert
  private itemSel = 0;
  private skillMenu = false; // sous-menu Techniques ouvert
  private skillSel = 0;
  private steps: AnimStep[] = [];
  private animT = 0;
  private particles = new Particles();
  // Ambiance : brouillard bas + cendres flottantes (valeurs à ajuster librement ici)
  private ambient = new AmbientFX({
    fogBlobs: 8, motes: 56,
    fogColor: "92,108,148", moteColor: "162,176,210",
    fogOpacity: 0.08, moteOpacity: 0.2,
    speed: 1, leftBias: 1.6, // densité renforcée sur la moitié gauche (comble le vide)
    fogBand: { y: 405, h: 105 },
  });
  private floaters: Floater[] = [];
  private enemyShake = 0;
  private screenShake = 0;
  private enemyFlash = 0;
  private playerFlash = 0;
  private phase2Banner = 0;
  private abilityBanner = 0;          // flash du nom d'une attaque spéciale de classe
  private abilityBannerName = "";
  private abilityBannerColor = "#ffd84a";
  private shownEnemyHp: number;
  private shownPlayerHp: number;
  private shownAllyHp: number;
  private allyLunge = 0;   // 1 → 0 : le Rival allié se rue sur l'ennemi
  private allyFlash = 0;   // le Rival encaisse un coup à ta place
  private logReveal = 0;
  // ---- juice ----
  private hitstop = 0;        // gel du temps (impact frames)
  private heroLunge = 0;      // 1 → 0 : le héros se rue vers l'ennemi
  private enemyLunge = 0;     // 1 → 0 : l'ennemi se rue vers le héros
  private heroCast = 0;       // 1 → 0 : emphase (léger zoom) quand le héros lance une compétence
  private enemyCast = 0;      // 1 → 0 : emphase quand l'ennemi lance sa spéciale
  private slashes: Slash[] = [];
  private rings: Ring[] = [];
  private ghosts: Ghost[] = [];
  private flashTint = 0;      // flash plein écran (crit / phase 2)
  private flashColor = "#fff";

  constructor(monster: Monster) {
    this.enemy = monster;
    this.session = new CombatSession(G.ctx, monster);
    this.shownEnemyHp = monster.hp;
    this.shownPlayerHp = G.ctx.player.hp;
    this.shownAllyHp = this.session.ally?.hp ?? 0;
  }

  // Position du Rival allié (légèrement en retrait du héros ; se rue en frappant)
  // Équipe en bas-gauche, bien étalée ; l'élan file en diagonale vers l'ennemi (haut-droite).
  private get allyX() { return 262 + this.allyLunge * 120; }
  private get allyY() { return 420 - this.allyLunge * 90; }

  enter() {
    // Thèmes dédiés : Gardien des Sceaux (warden.mp3), Roi de l'Abîme (abyssking.mp3) ;
    // le Dévoreur et les autres boss gardent boss.mp3.
    const warden = this.enemy.nameKey.startsWith("mob.warden");
    const king = this.enemy.nameKey === "mob.boss" && !G.ctx.endless;
    const minotaur = this.enemy.nameKey === "mob.minotaur"; // le maître du Labyrinthe mérite le thème boss
    Audio.setMode(warden ? "warden" : king ? "abyssking" : minotaur || this.enemy.rank === MonsterRank.Boss ? "boss" : "combat");
    if (this.enemy.rank === MonsterRank.Boss) Audio.sfx("roar");
    else Audio.sfx("hit");
  }

  private get actions(): { id: CombatActionId; label: string; enabled: boolean; key: string }[] {
    const s = this.session;
    return [
      { id: "attack", label: T("act.attack"), enabled: true, key: "1" },
      {
        id: "heal",
        label: s.healsLeft > 0 ? T("act.heal.n", { n: s.healsLeft }) : T("act.heal.none"),
        enabled: s.healsLeft > 0, key: "2",
      },
      {
        id: "dodge",
        label: s.dodgeTurnsLeft > 0 ? T("act.dodge.on", { n: s.dodgeTurnsLeft }) : T("act.dodge"),
        enabled: true, key: "3",
      },
      { id: "flee", label: T("act.flee"), enabled: true, key: "4" },
      {
        id: "skill",
        label: T("act.skills") + `  ⚡${s.energy}`,
        enabled: this.kit().length > 0, key: "5",
      },
      {
        id: "item",
        label: this.consumables().length > 0
          ? T("act.item", { n: this.consumables().reduce((a, c) => a + c.count, 0) })
          : T("act.item.none"),
        enabled: this.consumables().length > 0, key: "6",
      },
    ];
  }

  // Kit de compétences équipées du joueur (résolu depuis les ids)
  private kit(): Skill[] {
    return G.ctx.player.skills.map(id => SKILLS[id]).filter(Boolean) as Skill[];
  }

  // Tags d'effet d'une compétence, déduits automatiquement de ses SkillOp (pour lire le kit d'un coup d'œil)
  private skillTags(sk: Skill): { icon: string; color: string }[] {
    const STC: Record<string, { i: string; c: string }> = {
      burn: { i: "🔥", c: "#ff7a3a" }, bleed: { i: "🩸", c: "#ff4a6a" }, chill: { i: "❄", c: "#7ad4ff" },
      poison: { i: "☠", c: "#7ae87a" }, stun: { i: "✦", c: "#ffd84a" },
    };
    const out: { icon: string; color: string }[] = [];
    for (const op of sk.ops) {
      if (op.t === "dmg") out.push({ icon: op.sig ? "★" : "⚔", color: op.sig ? "#ffd84a" : "#ffb0a0" });
      else if (op.t === "status") { const m = STC[op.kind]; if (m) out.push({ icon: m.i, color: m.c }); }
      else if (op.t === "armorBreak") out.push({ icon: "🛡", color: "#d0d0d8" });
      else if (op.t === "selfArmor") out.push({ icon: "🛡", color: "#8fd4ff" });
      else if (op.t === "dodge") out.push({ icon: "◇", color: "#8fd4ff" });
      else if (op.t === "heal") out.push({ icon: "✚", color: "#7ae87a" });
    }
    return out.slice(0, 3);
  }

  // Panneau incliné (parallélogramme) — cadrage dynamique façon Pokémon, mais teintes sombres.
  private slantRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sk: number) {
    g.beginPath();
    g.moveTo(x + sk, y); g.lineTo(x + w, y); g.lineTo(x + w - sk, y + h); g.lineTo(x, y + h); g.closePath();
  }

  // Pastilles de statut (poison/brûlure/givre…) alignées à partir de (x,y) ; dir=1 vers la droite, -1 vers la gauche.
  private statusChips(g: CanvasRenderingContext2D, statuses: { kind: string; turns: number; power: number }[], x: number, y: number, dir: 1 | -1) {
    const AB: Record<string, string> = { poison: "PSN", stun: "ÉTD", burn: "BRÛ", bleed: "SGN", chill: "GIV", dodge: "ESQ", mist: "BRM" };
    const COL: Record<string, string> = { poison: "#7ae87a", stun: "#ffd84a", burn: "#ff7a3a", bleed: "#ff4a6a", chill: "#7ad4ff", dodge: "#8fd4ff", mist: "#8fd4ff" };
    g.font = `bold 9px ${FONT}`;
    let cx = x;
    for (const s of statuses) {
      if (s.turns <= 0) continue;
      const col = COL[s.kind] ?? "#c8c0d4";
      const label = (AB[s.kind] ?? "?") + (s.power ? " " + s.power : "");
      const w = g.measureText(label).width + 12;
      const bx = dir < 0 ? cx - w : cx;
      g.fillStyle = "rgba(8,6,14,.92)"; g.beginPath(); g.roundRect(bx, y, w, 15, 4); g.fill();
      g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.roundRect(bx, y, w, 15, 4); g.stroke();
      textShadow(g, label, bx + w / 2, y + 8, 9, col, "center");
      cx += dir * (w + 4);
    }
  }

  // Consommables de l'inventaire, groupés par type
  private consumables(): { id: string; name: string; count: number }[] {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const it of G.ctx.player.inventory) {
      if (!it.consumable) continue;
      const cur = map.get(it.id);
      if (cur) cur.count++;
      else map.set(it.id, { id: it.id, name: it.name, count: 1 });
    }
    return [...map.values()];
  }

  // Position du héros sur le champ de bataille (il fait face à l'ennemi)
  private get heroX() { return HX + this.heroLunge * 130; }
  private get heroY() { return HY - this.heroLunge * 105; }

  update(dt: number) {
    // Hitstop : le monde entier se fige un battement à l'impact
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.t += dt;
    this.heroLunge = Math.max(0, this.heroLunge - dt * 4.5);
    this.enemyLunge = Math.max(0, this.enemyLunge - dt * 4.5);
    this.allyLunge = Math.max(0, this.allyLunge - dt * 4.5);
    this.allyFlash = Math.max(0, this.allyFlash - dt * 4);
    // aura du Panthéon : les rangs S font irradier le héros d'or, ici aussi
    if (epicSCount() > 0 && Math.random() < dt * (3 + epicSCount() * 2))
      this.particles.spawn({ x: this.heroX + (Math.random() - 0.5) * 40, y: this.heroY + (Math.random() - 0.5) * 40, vx: (Math.random() - 0.5) * 8, vy: -14 - Math.random() * 12, life: 0.9, maxLife: 0.9, size: 1.6, color: "#ffd84a", glow: true });
    this.ambient.update(dt);
    this.heroCast = Math.max(0, this.heroCast - dt * 2.6);
    this.enemyCast = Math.max(0, this.enemyCast - dt * 2.6);
    this.flashTint = Math.max(0, this.flashTint - dt * 5);
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      this.slashes[i].life -= dt;
      if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt; r.r += (r.maxR - r.r) * dt * 10;
      if (r.life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      this.ghosts[i].life -= dt * 4;
      if (this.ghosts[i].life <= 0) this.ghosts.splice(i, 1);
    }
    // traînée du héros pendant un lunge
    if (this.heroLunge > 0.1 && Math.random() < dt * 40)
      this.ghosts.push({ x: this.heroX, y: this.heroY, life: 1, flip: false, size: 96 });
    // Braises sombres montant autour des boss / mini-boss : présence oppressante
    const rank = this.enemy.rank;
    if (rank !== MonsterRank.Normal && !this.enemy.isDead) {
      const rate = rank === MonsterRank.Boss ? 16 : 8;
      if (Math.random() < dt * rate) {
        const boss = rank === MonsterRank.Boss;
        this.particles.spawn({
          x: EX + (Math.random() - 0.5) * (boss ? 230 : 170),
          y: EY + 60 + Math.random() * 40,
          vx: (Math.random() - 0.5) * 14,
          vy: -18 - Math.random() * 26,
          life: 1.6 + Math.random() * 1.4, maxLife: 3,
          size: 1.5 + Math.random() * 2,
          color: boss
            ? (Math.random() < 0.6 ? "#c02840" : "#5a1830")
            : (Math.random() < 0.6 ? "#8a5fd0" : "#3a2258"),
          glow: true,
        });
      }
    }
    this.particles.update(dt);
    this.enemyShake = Math.max(0, this.enemyShake - dt * 3);
    this.screenShake = Math.max(0, this.screenShake - dt * 3);
    this.enemyFlash = Math.max(0, this.enemyFlash - dt * 4);
    this.playerFlash = Math.max(0, this.playerFlash - dt * 4);
    this.phase2Banner = Math.max(0, this.phase2Banner - dt);
    this.abilityBanner = Math.max(0, this.abilityBanner - dt);
    this.logReveal += dt * 30;
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt; f.y -= dt * 42;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
    this.shownEnemyHp = lerp(this.shownEnemyHp, Math.max(0, this.enemy.hp), clamp(dt * 8, 0, 1));
    this.shownPlayerHp = lerp(this.shownPlayerHp, Math.max(0, G.ctx.player.hp), clamp(dt * 8, 0, 1));
    if (this.session.ally) this.shownAllyHp = lerp(this.shownAllyHp, Math.max(0, this.session.ally.hp), clamp(dt * 8, 0, 1));

    switch (this.state) {
      case "intro":
        if (Input.consume("confirm")) this.t = Math.max(this.t, INTRO_DUR);
        if (this.t >= INTRO_DUR) { this.state = "input"; Input.clear(); }
        break;

      case "input": {
        // Sous-menu Techniques : navigation prioritaire
        if (this.skillMenu) {
          const kit = this.kit();
          if (Input.consume("cancel") || kit.length === 0) { this.skillMenu = false; Audio.sfx("back"); Input.clear(); break; }
          if (Input.consume("up")) { this.skillSel = (this.skillSel + kit.length - 1) % kit.length; Audio.sfx("ui"); }
          if (Input.consume("down")) { this.skillSel = (this.skillSel + 1) % kit.length; Audio.sfx("ui"); }
          if (Input.consume("confirm")) {
            const sk = kit[Math.min(this.skillSel, kit.length - 1)];
            if (this.session.energy < sk.cost) { Audio.sfx("locked"); break; }
            this.skillMenu = false;
            Audio.sfx("confirm");
            this.abilityBanner = 1.1; this.abilityBannerName = T(sk.nameKey); this.abilityBannerColor = sk.color;
            this.playRound("skill", sk.id);
          }
          break;
        }
        // Sous-menu Objet : navigation prioritaire
        if (this.itemMenu) {
          const list = this.consumables();
          if (Input.consume("cancel") || list.length === 0) { this.itemMenu = false; Audio.sfx("back"); Input.clear(); break; }
          if (Input.consume("up")) { this.itemSel = (this.itemSel + list.length - 1) % list.length; Audio.sfx("ui"); }
          if (Input.consume("down")) { this.itemSel = (this.itemSel + 1) % list.length; Audio.sfx("ui"); }
          if (Input.consume("confirm")) {
            const it = list[Math.min(this.itemSel, list.length - 1)];
            this.itemMenu = false;
            Audio.sfx("confirm");
            this.playRound("item", it.id);
          }
          break;
        }
        const n = this.actions.length;
        if (Input.consume("left") || Input.consume("up")) { this.sel = (this.sel + n - 1) % n; Audio.sfx("ui"); }
        if (Input.consume("right") || Input.consume("down")) { this.sel = (this.sel + 1) % n; Audio.sfx("ui"); }
        let chosen: number = -1;
        if (Input.consume("act1")) chosen = 0;
        if (Input.consume("act2")) chosen = 1;
        if (Input.consume("act3")) chosen = 2;
        if (Input.consume("act4")) chosen = 3;
        if (Input.consume("act5")) chosen = 4;
        if (Input.consume("act6")) chosen = 5;
        if (Input.consume("confirm")) chosen = this.sel;
        if (chosen >= 0) {
          const a = this.actions[chosen];
          if (!a.enabled) { Audio.sfx("locked"); break; }
          this.sel = chosen;
          if (a.id === "item") { this.itemMenu = true; this.itemSel = 0; Audio.sfx("ui"); break; }
          if (a.id === "skill") { this.skillMenu = true; this.skillSel = 0; Audio.sfx("ui"); break; }
          this.playRound(a.id);
        }
        break;
      }

      case "anim": {
        this.animT += dt;
        while (this.steps.length && this.steps[0].at <= this.animT) {
          this.steps.shift()!.fn();
        }
        if (!this.steps.length) {
          this.state = this.session.over ? "done" : "input";
          if (this.state === "done") Input.clear();
        }
        break;
      }

      case "done":
        if (Input.consume("confirm")) {
          Audio.sfx("confirm");
          this.resolveOutcome();
        }
        break;
    }
  }

  // Progression du slide-in d'intro (0 = hors écran, 1 = en place), avec easing
  private introSlide(): number {
    if (this.state !== "intro") return 1;
    const p = clamp((this.t - 0.35) / 0.6, 0, 1);
    return 1 - Math.pow(1 - p, 3);
  }

  private playRound(action: CombatActionId, itemId?: string) {
    this.session.playTurn(action, itemId);
    const events = this.session.drainEvents();
    this.steps = [];
    this.animT = 0;
    let at = 0.12;
    const ex = EX, ey = EY;      // centre ennemi (haut-droite)
    const hx = HX, hy = HY;      // héros au sol (bas-gauche)
    const pop = (x: number, y: number, txt: string, color: string, size: number, life = 1.1) =>
      this.floaters.push({ x, y, text: txt, color, life, maxLife: life, size });
    const slashAt = (x: number, y: number, color = "#fff") =>
      this.slashes.push({ x, y, angle: -0.6 + Math.random() * 1.2, life: 0.22, color });
    const ringAt = (x: number, y: number, maxR: number, color: string) =>
      this.rings.push({ x, y, r: 8, maxR, life: 0.4, color });
    for (const e of events) {
      const fn = () => {
        switch (e.type) {
          case "playerHit":
            Audio.sfx("hit");
            this.heroLunge = 1; this.hitstop = 0.05;
            this.enemyShake = 1; this.enemyFlash = 1;
            slashAt(ex, ey);
            this.particles.burst(ex, ey, "#ff7050", 14, 130, 0.6, 3.5);
            pop(ex + (Math.random() - 0.5) * 40, ey - 50, "-" + e.value, "#fff", 26);
            break;
          case "playerCrit":
            Audio.sfx("crit");
            this.heroLunge = 1; this.hitstop = 0.11;
            this.enemyShake = 1.6; this.enemyFlash = 1; this.screenShake = 0.9;
            this.flashTint = 0.35; this.flashColor = "#ffd84a";
            slashAt(ex, ey, "#ffd84a"); slashAt(ex + 12, ey + 8, "#fff");
            ringAt(ex, ey, 90, "#ffd84a");
            this.particles.burst(ex, ey, "#ffd84a", 26, 190, 0.8, 4, true);
            pop(ex, ey - 60, "CRIT -" + e.value, "#ffd84a", 34, 1.3);
            break;
          case "echoHit":
            Audio.sfx("echo");
            this.heroLunge = 0.7; this.hitstop = 0.04;
            this.enemyShake = 0.8; this.enemyFlash = 0.7;
            slashAt(ex - 10, ey + 6, "#ffe14a");
            pop(ex + 30, ey - 34, "ÉCHO -" + e.value, "#ffe14a", 20);
            break;
          case "thunder":
            Audio.sfx("chain");
            this.enemyFlash = 1; this.screenShake = 0.5;
            this.flashTint = 0.22; this.flashColor = "#ffe14a";
            // éclair vertical
            this.particles.burst(ex, ey - 60, "#ffe14a", 18, 160, 0.5, 3, true);
            pop(ex - 30, ey - 76, "⚡-" + e.value, "#ffe14a", 24);
            break;
          case "combustion":
            Audio.sfx("burn");
            this.enemyShake = 1.2;
            ringAt(ex, ey, 70, "#ff7a3a");
            this.particles.burst(ex, ey, "#ff7a3a", 24, 160, 0.7, 3.6, true);
            pop(ex + 26, ey - 44, "-" + e.value, "#ff7a3a", 24);
            break;
          case "burn":
            if (e.value) {
              this.particles.burst(ex, ey + 20, "#ff7a3a", 10, 60, 0.6, 2.6, true);
              pop(ex - 34, ey - 30, "-" + e.value, "#ff7a3a", 19);
            } else this.particles.burst(ex, ey + 26, "#ff7a3a", 6, 40, 0.45, 2.2, true);
            break;
          case "bleed":
            if (e.value) {
              this.particles.burst(ex, ey + 24, "#ff4a6a", 10, 70, 0.6, 2.6);
              pop(ex + 40, ey - 26, "-" + e.value, "#ff4a6a", 19);
            } else this.particles.burst(ex, ey + 30, "#ff4a6a", 5, 44, 0.4, 2.2);
            break;
          case "chill":
            this.particles.burst(ex, ey, "#7ad4ff", 8, 60, 0.6, 2.4, true);
            if (e.value) pop(ex + 48, ey - 12, "❄" + e.value, "#7ad4ff", 17, 0.8);
            break;
          case "freeze":
            Audio.sfx("freeze");
            this.enemyFlash = 0.8; this.hitstop = 0.06;
            ringAt(ex, ey, 80, "#7ad4ff");
            this.particles.burst(ex, ey, "#bfeaff", 22, 120, 0.9, 3.2, true);
            pop(ex, ey - 66, T("combat.pop.frozen"), "#7ad4ff", 24);
            break;
          case "thorns":
            this.playerFlash = 0.7;
            this.particles.burst(hx, hy, "#c8873a", 12, 90, 0.6, 2.8);
            pop(hx, hy - 60, "-" + e.value, "#c8873a", 20);
            break;
          case "resonance":
            ringAt(ex, ey, 120, "#fff");
            break;
          case "skillHit": {
            this.heroCast = 0.7; // emphase sur le héros qui lance une technique
            // coup de compétence non-signature : gerbe teintée de la couleur de la compétence
            const col = e.variant ?? "#c8c0d4";
            Audio.sfx("hit");
            this.heroLunge = 1; this.hitstop = 0.06;
            this.enemyShake = 1.3; this.enemyFlash = 1; this.screenShake = 0.5;
            slashAt(ex, ey, col);
            ringAt(ex, ey, 84, col);
            this.particles.burst(ex, ey, col, 22, 170, 0.8, 3.8, true);
            if (e.value) pop(ex, ey - 56, "-" + e.value, col, 28, 1.2);
            break;
          }
          case "armorBreak":
            Audio.sfx("crit");
            this.enemyShake = 1.4; this.enemyFlash = 1; this.hitstop = 0.05;
            ringAt(ex, ey, 88, "#d0d0d8");
            this.particles.burst(ex, ey, "#d0d0d8", 18, 150, 0.7, 3.4);
            pop(ex, ey - 40, T("combat.pop.armorbreak", { n: e.value }), "#d0d0d8", 20, 1.2);
            break;
          case "heal":
            Audio.sfx("heal");
            this.playerFlash = 0.6;
            this.particles.burst(hx, hy, "#7ae87a", 16, 80, 0.9, 3, true);
            pop(hx, hy - 66, "+" + e.value, "#7ae87a", 24);
            break;
          case "dodgeUp":
            Audio.sfx("dodge");
            this.particles.burst(hx, hy, "#8fd4ff", 12, 70, 0.7, 3, true);
            break;
          case "enemyHit":
            Audio.sfx("hurt");
            this.enemyLunge = 1; this.hitstop = 0.05;
            this.screenShake = 1; this.playerFlash = 1;
            pop(hx + (Math.random() - 0.5) * 40, hy - 56, "-" + e.value, "#ff6060", 26);
            break;
          case "playerDodge":
            Audio.sfx("dodge");
            this.enemyLunge = 0.8;
            pop(hx, hy - 56, "MISS", "#8fd4ff", 22, 1);
            break;
          case "fleeOk": Audio.sfx("flee"); break;
          case "fleeFail": Audio.sfx("locked"); this.screenShake = 0.4; break;
          case "enemyCharge":
            if (e.variant === "mob.superboss") {
              // DÉVOREUR D'ÂME : l'Abîme aspire tout vers lui avant de frapper.
              Audio.sfx("roar");
              this.enemyFlash = 0.8; this.screenShake = 0.7;
              this.flashTint = 0.22; this.flashColor = "#3a0810";
              ringAt(ex, ey, 150, "#c0203a"); ringAt(ex, ey, 200, "#7a1020");
              this.particles.burst(ex, ey, "#c0203a", 30, -170, 1.1, 3.6, true); // aspiration
              this.particles.burst(ex, ey, "#3a0810", 18, -120, 1, 3, true);
              pop(ex, ey - 74, T("combat.pop.charging"), "#ff6a7a", 24, 1.5);
            } else {
              Audio.sfx("charge");
              this.enemyFlash = 0.6;
              ringAt(ex, ey, 100, "#ff5060");
              this.particles.burst(ex, ey, "#ff5060", 18, -120, 0.8, 3, true); // implosion visuelle
              pop(ex, ey - 70, T("combat.pop.charging"), "#ff9090", 24, 1.4);
            }
            break;
          case "enemyGuard":
            if ((e.variant ?? "").startsWith("mob.warden")) {
              // GARDIEN : garde de pierre runique.
              Audio.sfx("warden");
              this.enemyFlash = 0.7;
              ringAt(ex, ey, 70, "#8a5fd0"); ringAt(ex, ey, 46, "#c8b0e0");
              this.particles.burst(ex, ey, "#8a5fd0", 16, 90, 0.7, 3, true);
            } else {
              Audio.sfx("dodge");
              ringAt(ex, ey, 60, "#8fd4ff");
              this.particles.burst(ex, ey, "#8fd4ff", 16, 100, 0.7, 3, true);
            }
            break;
          case "enemyLeech":
            Audio.sfx("hurt");
            this.enemyLunge = 1; this.hitstop = 0.05;
            this.screenShake = 1.2; this.playerFlash = 1;
            this.particles.burst(hx, hy, "#c060ff", 20, 140, 0.9, 3.4, true);
            pop(hx, hy - 60, "-" + e.value, "#c060ff", 26);
            break;
          case "phase2":
            Audio.sfx("phase2");
            this.phase2Banner = 2.2;
            this.screenShake = 1.6;
            this.hitstop = 0.14;
            this.flashTint = 0.5; this.flashColor = "#c02840";
            ringAt(ex, ey, 220, "#ff3050");
            this.particles.burst(ex, ey, "#c02840", 40, 220, 1.2, 4.5, true);
            break;
          case "enemyDead":
            Audio.sfx("die");
            this.hitstop = 0.12;
            this.screenShake = 0.8;
            this.flashTint = 0.3; this.flashColor = "#fff";
            ringAt(ex, ey, 160, "#fff");
            this.particles.burst(ex, ey, "#c8c0d4", 34, 170, 1.1, 4);
            this.particles.burst(ex, ey, "#ffd84a", 20, 120, 1.3, 3, true);
            break;
          case "playerDead":
            Audio.sfx("die");
            this.screenShake = 2;
            break;
          case "levelup":
            Audio.sfx("levelup");
            pop(hx, hy - 90, "LEVEL UP!", "#7ae87a", 26, 1.6);
            break;
          case "reward": Audio.sfx("coin"); break;
          case "classAbility": {
            this.heroCast = 1; // emphase/zoom sur le héros qui lance sa signature
            // Chorégraphie signature propre à chaque classe.
            const showBanner = (name: string, color: string) => {
              this.abilityBanner = 1.1; this.abilityBannerName = name; this.abilityBannerColor = color;
            };
            if (e.variant === "warrior") {
              // BRISE-GARDE : coup lourd et tellurique — hitstop massif, double onde, éclats.
              Audio.sfx("heavy");
              this.heroLunge = 1; this.hitstop = 0.17;
              this.enemyShake = 2.2; this.enemyFlash = 1; this.screenShake = 1.7;
              this.flashTint = 0.4; this.flashColor = "#ffae57";
              slashAt(ex, ey, "#ffd8b0"); slashAt(ex - 12, ey + 12, "#fff");
              ringAt(ex, ey, 135, "#ffae57"); ringAt(ex, ey, 82, "#fff");
              this.particles.burst(ex, ey, "#ffae57", 34, 220, 0.9, 4.6, true);
              this.particles.burst(ex, ey + 22, "#8a6a4a", 18, 130, 0.7, 3.2); // débris
              pop(ex, ey - 62, "-" + e.value, "#ffd8b0", 36, 1.4);
              showBanner(T("act.class.warrior"), "#ffae57");
            } else if (e.variant === "mage") {
              // TRAIT ARCANIQUE : charge implosive puis détonation — flash intense, peu de shake.
              Audio.sfx("chain");
              this.heroLunge = 0.5; this.hitstop = 0.09;
              this.enemyShake = 1.2; this.enemyFlash = 1; this.screenShake = 0.7;
              this.flashTint = 0.46; this.flashColor = "#b6a6ff";
              ringAt(ex, ey, 150, "#c88aff"); ringAt(ex, ey, 110, "#8fb0ff");
              this.particles.burst(ex, ey, "#c88aff", 24, -150, 0.5, 3, true); // implosion (canalisation)
              this.particles.burst(ex, ey, "#8fb0ff", 32, 215, 0.95, 4.2, true); // détonation
              slashAt(ex, ey, "#c8b0ff");
              pop(ex, ey - 62, "-" + e.value, "#c8b0ff", 34, 1.4);
              showBanner(T("act.class.mage"), "#b6a6ff");
            } else {
              // ASSASSINAT (voleur) : flurry de frappes rapides + traînée d'ombres.
              Audio.sfx("crit");
              this.heroLunge = 1; this.hitstop = 0.05;
              this.enemyShake = 1.5; this.enemyFlash = 1; this.screenShake = 0.7;
              this.flashTint = 0.3; this.flashColor = "#ffd84a";
              for (let i = 0; i < 4; i++)
                this.slashes.push({
                  x: ex + (Math.random() - 0.5) * 44, y: ey + (Math.random() - 0.5) * 32,
                  angle: -0.8 + Math.random() * 1.6, life: 0.16 + i * 0.05,
                  color: i % 2 ? "#ff4a6a" : "#ffd84a",
                });
              ringAt(ex, ey, 74, "#ffd84a");
              this.particles.burst(ex, ey, "#ffd84a", 22, 200, 0.7, 3.4, true);
              this.particles.burst(ex, ey, "#ff4a6a", 12, 150, 0.6, 3, true);
              pop(ex, ey - 60, "-" + e.value, "#ffd84a", 32, 1.3);
              showBanner(T("act.class.rogue"), "#ffd84a");
            }
            break;
          }
          case "enemySpecial":
            this.enemyCast = 1; // emphase/zoom sur l'ennemi qui déchaîne sa spéciale
            if (e.variant === "mob.superboss") {
              // DÉVOREUR D'ÂME : la charge s'abat — cataclysme d'ombre.
              Audio.sfx("phase2");
              this.enemyLunge = 1; this.hitstop = 0.16;
              this.screenShake = 2.4; this.playerFlash = 1;
              this.flashTint = 0.5; this.flashColor = "#c0203a";
              ringAt(hx, hy, 150, "#c0203a"); ringAt(hx, hy, 100, "#3a0810");
              this.particles.burst(hx, hy, "#c0203a", 40, 230, 1.2, 4.8, true);
              this.particles.burst(hx, hy, "#3a0810", 20, 150, 1, 3.6);
              pop(hx, hy - 74, "-" + e.value, "#ff5060", 34, 1.4);
              this.abilityBanner = 1.1; this.abilityBannerName = T("boss.move.devourer"); this.abilityBannerColor = "#ff5060";
            } else if (e.variant === "mob.rival") {
              // RIVAL : estoc perforant, lame corrompue.
              Audio.sfx("heavy");
              this.enemyLunge = 1; this.hitstop = 0.11;
              this.screenShake = 1.4; this.playerFlash = 1;
              this.flashTint = 0.34; this.flashColor = "#8a5fd0";
              slashAt(hx, hy, "#c8a8ff"); slashAt(hx + 10, hy - 6, "#e0d0ff");
              ringAt(hx, hy, 96, "#c8a8ff");
              this.particles.burst(hx, hy, "#a87fe0", 26, 200, 0.9, 4, true);
              pop(hx, hy - 70, "-" + e.value, "#c8a8ff", 30, 1.3);
              this.abilityBanner = 1.1; this.abilityBannerName = T("boss.move.rival"); this.abilityBannerColor = "#c8a8ff";
            } else {
              Audio.sfx("heavy");
              this.enemyLunge = 1; this.hitstop = 0.1;
              this.screenShake = 1.8; this.playerFlash = 1;
              this.flashTint = 0.32; this.flashColor = "#c02840";
              ringAt(hx, hy, 110, "#ff5060");
              this.particles.burst(hx, hy, "#c02840", 28, 190, 1, 4.2, true);
              pop(hx, hy - 70, "-" + e.value, "#ff5060", 30, 1.3);
            }
            break;
          case "enemyBuff":
            if ((e.variant ?? "").startsWith("mob.warden")) {
              // GARDIEN DES SCEAUX : il se scelle dans la pierre runique.
              Audio.sfx("warden");
              this.enemyFlash = 1; this.screenShake = 0.6; this.hitstop = 0.05;
              ringAt(ex, ey, 120, "#8a5fd0"); ringAt(ex, ey, 78, "#c8b0e0");
              this.particles.burst(ex, ey + 10, "#8a5fd0", 26, -110, 0.9, 3.6, true); // pierre qui converge
              this.particles.burst(ex, ey, "#c8b0e0", 16, 90, 0.7, 3, true);
              this.abilityBanner = 1.1; this.abilityBannerName = T("boss.move.warden"); this.abilityBannerColor = "#c8a8ff";
            } else {
              Audio.sfx("dodge");
              this.particles.burst(ex, ey, "#8fd4ff", 20, 130, 0.8, 3.5, true);
            }
            break;
          case "itemUse":
            Audio.sfx("crit");
            this.enemyShake = 1.4; this.enemyFlash = 1; this.screenShake = 0.8; this.hitstop = 0.06;
            ringAt(ex, ey, 90, "#ff9d2e");
            this.particles.burst(ex, ey, "#ff9d2e", 26, 180, 0.9, 4, true);
            if (e.value) pop(ex, ey - 55, "-" + e.value, "#ff9d2e", 28, 1.2);
            break;
          case "poisonEnemy":
            this.particles.burst(ex, ey, "#7ae87a", 10, 70, 0.6, 2.5, true);
            pop(ex, ey - 40, "-" + e.value, "#7ae87a", 20, 1);
            break;
          case "poisonPlayer":
            this.playerFlash = 0.5;
            pop(hx, hy - 56, "-" + e.value, "#7ae87a", 20, 1);
            break;
          case "stunEnemy":
            Audio.sfx("dodge");
            pop(ex, ey - 50, T("status.stun").toUpperCase() + " !", "#ffd84a", 22);
            break;
          case "stunPlayer":
            Audio.sfx("hurt");
            pop(hx, hy - 66, T("status.stun").toUpperCase() + " !", "#ffd84a", 22);
            break;
          // ---- allié (Rival) ----
          case "allyHit":
            Audio.sfx("hit");
            this.allyLunge = 1; this.hitstop = 0.03;
            this.enemyShake = Math.max(this.enemyShake, 0.9); this.enemyFlash = 1;
            slashAt(ex - 8, ey + 10, "#c8a8ff");
            this.particles.burst(ex, ey, "#a87fe0", 12, 120, 0.6, 3, true);
            if (e.value) pop(ex - 24, ey - 40, "-" + e.value, "#c8a8ff", 22);
            break;
          case "allyCover":
            Audio.sfx("dodge");
            this.allyFlash = 1;
            ringAt(150, 345, 60, "#8a5fd0");
            this.particles.burst(150, 345, "#8a5fd0", 14, 90, 0.7, 3, true);
            if (e.value) pop(150, 300, "🛡 -" + e.value, "#c8a8ff", 18);
            break;
          case "allyFall":
            Audio.sfx("hurt");
            this.screenShake = Math.max(this.screenShake, 0.6);
            this.particles.burst(150, 345, "#6a5a80", 22, 130, 0.9, 3.5);
            pop(150, 300, T("combat.ally.down").toUpperCase(), "#b0a8c0", 18, 1.4);
            break;
        }
      };
      this.steps.push({ at, fn });
      at += e.type === "phase2" ? 1.6
        : e.type === "enemyDead" || e.type === "enemySpecial" || e.type === "enemyCharge" || e.type === "allyFall" ? 0.8
        : e.type === "burn" || e.type === "bleed" || e.type === "chill" ? 0.25
        : 0.55;
    }
    this.state = "anim";
    this.logReveal = 0;
  }

  private resolveOutcome() {
    const s = this.session;
    if (s.player.isDead) {
      if (G.ctx.endless) Flow.runSummary(); else Flow.endScreen(false);
      return;
    }
    // Descente Infinie : victoire/fuite → retour à l'exploration.
    // La progression (sortie d'étage de boss, draft de relique) est gérée côté exploration.
    if (G.ctx.endless) { Flow.toExplore(); return; }
    // Arène : victoire → combat suivant de la vague, ou récompense ; fuite → abandon
    if (G.ctx.arenaActive) {
      if (s.victory) {
        const next = G.ctx.nextArenaFight();
        if (next) { Flow.startCombat(next); return; }
        G.ctx.finishArenaWave();
      } else {
        G.ctx.abortArena();
      }
      saveGame(G.ctx);
      Flow.toExplore();
      return;
    }
    // Le Rival vaincu dans les Profondeurs : LE VERDICT. Tu décides de son sort — épargner
    // (briser la Boucle) ou l'achever (la perpétuer). Ce choix pèse sur la fin.
    if (s.victory && this.enemy.nameKey === "mob.rival") {
      if (G.ctx.currentLevel === 5) {
        Flow.creedChoice("rival_fate", () => { saveGame(G.ctx); Flow.toExplore(); });
        return;
      }
      saveGame(G.ctx); // ombre du Rival (arène) : pas de verdict
      Flow.toExplore();
      return;
    }
    if (s.victory && this.enemy.rank === MonsterRank.Boss) {
      // LE RÉGICIDE : le Roi de l'Abîme tombe — mini-film du coup fatal (signé par ta classe),
      // puis la suite normale (portail des Profondeurs ou écran de victoire).
      if (this.enemy.nameKey === "mob.boss") {
        const after = () => {
          if (G.ctx.currentLevel === 4 && G.ctx.player.inventory.some(i => i.id === "AbyssKey")) {
            G.ctx.openAbyssPortal();
            saveGame(G.ctx);
            Flow.toExplore();
          } else {
            Flow.endScreen(true);
          }
        };
        SceneManager.switchTo(() => new FilmScene(regicideFilmShots(G.ctx.player.classId, G.ctx.oath < 0), after));
        Audio.setMode("none");
        return;
      }
      // Le Dévoreur d'Âmes vaincu : la Boucle est entre tes mains. Ta fin dépend du Serment tenu.
      if (G.ctx.currentLevel === 5) { Flow.campaignEnding(G.ctx.decideEnding()); return; }
      Flow.endScreen(true);
      return;
    }
    saveGame(G.ctx);
    Flow.toExplore();
  }

  draw(g: CanvasRenderingContext2D) {
    const boss = this.enemy.rank === MonsterRank.Boss;
    const mini = this.enemy.rank === MonsterRank.MiniBoss;

    // secousse écran
    g.save();
    if (this.screenShake > 0) {
      g.translate((Math.random() - 0.5) * this.screenShake * 10, (Math.random() - 0.5) * this.screenShake * 10);
    }

    // fond
    const grad = g.createLinearGradient(0, 0, 0, VH);
    if (boss) { grad.addColorStop(0, "#1a0710"); grad.addColorStop(0.6, "#2a0c14"); grad.addColorStop(1, "#120508"); }
    else if (mini) { grad.addColorStop(0, "#140a20"); grad.addColorStop(1, "#1e1030"); }
    else { grad.addColorStop(0, "#0e0b18"); grad.addColorStop(1, "#1a1524"); }
    g.fillStyle = grad;
    g.fillRect(-12, -12, VW + 24, VH + 24);

    // ---- Parallaxe : colonnes fantômes qui dérivent (profondeur du théâtre) ----
    g.save();
    const pilCol = boss ? "rgba(120,30,45,.12)" : mini ? "rgba(90,60,140,.12)" : "rgba(90,80,120,.10)";
    for (let i = 0; i < 5; i++) {
      const px2 = ((i * 230 + this.t * (6 + i * 2)) % (VW + 160)) - 80;
      const pw2 = 46 + (i % 3) * 18;
      g.fillStyle = pilCol;
      g.fillRect(px2, 30, pw2, VH - 140);
      g.fillRect(px2 - 8, 30, pw2 + 16, 18);
    }
    // nappes de brume au sol
    g.globalAlpha = 0.08;
    for (let i = 0; i < 2; i++) {
      const fy = 330 + i * 60 + Math.sin(this.t * 0.5 + i * 2) * 10;
      const fgrad = g.createLinearGradient(0, fy - 40, 0, fy + 40);
      fgrad.addColorStop(0, "rgba(150,140,180,0)");
      fgrad.addColorStop(0.5, "rgba(150,140,180,1)");
      fgrad.addColorStop(1, "rgba(150,140,180,0)");
      g.fillStyle = fgrad;
      g.fillRect(0, fy - 40, VW, 80);
    }
    g.restore();

    // sols d'arène : deux plateformes en diagonale (ennemi haut-droite, équipe bas-gauche)
    g.fillStyle = "rgba(255,255,255,.04)";
    g.beginPath(); g.ellipse(EX, EY + 82, 220, 52, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(340, 462, 230, 48, 0, 0, Math.PI * 2); g.fill();

    // vignette
    const v = g.createRadialGradient(VW / 2, VH / 2, VH * 0.25, VW / 2, VH / 2, VH * 0.9);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,.65)");
    g.fillStyle = v; g.fillRect(-12, -12, VW + 24, VH + 24);

    // ===== ambiance : brouillard + cendres, derrière les sprites et l'UI =====
    this.ambient.draw(g);

    // ===== ennemi ===== (glisse depuis la droite pendant l'intro ; se rue en attaquant)
    const slide = this.introSlide();
    const lungeX = -this.enemyLunge * this.enemyLunge * 190; // il plonge en diagonale vers l'équipe
    const lungeY = this.enemyLunge * this.enemyLunge * 120;
    const ex = EX + (1 - slide) * (VW / 2 + 220) + lungeX, ey = EY + lungeY;
    const size = Math.round((boss ? 190 : mini ? 150 : 120) * (1 + this.enemyCast * 0.14));
    const bob = Math.sin(this.t * (boss ? 1.6 : 2.6)) * 6;
    const shakeX = this.enemyShake > 0 ? (Math.random() - 0.5) * this.enemyShake * 14 : 0;
    const spr = getSprite(this.enemy.sprite + (Math.floor(this.t * 3) % 2 && getSprite(this.enemy.sprite + "_2") ? "_2" : ""));

    // estrade de l'ennemi (halo de sol) + ombre — deux plateformes distinctes façon Pokémon
    if (slide >= 0.6) {
      g.save();
      const esx = EX, esy = EY + size / 2 + 6;
      const est = g.createRadialGradient(esx, esy, 16, esx, esy, size * 1.5);
      est.addColorStop(0, "rgba(120,110,150,.14)"); est.addColorStop(1, "rgba(120,110,150,0)");
      g.fillStyle = est;
      g.beginPath(); g.ellipse(esx, esy, size * 1.5, size * 0.34, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    // ombre
    g.fillStyle = "rgba(0,0,0,.5)";
    g.beginPath(); g.ellipse(ex, ey + size / 2 + 8, size * 0.36, size * 0.1, 0, 0, Math.PI * 2); g.fill();

    if (!this.session.victory || this.enemy.hp > 0 || this.shownEnemyHp > 0.5) {
      g.save();
      g.imageSmoothingEnabled = false;
      if (boss) { g.shadowColor = "#ff3040"; g.shadowBlur = 34 + Math.sin(this.t * 2.6) * 14; }
      else if (mini) { g.shadowColor = "#8a5fd0"; g.shadowBlur = 26 + Math.sin(this.t * 2.2) * 10; }
      const dying = this.enemy.isDead;
      if (dying) g.globalAlpha = clamp(this.shownEnemyHp / 8, 0, 1);
      if (spr) g.drawImage(spr, ex - size / 2 + shakeX, ey - size / 2 + bob, size, size);
      if (this.enemyFlash > 0 && spr) {
        g.globalAlpha = this.enemyFlash * 0.7;
        g.globalCompositeOperation = "lighter";
        g.drawImage(spr, ex - size / 2 + shakeX, ey - size / 2 + bob, size, size);
        g.globalCompositeOperation = "source-over";
      }
      g.restore();
    }

    // barre PV ennemi (fixe : ne suit pas les lunges) — bandeau haut-droite, au-dessus de lui
    const exBar = EX + (1 - slide) * (VW / 2 + 220);
    const bw = boss ? 420 : 320;
    const ehr = clamp(this.shownEnemyHp / this.enemy.maxHp, 0, 1);
    const epLeft = exBar - bw / 2 - 4, epW = bw + 8, epSk = 12;
    g.fillStyle = "rgba(8,6,14,.84)";
    this.slantRect(g, epLeft, 40, epW, 42, epSk); g.fill();
    // bordure + portrait + badge de rang (bandeau incliné, symétrique du panneau joueur)
    g.strokeStyle = boss ? "rgba(255,80,90,.55)" : mini ? "rgba(150,120,220,.55)" : "rgba(140,130,170,.45)";
    g.lineWidth = 2;
    this.slantRect(g, epLeft, 40, epW, 42, epSk); g.stroke();
    const eface = getSprite(this.enemy.sprite);
    if (eface) { g.imageSmoothingEnabled = false; g.drawImage(eface, epLeft + 10, 43, 36, 36); }
    textShadow(g, this.enemy.name + (this.session.phase2 ? "  —  " + T("combat.phase2.title") : ""),
      exBar + 16, 54, boss ? 17 : 15, boss ? "#ff9090" : mini ? "#c8a8ff" : "#e8e0f0", "center");
    if (boss || mini) {
      const badge = boss ? T("rank.boss") : T("rank.elite");
      const bcol = boss ? "#ff6070" : "#c8a8ff";
      g.font = `bold 9px ${FONT}`;
      const rbw = g.measureText(badge).width + 12, rbx = epLeft + epW - epSk - rbw - 2;
      g.fillStyle = "rgba(8,6,14,.92)"; g.beginPath(); g.roundRect(rbx, 44, rbw, 14, 4); g.fill();
      g.strokeStyle = bcol; g.lineWidth = 1; g.beginPath(); g.roundRect(rbx, 44, rbw, 14, 4); g.stroke();
      textShadow(g, badge, rbx + rbw / 2, 51, 9, bcol, "center");
    }
    // barre de PV décalée à droite du portrait (elle ne le recouvre plus)
    const ebX = epLeft + 54, ebW = epW - 68;
    g.fillStyle = "#25141c";
    g.beginPath(); g.roundRect(ebX, 66, ebW, 10, 4); g.fill();
    const ehGrad = g.createLinearGradient(ebX, 0, ebX + ebW, 0);
    ehGrad.addColorStop(0, boss ? "#c02040" : "#b83a3a");
    ehGrad.addColorStop(1, boss ? "#ff5060" : "#e06848");
    g.fillStyle = ehGrad;
    g.beginPath(); g.roundRect(ebX, 66, ebW * ehr, 10, 4); g.fill();

    // ===== INTENT : l'ennemi annonce son prochain coup =====
    if (!this.enemy.isDead && this.state !== "done" && slide >= 1) {
      const it = this.session.intent;
      const icon = INTENT_ICON[it.kind];
      let label = T(it.labelKey);
      if (it.kind === "attack" || it.kind === "heavy" || it.kind === "leech" || it.kind === "venom" || it.kind === "pierce") {
        const est = Math.max(1, Math.round(this.enemy.effectiveAttack * it.mult + (it.flat ?? 0)));
        label += ` ~${est}`;
      }
      g.font = `bold 13px ${FONT}`;
      const tw2 = g.measureText(icon + "  " + label).width + 30;
      const iy = 92;
      const danger = it.kind === "heavy" || it.kind === "charge" || it.kind === "pierce";
      const pulse2 = danger ? 0.75 + Math.sin(this.t * 6) * 0.25 : 1;
      g.globalAlpha = pulse2;
      g.fillStyle = danger ? "rgba(120,20,30,.88)" : "rgba(20,16,34,.85)";
      g.beginPath(); g.roundRect(exBar - tw2 / 2, iy - 12, tw2, 24, 12); g.fill();
      g.strokeStyle = danger ? "#ff6070" : "rgba(150,140,190,.5)";
      g.lineWidth = 1.4;
      g.beginPath(); g.roundRect(exBar - tw2 / 2, iy - 12, tw2, 24, 12); g.stroke();
      textShadow(g, icon + "  " + label, exBar, iy + 1, 13, danger ? "#ffd0d0" : "#c8d4e8", "center");
      g.globalAlpha = 1;
    }

    // (pas d'estrade côté équipe : seules les ombres individuelles posent les persos ;
    //  l'estrade lumineuse est réservée à l'ennemi)

    // ===== héros sur le champ de bataille (traînées + lunge + emphase au lancer) =====
    {
      const hsz = Math.round(124 * (1 + this.heroCast * 0.16)); // +15% : le héros a plus de présence
      for (const gh of this.ghosts) {
        const hspr = getSprite("player");
        if (!hspr) break;
        g.save();
        g.imageSmoothingEnabled = false;
        g.globalAlpha = gh.life * 0.25;
        g.drawImage(hspr, gh.x - gh.size / 2, gh.y - gh.size / 2, gh.size, gh.size);
        g.restore();
      }
      const hspr = getSprite("player");
      if (hspr) {
        const hx2 = this.heroX, hy2 = this.heroY + Math.sin(this.t * 2.6) * 3;
        g.fillStyle = "rgba(0,0,0,.45)";
        g.beginPath(); g.ellipse(hx2, this.heroY + hsz / 2 - 2, hsz * 0.3, hsz * 0.09, 0, 0, Math.PI * 2); g.fill();
        g.save();
        g.imageSmoothingEnabled = false;
        if (this.playerFlash > 0) { g.shadowColor = "#ff4040"; g.shadowBlur = 20 * this.playerFlash; }
        const introOff = (1 - slide) * -360;
        g.drawImage(hspr, hx2 - hsz / 2 + introOff, hy2 - hsz / 2, hsz, hsz);
        g.restore();
      }
    }

    // ===== Allié (Rival 2v1 OU compagnon de quête) : se tient en retrait, se rue en frappant =====
    if (this.session.ally) {
      const a = this.session.ally;
      const asz = 92;
      const ax = this.allyX, ay = this.allyY + Math.sin(this.t * 2.4 + 1) * 3;
      const aspr = getSprite(a.sprite) ?? getSprite("rival"); // vrai sprite de l'allié (Bram = Bram, etc.)
      const down = !a.alive;
      // ombre
      g.fillStyle = "rgba(0,0,0,.4)";
      g.beginPath(); g.ellipse(this.allyX, this.allyY + asz / 2 - 4, asz * 0.3, asz * 0.09, 0, 0, Math.PI * 2); g.fill();
      if (aspr) {
        g.save();
        g.imageSmoothingEnabled = false;
        const introOff = (1 - slide) * -360;
        if (down) {
          // à terre : couché, grisé, translucide
          g.globalAlpha = 0.4;
          g.translate(ax + introOff, ay); g.rotate(Math.PI / 2);
          g.drawImage(aspr, -asz / 2, -asz / 2, asz, asz);
        } else {
          g.shadowColor = "#8a5fd0"; g.shadowBlur = 10 + Math.sin(this.t * 2) * 4;
          g.drawImage(aspr, ax - asz / 2 + introOff, ay - asz / 2, asz, asz);
          if (this.allyFlash > 0) {
            g.globalAlpha = this.allyFlash * 0.7; g.globalCompositeOperation = "lighter";
            g.drawImage(aspr, ax - asz / 2 + introOff, ay - asz / 2, asz, asz);
          }
        }
        g.restore();
      }
      // (PV de l'allié désormais dans la rangée de portraits d'équipe, en haut à gauche)
      if (down && slide >= 1)
        textShadow(g, T(a.nameKey), this.allyX, this.allyY + asz / 2 + 4, 11, "#8a8098", "center");
    }

    // ===== rangée de portraits d'équipe (haut-gauche) : panneaux inclinés + niveau + statuts =====
    {
      const members: { name: string; sprite: string; hp: number; max: number; col: string; down?: boolean; lvl?: number; statuses?: any[] }[] = [
        { name: T("combat.you"), sprite: "player", hp: this.shownPlayerHp, max: G.ctx.player.maxHp, col: "#e06848", lvl: G.ctx.player.level, statuses: G.ctx.player.statuses },
      ];
      if (this.session.ally) {
        const a = this.session.ally;
        members.push({ name: T(a.nameKey), sprite: a.sprite, hp: this.shownAllyHp, max: a.maxHp, col: "#7a4fc0", down: !a.alive });
      }
      const cw = 236, gap = 7, sk = 11, rx = 14 - (1 - slide) * 300;
      let ry = 14;
      members.forEach((m) => {
        const ch = m.lvl !== undefined ? 58 : 42; // la carte du joueur loge une ligne ATK/CRIT en plus
        g.fillStyle = "rgba(8,6,14,.84)";
        this.slantRect(g, rx, ry, cw, ch, sk); g.fill();
        g.strokeStyle = m.down ? "rgba(90,84,110,.5)" : "rgba(140,130,170,.5)"; g.lineWidth = 1.5;
        this.slantRect(g, rx, ry, cw, ch, sk); g.stroke();
        const spr = getSprite(m.sprite) ?? getSprite("pnj_orin");
        if (spr) { g.save(); g.imageSmoothingEnabled = false; if (m.down) g.globalAlpha = 0.4; g.drawImage(spr, rx + 11, ry + 4, 36, 36); g.restore(); }
        text(g, m.name, rx + 54, ry + 13, 14, m.down ? "#8a8098" : "#e8e0f0");
        if (m.lvl !== undefined) textShadow(g, `Nv.${m.lvl}`, rx + cw - 16, ry + 13, 12, "#bfe0ff", "right");
        const hbw = cw - 70, hbx = rx + 54, hby = ry + 23;
        g.fillStyle = "#25141c"; g.beginPath(); g.roundRect(hbx, hby, hbw, 12, 4); g.fill();
        const hr = clamp(m.hp / m.max, 0, 1);
        g.fillStyle = m.down ? "#4a4458" : hr > 0.3 ? m.col : "#e02222"; g.beginPath(); g.roundRect(hbx, hby, hbw * hr, 12, 4); g.fill();
        textShadow(g, `${Math.max(0, Math.round(m.hp))}/${m.max}`, hbx + hbw / 2, hby + 6, 10, "#fff", "center");
        if (m.lvl !== undefined) {
          const pl = G.ctx.player;
          text(g, `⚔ ${pl.attack}   ✦ ${pl.critChancePercent}%   🛡 ${pl.armor}`, rx + 54, ry + 47, 12, "#b0acc0");
        }
        ry += ch + gap;
      });
      // pastilles sous le roster : statuts du joueur + buffs actifs (esquive, brume)
      if (slide >= 1) {
        const chips = [...G.ctx.player.statuses];
        if (this.session.dodgeTurnsLeft > 0) chips.push({ kind: "dodge", turns: this.session.dodgeTurnsLeft, power: this.session.dodgeTurnsLeft } as any);
        if (this.session.mistTurns > 0) chips.push({ kind: "mist", turns: this.session.mistTurns, power: this.session.mistTurns } as any);
        if (chips.length > 0) this.statusChips(g, chips, rx + 6, ry + 2, 1);
      }
    }

    // ===== journal de combat : boîte compacte à droite, au-dessus du bandeau d'actions =====
    const lw = 312, lh = 108, lx = VW - lw - 14 + (1 - slide) * 340, ly = 338;
    g.fillStyle = "rgba(8,6,14,.78)";
    g.beginPath(); g.roundRect(lx, ly, lw, lh, 10); g.fill();
    g.strokeStyle = "rgba(140,130,170,.3)"; g.lineWidth = 1;
    g.beginPath(); g.roundRect(lx, ly, lw, lh, 10); g.stroke();
    // retour à la ligne des messages longs (les répliques de PNJ/spéciales dépassent la boîte)
    g.font = `bold 11px ${FONT}`;
    const maxTextW = lw - 24, rowH = 16, maxRows = 6;
    const wrapped: { text: string; last: boolean }[] = [];
    const raw = this.session.log.slice(-5);
    raw.forEach((l, li) => {
      const isLastEntry = li === raw.length - 1;
      const parts = wrapLine(g, l, maxTextW, 2);
      parts.forEach((pt, pi) => wrapped.push({ text: pt, last: isLastEntry && pi === parts.length - 1 }));
    });
    const shown = wrapped.slice(-maxRows);
    shown.forEach((row, i) => {
      let s = row.text;
      // effet machine à écrire : seule la toute dernière ligne se révèle pendant l'anim
      if (row.last && this.state === "anim") s = s.slice(0, Math.max(0, Math.floor(this.logReveal * 3)));
      text(g, s, lx + 12, ly + 16 + i * rowH, 11, row.last ? "#fff" : "#9a92ac");
    });

    // ===== bandeau d'actions pleine largeur (tour + boutons), façon boîte de commande =====
    const barY = VH - 72, barH = 62, by = VH - 64;
    g.save();
    g.globalAlpha = slide;
    const barGrad = g.createLinearGradient(0, barY, 0, barY + barH);
    barGrad.addColorStop(0, "rgba(16,12,26,.94)"); barGrad.addColorStop(1, "rgba(9,7,16,.94)");
    g.fillStyle = barGrad;
    g.beginPath(); g.roundRect(8, barY, VW - 16, barH, 10); g.fill();
    g.strokeStyle = "rgba(140,130,170,.35)"; g.lineWidth = 1.5;
    g.beginPath(); g.roundRect(8, barY, VW - 16, barH, 10); g.stroke();
    // liseré d'accent en haut du bandeau (cyan à ton tour, pourpre pendant la résolution)
    const turnInput = this.state === "input" && !this.itemMenu && !this.skillMenu;
    g.strokeStyle = turnInput ? "rgba(120,210,255,.5)" : "rgba(140,90,220,.35)";
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(18, barY + 1); g.lineTo(VW - 18, barY + 1); g.stroke();

    // indicateur de tour, intégré à gauche du bandeau
    const tLabel = turnInput ? "▶ " + T("combat.turn.you") : this.state === "anim" ? "⚔ " + T("combat.turn.resolving") : "";
    if (tLabel) {
      const blink = turnInput ? 0.75 + Math.sin(this.t * 5) * 0.25 : 1;
      g.globalAlpha = slide * blink;
      textShadow(g, tLabel, 24, barY + barH / 2, 13, turnInput ? "#8fe0ff" : "#b8a8d8", "left");
      g.globalAlpha = slide;
    }

    // boutons d'action
    const acts = this.actions;
    const btnW = 118, btnGap = 8, btnH = 44;
    const bx0 = VW - 22 - (btnW * acts.length + btnGap * (acts.length - 1));
    acts.forEach((a, i) => {
      const bx = bx0 + i * (btnW + btnGap), byy = barY + (barH - btnH) / 2;
      const selected = i === this.sel && this.state === "input";
      g.fillStyle = !a.enabled ? "rgba(30,26,40,.7)" : selected ? "rgba(140,30,30,.92)" : "rgba(34,28,50,.9)";
      g.beginPath(); g.roundRect(bx, byy, btnW, btnH, 8); g.fill();
      if (selected) { g.save(); g.shadowColor = "#ff6050"; g.shadowBlur = 12; }
      g.strokeStyle = selected ? "#ffb0a0" : "rgba(140,130,170,.35)";
      g.lineWidth = selected ? 2 : 1;
      g.beginPath(); g.roundRect(bx, byy, btnW, btnH, 8); g.stroke();
      if (selected) g.restore();
      textShadow(g, a.key, bx + 13, byy + btnH / 2, 14, selected ? "#ffd84a" : "#7a7090", "center");
      const lbl = a.label.length > 12 ? a.label.slice(0, 11) + "…" : a.label;
      text(g, lbl, bx + 25, byy + btnH / 2, 11, !a.enabled ? "#5a5470" : selected ? "#fff" : "#c8c0d4");
    });
    g.restore();
    // Sous-menu Objet
    if (this.itemMenu && this.state === "input") {
      const list = this.consumables();
      const rowH = 30, w2 = 280, h2 = list.length * rowH + 34;
      const x2 = VW / 2 - w2 / 2, y2 = by - 14 - h2;
      g.fillStyle = "rgba(8,6,14,.94)";
      g.beginPath(); g.roundRect(x2, y2, w2, h2, 8); g.fill();
      g.strokeStyle = "rgba(255,157,46,.5)";
      g.lineWidth = 1.5;
      g.beginPath(); g.roundRect(x2, y2, w2, h2, 8); g.stroke();
      list.forEach((it, i) => {
        const ry = y2 + 12 + i * rowH;
        const selected = i === this.itemSel;
        if (selected) {
          g.fillStyle = "rgba(140,70,20,.6)";
          g.beginPath(); g.roundRect(x2 + 8, ry - 3, w2 - 16, 26, 5); g.fill();
        }
        const spr = getSprite(ItemSpriteFor(it.id));
        if (spr) { g.imageSmoothingEnabled = false; g.drawImage(spr, x2 + 14, ry - 2, 24, 24); }
        text(g, `${it.name} ×${it.count}`, x2 + 46, ry + 10, 13, selected ? "#fff" : "#c8c0d4");
      });
      text(g, T("combat.itemmenu.hint"), VW / 2, y2 + h2 - 12, 10, "#8a8098", "center");
    }
    // Sous-menu Techniques (lisibilité : desc en bas, tags d'effet, coût en pastille, énergie en pips)
    if (this.skillMenu && this.state === "input") {
      const kit = this.kit();
      const rowH = 30, w2 = 388, headH = 32, footH = 44;
      const h2 = headH + kit.length * rowH + footH;
      const x2 = VW / 2 - w2 / 2, y2 = by - 14 - h2;
      g.fillStyle = "rgba(10,7,18,.97)";
      g.beginPath(); g.roundRect(x2, y2, w2, h2, 10); g.fill();
      g.strokeStyle = "rgba(150,130,220,.55)"; g.lineWidth = 1.5;
      g.beginPath(); g.roundRect(x2, y2, w2, h2, 10); g.stroke();

      // en-tête : titre + jauge d'Énergie en pips
      textShadow(g, T("act.skills").toUpperCase(), x2 + 16, y2 + 20, 14, "#c8b0ff", "left");
      const maxE = this.session.maxEnergy, pipGap = 12, pipsW = (maxE - 1) * pipGap;
      const px0 = x2 + w2 - 16 - pipsW;
      text(g, "⚡", px0 - 18, y2 + 20, 13, "#ffd84a", "center");
      for (let e = 0; e < maxE; e++) {
        g.beginPath(); g.arc(px0 + e * pipGap, y2 + 16, 4, 0, Math.PI * 2);
        g.fillStyle = e < this.session.energy ? "#ffd84a" : "rgba(120,110,150,.35)";
        g.fill();
      }
      g.strokeStyle = "rgba(150,130,220,.22)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x2 + 12, y2 + headH); g.lineTo(x2 + w2 - 12, y2 + headH); g.stroke();

      // lignes
      const listY = y2 + headH;
      kit.forEach((sk, i) => {
        const ry = listY + i * rowH, cy = ry + rowH / 2 + 1;
        const selected = i === this.skillSel;
        const affordable = this.session.energy >= sk.cost;
        if (selected) {
          g.fillStyle = "rgba(96,64,150,.5)";
          g.beginPath(); g.roundRect(x2 + 8, ry + 2, w2 - 16, rowH - 4, 6); g.fill();
          g.save(); g.globalAlpha = 0.55; g.strokeStyle = sk.color; g.lineWidth = 1;
          g.beginPath(); g.roundRect(x2 + 8, ry + 2, w2 - 16, rowH - 4, 6); g.stroke(); g.restore();
        }
        // tags d'effet
        let tx = x2 + 16;
        for (const tg of this.skillTags(sk)) { text(g, tg.icon, tx, cy, 13, affordable ? tg.color : "#5a5470", "left"); tx += 17; }
        // nom (teinté de la couleur de la compétence)
        const nameCol = !affordable ? "#6a6480" : selected ? "#fff" : sk.color;
        text(g, T(sk.nameKey), Math.max(tx + 4, x2 + 74), cy, 13, nameCol, "left");
        // pastille de coût (rouge si trop cher)
        const pillW = 32, pillX = x2 + w2 - 16 - pillW;
        g.fillStyle = affordable ? "rgba(90,60,140,.65)" : "rgba(120,30,30,.55)";
        g.beginPath(); g.roundRect(pillX, ry + rowH / 2 - 9, pillW, 18, 5); g.fill();
        text(g, `⚡${sk.cost}`, pillX + pillW / 2, cy, 11, affordable ? "#ffd84a" : "#ff8a8a", "center");
      });

      // pied : description de la sélection (lisible) + aide
      const fy = listY + kit.length * rowH;
      g.strokeStyle = "rgba(150,130,220,.22)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x2 + 12, fy); g.lineTo(x2 + w2 - 12, fy); g.stroke();
      const sel = kit[Math.min(this.skillSel, kit.length - 1)];
      if (sel) text(g, T(sel.descKey), x2 + 16, fy + 17, 12, "#d8d0e8", "left");
      text(g, T("combat.skillmenu.hint"), x2 + 16, fy + 34, 10, "#8a8098", "left");
    }

    // Pastilles de statut de l'ennemi (sous son sprite ; celles du joueur sont sur le roster)
    if (this.enemy.statuses.length > 0 && !this.enemy.isDead && slide >= 1) {
      const ey2 = EY + (boss ? 95 : mini ? 75 : 60) + 10;
      const nChips = this.enemy.statuses.filter(s => s.turns > 0).length;
      this.statusChips(g, this.enemy.statuses, exBar - nChips * 26, ey2, 1);
    }
    if (this.state === "done" && Math.sin(this.t * 4) > -0.2)
      textShadow(g, T("combat.continue"), VW / 2, by - 16, 13, "#ffd84a", "center");

    // ---- arcs de taille (slash) ----
    for (const s of this.slashes) {
      const a = clamp(s.life / 0.22, 0, 1);
      g.save();
      g.translate(s.x, s.y);
      g.rotate(s.angle);
      g.globalAlpha = a;
      g.strokeStyle = s.color;
      g.shadowColor = s.color; g.shadowBlur = 10;
      g.lineCap = "round";
      const r = 60 * (1.4 - a * 0.4);
      g.lineWidth = 6 * a + 1;
      g.beginPath(); g.arc(0, 0, r, -2.1, -0.4); g.stroke();
      g.lineWidth = 3 * a + 0.5;
      g.beginPath(); g.arc(0, 0, r * 0.72, -2, -0.5); g.stroke();
      g.restore();
    }
    // ---- ondes de choc ----
    for (const r of this.rings) {
      const a = clamp(r.life / 0.4, 0, 1);
      g.save();
      g.globalAlpha = a * 0.8;
      g.strokeStyle = r.color;
      g.shadowColor = r.color; g.shadowBlur = 12;
      g.lineWidth = 3 * a + 0.5;
      g.beginPath(); g.arc(r.x, r.y, r.r, 0, Math.PI * 2); g.stroke();
      g.restore();
    }

    // particules + floaters (les chiffres POPENT à l'apparition)
    this.particles.draw(g);
    for (const f of this.floaters) {
      const age = 1 - f.life / f.maxLife;
      const popScale = age < 0.18 ? 1.7 - (age / 0.18) * 0.7 : 1;
      g.globalAlpha = clamp(f.life, 0, 1);
      g.font = `bold ${Math.round(f.size * popScale)}px ${FONT}`;
      g.textAlign = "center";
      g.fillStyle = "rgba(0,0,0,.7)";
      g.fillText(f.text, f.x + 2, f.y + 2);
      g.fillStyle = f.color;
      g.fillText(f.text, f.x, f.y);
      g.globalAlpha = 1;
    }

    // ---- flash plein écran (crit, phase 2, mise à mort) ----
    if (this.flashTint > 0) {
      g.globalAlpha = this.flashTint * 0.5;
      g.fillStyle = this.flashColor;
      g.fillRect(-12, -12, VW + 24, VH + 24);
      g.globalAlpha = 1;
    }

    // bannière d'intro (après le slide-in des combattants)
    if (this.state === "intro" && this.t > 0.85) {
      const bt = this.t - 0.85;
      const a = clamp(bt / 0.15, 0, 1) * clamp((0.65 - bt) / 0.2 + 1, 0, 1);
      g.globalAlpha = Math.min(1, a);
      g.fillStyle = boss ? "rgba(120,10,20,.92)" : "rgba(60,20,80,.92)";
      g.fillRect(0, VH / 2 - 46, VW, 92);
      textShadow(g, boss ? T("combat.boss", { name: this.enemy.name }) : T("combat.title", { name: this.enemy.name }),
        VW / 2, VH / 2, 30, "#fff", "center");
      g.globalAlpha = 1;
    }

    // Volets d'ouverture façon Pokémon (stores vénitiens alternés)
    if (this.state === "intro" && this.t < 0.5) {
      const cov = Math.pow(1 - clamp(this.t / 0.5, 0, 1), 2);
      const barH = VH / 8;
      g.fillStyle = "#050409";
      for (let i = 0; i < 8; i++) {
        const h = barH * cov;
        const y = i % 2 === 0 ? i * barH : (i + 1) * barH - h;
        g.fillRect(-12, y, VW + 24, h + 0.5);
      }
    }

    // bannière du nom d'attaque spéciale (flash bref, s'estompe)
    if (this.abilityBanner > 0) {
      const a = clamp(this.abilityBanner / 0.35, 0, 1) * clamp(this.abilityBanner / 0.9, 0, 1);
      const slide = (1 - clamp(this.abilityBanner / 1.1, 0, 1)) * 24;
      g.globalAlpha = Math.min(1, a);
      textShadow(g, this.abilityBannerName.toUpperCase(), VW / 2, 120 - slide, 34, this.abilityBannerColor, "center");
      g.globalAlpha = 1;
    }

    // bannière PHASE II
    if (this.phase2Banner > 0) {
      const a = clamp(this.phase2Banner / 0.4, 0, 1);
      g.globalAlpha = Math.min(1, a);
      g.fillStyle = "rgba(140,10,20,.88)";
      g.fillRect(0, VH / 2 - 70, VW, 140);
      const glitch = Math.random() < 0.2 ? "PHΛSE II" : T("combat.phase2.title");
      textShadow(g, glitch, VW / 2, VH / 2 - 18, 44, "#ffe0e0", "center");
      textShadow(g, T("combat.phase2.sub"), VW / 2, VH / 2 + 26, 18, "#ff9090", "center");
      g.globalAlpha = 1;
    }

    g.restore();
  }
}
