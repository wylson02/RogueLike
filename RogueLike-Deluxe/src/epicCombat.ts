// ===== LE PANTHÉON — moteur de combat d'action temps réel =====
// Arène fixe, déplacement horizontal libre, roulade à i-frames, garde/parade, endurance,
// hitbox réelles télégraphées, phases de boss. Totalement autonome : ne touche ni au
// CombatSession tour-par-tour, ni au GameContext des autres modes.
import { Scene } from "./scenes";
import { VW, VH, text, textShadow, Particles, AmbientFX, FONT } from "./render";
import { Input } from "./input";
import { Audio } from "./audio";
import { T } from "./i18n";
import { getSprite } from "./sprites";
import { clamp, lerp } from "./core";
import { EpicBoss, EpicAttack, EPIC_HERO } from "./epicMode";

const ARENA_L = 96, ARENA_R = 864;   // bornes du sol
const FLOOR_Y = 452;                 // ligne de sol (pieds des combattants)
const INTRO_DUR = 1.6;

interface Floater { x: number; y: number; text: string; color: string; life: number; maxLife: number; size: number; }
// Projectile / onde de choc : persiste et voyage seul (le boss peut agir après l'avoir lancé).
interface Projectile { x: number; y: number; vx: number; r: number; dmg: number; color: string; life: number; hit: boolean; wave: boolean; }
interface Ghost { x: number; life: number; }

type BossState = "idle" | "windup" | "active" | "recovery" | "stagger";

export class EpicCombatScene implements Scene {
  private boss: EpicBoss;
  private onOutcome: (won: boolean) => void;
  private t = 0;
  private phase: "intro" | "fight" | "won" | "lost" = "intro";
  private outcomeT = 0;

  // ---- héros ----
  private hx = ARENA_L + 120;
  private hFacing: 1 | -1 = 1;
  private hp = EPIC_HERO.maxHp;
  private stamina = EPIC_HERO.maxStamina;
  private vx = 0;                    // élan (roulade / recul)
  private atkTimer = 0;              // >0 pendant une attaque
  private atkKind: "light" | "heavy" | null = null;
  private atkPhase: "windup" | "active" | "recovery" = "windup";
  private atkHit = false;           // la frappe en cours a-t-elle déjà touché ?
  private rollTimer = 0;
  private rollDir: 1 | -1 = 1;
  private invuln = 0;               // i-frames (roulade / relève)
  private hurtTimer = 0;            // étourdi après un coup
  private blocking = false;
  private blockHeld = 0;            // temps de maintien (fenêtre de parade au début)
  private flaskTimer = 0;
  private flasks = EPIC_HERO.flasks;
  private staminaFlash = 0;         // clignote si action refusée (pas assez d'endurance)

  // ---- boss ----
  private bx = ARENA_R - 160;
  private bFacing: 1 | -1 = -1;
  private bhp: number;
  private bmaxhp: number;
  private bstate: BossState = "idle";
  private bstateT = 0;              // temps restant dans l'état courant
  private bidle = 0.8;              // délai avant la prochaine attaque
  private cur: EpicAtk | null = null;
  private bphase = 0;               // nombre de changements de phase franchis
  private swingHit = false;         // hitbox mêlée : une frappe par coup
  private slamX = 0;                // point d'impact verrouillé du slam / plongeon
  private airborne = false;         // le boss est en l'air (plongeon) : intouchable, aucun contact
  private diveFromX = 0;            // position de décollage du plongeon (pour l'anim de rendu)
  private comboLeft = 0;            // frappes restantes d'un combo
  private comboGap = 0;
  private bflash = 0;
  private bdeathT = 0;
  private contactCd = 0;            // anti-spam des dégâts de contact

  // ---- fx / juice ----
  private particles = new Particles();
  private ambient: AmbientFX;
  private floaters: Floater[] = [];
  private projectiles: Projectile[] = [];
  private ghosts: Ghost[] = [];
  private screenShake = 0;
  private hitstop = 0;
  private flashTint = 0;
  private flashColor = "#fff";
  private phaseBanner = 0;
  private moveBanner = 0;
  private moveBannerText = "";
  private moveBannerColor = "#fff";
  private shownBhp: number;
  private shownHp: number;

  constructor(boss: EpicBoss, onOutcome: (won: boolean) => void) {
    this.boss = boss;
    this.onOutcome = onOutcome;
    this.bhp = boss.hp; this.bmaxhp = boss.hp;
    this.shownBhp = boss.hp; this.shownHp = this.hp;
    this.ambient = new AmbientFX({
      fogBlobs: 7, motes: 44, fogColor: "120,110,150", moteColor: "180,170,210",
      fogOpacity: 0.07, moteOpacity: 0.18, speed: 1, fogBand: { y: 430, h: 110 },
    });
  }

  enter() {
    Audio.setMode("boss");
    Audio.sfx("roar");
  }

  private get dist() { return Math.abs(this.hx - this.bx); }
  private timeScale() { return 1 - this.boss.phaseSpeedup * this.bphase; }

  // ============================ UPDATE ============================
  update(dt: number) {
    // décroissances visuelles (tournent même pendant l'intro / hitstop)
    this.screenShake = Math.max(0, this.screenShake - dt * 3);
    this.flashTint = Math.max(0, this.flashTint - dt * 5);
    this.phaseBanner = Math.max(0, this.phaseBanner - dt);
    this.moveBanner = Math.max(0, this.moveBanner - dt);
    this.bflash = Math.max(0, this.bflash - dt * 4);
    this.staminaFlash = Math.max(0, this.staminaFlash - dt * 3);
    this.ambient.update(dt);
    this.updateFx(dt);
    this.shownBhp = lerp(this.shownBhp, Math.max(0, this.bhp), clamp(dt * 9, 0, 1));
    this.shownHp = lerp(this.shownHp, Math.max(0, this.hp), clamp(dt * 9, 0, 1));

    if (this.phase === "intro") {
      this.t += dt;
      if (Input.consume("confirm")) this.t = Math.max(this.t, INTRO_DUR);
      if (this.t >= INTRO_DUR) { this.phase = "fight"; Input.clear(); }
      return;
    }

    if (this.phase === "won" || this.phase === "lost") {
      this.outcomeT += dt;
      this.bdeathT += dt;
      // brève tenue puis retour (confirmable)
      if (this.outcomeT > 1.4 && Input.consume("confirm")) this.onOutcome(this.phase === "won");
      if (this.outcomeT > 6) this.onOutcome(this.phase === "won");
      return;
    }

    // ---- FIGHT ----
    if (this.hitstop > 0) { this.hitstop -= dt; return; } // gel d'impact
    this.t += dt;

    // abandon (retour au Panthéon, sans progression)
    if (Input.consume("cancel")) { this.onOutcome(false); return; }

    this.updateHero(dt);
    this.updateBoss(dt);
    this.updateProjectiles(dt);

    this.checkPhaseChange();
    if (this.bhp <= 0 && this.phase === "fight") this.win();
    if (this.hp <= 0 && this.phase === "fight") this.lose();
  }

  private updateFx(dt: number) {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]; f.life -= dt; f.y -= dt * 40;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      this.ghosts[i].life -= dt * 3.5;
      if (this.ghosts[i].life <= 0) this.ghosts.splice(i, 1);
    }
    this.particles.update(dt);
  }

  // ---------------- Héros ----------------
  private updateHero(dt: number) {
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.contactCd = Math.max(0, this.contactCd - dt);

    // fiole (soin) : immobile et vulnérable le temps de boire
    if (this.flaskTimer > 0) {
      this.flaskTimer -= dt;
      this.stamina = Math.min(EPIC_HERO.maxStamina, this.stamina + dt * 10);
      return;
    }

    // roulade en cours : élan + i-frames au début
    if (this.rollTimer > 0) {
      this.rollTimer -= dt;
      this.hx += this.rollDir * EPIC_HERO.rollDist * dt / EPIC_HERO.rollDur;
      this.hx = clamp(this.hx, ARENA_L, ARENA_R);
      if (Math.random() < dt * 50) this.ghosts.push({ x: this.hx, life: 1 });
      return;
    }

    // attaque en cours : windup → active (hitbox) → recovery
    if (this.atkTimer > 0) {
      this.atkTimer -= dt;
      this.resolveHeroAttack();
      return;
    }

    // étourdi : ni action ni déplacement
    if (this.hurtTimer > 0) return;

    // ---- entrées libres ----
    this.blocking = Input.isDown("down") && this.stamina > 0;
    if (this.blocking) this.blockHeld += dt; else this.blockHeld = 0;

    let move = 0;
    if (Input.isDown("left")) move -= 1;
    if (Input.isDown("right")) move += 1;
    if (move !== 0 && !this.blocking) {
      this.hFacing = move as 1 | -1;
      this.hx = clamp(this.hx + move * EPIC_HERO.moveSpeed * dt, ARENA_L, ARENA_R);
    }

    // régénération d'endurance (réduite en garde)
    this.stamina = Math.min(EPIC_HERO.maxStamina,
      this.stamina + (this.blocking ? EPIC_HERO.staminaRegenBlock : EPIC_HERO.staminaRegen) * dt);

    // roulade
    if (Input.consume("up")) {
      if (this.tryCost(EPIC_HERO.rollCost)) {
        this.rollTimer = EPIC_HERO.rollDur;
        this.invuln = EPIC_HERO.rollIFrames;
        this.rollDir = (move !== 0 ? move : this.hFacing) as 1 | -1;
        Audio.sfx("dodge");
      }
    }
    // attaque lourde
    else if (Input.consume("act1")) {
      if (this.tryCost(EPIC_HERO.heavyCost)) this.startAttack("heavy");
    }
    // attaque légère
    else if (Input.consume("confirm")) {
      if (this.tryCost(EPIC_HERO.lightCost)) this.startAttack("light");
    }
    // boire une fiole
    else if (Input.consume("tabR")) {
      if (this.flasks > 0 && this.hp < EPIC_HERO.maxHp) {
        this.flasks--;
        this.flaskTimer = EPIC_HERO.flaskDur;
        this.hp = Math.min(EPIC_HERO.maxHp, this.hp + EPIC_HERO.flaskHeal);
        Audio.sfx("heal");
        this.particles.burst(this.hx, FLOOR_Y - 40, "#7ae87a", 18, 90, 0.9, 3, true);
        this.pop(this.hx, FLOOR_Y - 80, "+" + EPIC_HERO.flaskHeal, "#7ae87a", 22);
      } else { this.staminaFlash = 1; Audio.sfx("locked"); }
    }
  }

  private tryCost(c: number): boolean {
    if (this.stamina < c) { this.staminaFlash = 1; Audio.sfx("locked"); return false; }
    this.stamina -= c;
    return true;
  }

  private startAttack(kind: "light" | "heavy") {
    this.atkKind = kind; this.atkHit = false; this.atkPhase = "windup";
    this.atkTimer = kind === "light"
      ? EPIC_HERO.lightWindup + EPIC_HERO.lightActive + EPIC_HERO.lightRecovery
      : EPIC_HERO.heavyWindup + EPIC_HERO.heavyActive + EPIC_HERO.heavyRecovery;
    Audio.sfx(kind === "heavy" ? "crit" : "hit");
  }

  // Découpe l'attaque du héros en phases et applique la hitbox pendant la fenêtre active.
  private resolveHeroAttack() {
    const H = EPIC_HERO;
    const total = this.atkKind === "light"
      ? [H.lightWindup, H.lightActive, H.lightRecovery]
      : [H.heavyWindup, H.heavyActive, H.heavyRecovery];
    const full = total[0] + total[1] + total[2];
    const elapsed = full - this.atkTimer;
    this.atkPhase = elapsed < total[0] ? "windup" : elapsed < total[0] + total[1] ? "active" : "recovery";

    if (this.atkPhase === "active" && !this.atkHit) {
      const reach = this.atkKind === "heavy" ? H.heavyReach : H.lightReach;
      const dmg = this.atkKind === "heavy" ? H.heavyDmg : H.lightDmg;
      const x0 = this.hFacing > 0 ? this.hx : this.hx - reach;
      const x1 = this.hFacing > 0 ? this.hx + reach : this.hx;
      const bl = this.bx - this.boss.size * 0.3, br = this.bx + this.boss.size * 0.3;
      if (x1 >= bl && x0 <= br && this.bdeathT === 0 && !this.airborne) {
        this.atkHit = true;
        this.hitBoss(dmg, this.atkKind === "heavy");
      }
    }
    if (this.atkTimer <= 0) { this.atkKind = null; }
  }

  private hitBoss(dmg: number, heavy: boolean) {
    // Une lourde qui percute le boss en pleine préparation brise sa garde (récompense les reads).
    const poiseBreak = heavy && (this.bstate === "windup");
    this.bhp -= dmg;
    this.bflash = 1;
    this.hitstop = heavy ? 0.09 : 0.05;
    this.screenShake = heavy ? 0.9 : 0.5;
    const col = heavy ? "#ffd8b0" : "#ffb0a0";
    this.particles.burst(this.bx, FLOOR_Y - this.boss.size * 0.35, col, heavy ? 24 : 14, 170, 0.7, heavy ? 4 : 3, true);
    this.pop(this.bx, FLOOR_Y - this.boss.size * 0.5, "-" + dmg, col, heavy ? 30 : 24);
    Audio.sfx(heavy ? "crit" : "hit");
    if (poiseBreak) { this.staggerBoss(1.1); this.flashTint = 0.3; this.flashColor = "#ffd8b0"; }
  }

  // ---------------- Boss ----------------
  private updateBoss(dt: number) {
    if (this.bdeathT > 0) return;
    const ts = this.timeScale();
    this.bFacing = this.hx < this.bx ? -1 : 1;

    // dégâts de contact si le héros colle le boss (hors i-frames, hors vol)
    if (!this.airborne && this.contactCd <= 0 && this.dist < this.boss.size * 0.34 + 18 && this.invuln <= 0 && this.rollTimer <= 0) {
      this.hurtHero(this.boss.contactDmg, this.hx < this.bx ? -1 : 1, false);
      this.contactCd = 0.6;
    }

    switch (this.bstate) {
      case "stagger":
        this.bstateT -= dt;
        if (this.bstateT <= 0) { this.bstate = "idle"; this.bidle = 0.3; }
        break;

      case "idle": {
        this.bidle -= dt;
        // approche/repositionnement lent vers le héros
        const gap = this.dist;
        if (gap > 150) this.bx += this.bFacing * this.boss.moveSpeed * dt;
        else if (gap < 90) this.bx -= this.bFacing * this.boss.moveSpeed * 0.6 * dt;
        this.bx = clamp(this.bx, ARENA_L + 40, ARENA_R - 40);
        if (this.bidle <= 0) this.beginAttack();
        break;
      }

      case "windup":
        this.bstateT -= dt;
        // télégraphe : le boss frémit, l'aura enfle (rendu géré dans draw)
        if (this.cur!.kind === "slam") this.slamX = this.hx; // suit le héros jusqu'à l'impact
        // Plongeon : l'ombre traque le héros tant qu'il reste du temps, puis se verrouille (dernier tiers).
        if (this.cur!.kind === "dive" && this.bstateT > 0.4) this.slamX = this.hx;
        if (this.bstateT <= 0) {
          this.bstate = "active";
          this.bstateT = this.cur!.active * ts;
          this.swingHit = false;
          this.onAttackActive();
        }
        break;

      case "active":
        this.bstateT -= dt;
        this.tickAttackActive(dt, ts);
        if (this.bstateT <= 0) {
          // combo : enchaîne la frappe suivante après un court intervalle
          if (this.comboLeft > 0) {
            this.comboGap -= dt;
            this.bstate = "windup"; this.bstateT = 0.16 * ts; this.comboLeft--;
          } else {
            this.bstate = "recovery"; this.bstateT = this.cur!.recovery * ts;
          }
        }
        break;

      case "recovery":
        this.bstateT -= dt;
        if (this.bstateT <= 0) { this.bstate = "idle"; this.bidle = (0.5 + Math.random() * 0.5) * ts; this.cur = null; }
        break;
    }
  }

  private beginAttack() {
    const d = this.dist;
    const unlocked = (a: EpicAttack) => a.fromPhase === undefined || this.bphase >= a.fromPhase;
    let pool = this.boss.attacks.filter(a =>
      unlocked(a) && (a.minDist === undefined || d >= a.minDist) && (a.maxDist === undefined || d <= a.maxDist));
    if (pool.length === 0) pool = this.boss.attacks.filter(unlocked);
    if (pool.length === 0) pool = this.boss.attacks;
    const a = pool[Math.floor(Math.random() * pool.length)];
    this.cur = { ...a };
    this.bstate = "windup";
    this.bstateT = a.windup * this.timeScale();
    this.comboLeft = a.kind === "combo" ? (a.hits ?? 1) - 1 : 0;
    this.moveBanner = 1.0; this.moveBannerText = T(a.labelKey); this.moveBannerColor = a.color;
    if (a.kind === "slam" || a.kind === "dive") this.slamX = this.hx;
    if (a.kind === "dive") { this.airborne = true; this.diveFromX = this.bx; }
    Audio.sfx(a.kind === "dive" ? "roar" : "guard");
  }

  // Déclenchement de la hitbox à l'entrée de la phase active.
  private onAttackActive() {
    const a = this.cur!;
    switch (a.kind) {
      case "projectile": {
        const y = FLOOR_Y - this.boss.size * 0.35;
        this.projectiles.push({ x: this.bx + this.bFacing * 30, y, vx: this.bFacing * (a.speed ?? 400), r: 16, dmg: a.dmg, color: a.color, life: 2.4, hit: false, wave: false });
        Audio.sfx("hit");
        break;
      }
      case "shockwave": {
        // deux ondes rasantes partant du boss dans les deux sens (il faut rouler au travers)
        for (const dir of [-1, 1] as const) {
          this.projectiles.push({ x: this.bx, y: FLOOR_Y - 12, vx: dir * (a.speed ?? 280), r: 30, dmg: a.dmg, color: a.color, life: 2.2, hit: false, wave: true });
        }
        this.screenShake = 0.8; this.hitstop = 0.05;
        this.particles.burst(this.bx, FLOOR_Y, a.color, 24, 150, 0.7, 3.5, true);
        Audio.sfx("phase2");
        break;
      }
      case "slam":
        this.screenShake = 1.1; this.hitstop = 0.06;
        this.flashTint = 0.2; this.flashColor = a.color;
        this.particles.burst(this.slamX, FLOOR_Y, a.color, 30, 190, 0.8, 4, true);
        Audio.sfx("warden");
        break;
      case "dive": {
        // Le boss s'écrase au sol sur le point verrouillé : gros impact + éclats.
        this.airborne = false;
        this.bx = this.slamX;
        this.screenShake = 1.6; this.hitstop = 0.09;
        this.flashTint = 0.32; this.flashColor = a.color;
        this.particles.burst(this.slamX, FLOOR_Y, a.color, 40, 230, 0.9, 4.6, true);
        this.particles.burst(this.slamX, FLOOR_Y, "#fff", 16, 150, 0.6, 3, true);
        Audio.sfx("phase2");
        // ANÉANTISSEMENT : l'impact libère deux ondes de choc en prime.
        if (a.labelKey === "epic.mv.annihilation") {
          for (const dir of [-1, 1] as const)
            this.projectiles.push({ x: this.slamX, y: FLOOR_Y - 12, vx: dir * 320, r: 30, dmg: Math.round(a.dmg * 0.6), color: a.color, life: 2.2, hit: false, wave: true });
        }
        break;
      }
      case "volley": {
        // Salve : plusieurs projectiles espacés (il faut rouler/écarter plusieurs fois).
        const y = FLOOR_Y - this.boss.size * 0.35;
        const n = a.hits ?? 3;
        for (let k = 0; k < n; k++)
          this.projectiles.push({ x: this.bx + this.bFacing * (30 + k * 130), y, vx: this.bFacing * (a.speed ?? 430), r: 15, dmg: a.dmg, color: a.color, life: 2.6, hit: false, wave: false });
        Audio.sfx("hit");
        break;
      }
      case "spin":
        this.screenShake = 0.7; this.hitstop = 0.04;
        this.particles.burst(this.bx, FLOOR_Y - this.boss.size * 0.3, a.color, 26, 170, 0.7, 3.6, true);
        Audio.sfx("crit");
        break;
      case "dash":
        Audio.sfx("roar");
        break;
      case "sweep":
      case "combo":
        Audio.sfx("hit");
        break;
    }
  }

  // Pendant la fenêtre active : mêlée & ruée testées chaque frame (les projectiles vivent à part).
  private tickAttackActive(dt: number, ts: number) {
    const a = this.cur!;
    if (a.kind === "dash") {
      // le boss fend l'arène à grande vitesse ; sa masse est la hitbox
      this.bx = clamp(this.bx + this.bFacing * (a.speed ?? 700) * dt, ARENA_L + 20, ARENA_R - 20);
      if (!this.swingHit && this.dist < this.boss.size * 0.34 + 16) {
        this.swingHit = true;
        this.hurtHero(a.dmg, this.bFacing, true);
      }
      if (Math.random() < dt * 40) this.particles.spawn({ x: this.bx, y: FLOOR_Y - 30, vx: -this.bFacing * 60, vy: -10, life: 0.4, maxLife: 0.4, size: 3, color: a.color, glow: true });
    } else if (a.kind === "slam" || a.kind === "dive") {
      // zone d'impact au sol verrouillée (slam suit ; plongeon verrouille en fin de vol)
      if (!this.swingHit && Math.abs(this.hx - this.slamX) < a.range * 0.5 && this.invuln <= 0 && this.rollTimer <= 0) {
        this.swingHit = true;
        this.hurtHero(a.dmg, this.hx < this.slamX ? -1 : 1, true);
      }
    } else if (a.kind === "spin") {
      // frappe tournoyante : dangereuse des deux côtés à la fois
      if (!this.swingHit && this.dist < a.range && this.invuln <= 0 && this.rollTimer <= 0) {
        this.swingHit = true;
        this.hurtHero(a.dmg, this.hx < this.bx ? -1 : 1, true);
      }
    } else if (a.kind === "sweep" || a.kind === "combo") {
      // arc devant le boss
      const x0 = this.bFacing > 0 ? this.bx : this.bx - a.range;
      const x1 = this.bFacing > 0 ? this.bx + a.range : this.bx;
      if (!this.swingHit && this.hx >= x0 && this.hx <= x1 && this.invuln <= 0 && this.rollTimer <= 0) {
        this.swingHit = true;
        this.hurtHero(a.dmg, this.bFacing, true);
      }
    }
  }

  private staggerBoss(dur: number) {
    this.bstate = "stagger"; this.bstateT = dur; this.cur = null; this.comboLeft = 0;
    Audio.sfx("hurt");
    this.pop(this.bx, FLOOR_Y - this.boss.size * 0.55, T("epic.stagger"), "#ffd84a", 22, 1.2);
  }

  // ---------------- Projectiles ----------------
  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt; p.life -= dt;
      if (p.wave) p.r += dt * 10; // l'onde grandit légèrement
      if (Math.random() < dt * 30) this.particles.spawn({ x: p.x, y: p.y, vx: 0, vy: -20, life: 0.3, maxLife: 0.3, size: 2.5, color: p.color, glow: true });
      if (!p.hit && Math.abs(p.x - this.hx) < p.r + 16 && this.invuln <= 0 && this.rollTimer <= 0 && this.flaskTimer <= 0) {
        p.hit = true;
        this.hurtHero(p.dmg, p.vx > 0 ? 1 : -1, true);
        if (!p.wave) { this.projectiles.splice(i, 1); continue; }
      }
      if (p.life <= 0 || p.x < ARENA_L - 60 || p.x > ARENA_R + 60) this.projectiles.splice(i, 1);
    }
  }

  // ---------------- Dégâts au héros (garde / parade / i-frames) ----------------
  private hurtHero(dmg: number, fromDir: number, knock: boolean) {
    if (this.invuln > 0 || this.rollTimer > 0) return; // esquive parfaite

    if (this.blocking) {
      // Parade : bloquer dans la toute première fenêtre annule tout et chancelle le boss.
      if (this.blockHeld <= EPIC_HERO.parryWindow) {
        Audio.sfx("seal");
        this.flashTint = 0.35; this.flashColor = "#ffe14a";
        this.particles.burst(this.hx + fromDir * -18, FLOOR_Y - 40, "#ffe14a", 20, 130, 0.6, 3.5, true);
        this.pop(this.hx, FLOOR_Y - 84, T("epic.parry"), "#ffe14a", 24, 1.2);
        this.staggerBoss(1.2);
        this.stamina = Math.min(EPIC_HERO.maxStamina, this.stamina + 15);
        return;
      }
      // Blocage normal : dégâts réduits, coûte de l'endurance ; à vide → garde brisée.
      this.stamina -= EPIC_HERO.blockDrainPerHit;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.takeHit(dmg, fromDir, true); // garde brisée : plein dégâts + étourdissement
        this.pop(this.hx, FLOOR_Y - 84, T("epic.guardbreak"), "#ff6060", 20, 1.2);
        return;
      }
      const reduced = Math.max(1, Math.round(dmg * (1 - EPIC_HERO.blockReduce)));
      this.hp -= reduced;
      Audio.sfx("guard");
      this.particles.burst(this.hx + fromDir * -14, FLOOR_Y - 40, "#8fd4ff", 12, 90, 0.5, 3, true);
      this.pop(this.hx, FLOOR_Y - 70, "-" + reduced, "#8fd4ff", 18);
      this.screenShake = Math.max(this.screenShake, 0.4);
      return;
    }

    this.takeHit(dmg, fromDir, knock);
  }

  private takeHit(dmg: number, fromDir: number, knock: boolean) {
    this.hp -= dmg;
    this.hurtTimer = 0.28;
    this.invuln = 0.5;              // brefs i-frames après un coup (évite le stun-lock)
    this.atkTimer = 0; this.atkKind = null;
    this.screenShake = 1.2; this.hitstop = 0.05;
    this.flashTint = 0.28; this.flashColor = "#c02840";
    if (knock) this.hx = clamp(this.hx + fromDir * 46, ARENA_L, ARENA_R);
    this.particles.burst(this.hx, FLOOR_Y - 40, "#ff6060", 18, 150, 0.7, 3.5);
    this.pop(this.hx, FLOOR_Y - 84, "-" + dmg, "#ff6060", 26);
    Audio.sfx("hurt");
  }

  // ---------------- Phases / issue ----------------
  private checkPhaseChange() {
    const frac = this.bhp / this.bmaxhp;
    const thresholds = this.boss.phaseAt;
    if (this.bphase < thresholds.length && frac <= thresholds[this.bphase]) {
      this.bphase++;
      this.phaseBanner = 2.0;
      this.screenShake = 1.6; this.hitstop = 0.12;
      this.flashTint = 0.5; this.flashColor = this.boss.glow;
      this.particles.burst(this.bx, FLOOR_Y - this.boss.size * 0.4, this.boss.glow, 40, 220, 1.1, 4.5, true);
      this.bstate = "idle"; this.bidle = 0.6; this.cur = null; this.comboLeft = 0;
      this.airborne = false;
      this.projectiles = [];
      Audio.sfx("phase2");
    }
  }

  private win() {
    this.phase = "won"; this.outcomeT = 0; this.bdeathT = 0.001;
    this.screenShake = 1.4; this.flashTint = 0.4; this.flashColor = "#fff";
    this.particles.burst(this.bx, FLOOR_Y - this.boss.size * 0.4, "#fff", 40, 180, 1.2, 4.5, true);
    this.particles.burst(this.bx, FLOOR_Y - this.boss.size * 0.4, "#ffd84a", 24, 130, 1.4, 3, true);
    Audio.sfx("victory");
    Audio.setMode("none");
  }

  private lose() {
    this.phase = "lost"; this.outcomeT = 0;
    this.screenShake = 2;
    Audio.sfx("die"); Audio.sfx("defeat");
    Audio.setMode("none");
  }

  private pop(x: number, y: number, txt: string, color: string, size: number, life = 1.0) {
    this.floaters.push({ x, y, text: txt, color, life, maxLife: life, size });
  }

  // ============================ DRAW ============================
  draw(g: CanvasRenderingContext2D) {
    g.save();
    if (this.screenShake > 0)
      g.translate((Math.random() - 0.5) * this.screenShake * 10, (Math.random() - 0.5) * this.screenShake * 10);

    // fond
    const grad = g.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, this.boss.bg[0]); grad.addColorStop(0.6, this.boss.bg[1]); grad.addColorStop(1, this.boss.bg[2]);
    g.fillStyle = grad; g.fillRect(-12, -12, VW + 24, VH + 24);

    // colonnes parallaxe
    g.save();
    for (let i = 0; i < 5; i++) {
      const px = ((i * 230 + this.t * (5 + i * 2)) % (VW + 160)) - 80;
      g.fillStyle = "rgba(120,110,150,.08)";
      g.fillRect(px, 30, 46 + (i % 3) * 16, VH - 150);
    }
    g.restore();

    // sol
    g.fillStyle = "rgba(255,255,255,.05)";
    g.fillRect(ARENA_L - 30, FLOOR_Y + 8, ARENA_R - ARENA_L + 60, 4);
    g.fillStyle = "rgba(0,0,0,.35)";
    g.fillRect(-12, FLOOR_Y + 12, VW + 24, VH);

    this.ambient.draw(g);

    // ---- télégraphes de danger (avant les sprites, au sol) ----
    this.drawTelegraph(g);
    // ---- projectiles / ondes ----
    for (const p of this.projectiles) this.drawProjectile(g, p);

    // ---- boss ----
    this.drawBoss(g);
    // ---- héros ----
    this.drawHero(g);

    // ---- particules & dégâts flottants ----
    this.particles.draw(g);
    for (const f of this.floaters) {
      const a = clamp(f.life / f.maxLife, 0, 1);
      g.globalAlpha = a;
      textShadow(g, f.text, f.x, f.y, f.size, f.color, "center");
      g.globalAlpha = 1;
    }

    // vignette
    const v = g.createRadialGradient(VW / 2, VH / 2, VH * 0.3, VW / 2, VH / 2, VH * 0.95);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.6)");
    g.fillStyle = v; g.fillRect(-12, -12, VW + 24, VH + 24);

    // flash plein écran
    if (this.flashTint > 0) {
      g.globalAlpha = this.flashTint;
      g.fillStyle = this.flashColor; g.fillRect(-12, -12, VW + 24, VH + 24);
      g.globalAlpha = 1;
    }
    g.restore();

    this.drawHUD(g);
    if (this.phase === "intro") this.drawIntro(g);
    if (this.phase === "won") this.drawOutcome(g, true);
    if (this.phase === "lost") this.drawOutcome(g, false);
  }

  private drawTelegraph(g: CanvasRenderingContext2D) {
    if (this.bstate !== "windup" || !this.cur) return;
    const a = this.cur;
    const full = a.windup * this.timeScale();
    const prog = 1 - clamp(this.bstateT / full, 0, 1); // 0→1
    g.save();
    g.globalAlpha = 0.28 + prog * 0.32;
    g.fillStyle = a.color;
    g.strokeStyle = a.color; g.lineWidth = 2 + prog * 2;
    if (a.kind === "slam") {
      const r = a.range * 0.5 * (0.6 + prog * 0.4);
      g.beginPath(); g.ellipse(this.slamX, FLOOR_Y + 6, r, 22, 0, 0, Math.PI * 2); g.fill();
    } else if (a.kind === "dive") {
      // Ombre au sol qui rétrécit et s'intensifie à mesure que le boss retombe : ROULE hors du cercle.
      const r = a.range * 0.5;
      g.globalAlpha = 0.18 + prog * 0.5;
      g.beginPath(); g.ellipse(this.slamX, FLOOR_Y + 6, r, r * 0.32, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.5 + Math.sin(this.t * 22) * 0.3;
      g.beginPath(); g.ellipse(this.slamX, FLOOR_Y + 6, r * (1.15 - prog * 0.3), r * 0.36, 0, 0, Math.PI * 2); g.stroke();
      // réticule de danger
      textShadow(g, "⚠", this.slamX, FLOOR_Y - 26, 22, a.color, "center");
    } else if (a.kind === "sweep" || a.kind === "combo") {
      const x0 = this.bFacing > 0 ? this.bx : this.bx - a.range;
      g.fillRect(x0, FLOOR_Y - 4, a.range, 20);
    } else if (a.kind === "spin") {
      // danger des deux côtés
      g.fillRect(this.bx - a.range, FLOOR_Y - 4, a.range * 2, 20);
    } else if (a.kind === "dash") {
      const x0 = this.bFacing > 0 ? this.bx : this.bx - a.range;
      g.globalAlpha = 0.18 + prog * 0.22;
      g.fillRect(x0, FLOOR_Y - 30, a.range, 44);
    } else if (a.kind === "shockwave") {
      g.beginPath(); g.ellipse(this.bx, FLOOR_Y + 6, 40 + prog * 30, 16, 0, 0, Math.PI * 2); g.fill();
    } else if (a.kind === "projectile" || a.kind === "volley") {
      g.beginPath(); g.arc(this.bx + this.bFacing * 30, FLOOR_Y - this.boss.size * 0.35, 8 + prog * 10, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  private drawProjectile(g: CanvasRenderingContext2D, p: Projectile) {
    g.save();
    g.shadowColor = p.color; g.shadowBlur = 16;
    g.fillStyle = p.color;
    if (p.wave) {
      g.globalAlpha = 0.8;
      g.beginPath(); g.ellipse(p.x, FLOOR_Y + 2, p.r * 0.5, p.r, 0, 0, Math.PI * 2); g.fill();
    } else {
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  private drawBoss(g: CanvasRenderingContext2D) {
    const ts = this.timeScale();
    const winProg = this.bstate === "windup" && this.cur ? 1 - clamp(this.bstateT / (this.cur.windup * ts), 0, 1) : 0;
    const size = this.boss.size * (this.bstate === "windup" ? 1 + winProg * 0.08 : 1);
    const dying = this.bdeathT > 0;
    const bob = Math.sin(this.t * 1.8) * 5;
    const spr = getSprite(this.boss.sprite);

    // Plongeon : le boss quitte le sol, monte, dérive au-dessus du point d'impact, puis retombe.
    let drawX = this.bx;
    let liftY = 0;
    if (this.airborne && this.cur) {
      const arc = Math.sin(Math.min(1, winProg * 1.15) * Math.PI); // 0 → haut → 0
      liftY = arc * 320;
      drawX = lerp(this.diveFromX, this.slamX, clamp(winProg * 1.25, 0, 1));
    }

    // ombre au sol (rétrécit et pâlit quand le boss s'élève)
    const shGround = this.airborne ? drawX : this.bx;
    const shScale = this.airborne ? clamp(1 - liftY / 340, 0.25, 1) : 1;
    g.fillStyle = `rgba(0,0,0,${(0.45 * shScale).toFixed(2)})`;
    g.beginPath(); g.ellipse(shGround, FLOOR_Y + 8, size * 0.34 * shScale, size * 0.09 * shScale, 0, 0, Math.PI * 2); g.fill();

    g.save();
    g.imageSmoothingEnabled = false;
    g.shadowColor = this.boss.glow; g.shadowBlur = (this.bstate === "windup" ? 40 : 26) + Math.sin(this.t * 2.4) * 10;
    if (dying) g.globalAlpha = clamp(1 - this.bdeathT / 1.2, 0, 1);
    if (this.bstate === "stagger") g.globalAlpha *= 0.6 + Math.sin(this.t * 20) * 0.15;
    const bx = drawX - size / 2, by = FLOOR_Y - size + bob - liftY;
    if (spr) g.drawImage(spr, bx, by, size, size);
    if (this.bflash > 0 && spr) {
      g.globalAlpha = this.bflash * 0.7; g.globalCompositeOperation = "lighter";
      g.drawImage(spr, bx, by, size, size);
      g.globalCompositeOperation = "source-over";
    }
    g.restore();
  }

  private drawHero(g: CanvasRenderingContext2D) {
    const size = 90;
    const spr = getSprite("player");
    // ghosts de roulade
    for (const gh of this.ghosts) {
      g.globalAlpha = gh.life * 0.35;
      if (spr) { g.imageSmoothingEnabled = false; g.drawImage(spr, gh.x - size / 2, FLOOR_Y - size, size, size); }
      g.globalAlpha = 1;
    }
    // ombre
    g.fillStyle = "rgba(0,0,0,.45)";
    g.beginPath(); g.ellipse(this.hx, FLOOR_Y + 6, size * 0.3, size * 0.08, 0, 0, Math.PI * 2); g.fill();

    g.save();
    g.imageSmoothingEnabled = false;
    if (this.invuln > 0 && this.rollTimer > 0) g.globalAlpha = 0.55; // translucide pendant l'esquive
    if (this.hurtTimer > 0) g.globalAlpha = 0.5 + Math.sin(this.t * 40) * 0.3;
    // flip selon l'orientation
    const flip = this.hFacing < 0;
    if (flip) { g.translate(this.hx, 0); g.scale(-1, 1); g.translate(-this.hx, 0); }
    const rollLean = this.rollTimer > 0 ? Math.sin((1 - this.rollTimer / EPIC_HERO.rollDur) * Math.PI) * 0.5 : 0;
    if (rollLean) { g.translate(this.hx, FLOOR_Y - size / 2); g.rotate(this.rollDir * rollLean); g.translate(-this.hx, -(FLOOR_Y - size / 2)); }
    if (spr) g.drawImage(spr, this.hx - size / 2, FLOOR_Y - size, size, size);
    g.restore();

    // arme / effet d'attaque
    if (this.atkKind && this.atkPhase !== "windup") {
      const reach = this.atkKind === "heavy" ? EPIC_HERO.heavyReach : EPIC_HERO.lightReach;
      const col = this.atkKind === "heavy" ? "#ffd8b0" : "#dfe6ff";
      g.save();
      g.globalAlpha = this.atkPhase === "active" ? 0.9 : 0.4;
      g.strokeStyle = col; g.lineWidth = this.atkKind === "heavy" ? 6 : 4;
      g.shadowColor = col; g.shadowBlur = 12;
      const cx = this.hx + this.hFacing * 20, cy = FLOOR_Y - size * 0.55;
      g.beginPath();
      g.arc(cx, cy, reach * 0.7, this.hFacing > 0 ? -0.9 : Math.PI - 0.9 + 1.8, this.hFacing > 0 ? 0.9 : Math.PI + 0.9 + 1.8);
      g.stroke();
      g.restore();
    }
    // bouclier de garde
    if (this.blocking) {
      const parry = this.blockHeld <= EPIC_HERO.parryWindow;
      g.save();
      g.globalAlpha = parry ? 0.9 : 0.6;
      g.strokeStyle = parry ? "#ffe14a" : "#8fd4ff"; g.lineWidth = 4;
      g.shadowColor = parry ? "#ffe14a" : "#8fd4ff"; g.shadowBlur = 14;
      const sx = this.hx + this.hFacing * 26;
      g.beginPath(); g.ellipse(sx, FLOOR_Y - size * 0.5, 12, 34, 0, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
    // fiole (soin)
    if (this.flaskTimer > 0) {
      g.globalAlpha = 0.5 + Math.sin(this.t * 12) * 0.3;
      textShadow(g, "✚", this.hx, FLOOR_Y - size - 14, 22, "#7ae87a", "center");
      g.globalAlpha = 1;
    }
  }

  private drawHUD(g: CanvasRenderingContext2D) {
    // ---- barre de PV du boss (haut) ----
    const bw = 560, bx = VW / 2 - bw / 2, by = 34;
    textShadow(g, T(this.boss.nameKey), VW / 2, by - 6, 18, "#ffd0d0", "center");
    text(g, T(this.boss.titleKey), VW / 2, by + 12, 11, "#c8a8c0", "center");
    g.fillStyle = "rgba(8,6,14,.8)";
    g.beginPath(); g.roundRect(bx, by + 22, bw, 14, 5); g.fill();
    const frac = clamp(this.shownBhp / this.bmaxhp, 0, 1);
    const hg = g.createLinearGradient(bx, 0, bx + bw, 0);
    hg.addColorStop(0, "#7a1020"); hg.addColorStop(1, this.boss.glow);
    g.fillStyle = hg;
    g.beginPath(); g.roundRect(bx, by + 22, bw * frac, 14, 5); g.fill();
    g.strokeStyle = "rgba(255,120,130,.5)"; g.lineWidth = 1.5;
    g.beginPath(); g.roundRect(bx, by + 22, bw, 14, 5); g.stroke();
    // marqueurs de phase
    for (const th of this.boss.phaseAt) {
      const mx = bx + bw * th;
      g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(mx, by + 22); g.lineTo(mx, by + 36); g.stroke();
    }

    // ---- bas : PV + endurance + fioles ----
    const px = 40, py = VH - 56;
    // PV héros
    const phw = 300;
    g.fillStyle = "rgba(8,6,14,.8)";
    g.beginPath(); g.roundRect(px, py, phw, 16, 5); g.fill();
    const pf = clamp(this.shownHp / EPIC_HERO.maxHp, 0, 1);
    const pg = g.createLinearGradient(px, 0, px + phw, 0);
    pg.addColorStop(0, "#3aa03a"); pg.addColorStop(1, "#7ae87a");
    g.fillStyle = pg;
    g.beginPath(); g.roundRect(px, py, phw * pf, 16, 5); g.fill();
    g.strokeStyle = "rgba(150,220,150,.5)"; g.lineWidth = 1.5;
    g.beginPath(); g.roundRect(px, py, phw, 16, 5); g.stroke();
    text(g, Math.max(0, Math.round(this.hp)) + " / " + EPIC_HERO.maxHp, px + 8, py + 8, 11, "#eaffea");

    // endurance
    const sy = py + 22;
    g.fillStyle = "rgba(8,6,14,.8)";
    g.beginPath(); g.roundRect(px, sy, phw, 9, 4); g.fill();
    const sf = clamp(this.stamina / EPIC_HERO.maxStamina, 0, 1);
    g.fillStyle = this.staminaFlash > 0 ? "#ff6060" : "#e0b048";
    g.beginPath(); g.roundRect(px, sy, phw * sf, 9, 4); g.fill();

    // fioles
    for (let i = 0; i < EPIC_HERO.flasks; i++) {
      const fx = px + 4 + i * 22, fy = sy + 22;
      g.globalAlpha = i < this.flasks ? 1 : 0.25;
      textShadow(g, "✚", fx, fy, 18, "#7ae87a", "left");
      g.globalAlpha = 1;
    }

    // aide contrôles
    text(g, T("epic.controls"), VW - 24, VH - 20, 11, "#9a92ac", "right");

    // bannière de nom de coup
    if (this.moveBanner > 0 && this.bstate !== "idle") {
      g.globalAlpha = clamp(this.moveBanner / 1.0, 0, 1);
      textShadow(g, "⚠ " + this.moveBannerText, this.bx, FLOOR_Y - this.boss.size - 6, 16, this.moveBannerColor, "center");
      g.globalAlpha = 1;
    }
    // bannière de phase
    if (this.phaseBanner > 0) {
      const a = clamp(this.phaseBanner / 2, 0, 1);
      g.globalAlpha = Math.min(1, a * 2);
      textShadow(g, T("epic.phase", { n: this.bphase + 1 }), VW / 2, VH / 2 - 40, 42, this.boss.glow, "center");
      g.globalAlpha = 1;
    }
  }

  private drawIntro(g: CanvasRenderingContext2D) {
    const a = clamp(1 - this.t / INTRO_DUR, 0, 1);
    g.fillStyle = `rgba(5,4,10,${a * 0.7})`;
    g.fillRect(0, 0, VW, VH);
    textShadow(g, T(this.boss.nameKey), VW / 2, VH / 2 - 20, 46, "#f0e2c8", "center");
    text(g, T(this.boss.titleKey), VW / 2, VH / 2 + 26, 18, this.boss.glow, "center");
  }

  private drawOutcome(g: CanvasRenderingContext2D, won: boolean) {
    const a = clamp(this.outcomeT / 1.2, 0, 1);
    g.fillStyle = `rgba(5,4,10,${a * 0.72})`;
    g.fillRect(0, 0, VW, VH);
    g.save();
    g.shadowColor = won ? "#ffd84a" : "#c02840"; g.shadowBlur = 24;
    textShadow(g, won ? T("epic.win") : T("epic.dead"), VW / 2, VH / 2 - 16, 52, won ? "#ffe6a0" : "#ff6070", "center");
    g.restore();
    if (this.outcomeT > 1.4 && Math.sin(this.t * 5) > -0.3)
      text(g, T("epic.continue"), VW / 2, VH / 2 + 48, 16, "#c8c0d4", "center");
  }
}

// Type interne : copie mutable d'une attaque en cours d'exécution.
interface EpicAtk extends EpicAttack { }
