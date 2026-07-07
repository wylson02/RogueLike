// ===== Scène de combat : mise en scène du CombatSession =====
import { Scene } from "./scenes";
import { VW, VH, text, textShadow, Particles, FONT } from "./render";
import { Input } from "./input";
import { Audio } from "./audio";
import { T } from "./i18n";
import { G, Flow } from "./game";
import { CombatSession, CombatActionId } from "./combat";
import { Monster, MonsterRank, ClassCatalog } from "./entities";
import { getSprite } from "./sprites";
import { clamp, lerp } from "./core";
import { saveGame } from "./save";

interface Floater { x: number; y: number; text: string; color: string; life: number; size: number; }
interface AnimStep { at: number; fn: () => void; }

const INTRO_DUR = 1.7; // intro façon Pokémon : volets, slide-in, bannière

export class CombatScene implements Scene {
  private session: CombatSession;
  private enemy: Monster;
  private t = 0;
  private sel = 0;
  private state: "intro" | "input" | "anim" | "done" = "intro";
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

  constructor(monster: Monster) {
    this.enemy = monster;
    this.session = new CombatSession(G.ctx, monster);
    this.shownEnemyHp = monster.hp;
    this.shownPlayerHp = G.ctx.player.hp;
  }

  enter() {
    Audio.setMode(this.enemy.rank === MonsterRank.Boss ? "boss" : "combat");
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
        label: s.classAbilityUsed ? T("act.class.used") : T(ClassCatalog[s.player.classId].abilityNameKey),
        enabled: !s.classAbilityUsed, key: "5",
      },
    ];
  }

  update(dt: number) {
    this.t += dt;
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
        const n = this.actions.length;
        if (Input.consume("left") || Input.consume("up")) { this.sel = (this.sel + n - 1) % n; Audio.sfx("ui"); }
        if (Input.consume("right") || Input.consume("down")) { this.sel = (this.sel + 1) % n; Audio.sfx("ui"); }
        let chosen: number = -1;
        if (Input.consume("act1")) chosen = 0;
        if (Input.consume("act2")) chosen = 1;
        if (Input.consume("act3")) chosen = 2;
        if (Input.consume("act4")) chosen = 3;
        if (Input.consume("act5")) chosen = 4;
        if (Input.consume("confirm")) chosen = this.sel;
        if (chosen >= 0) {
          const a = this.actions[chosen];
          if (!a.enabled) { Audio.sfx("locked"); break; }
          this.sel = chosen;
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

  private playRound(action: CombatActionId) {
    this.session.playTurn(action);
    const events = this.session.drainEvents();
    this.steps = [];
    this.animT = 0;
    let at = 0.12;
    const ex = VW / 2, ey = 200; // centre ennemi
    for (const e of events) {
      const fn = () => {
        switch (e.type) {
          case "playerHit":
            Audio.sfx("hit");
            this.enemyShake = 1; this.enemyFlash = 1;
            this.particles.burst(ex, ey, "#ff7050", 14, 130, 0.6, 3.5);
            this.floaters.push({ x: ex + (Math.random() - 0.5) * 40, y: ey - 50, text: "-" + e.value, color: "#fff", life: 1.1, size: 26 });
            break;
          case "playerCrit":
            Audio.sfx("crit");
            this.enemyShake = 1.6; this.enemyFlash = 1; this.screenShake = 0.7;
            this.particles.burst(ex, ey, "#ffd84a", 26, 190, 0.8, 4, true);
            this.floaters.push({ x: ex, y: ey - 60, text: "CRIT -" + e.value, color: "#ffd84a", life: 1.3, size: 34 });
            break;
          case "heal":
            Audio.sfx("heal");
            this.playerFlash = 0.6;
            this.particles.burst(200, VH - 130, "#7ae87a", 16, 80, 0.9, 3, true);
            this.floaters.push({ x: 210, y: VH - 170, text: "+" + e.value, color: "#7ae87a", life: 1.1, size: 24 });
            break;
          case "dodgeUp":
            Audio.sfx("dodge");
            this.particles.burst(200, VH - 130, "#8fd4ff", 12, 70, 0.7, 3, true);
            break;
          case "enemyHit":
            Audio.sfx("hurt");
            this.screenShake = 1; this.playerFlash = 1;
            this.floaters.push({ x: 240 + (Math.random() - 0.5) * 40, y: VH - 180, text: "-" + e.value, color: "#ff6060", life: 1.1, size: 26 });
            break;
          case "playerDodge":
            Audio.sfx("dodge");
            this.floaters.push({ x: 240, y: VH - 180, text: "MISS", color: "#8fd4ff", life: 1, size: 22 });
            break;
          case "fleeOk": Audio.sfx("flee"); break;
          case "fleeFail": Audio.sfx("locked"); this.screenShake = 0.4; break;
          case "phase2":
            Audio.sfx("phase2");
            this.phase2Banner = 2.2;
            this.screenShake = 1.6;
            this.particles.burst(ex, ey, "#c02840", 40, 220, 1.2, 4.5, true);
            break;
          case "enemyDead":
            Audio.sfx("die");
            this.particles.burst(ex, ey, "#c8c0d4", 34, 170, 1.1, 4);
            this.particles.burst(ex, ey, "#ffd84a", 20, 120, 1.3, 3, true);
            break;
          case "playerDead":
            Audio.sfx("die");
            this.screenShake = 2;
            break;
          case "levelup":
            Audio.sfx("levelup");
            this.floaters.push({ x: 240, y: VH - 210, text: "LEVEL UP!", color: "#7ae87a", life: 1.6, size: 26 });
            break;
          case "reward": Audio.sfx("coin"); break;
          case "classAbility":
            Audio.sfx("crit");
            this.enemyShake = 1.8; this.enemyFlash = 1; this.screenShake = 1;
            this.particles.burst(ex, ey, "#ffd84a", 30, 200, 0.9, 4.2, true);
            this.floaters.push({ x: ex, y: ey - 60, text: "-" + e.value, color: "#ffd84a", life: 1.3, size: 32 });
            break;
          case "enemySpecial":
            Audio.sfx("hurt");
            this.screenShake = 1.8; this.playerFlash = 1;
            this.particles.burst(240, VH - 180, "#c02840", 28, 190, 1, 4.2, true);
            this.floaters.push({ x: 240, y: VH - 200, text: "-" + e.value, color: "#ff5060", life: 1.3, size: 30 });
            break;
          case "enemyBuff":
            Audio.sfx("dodge");
            this.particles.burst(ex, ey, "#8fd4ff", 20, 130, 0.8, 3.5, true);
            break;
        }
      };
      this.steps.push({ at, fn });
      at += e.type === "phase2" ? 1.6 : e.type === "enemyDead" || e.type === "enemySpecial" ? 0.8 : 0.55;
    }
    this.state = "anim";
    this.logReveal = 0;
  }

  private resolveOutcome() {
    const s = this.session;
    if (s.player.isDead) { Flow.endScreen(false); return; }
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
    if (s.victory && this.enemy.rank === MonsterRank.Boss) {
      // Post-jeu : le Roi vaincu avec la Clé de l'Abîme → le portail des Profondeurs s'ouvre
      if (G.ctx.currentLevel === 4 && G.ctx.player.inventory.some(i => i.id === "AbyssKey")) {
        G.ctx.openAbyssPortal();
        saveGame(G.ctx);
        Flow.toExplore();
        return;
      }
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

    // sol d'arène
    g.fillStyle = "rgba(255,255,255,.04)";
    g.beginPath(); g.ellipse(VW / 2, 300, 260, 60, 0, 0, Math.PI * 2); g.fill();

    // vignette
    const v = g.createRadialGradient(VW / 2, VH / 2, VH * 0.25, VW / 2, VH / 2, VH * 0.9);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,.65)");
    g.fillStyle = v; g.fillRect(-12, -12, VW + 24, VH + 24);

    // ===== ennemi ===== (glisse depuis la droite pendant l'intro)
    const slide = this.introSlide();
    const ex = VW / 2 + (1 - slide) * (VW / 2 + 220), ey = 200;
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

    // barre PV ennemi
    const bw = boss ? 420 : 320;
    const ehr = clamp(this.shownEnemyHp / this.enemy.maxHp, 0, 1);
    g.fillStyle = "rgba(8,6,14,.8)";
    g.beginPath(); g.roundRect(ex - bw / 2 - 4, 40, bw + 8, 42, 8); g.fill();
    textShadow(g, this.enemy.name + (this.session.phase2 ? "  —  " + T("combat.phase2.title") : ""),
      ex, 54, boss ? 17 : 15, boss ? "#ff9090" : mini ? "#c8a8ff" : "#e8e0f0", "center");
    g.fillStyle = "#25141c";
    g.beginPath(); g.roundRect(ex - bw / 2 + 4, 66, bw - 8, 10, 4); g.fill();
    const ehGrad = g.createLinearGradient(ex - bw / 2, 0, ex + bw / 2, 0);
    ehGrad.addColorStop(0, boss ? "#c02040" : "#b83a3a");
    ehGrad.addColorStop(1, boss ? "#ff5060" : "#e06848");
    g.fillStyle = ehGrad;
    g.beginPath(); g.roundRect(ex - bw / 2 + 4, 66, (bw - 8) * ehr, 10, 4); g.fill();

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
    const lx = VW - 350 + (1 - slide) * 380, ly = VH - 214, lw = 330, lh = 120;
    g.fillStyle = "rgba(8,6,14,.72)";
    g.beginPath(); g.roundRect(lx, ly, lw, lh, 10); g.fill();
    const lines = this.session.log.slice(-6);
    let budget = Math.floor(this.logReveal + 200);
    lines.forEach((l, i) => {
      let s = l.length > 42 ? l.slice(0, 41) + "…" : l;
      const isLast = i === lines.length - 1;
      if (isLast && this.state === "anim") s = s.slice(0, Math.max(0, Math.floor(this.logReveal * 3)));
      text(g, s, lx + 12, ly + 16 + i * 17, 11, isLast ? "#fff" : "#9a92ac");
    });

    // ===== boutons d'action =====
    const acts = this.actions;
    const btnW = acts.length > 4 ? 150 : 190, btnGap = 10, btnH = 46;
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
      textShadow(g, a.key, bx + 16, by + btnH / 2, 15, selected ? "#ffd84a" : "#7a7090", "center");
      text(g, a.label, bx + 32, by + btnH / 2, 13, !a.enabled ? "#5a5470" : selected ? "#fff" : "#c8c0d4");
    });
    g.globalAlpha = 1;
    if (this.state === "input")
      text(g, T("combat.yourturn"), VW / 2, by - 16, 12, "#8fd4ff", "center");
    if (this.state === "done" && Math.sin(this.t * 4) > -0.2)
      textShadow(g, T("combat.continue"), VW / 2, by - 16, 13, "#ffd84a", "center");

    // particules + floaters
    this.particles.draw(g);
    for (const f of this.floaters) {
      g.globalAlpha = clamp(f.life, 0, 1);
      g.font = `bold ${f.size}px ${FONT}`;
      g.textAlign = "center";
      g.fillStyle = "rgba(0,0,0,.7)";
      g.fillText(f.text, f.x + 2, f.y + 2);
      g.fillStyle = f.color;
      g.fillText(f.text, f.x, f.y);
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
