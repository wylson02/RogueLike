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
import { EpicBoss, EpicAttack, EPIC_HERO, recordEpicRank } from "./epicMode";

const ARENA_L = 96, ARENA_R = 864;   // bornes du sol
const FLOOR_Y = 452;                 // ligne de sol (pieds des combattants)
const INTRO_DUR = 1.6;

interface Floater { x: number; y: number; text: string; color: string; life: number; maxLife: number; size: number; }
// Projectile / onde de choc : persiste et voyage seul (le boss peut agir après l'avoir lancé).
interface Projectile { x: number; y: number; vx: number; r: number; dmg: number; color: string; life: number; hit: boolean; wave: boolean; }
interface Ghost { x: number; life: number; }
// Éruption au sol télégraphée (bullet-hell) : delay = compte à rebours visible, puis active = explosion.
interface Zone { x: number; r: number; delay: number; active: number; dmg: number; color: string; hit: boolean; fromSky: boolean; }
// Spectre : réplique fantomatique qui te tire dessus en tenaille.
interface Phantom { x: number; y: number; timer: number; dmg: number; color: string; fired: boolean; life: number; speed: number; }

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
  private zones: Zone[] = [];        // éruptions au sol / météores
  private phantoms: Phantom[] = [];  // spectres en tenaille
  private beamX = 0;                 // position du rayon balayant
  private beamVX = 0;                // vitesse/sens du rayon
  private ghosts: Ghost[] = [];
  private screenShake = 0;
  private hitstop = 0;
  private slowmo = 0;               // bullet-time (secondes réelles restantes) : parade parfaite / phase / exécution
  private camZoom = 1;              // caméra dynamique (léger zoom recentré sur l'action)
  private camFx = VW / 2;
  private camFy = VH / 2;
  private rings: { x: number; y: number; r: number; maxR: number; life: number; color: string }[] = [];
  private atkStepped = false;       // le pas d'engagement de la frappe a-t-il été fait ?
  private revealBanner = 0;         // "NOUVEAU COUP" révélé à l'entrée d'une phase
  private revealText = "";
  private negFrames = 0;            // frames négatives (silhouettes blanches sur noir, façon animé)
  private chroma = 0;               // aberration chromatique sur les gros impacts
  private bossGhosts: { x: number; y: number; s: number; life: number }[] = []; // traînées du Colosse
  private prevBDrawX = 0;
  private shards: { x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number }[] = []; // éclats de la barre de PV
  private fgAsh: { x: number; y: number; vx: number; vy: number; r: number; a: number }[] = []; // cendres de premier plan (profondeur)
  private bDraw = { x: 0, y: 0, s: 0 };            // dernière position de rendu du boss
  private hDraw = { x: 0, y: 0, s: 90, flip: false }; // idem héros
  // ---- stats de rang ----
  private fightT = 0;
  private dmgTaken = 0;
  private parries = 0;
  private rank: string | null = null;
  private flashTint = 0;
  private flashColor = "#fff";
  private phaseBanner = 0;
  private moveBanner = 0;
  private moveBannerText = "";
  private moveBannerColor = "#fff";
  private shownBhp: number;
  private shownHp: number;

  constructor(boss: EpicBoss, onOutcome: (won: boolean) => void, private bossIndex = -1) {
    this.boss = boss;
    this.onOutcome = onOutcome;
    this.bhp = boss.hp; this.bmaxhp = boss.hp;
    this.shownBhp = boss.hp; this.shownHp = this.hp;
    // Ambiance aux couleurs du Colosse : ses cendres hantent SON arène.
    const glow = hexToRgb(boss.glow) ?? "180,170,210";
    this.ambient = new AmbientFX({
      fogBlobs: 7, motes: 48, fogColor: "120,110,150", moteColor: glow,
      fogOpacity: 0.07, moteOpacity: 0.2, speed: 1, fogBand: { y: 430, h: 110 },
    });
    // cendres de PREMIER PLAN : grosses, floues, elles passent devant les combattants (profondeur)
    for (let i = 0; i < 9; i++)
      this.fgAsh.push({
        x: Math.random() * VW, y: Math.random() * VH,
        vx: (Math.random() - 0.5) * 26, vy: -30 - Math.random() * 40,
        r: 5 + Math.random() * 9, a: 0.05 + Math.random() * 0.07,
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
    this.revealBanner = Math.max(0, this.revealBanner - dt);
    this.bflash = Math.max(0, this.bflash - dt * 4);
    this.staminaFlash = Math.max(0, this.staminaFlash - dt * 3);
    this.ambient.update(dt);
    this.updateFx(dt);
    // ---- caméra dynamique : zoom cible selon le moment, recentrée sur l'action ----
    let zTarget = 1, fx = VW / 2, fy = VH / 2;
    if (this.phase === "won") { zTarget = 1.14; fx = this.bx; fy = FLOOR_Y - this.boss.size * 0.4; }
    else if (this.phase === "lost") { zTarget = 1.1; fx = this.hx; fy = FLOOR_Y - 46; }
    else if (this.slowmo > 0) { zTarget = 1.07; fx = (this.hx + this.bx) / 2; fy = FLOOR_Y - 70; }
    this.camZoom = lerp(this.camZoom, zTarget, clamp(dt * 4, 0, 1));
    this.camFx = lerp(this.camFx, fx, clamp(dt * 5, 0, 1));
    this.camFy = lerp(this.camFy, fy, clamp(dt * 5, 0, 1));
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
      // exécution : le Colosse vaincu se désagrège en cendres qui montent
      if (this.phase === "won" && Math.random() < dt * 34) {
        this.particles.spawn({
          x: this.bx + (Math.random() - 0.5) * this.boss.size * 0.6,
          y: FLOOR_Y - Math.random() * this.boss.size * 0.8,
          vx: (Math.random() - 0.5) * 14, vy: -34 - Math.random() * 50,
          life: 1.7, maxLife: 1.7, size: 1.8 + Math.random() * 1.8,
          color: Math.random() < 0.6 ? this.boss.glow : "#8a8098", glow: true,
        });
      }
      // brève tenue puis retour (confirmable)
      if (this.outcomeT > 1.4 && Input.consume("confirm")) this.onOutcome(this.phase === "won");
      if (this.outcomeT > 6) this.onOutcome(this.phase === "won");
      return;
    }

    // ---- FIGHT ----
    if (this.hitstop > 0) { this.hitstop -= dt; return; } // gel d'impact
    this.t += dt;
    this.fightT += dt;
    // bullet-time : le monde ralentit (parade parfaite / bascule de phase), toi tu restes lucide
    const gdt = this.slowmo > 0 ? dt * 0.3 : dt;
    this.slowmo = Math.max(0, this.slowmo - dt);

    // abandon (retour au Panthéon, sans progression)
    if (Input.consume("cancel")) { this.onOutcome(false); return; }

    this.updateHero(gdt);
    this.updateBoss(gdt);
    this.updateProjectiles(gdt);
    this.updateZones(gdt);
    this.updatePhantoms(gdt);

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
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt; r.r += (r.maxR - r.r) * dt * 9;
      if (r.life <= 0) this.rings.splice(i, 1);
    }
    this.negFrames = Math.max(0, this.negFrames - dt);
    this.chroma = Math.max(0, this.chroma - dt * 2.2);
    for (let i = this.bossGhosts.length - 1; i >= 0; i--) {
      this.bossGhosts[i].life -= dt * 3.2;
      if (this.bossGhosts[i].life <= 0) this.bossGhosts.splice(i, 1);
    }
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 420 * dt; s.rot += s.vr * dt;
      if (s.life <= 0) this.shards.splice(i, 1);
    }
    // cendres de premier plan : dérive lente, boucle (pool fixe, zéro allocation)
    for (const a of this.fgAsh) {
      a.x += a.vx * dt; a.y += a.vy * dt;
      if (a.y < -14) { a.y = VH + 14; a.x = Math.random() * VW; }
      if (a.x < -14) a.x = VW + 14; else if (a.x > VW + 14) a.x = -14;
    }
    // traînées du Colosse : dès qu'il file (ruée / plongeon), il laisse des échos
    if (Math.abs(this.bDraw.x - this.prevBDrawX) > 6 && this.bDraw.s > 0)
      this.bossGhosts.push({ x: this.bDraw.x, y: this.bDraw.y, s: this.bDraw.s, life: 1 });
    this.prevBDrawX = this.bDraw.x;
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
    this.atkKind = kind; this.atkHit = false; this.atkPhase = "windup"; this.atkStepped = false;
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

    // pas d'engagement : la frappe porte le corps en avant (le coup se SENT)
    if (this.atkPhase === "active" && !this.atkStepped) {
      this.atkStepped = true;
      this.hx = clamp(this.hx + this.hFacing * (this.atkKind === "heavy" ? 26 : 13), ARENA_L, ARENA_R);
      if (this.atkKind === "heavy") this.ghosts.push({ x: this.hx - this.hFacing * 18, life: 0.8 });
    }

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
    this.hitstop = heavy ? 0.12 : 0.05;
    this.screenShake = heavy ? 1.1 : 0.5;
    const col = heavy ? "#ffd8b0" : "#ffb0a0";
    if (heavy) {
      this.rings.push({ x: this.bx, y: FLOOR_Y - this.boss.size * 0.35, r: 10, maxR: 130, life: 0.4, color: col });
      this.negFrames = 0.08; this.chroma = 0.16; // impact façon animé
    }
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
    // Rayon : démarre du bord opposé au héros et balaie vers lui puis au-delà.
    if (a.kind === "beam") {
      const fromRight = this.hx < (ARENA_L + ARENA_R) / 2;
      this.beamX = fromRight ? ARENA_R + 40 : ARENA_L - 40;
      this.beamVX = (fromRight ? -1 : 1) * (a.speed ?? 360);
    }
    Audio.sfx(a.kind === "dive" ? "roar" : a.kind === "teleport" ? "dodge" : "guard");
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
        // ANÉANTISSEMENT / OUBLI : l'impact libère deux ondes de choc en prime.
        if (a.labelKey === "epic.mv.annihilation" || a.labelKey === "epic.mv.oblivion") {
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
      case "zones": {
        // Motif d'éruptions au sol avec des interstices sûrs : place-toi dans les trous.
        const count = a.hits ?? 6;
        const span = ARENA_R - ARENA_L;
        const gap = Math.floor(Math.random() * count); // une colonne épargnée (refuge)
        for (let k = 0; k < count; k++) {
          if (k === gap) continue;
          const x = ARENA_L + span * (k + 0.5) / count;
          this.zones.push({ x, r: (span / count) * 0.62, delay: 0.55 + Math.random() * 0.15, active: 0.22, dmg: a.dmg, color: a.color, hit: false, fromSky: false });
        }
        Audio.sfx("warden");
        break;
      }
      case "rain": {
        // Pluie de météores : positions étalées, retombées échelonnées (bullet-hell vertical).
        const count = a.hits ?? 8;
        for (let k = 0; k < count; k++) {
          const x = ARENA_L + 30 + Math.random() * (ARENA_R - ARENA_L - 60);
          this.zones.push({ x, r: 46, delay: 0.5 + k * 0.14 + Math.random() * 0.1, active: 0.2, dmg: a.dmg, color: a.color, hit: false, fromSky: true });
        }
        // plus deux impacts garantis autour de la position actuelle du héros (anti-immobilisme)
        for (const off of [-70, 70])
          this.zones.push({ x: clamp(this.hx + off, ARENA_L, ARENA_R), r: 46, delay: 0.8, active: 0.2, dmg: a.dmg, color: a.color, hit: false, fromSky: true });
        Audio.sfx("phase2");
        break;
      }
      case "beam":
        this.screenShake = 0.6;
        this.flashTint = 0.2; this.flashColor = a.color;
        Audio.sfx("chain");
        break;
      case "teleport": {
        // Se dissout puis réapparaît en flanquant le héros, et frappe autour de lui.
        this.particles.burst(this.bx, FLOOR_Y - this.boss.size * 0.35, a.color, 20, 140, 0.6, 3.4, true);
        const side = this.hx < (ARENA_L + ARENA_R) / 2 ? 1 : -1;
        this.bx = clamp(this.hx + side * 100, ARENA_L + 40, ARENA_R - 40);
        this.particles.burst(this.bx, FLOOR_Y - this.boss.size * 0.35, a.color, 24, 160, 0.7, 3.6, true);
        this.hitstop = 0.05;
        Audio.sfx("crit");
        break;
      }
      case "phantom": {
        // Spectres surgissant aux flancs pour un feu croisé.
        const y = FLOOR_Y - this.boss.size * 0.35;
        const spots = [ARENA_L + 60, ARENA_R - 60, (ARENA_L + ARENA_R) / 2];
        const n = Math.min(spots.length, a.hits ?? 2);
        for (let k = 0; k < n; k++)
          this.phantoms.push({ x: spots[k], y, timer: 0.5 + k * 0.22, dmg: a.dmg, color: a.color, fired: false, life: 1.6, speed: a.speed ?? 460 });
        Audio.sfx("warden");
        break;
      }
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
    } else if (a.kind === "spin" || a.kind === "teleport") {
      // frappe tournoyante / réapparition : dangereuse des deux côtés à la fois
      if (!this.swingHit && this.dist < a.range && this.invuln <= 0 && this.rollTimer <= 0) {
        this.swingHit = true;
        this.hurtHero(a.dmg, this.hx < this.bx ? -1 : 1, true);
      }
    } else if (a.kind === "beam") {
      // rayon vertical qui balaie : roule au travers (i-frames) ou tiens-toi du bon côté
      this.beamX += this.beamVX * dt;
      if (Math.abs(this.hx - this.beamX) < a.range && this.invuln <= 0 && this.rollTimer <= 0) {
        this.hurtHero(a.dmg, this.beamVX > 0 ? 1 : -1, true); // l'invuln post-coup évite le multi-hit
      }
      if (Math.random() < dt * 60) this.particles.spawn({ x: this.beamX + (Math.random() - 0.5) * a.range, y: 40 + Math.random() * (FLOOR_Y - 40), vx: 0, vy: 40, life: 0.3, maxLife: 0.3, size: 3, color: a.color, glow: true });
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

  // Éruptions au sol / météores : télégraphe (delay) puis explosion (active).
  private updateZones(dt: number) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      if (z.delay > 0) {
        z.delay -= dt;
        if (z.delay <= 0) { // l'impact frappe
          this.screenShake = Math.max(this.screenShake, 0.6);
          this.particles.burst(z.x, FLOOR_Y, z.color, 20, 160, 0.6, 3.4, true);
          Audio.sfx("hit");
        }
        continue;
      }
      if (!z.hit && Math.abs(this.hx - z.x) < z.r && this.invuln <= 0 && this.rollTimer <= 0 && this.flaskTimer <= 0) {
        z.hit = true;
        this.hurtHero(z.dmg, this.hx < z.x ? -1 : 1, true);
      }
      z.active -= dt;
      if (z.active <= 0) this.zones.splice(i, 1);
    }
  }

  // Spectres : après un court délai, chacun tire un projectile vers le héros, puis s'efface.
  private updatePhantoms(dt: number) {
    for (let i = this.phantoms.length - 1; i >= 0; i--) {
      const ph = this.phantoms[i];
      ph.timer -= dt;
      if (ph.timer <= 0 && !ph.fired) {
        ph.fired = true;
        const dir = this.hx < ph.x ? -1 : 1;
        this.projectiles.push({ x: ph.x + dir * 20, y: ph.y, vx: dir * ph.speed, r: 14, dmg: ph.dmg, color: ph.color, life: 2.4, hit: false, wave: false });
        this.particles.burst(ph.x, ph.y, ph.color, 12, 120, 0.5, 3, true);
        Audio.sfx("hit");
      }
      if (ph.fired) { ph.life -= dt; if (ph.life <= 0) this.phantoms.splice(i, 1); }
    }
  }

  // ---------------- Dégâts au héros (garde / parade / i-frames) ----------------
  private hurtHero(dmg: number, fromDir: number, knock: boolean) {
    if (this.invuln > 0 || this.rollTimer > 0) return; // esquive parfaite

    if (this.blocking) {
      // Parade : bloquer dans la toute première fenêtre annule tout et chancelle le boss.
      if (this.blockHeld <= EPIC_HERO.parryWindow) {
        Audio.sfx("seal");
        this.parries++;
        this.slowmo = 0.55;   // BULLET-TIME : le monde ralentit, ta fenêtre de riposte s'ouvre
        this.hitstop = 0.1;
        this.negFrames = 0.1; this.chroma = 0.18;
        this.flashTint = 0.35; this.flashColor = "#ffe14a";
        this.rings.push({ x: this.hx + fromDir * -16, y: FLOOR_Y - 44, r: 8, maxR: 110, life: 0.45, color: "#ffe14a" });
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
      this.dmgTaken += reduced;
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
    this.dmgTaken += dmg;
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
      this.screenShake = 2; this.hitstop = 0.18; this.slowmo = 0.7; // le monde retient son souffle
      this.negFrames = 0.12; this.chroma = 0.2;
      // la barre de PV se brise au seuil : des éclats en tombent
      const mkx = VW / 2 - 280 + 560 * this.boss.phaseAt[this.bphase - 1];
      for (let i = 0; i < 6; i++)
        this.shards.push({ x: mkx + (Math.random() - 0.5) * 8, y: 64, vx: (Math.random() - 0.5) * 120, vy: 30 + Math.random() * 80, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 9, life: 0.9 });
      this.flashTint = 0.5; this.flashColor = this.boss.glow;
      this.rings.push({ x: this.bx, y: FLOOR_Y - this.boss.size * 0.4, r: 14, maxR: 320, life: 0.6, color: this.boss.glow });
      this.particles.burst(this.bx, FLOOR_Y - this.boss.size * 0.4, this.boss.glow, 40, 220, 1.1, 4.5, true);
      // l'arène tremble : des débris pleuvent du plafond
      for (let i = 0; i < 22; i++) {
        this.particles.spawn({
          x: Math.random() * VW, y: -10 - Math.random() * 40,
          vx: (Math.random() - 0.5) * 20, vy: 140 + Math.random() * 160,
          life: 1.6, maxLife: 1.6, size: 2 + Math.random() * 2.4,
          color: Math.random() < 0.4 ? this.boss.glow : "#6a6280", glow: Math.random() < 0.4,
        });
      }
      // révélation : les coups débloqués par cette phase s'annoncent
      const revealed = this.boss.attacks.filter(a => a.fromPhase === this.bphase);
      if (revealed.length > 0) {
        this.revealBanner = 2.6;
        this.revealText = revealed.map(a => T(a.labelKey)).join("  •  ");
      }
      this.bstate = "idle"; this.bidle = 0.6; this.cur = null; this.comboLeft = 0;
      this.airborne = false;
      this.projectiles = []; this.zones = []; this.phantoms = [];
      Audio.sfx("phase2");
    }
  }

  // Rang de combat : les dégâts subis pèsent, chaque parade rachète, la lenteur pénalise un peu.
  private computeRank(): string {
    const score = this.dmgTaken - this.parries * 8 + (this.fightT > 130 ? 15 : 0);
    if (this.dmgTaken === 0 || score <= 12) return "S";
    if (score <= 50) return "A";
    if (score <= 105) return "B";
    return "C";
  }

  private win() {
    this.phase = "won"; this.outcomeT = 0; this.bdeathT = 0.001;
    this.negFrames = 0.12; this.chroma = 0.2;
    this.rank = this.computeRank();
    if (this.bossIndex >= 0) recordEpicRank(this.bossIndex, this.rank);
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
    // caméra dynamique : léger zoom recentré sur l'action (parade, phase, exécution)
    if (this.camZoom > 1.002) {
      g.translate(this.camFx, this.camFy);
      g.scale(this.camZoom, this.camZoom);
      g.translate(-this.camFx, -this.camFy);
    }

    // fond
    const grad = g.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, this.boss.bg[0]); grad.addColorStop(0.6, this.boss.bg[1]); grad.addColorStop(1, this.boss.bg[2]);
    g.fillStyle = grad; g.fillRect(-12, -12, VW + 24, VH + 24);
    // l'arène s'imprègne de la couleur du Colosse à chaque phase franchie
    if (this.bphase > 0) {
      g.globalAlpha = 0.05 * this.bphase;
      g.fillStyle = this.boss.glow; g.fillRect(-12, -12, VW + 24, VH + 24);
      g.globalAlpha = 1;
    }

    // décor de fond propre au Colosse (piliers / statues / stalactites / arches)
    this.drawBackdrop(g);

    // sol
    g.fillStyle = "rgba(255,255,255,.05)";
    g.fillRect(ARENA_L - 30, FLOOR_Y + 8, ARENA_R - ARENA_L + 60, 4);
    g.fillStyle = "rgba(0,0,0,.35)";
    g.fillRect(-12, FLOOR_Y + 12, VW + 24, VH);

    this.ambient.draw(g);
    // éclairage dynamique : les télégraphes et tes frappes baignent l'arène de leur couleur
    this.drawDynamicLight(g);

    // ---- télégraphes de danger (avant les sprites, au sol) ----
    this.drawTelegraph(g);
    this.drawZones(g);
    // ---- projectiles / ondes ----
    for (const p of this.projectiles) this.drawProjectile(g, p);
    // ---- spectres (derrière le boss) ----
    this.drawPhantoms(g);

    // ---- boss ----
    this.drawBoss(g);
    // ---- héros ----
    this.drawHero(g);
    // ---- reflets dans le marbre du Panthéon ----
    this.drawReflections(g);
    // ---- aberration chromatique (gros impacts) : la scène se dédouble rouge/cyan ----
    if (this.chroma > 0.01) {
      const off = 2.5 + this.chroma * 12;
      const a = Math.min(0.32, this.chroma * 1.8);
      const bs = getSprite(this.boss.sprite), hs = getSprite("player");
      g.save(); g.imageSmoothingEnabled = false; g.globalAlpha = a; g.globalCompositeOperation = "lighter";
      g.filter = "sepia(1) saturate(8) hue-rotate(-60deg) brightness(1.3)"; // fantôme rouge
      if (bs && this.bdeathT === 0) g.drawImage(bs, this.bDraw.x - off, this.bDraw.y, this.bDraw.s, this.bDraw.s);
      if (hs) g.drawImage(hs, this.hDraw.x - off, this.hDraw.y, this.hDraw.s, this.hDraw.s);
      g.filter = "sepia(1) saturate(8) hue-rotate(140deg) brightness(1.3)"; // fantôme cyan
      if (bs && this.bdeathT === 0) g.drawImage(bs, this.bDraw.x + off, this.bDraw.y, this.bDraw.s, this.bDraw.s);
      if (hs) g.drawImage(hs, this.hDraw.x + off, this.hDraw.y, this.hDraw.s, this.hDraw.s);
      g.filter = "none";
      g.restore();
    }
    // ---- rayon balayant (par-dessus tout) ----
    this.drawBeam(g);

    // ---- anneaux de choc (parade, coup lourd, phase) ----
    for (const r of this.rings) {
      g.save();
      g.globalAlpha = clamp(r.life / 0.45, 0, 1) * 0.85;
      g.strokeStyle = r.color; g.lineWidth = 3.5; g.shadowColor = r.color; g.shadowBlur = 14;
      g.beginPath(); g.arc(r.x, r.y, r.r, 0, Math.PI * 2); g.stroke();
      g.restore();
    }

    // ---- particules & dégâts flottants ----
    this.particles.draw(g);
    for (const f of this.floaters) {
      const a = clamp(f.life / f.maxLife, 0, 1);
      g.globalAlpha = a;
      textShadow(g, f.text, f.x, f.y, f.size, f.color, "center");
      g.globalAlpha = 1;
    }

    // cendres de premier plan : elles passent DEVANT les combattants (profondeur)
    g.save();
    for (const a2 of this.fgAsh) {
      const fg = g.createRadialGradient(a2.x, a2.y, 1, a2.x, a2.y, a2.r);
      fg.addColorStop(0, `rgba(200,190,215,${a2.a.toFixed(3)})`);
      fg.addColorStop(1, "rgba(200,190,215,0)");
      g.fillStyle = fg;
      g.beginPath(); g.arc(a2.x, a2.y, a2.r, 0, Math.PI * 2); g.fill();
    }
    g.restore();

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

    // FRAMES NÉGATIVES : l'instant d'impact en silhouettes blanches sur noir (façon animé)
    if (this.negFrames > 0) {
      g.fillStyle = "#05040a"; g.fillRect(-12, -12, VW + 24, VH + 24);
      const bs = getSprite(this.boss.sprite), hs = getSprite("player");
      g.save(); g.imageSmoothingEnabled = false;
      g.filter = "brightness(0) invert(1)";
      if (bs) g.drawImage(bs, this.bDraw.x, this.bDraw.y, this.bDraw.s, this.bDraw.s);
      if (hs) g.drawImage(hs, this.hDraw.x, this.hDraw.y, this.hDraw.s, this.hDraw.s);
      g.filter = "none";
      g.restore();
    }
    g.restore();

    this.drawHUD(g);
    if (this.phase === "intro") this.drawIntro(g);
    if (this.phase === "won") this.drawOutcome(g, true);
    if (this.phase === "lost") this.drawOutcome(g, false);
  }

  // Décor de fond propre au Colosse : chaque arène a sa silhouette (teintée de son aura).
  private drawBackdrop(g: CanvasRenderingContext2D) {
    const rgb = hexToRgb(this.boss.glow) ?? "120,110,150";
    const kind = this.bossIndex >= 0 ? this.bossIndex % 4 : 0;
    g.save();
    if (kind === 0) { // piliers du Panthéon (défilement lent)
      for (let i = 0; i < 5; i++) {
        const px = ((i * 230 + this.t * (5 + i * 2)) % (VW + 160)) - 80;
        g.fillStyle = `rgba(${rgb},.06)`;
        g.fillRect(px, 30, 46 + (i % 3) * 16, VH - 150);
      }
    } else if (kind === 1) { // statues effondrées
      for (let i = 0; i < 4; i++) {
        const sx = 90 + i * 240, tilt = (i % 2 ? 1 : -1) * 0.1;
        g.save(); g.translate(sx, FLOOR_Y); g.rotate(tilt);
        g.fillStyle = `rgba(${rgb},.07)`;
        g.fillRect(-26, -230 + (i % 2) * 60, 52, 230 - (i % 2) * 60); // buste
        g.beginPath(); g.arc(0, -252 + (i % 2) * 60, 24, 0, Math.PI * 2); g.fill(); // tête
        g.restore();
      }
    } else if (kind === 2) { // stalactites de la voûte
      for (let i = 0; i < 8; i++) {
        const sx = 40 + i * 125 + Math.sin(i * 3.7) * 26;
        const h = 90 + (i % 3) * 70;
        g.fillStyle = `rgba(${rgb},.07)`;
        g.beginPath(); g.moveTo(sx - 22, 0); g.lineTo(sx + 22, 0); g.lineTo(sx, h); g.closePath(); g.fill();
      }
    } else { // arches gothiques
      g.strokeStyle = `rgba(${rgb},.09)`; g.lineWidth = 12;
      for (let i = 0; i < 4; i++) {
        const cx = 120 + i * 240;
        g.beginPath(); g.moveTo(cx - 80, FLOOR_Y);
        g.lineTo(cx - 80, 190); g.arc(cx, 190, 80, Math.PI, 0); g.lineTo(cx + 80, FLOOR_Y);
        g.stroke();
      }
    }
    g.restore();
  }

  // Éclairage dynamique : le danger annonce sa couleur, tes coups éclairent la scène.
  private drawDynamicLight(g: CanvasRenderingContext2D) {
    // télégraphe du boss : lueur au sol sur la zone menacée + bords d'écran teintés
    if (this.bstate === "windup" && this.cur) {
      const a = this.cur;
      const prog = 1 - clamp(this.bstateT / (a.windup * this.timeScale()), 0, 1);
      const tx = a.kind === "slam" || a.kind === "dive" ? this.slamX : this.bx;
      const rad = (a.range ?? 120) + 140;
      const gl = g.createRadialGradient(tx, FLOOR_Y, 10, tx, FLOOR_Y, rad);
      const rgb = hexToRgb(a.color) ?? "255,80,90";
      gl.addColorStop(0, `rgba(${rgb},${(0.1 + prog * 0.2).toFixed(3)})`);
      gl.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gl;
      g.beginPath(); g.ellipse(tx, FLOOR_Y, rad, rad * 0.4, 0, 0, Math.PI * 2); g.fill();
      // les bords de l'écran s'embrasent avec l'imminence du coup
      const ea = 0.12 * prog;
      for (const [x0, x1] of [[0, 90], [VW, VW - 90]] as const) {
        const eg = g.createLinearGradient(x0, 0, x1, 0);
        eg.addColorStop(0, `rgba(${rgb},${ea.toFixed(3)})`); eg.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = eg; g.fillRect(Math.min(x0, x1), 0, 90, VH);
      }
    }
    // frappe du héros : sa lumière éclaire brièvement le sol
    if (this.atkKind && this.atkPhase === "active") {
      const col = this.atkKind === "heavy" ? "255,216,176" : "223,230,255";
      const gl = g.createRadialGradient(this.hx, FLOOR_Y - 30, 8, this.hx, FLOOR_Y - 30, 150);
      gl.addColorStop(0, `rgba(${col},.16)`); gl.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gl;
      g.beginPath(); g.arc(this.hx, FLOOR_Y - 30, 150, 0, Math.PI * 2); g.fill();
    }
  }

  // Reflets dans le marbre : les combattants se mirent sous la ligne de sol.
  private drawReflections(g: CanvasRenderingContext2D) {
    const feet = FLOOR_Y + 11;
    g.save();
    g.imageSmoothingEnabled = false;
    g.globalAlpha = 0.15;
    const bs = getSprite(this.boss.sprite);
    if (bs && this.bDraw.s > 0 && this.bdeathT === 0) {
      g.save();
      g.translate(0, feet); g.scale(1, -0.85); g.translate(0, -feet);
      g.drawImage(bs, this.bDraw.x, this.bDraw.y, this.bDraw.s, this.bDraw.s);
      g.restore();
    }
    const hs = getSprite("player");
    if (hs) {
      g.save();
      g.translate(0, feet); g.scale(1, -0.85); g.translate(0, -feet);
      if (this.hDraw.flip) { const cx = this.hDraw.x + this.hDraw.s / 2; g.translate(cx, 0); g.scale(-1, 1); g.translate(-cx, 0); }
      g.drawImage(hs, this.hDraw.x, this.hDraw.y, this.hDraw.s, this.hDraw.s);
      g.restore();
    }
    g.restore();
    // le reflet s'évanouit avec la profondeur du marbre
    const fade = g.createLinearGradient(0, feet, 0, feet + 110);
    fade.addColorStop(0, "rgba(8,6,14,.25)"); fade.addColorStop(1, "rgba(8,6,14,.95)");
    g.fillStyle = fade;
    g.fillRect(-12, feet, VW + 24, 130);
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
    } else if (a.kind === "projectile" || a.kind === "volley" || a.kind === "phantom") {
      g.beginPath(); g.arc(this.bx + this.bFacing * 30, FLOOR_Y - this.boss.size * 0.35, 8 + prog * 10, 0, Math.PI * 2); g.fill();
    } else if (a.kind === "beam") {
      // ligne fantôme au point de départ + flèche du sens de balayage
      g.globalAlpha = 0.3 + prog * 0.4;
      g.fillRect(this.beamX - 2, 0, 4, FLOOR_Y + 30);
      const arrow = this.beamVX > 0 ? "»»»" : "«««";
      textShadow(g, arrow, this.beamX + Math.sign(this.beamVX) * 26, FLOOR_Y - 60, 20, a.color, "center");
    } else if (a.kind === "teleport") {
      g.beginPath(); g.arc(this.bx, FLOOR_Y - this.boss.size * 0.35, 20 + prog * 16, 0, Math.PI * 2); g.stroke();
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

  private drawZones(g: CanvasRenderingContext2D) {
    for (const z of this.zones) {
      g.save();
      if (z.delay > 0) {
        // télégraphe : cercle qui se resserre + réticule ; météore qui tombe
        const p = clamp(1 - z.delay / 0.7, 0, 1);
        g.globalAlpha = 0.2 + p * 0.4;
        g.strokeStyle = z.color; g.lineWidth = 2;
        g.beginPath(); g.ellipse(z.x, FLOOR_Y + 6, z.r, z.r * 0.34, 0, 0, Math.PI * 2); g.stroke();
        g.globalAlpha = 0.15 + p * 0.35; g.fillStyle = z.color;
        g.beginPath(); g.ellipse(z.x, FLOOR_Y + 6, z.r * (1 - p * 0.5), z.r * 0.34 * (1 - p * 0.5), 0, 0, Math.PI * 2); g.fill();
        if (z.fromSky) { // le météore descend
          const my = -20 + p * (FLOOR_Y - 20);
          g.shadowColor = z.color; g.shadowBlur = 16;
          g.beginPath(); g.arc(z.x, my, 10, 0, Math.PI * 2); g.fill();
        }
      } else {
        // explosion
        const p = clamp(z.active / 0.22, 0, 1);
        g.globalAlpha = p * 0.8; g.fillStyle = z.color;
        g.shadowColor = z.color; g.shadowBlur = 20;
        g.beginPath(); g.ellipse(z.x, FLOOR_Y, z.r * (1.1 - p * 0.2), z.r * 0.5, 0, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }
  }

  private drawPhantoms(g: CanvasRenderingContext2D) {
    const spr = getSprite(this.boss.sprite);
    const size = this.boss.size * 0.7;
    for (const ph of this.phantoms) {
      g.save();
      g.globalAlpha = (ph.fired ? clamp(ph.life / 1.1, 0, 1) : clamp(1 - ph.timer / 0.5, 0.2, 0.5)) * 0.6;
      g.imageSmoothingEnabled = false;
      g.shadowColor = ph.color; g.shadowBlur = 18;
      if (spr) g.drawImage(spr, ph.x - size / 2, FLOOR_Y - size, size, size);
      g.restore();
    }
  }

  private drawBeam(g: CanvasRenderingContext2D) {
    if (this.bstate !== "active" || !this.cur || this.cur.kind !== "beam") return;
    const w = this.cur.range;
    g.save();
    g.globalAlpha = 0.32;
    const bg = g.createLinearGradient(this.beamX - w, 0, this.beamX + w, 0);
    bg.addColorStop(0, "rgba(0,0,0,0)"); bg.addColorStop(0.5, this.cur.color); bg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = bg;
    g.fillRect(this.beamX - w, 0, w * 2, FLOOR_Y + 40);
    g.globalAlpha = 0.9; g.fillStyle = "#fff";
    g.fillRect(this.beamX - 3, 0, 6, FLOOR_Y + 40);
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

    // traînées du Colosse (ruée / plongeon) : échos teintés de son aura
    for (const gh of this.bossGhosts) {
      if (!spr) break;
      g.save(); g.imageSmoothingEnabled = false;
      g.globalAlpha = gh.life * 0.22;
      g.shadowColor = this.boss.glow; g.shadowBlur = 14;
      g.drawImage(spr, gh.x, gh.y, gh.s, gh.s);
      g.restore();
    }

    g.save();
    g.imageSmoothingEnabled = false;
    g.shadowColor = this.boss.glow; g.shadowBlur = (this.bstate === "windup" ? 40 : 26) + Math.sin(this.t * 2.4) * 10;
    if (dying) g.globalAlpha = clamp(1 - this.bdeathT / 1.2, 0, 1);
    if (this.bstate === "stagger") g.globalAlpha *= 0.6 + Math.sin(this.t * 20) * 0.15;
    const bx = drawX - size / 2, by = FLOOR_Y - size + bob - liftY;
    this.bDraw = { x: bx, y: by, s: size }; // mémorisé pour reflets / chroma / frames négatives
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
    this.hDraw = { x: this.hx - size / 2, y: FLOOR_Y - size, s: size, flip }; // mémorisé pour reflets / chroma / négatif
    if (spr) g.drawImage(spr, this.hx - size / 2, FLOOR_Y - size, size, size);
    g.restore();

    // arme / effet d'attaque : double arc de lame avec traînée (le coup a un corps)
    if (this.atkKind && this.atkPhase !== "windup") {
      const reach = this.atkKind === "heavy" ? EPIC_HERO.heavyReach : EPIC_HERO.lightReach;
      const heavy = this.atkKind === "heavy";
      const col = heavy ? "#ffd8b0" : "#dfe6ff";
      const active = this.atkPhase === "active";
      const cx = this.hx + this.hFacing * 20, cy = FLOOR_Y - size * 0.55;
      const a0 = this.hFacing > 0 ? -0.9 : Math.PI - 0.9 + 1.8;
      const a1 = this.hFacing > 0 ? 0.9 : Math.PI + 0.9 + 1.8;
      g.save();
      // traînée large et diffuse derrière le tranchant
      g.globalAlpha = active ? 0.35 : 0.15;
      g.strokeStyle = col; g.lineWidth = heavy ? 16 : 10; g.shadowColor = col; g.shadowBlur = 18;
      g.beginPath(); g.arc(cx, cy, reach * 0.62, a0, a1); g.stroke();
      // tranchant net
      g.globalAlpha = active ? 0.95 : 0.4;
      g.lineWidth = heavy ? 6 : 4; g.shadowBlur = 12;
      g.beginPath(); g.arc(cx, cy, reach * 0.72, a0, a1); g.stroke();
      // pointe incandescente sur la lourde
      if (heavy && active) {
        g.globalAlpha = 0.9; g.fillStyle = "#fff";
        const tip = this.hFacing > 0 ? a1 : a0;
        g.beginPath(); g.arc(cx + Math.cos(tip) * reach * 0.72, cy + Math.sin(tip) * reach * 0.72, 4, 0, Math.PI * 2); g.fill();
      }
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
    // ---- barre de PV du boss (haut) : nom ornementé + barre segmentée par phases ----
    const bw = 560, bx = VW / 2 - bw / 2, by = 34;
    // filigranes de part et d'autre du nom, teintés de l'aura du Colosse
    g.save();
    g.font = `bold 18px ${FONT}`;
    const nw = g.measureText(T(this.boss.nameKey)).width;
    g.strokeStyle = this.boss.glow; g.globalAlpha = 0.55; g.lineWidth = 1.4;
    for (const dir of [-1, 1] as const) {
      const x0 = VW / 2 + dir * (nw / 2 + 22);
      g.beginPath(); g.moveTo(x0, by - 6); g.lineTo(x0 + dir * 70, by - 6); g.stroke();
      textShadow(g, "❖", x0 + dir * 82, by - 6, 11, this.boss.glow, "center");
    }
    g.restore();
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
    // segments de phase : entaille sombre, marqueur qui s'embrase une fois le seuil brisé
    this.boss.phaseAt.forEach((th, i) => {
      const mx = bx + bw * th;
      g.fillStyle = "rgba(8,6,14,.95)";
      g.fillRect(mx - 2, by + 21, 4, 16);
      const broken = this.bphase > i;
      g.strokeStyle = broken ? this.boss.glow : "rgba(255,255,255,.5)";
      g.lineWidth = broken ? 2 : 1;
      if (broken) { g.save(); g.shadowColor = this.boss.glow; g.shadowBlur = 8; }
      g.beginPath(); g.moveTo(mx, by + 20); g.lineTo(mx, by + 38); g.stroke();
      if (broken) g.restore();
    });
    // éclats de barre brisée (au passage d'un seuil)
    for (const s of this.shards) {
      g.save();
      g.globalAlpha = clamp(s.life / 0.6, 0, 1);
      g.translate(s.x, s.y); g.rotate(s.rot);
      g.fillStyle = this.boss.glow; g.shadowColor = this.boss.glow; g.shadowBlur = 6;
      g.fillRect(-3, -1.5, 6, 3);
      g.restore();
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

    // endurance — le bord de la jauge BRÛLE (braise vive, rouge quand une action est refusée)
    const sy = py + 22;
    g.fillStyle = "rgba(8,6,14,.8)";
    g.beginPath(); g.roundRect(px, sy, phw, 9, 4); g.fill();
    const sf = clamp(this.stamina / EPIC_HERO.maxStamina, 0, 1);
    g.fillStyle = this.staminaFlash > 0 ? "#ff6060" : "#e0b048";
    g.beginPath(); g.roundRect(px, sy, phw * sf, 9, 4); g.fill();
    if (sf > 0.02) {
      const fx2 = px + phw * sf, flick = 3.4 + Math.sin(this.t * 16) * 1.6 + (this.staminaFlash > 0 ? 3 : 0);
      g.save();
      g.fillStyle = this.staminaFlash > 0 ? "#ff6060" : "#ffd84a";
      g.shadowColor = this.staminaFlash > 0 ? "#ff3030" : "#ff9d2e";
      g.shadowBlur = 10 + Math.sin(this.t * 12) * 4;
      g.beginPath(); g.arc(fx2, sy + 4.5, flick, 0, Math.PI * 2); g.fill();
      g.restore();
    }

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
    // révélation des coups débloqués par la phase
    if (this.revealBanner > 0) {
      const a = clamp(this.revealBanner / 0.5, 0, 1);
      g.globalAlpha = Math.min(1, a);
      textShadow(g, T("epic.newmove", { name: this.revealText }), VW / 2, VH / 2 + 4, 17, "#ffd0d0", "center");
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
    g.fillStyle = `rgba(5,4,10,${a * (won ? 0.72 : 0.84)})`;
    g.fillRect(0, 0, VW, VH);
    // défaite : dans le noir, seules les braises du Colosse te regardent mourir
    if (!won) {
      const e = clamp((this.outcomeT - 0.5) / 1.2, 0, 1) * (0.7 + Math.sin(this.t * 3) * 0.3);
      if (e > 0) {
        g.save(); g.fillStyle = this.boss.glow; g.shadowColor = this.boss.glow; g.shadowBlur = 30 * e; g.globalAlpha = e;
        const ey = FLOOR_Y - this.boss.size * 0.62;
        g.beginPath(); g.ellipse(this.bx - 16, ey, 7, 10, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(this.bx + 16, ey, 7, 10, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    }
    g.save();
    g.shadowColor = won ? "#ffd84a" : "#c02840"; g.shadowBlur = 24;
    textShadow(g, won ? T("epic.win") : T("epic.dead"), VW / 2, VH / 2 - 16, 52, won ? "#ffe6a0" : "#ff6070", "center");
    g.restore();
    // rang de combat (victoire) : la lettre tombe avec un léger rebond
    if (won && this.rank) {
      const ra = clamp((this.outcomeT - 0.8) / 0.4, 0, 1);
      if (ra > 0) {
        const RC: Record<string, string> = { S: "#ffd84a", A: "#c8a8ff", B: "#8fd4ff", C: "#a8a4b8" };
        const scale = 1 + (1 - ra) * 1.6;
        g.save();
        g.globalAlpha = ra;
        g.translate(VW / 2 + 268, VH / 2 - 30); g.scale(scale, scale);
        g.shadowColor = RC[this.rank]; g.shadowBlur = 26;
        g.font = `bold 64px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillStyle = RC[this.rank];
        g.fillText(this.rank, 0, 0);
        g.restore();
        const mm = Math.floor(this.fightT / 60), ss = Math.floor(this.fightT % 60);
        text(g, T("epic.rank.stats", { time: `${mm}:${ss.toString().padStart(2, "0")}`, dmg: Math.round(this.dmgTaken), parry: this.parries }),
          VW / 2, VH / 2 + 24, 13, "#c8c0d4", "center");
      }
    }
    if (this.outcomeT > 1.4 && Math.sin(this.t * 5) > -0.3)
      text(g, T("epic.continue"), VW / 2, VH / 2 + 48, 16, "#c8c0d4", "center");
  }
}

// Type interne : copie mutable d'une attaque en cours d'exécution.
interface EpicAtk extends EpicAttack { }

// "#rrggbb" → "r,g,b" (pour teinter l'AmbientFX aux couleurs du Colosse)
function hexToRgb(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
