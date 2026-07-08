// ===== Scène de combat : mise en scène du CombatSession =====
import { Scene } from "./scenes";
import { VW, VH, text, textShadow, Particles, FONT, wrapLine } from "./render";
import { Input } from "./input";
import { Audio } from "./audio";
import { T } from "./i18n";
import { G, Flow } from "./game";
import { CombatSession, CombatActionId, INTENT_ICON } from "./combat";
import { Monster, MonsterRank, ClassCatalog } from "./entities";
import { getSprite } from "./sprites";
import { clamp, lerp } from "./core";
import { saveGame } from "./save";

interface Floater { x: number; y: number; text: string; color: string; life: number; maxLife: number; size: number; }
interface AnimStep { at: number; fn: () => void; }
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
  private steps: AnimStep[] = [];
  private animT = 0;
  private particles = new Particles();
  private floaters: Floater[] = [];
  private enemyShake = 0;
  private screenShake = 0;
  private enemyFlash = 0;
  private playerFlash = 0;
  private phase2Banner = 0;
  private shownEnemyHp: number;
  private shownPlayerHp: number;
  private logReveal = 0;
  // ---- juice ----
  private hitstop = 0;        // gel du temps (impact frames)
  private heroLunge = 0;      // 1 → 0 : le héros se rue vers l'ennemi
  private enemyLunge = 0;     // 1 → 0 : l'ennemi se rue vers le héros
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
  }

  enter() {
    // Musique boss aussi pour le Gardien des Sceaux (mini-boss) : même thème que son dialogue.
    const bossMusic = this.enemy.rank === MonsterRank.Boss || this.enemy.nameKey.startsWith("mob.warden");
    Audio.setMode(bossMusic ? "boss" : "combat");
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
        id: "class",
        label: s.classAbilityUsesLeft <= 0 ? T("act.class.used")
          : s.classAbilityUsesLeft > 1
            ? T(ClassCatalog[s.player.classId].abilityNameKey) + " ×" + s.classAbilityUsesLeft
            : T(ClassCatalog[s.player.classId].abilityNameKey),
        enabled: s.classAbilityUsesLeft > 0, key: "5",
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
  private get heroX() { return 250 + this.heroLunge * 190; }
  private get heroY() { return 330 - this.heroLunge * 60; }

  update(dt: number) {
    // Hitstop : le monde entier se fige un battement à l'impact
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.t += dt;
    this.heroLunge = Math.max(0, this.heroLunge - dt * 4.5);
    this.enemyLunge = Math.max(0, this.enemyLunge - dt * 4.5);
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
          x: VW / 2 + (Math.random() - 0.5) * (boss ? 230 : 170),
          y: 200 + 60 + Math.random() * 40,
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
    this.logReveal += dt * 30;
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt; f.y -= dt * 42;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
    this.shownEnemyHp = lerp(this.shownEnemyHp, Math.max(0, this.enemy.hp), clamp(dt * 8, 0, 1));
    this.shownPlayerHp = lerp(this.shownPlayerHp, Math.max(0, G.ctx.player.hp), clamp(dt * 8, 0, 1));

    switch (this.state) {
      case "intro":
        if (Input.consume("confirm")) this.t = Math.max(this.t, INTRO_DUR);
        if (this.t >= INTRO_DUR) { this.state = "input"; Input.clear(); }
        break;

      case "input": {
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
    const ex = VW / 2, ey = 200; // centre ennemi
    const hx = 250, hy = 330;    // héros au sol
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
            Audio.sfx("charge");
            this.enemyFlash = 0.6;
            ringAt(ex, ey, 100, "#ff5060");
            this.particles.burst(ex, ey, "#ff5060", 18, -120, 0.8, 3, true); // implosion visuelle
            pop(ex, ey - 70, T("combat.pop.charging"), "#ff9090", 24, 1.4);
            break;
          case "enemyGuard":
            Audio.sfx("dodge");
            ringAt(ex, ey, 60, "#8fd4ff");
            this.particles.burst(ex, ey, "#8fd4ff", 16, 100, 0.7, 3, true);
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
          case "classAbility":
            Audio.sfx("crit");
            this.heroLunge = 1; this.hitstop = 0.1;
            this.enemyShake = 1.8; this.enemyFlash = 1; this.screenShake = 1;
            this.flashTint = 0.3; this.flashColor = "#ffd84a";
            slashAt(ex, ey, "#ffd84a"); slashAt(ex - 14, ey + 10, "#ffd84a");
            ringAt(ex, ey, 110, "#ffd84a");
            this.particles.burst(ex, ey, "#ffd84a", 30, 200, 0.9, 4.2, true);
            pop(ex, ey - 60, "-" + e.value, "#ffd84a", 32, 1.3);
            break;
          case "enemySpecial":
            Audio.sfx("heavy");
            this.enemyLunge = 1; this.hitstop = 0.1;
            this.screenShake = 1.8; this.playerFlash = 1;
            this.flashTint = 0.32; this.flashColor = "#c02840";
            ringAt(hx, hy, 110, "#ff5060");
            this.particles.burst(hx, hy, "#c02840", 28, 190, 1, 4.2, true);
            pop(hx, hy - 70, "-" + e.value, "#ff5060", 30, 1.3);
            break;
          case "enemyBuff":
            Audio.sfx("dodge");
            this.particles.burst(ex, ey, "#8fd4ff", 20, 130, 0.8, 3.5, true);
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
        }
      };
      this.steps.push({ at, fn });
      at += e.type === "phase2" ? 1.6
        : e.type === "enemyDead" || e.type === "enemySpecial" || e.type === "enemyCharge" ? 0.8
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
      // Post-jeu : le Roi vaincu avec la Clé de l'Abîme → le portail des Profondeurs s'ouvre
      if (G.ctx.currentLevel === 4 && G.ctx.player.inventory.some(i => i.id === "AbyssKey")) {
        G.ctx.openAbyssPortal();
        saveGame(G.ctx);
        Flow.toExplore();
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

    // sol d'arène
    g.fillStyle = "rgba(255,255,255,.04)";
    g.beginPath(); g.ellipse(VW / 2, 300, 260, 60, 0, 0, Math.PI * 2); g.fill();

    // vignette
    const v = g.createRadialGradient(VW / 2, VH / 2, VH * 0.25, VW / 2, VH / 2, VH * 0.9);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,.65)");
    g.fillStyle = v; g.fillRect(-12, -12, VW + 24, VH + 24);

    // ===== ennemi ===== (glisse depuis la droite pendant l'intro ; se rue en attaquant)
    const slide = this.introSlide();
    const lungeX = -this.enemyLunge * this.enemyLunge * 150;
    const lungeY = this.enemyLunge * this.enemyLunge * 70;
    const ex = VW / 2 + (1 - slide) * (VW / 2 + 220) + lungeX, ey = 200 + lungeY;
    const size = boss ? 190 : mini ? 150 : 120;
    const bob = Math.sin(this.t * (boss ? 1.6 : 2.6)) * 6;
    const shakeX = this.enemyShake > 0 ? (Math.random() - 0.5) * this.enemyShake * 14 : 0;
    const spr = getSprite(this.enemy.sprite + (Math.floor(this.t * 3) % 2 && getSprite(this.enemy.sprite + "_2") ? "_2" : ""));

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

    // barre PV ennemi (fixe : ne suit pas les lunges)
    const exBar = VW / 2 + (1 - slide) * (VW / 2 + 220);
    const bw = boss ? 420 : 320;
    const ehr = clamp(this.shownEnemyHp / this.enemy.maxHp, 0, 1);
    g.fillStyle = "rgba(8,6,14,.8)";
    g.beginPath(); g.roundRect(exBar - bw / 2 - 4, 40, bw + 8, 42, 8); g.fill();
    textShadow(g, this.enemy.name + (this.session.phase2 ? "  —  " + T("combat.phase2.title") : ""),
      exBar, 54, boss ? 17 : 15, boss ? "#ff9090" : mini ? "#c8a8ff" : "#e8e0f0", "center");
    g.fillStyle = "#25141c";
    g.beginPath(); g.roundRect(exBar - bw / 2 + 4, 66, bw - 8, 10, 4); g.fill();
    const ehGrad = g.createLinearGradient(exBar - bw / 2, 0, exBar + bw / 2, 0);
    ehGrad.addColorStop(0, boss ? "#c02040" : "#b83a3a");
    ehGrad.addColorStop(1, boss ? "#ff5060" : "#e06848");
    g.fillStyle = ehGrad;
    g.beginPath(); g.roundRect(exBar - bw / 2 + 4, 66, (bw - 8) * ehr, 10, 4); g.fill();

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

    // ===== héros sur le champ de bataille (traînées + lunge) =====
    {
      const hsz = 96;
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

    // ===== joueur (panneau bas-gauche, glisse depuis la gauche pendant l'intro) =====
    const px = 20 - (1 - slide) * 360, py = VH - 210, pw = 300;
    g.fillStyle = "rgba(8,6,14,.8)";
    g.beginPath(); g.roundRect(px, py, pw, 116, 10); g.fill();
    g.strokeStyle = this.playerFlash > 0 ? `rgba(255,80,80,${this.playerFlash})` : "rgba(140,130,170,.4)";
    g.lineWidth = 2;
    g.beginPath(); g.roundRect(px, py, pw, 116, 10); g.stroke();

    const psprite = getSprite("player");
    if (psprite) {
      g.imageSmoothingEnabled = false;
      g.drawImage(psprite, px + 14, py + 14 + Math.sin(this.t * 3) * 2, 56, 56);
    }
    const p = G.ctx.player;
    const phr = clamp(this.shownPlayerHp / p.maxHp, 0, 1);
    g.fillStyle = "#25141c";
    g.beginPath(); g.roundRect(px + 84, py + 20, 190, 16, 5); g.fill();
    const phGrad = g.createLinearGradient(px + 84, 0, px + 274, 0);
    phGrad.addColorStop(0, phr > 0.35 ? "#b83a3a" : "#e02222");
    phGrad.addColorStop(1, phr > 0.35 ? "#e06848" : "#ff5050");
    g.fillStyle = phGrad;
    g.beginPath(); g.roundRect(px + 84, py + 20, 190 * phr, 16, 5); g.fill();
    textShadow(g, `${Math.round(this.shownPlayerHp)}/${p.maxHp}`, px + 179, py + 29, 12, "#fff", "center");
    text(g, `ATK ${p.attack}   ARM ${p.armor}   CRIT ${p.critChancePercent}%`, px + 84, py + 52, 12, "#a8a4b8");
    if (this.session.dodgeTurnsLeft > 0)
      text(g, T("act.dodge.on", { n: this.session.dodgeTurnsLeft }), px + 84, py + 72, 12, "#8fd4ff");
    text(g, `${T("hud.lvl")} ${p.level}`, px + 14, py + 96, 12, "#7ab8e8");
    text(g, `⬤ ${p.gold}`, px + 100, py + 96, 12, "#ffd84a");

    // ===== journal (droite, glisse depuis la droite pendant l'intro) =====
    const lw = 356, lh = 120, lx = VW - lw - 14 + (1 - slide) * 380, ly = VH - 214;
    g.fillStyle = "rgba(8,6,14,.72)";
    g.beginPath(); g.roundRect(lx, ly, lw, lh, 10); g.fill();
    // retour à la ligne des messages longs (les répliques de PNJ/spéciales dépassent la boîte)
    g.font = `bold 11px ${FONT}`;
    const maxTextW = lw - 24, rowH = 16, maxRows = 6;
    const wrapped: { text: string; last: boolean }[] = [];
    const raw = this.session.log.slice(-6);
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

    // ===== boutons d'action =====
    const acts = this.actions;
    const btnW = acts.length > 5 ? 124 : acts.length > 4 ? 150 : 190, btnGap = acts.length > 5 ? 8 : 10, btnH = 46;
    const bx0 = VW / 2 - (btnW * acts.length + btnGap * (acts.length - 1)) / 2, by = VH - 66;
    g.globalAlpha = slide; // les boutons apparaissent en fin d'intro
    acts.forEach((a, i) => {
      const bx = bx0 + i * (btnW + btnGap);
      const selected = i === this.sel && this.state === "input";
      g.fillStyle = !a.enabled ? "rgba(30,26,40,.7)" : selected ? "rgba(140,30,30,.9)" : "rgba(30,24,44,.85)";
      g.beginPath(); g.roundRect(bx, by, btnW, btnH, 8); g.fill();
      g.strokeStyle = selected ? "#ffb0a0" : "rgba(140,130,170,.35)";
      g.lineWidth = selected ? 2 : 1;
      g.beginPath(); g.roundRect(bx, by, btnW, btnH, 8); g.stroke();
      textShadow(g, a.key, bx + 14, by + btnH / 2, 14, selected ? "#ffd84a" : "#7a7090", "center");
      const maxChars = btnW < 150 ? 12 : 18;
      const lbl = a.label.length > maxChars ? a.label.slice(0, maxChars - 1) + "…" : a.label;
      text(g, lbl, bx + 26, by + btnH / 2, btnW < 150 ? 11 : 13, !a.enabled ? "#5a5470" : selected ? "#fff" : "#c8c0d4");
    });
    g.globalAlpha = 1;
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

    // Statuts actifs (pastilles) — burn/bleed/chill inclus, avec puissance
    const STATUS_COL: Record<string, string> = {
      poison: "#7ae87a", stun: "#ffd84a", burn: "#ff7a3a", bleed: "#ff4a6a", chill: "#7ad4ff",
    };
    const chip = (s: { kind: string; turns: number; power: number }) =>
      `${T("status." + s.kind)}${s.power ? " " + s.power : ""} (${s.turns})`;
    if (this.enemy.statuses.length > 0 && !this.enemy.isDead) {
      let sx0 = exBar - (this.enemy.statuses.length - 1) * 55;
      for (const s of this.enemy.statuses) {
        textShadow(g, chip(s), sx0, 118, 12, STATUS_COL[s.kind] ?? "#7ae87a", "center");
        sx0 += 110;
      }
    }
    if (G.ctx.player.statuses.length > 0) {
      const parts = G.ctx.player.statuses.map(chip).join("   ");
      text(g, parts, px + 14, py + 124, 12, "#7ae87a");
    }
    if (this.session.mistTurns > 0)
      text(g, T("status.mist"), px + 200, py + 124, 12, "#8fd4ff");

    if (this.state === "input" && !this.itemMenu)
      text(g, T("combat.yourturn"), VW / 2, by - 16, 12, "#8fd4ff", "center");
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
