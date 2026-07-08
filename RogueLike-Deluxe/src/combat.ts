// ===== Combat tour par tour, refondu =====
// Deux piliers nouveaux par rapport au port C# d'origine :
//  1. INTENTS : l'ennemi annonce son prochain coup (télégraphe façon Slay the Spire).
//     Chaque espèce a un pattern cyclique ; les boss changent de pattern en phase 2 ;
//     les gros coups passent par un tour de CHARGE lisible que le joueur peut mitiger.
//  2. HOOKS DE BOONS : les boons élémentaires (Braise/Givre/Sang/Tempête) s'appliquent
//     à-la-frappe / au-crit / au-kill / au-subi et résonnent entre eux (voir boons.ts).
import { GameContext, LogKind } from "./context";
import { Monster, MonsterRank } from "./entities";
import { hasResonance, elementStacks } from "./boons";
import { SKILLS } from "./skills";
import { T } from "./i18n";

export type CombatActionId = "attack" | "heal" | "dodge" | "flee" | "class" | "skill" | "item";

export interface CombatEvent {
  type: "playerHit" | "playerCrit" | "enemyHit" | "playerDodge" | "heal" | "dodgeUp"
      | "fleeOk" | "fleeFail" | "enemyDead" | "playerDead" | "phase2" | "levelup" | "reward"
      | "classAbility" | "enemySpecial" | "enemyBuff"
      | "itemUse" | "poisonEnemy" | "poisonPlayer" | "stunEnemy" | "stunPlayer"
      // ---- nouveaux (boons / intents) ----
      | "burn" | "bleed" | "chill" | "freeze" | "thunder" | "echoHit" | "combustion"
      | "thorns" | "enemyCharge" | "enemyGuard" | "enemyLeech" | "resonance"
      // ---- allié (fin 2 v 1 : le Rival épargné combat à tes côtés) ----
      | "allyHit" | "allyCover" | "allyFall"
      // ---- compétences (menu Techniques) ----
      | "skillHit" | "armorBreak";
  value?: number;
  variant?: string; // ex. classe pour classAbility (warrior/mage/rogue), ou teinte pour skillHit
}

// Allié de combat : le Rival, quand il a été épargné, se dresse contre le Dévoreur d'Âmes.
export interface CombatAlly {
  nameKey: string;
  sprite: string;
  maxHp: number; hp: number;
  attack: number;
  alive: boolean;
}

// ===== Intents : ce que l'ennemi fera à son prochain tour =====
export type IntentKind = "attack" | "heavy" | "charge" | "guard" | "leech" | "venom" | "pierce";

export interface Intent {
  kind: IntentKind;
  mult: number;             // multiplicateur d'ATK effective (attack/heavy/leech/venom/pierce)
  flat?: number;            // bonus plat de dégâts
  arm?: number;             // guard : armure gagnée
  healPct?: number;         // leech : % des dégâts rendus en PV
  poison?: { turns: number; power: number }; // venom
  unavoidable?: boolean;    // ignore l'esquive (mais pas la Brume)
  labelKey: string;         // clé i18n du télégraphe
}

const I = {
  attack: (mult = 1): Intent => ({ kind: "attack", mult, labelKey: "intent.attack" }),
  heavy: (mult: number, flat = 0): Intent => ({ kind: "heavy", mult, flat, labelKey: "intent.heavy" }),
  charge: (mult: number, flat = 0): Intent => ({ kind: "charge", mult, flat, labelKey: "intent.charge" }),
  guard: (arm: number): Intent => ({ kind: "guard", mult: 0, arm, labelKey: "intent.guard" }),
  leech: (mult: number, healPct: number): Intent => ({ kind: "leech", mult, healPct, labelKey: "intent.leech" }),
  venom: (mult: number, power: number, turns = 3): Intent => ({ kind: "venom", mult, poison: { turns, power }, labelKey: "intent.venom" }),
  pierce: (mult: number, flat = 0): Intent => ({ kind: "pierce", mult, flat, labelKey: "intent.pierce" }),
};

export const INTENT_ICON: Record<IntentKind, string> = {
  attack: "⚔", heavy: "💥", charge: "⏳", guard: "🛡", leech: "🧛", venom: "☠", pierce: "⚡",
};

// Pattern cyclique par espèce. Les boss reçoivent un pattern différent en phase 2.
function patternFor(nameKey: string, phase2: boolean): Intent[] {
  switch (nameKey) {
    case "mob.slime": return [I.attack(), I.attack(), I.leech(0.8, 50)];
    case "mob.nightslime": return [I.attack(), I.leech(1.2, 60)];
    case "mob.spider": return [I.attack(), I.venom(0.9, 2), I.attack(1.1)];
    case "mob.golem": return [I.attack(), I.attack(0.9), I.charge(2.4, 3)];
    case "mob.gargoyle": return [I.attack(), I.guard(2), I.heavy(1.6)];
    case "mob.warden":
    case "mob.warden.enraged": return [I.attack(), I.guard(3), I.charge(2.2, 2)];
    case "mob.boss":
      return phase2
        ? [I.attack(1.1), I.pierce(1.4), I.charge(2.8, 5)]
        : [I.attack(), I.attack(1.1), I.charge(2.4, 4)];
    case "mob.rival":
      return phase2
        ? [I.attack(1.1), I.pierce(1.5), I.charge(2.6, 3)]
        : [I.attack(), I.attack(), I.pierce(1.4)];
    case "mob.superboss":
      return phase2
        ? [I.pierce(1.4), I.leech(1.6, 80), I.charge(2.8, 5)]
        : [I.attack(), I.leech(1.4, 80), I.charge(2.5, 5)];
    default: return [I.attack()];
  }
}

export class CombatSession {
  ctx: GameContext;
  enemy: Monster;
  log: string[] = [];
  healsLeft = 2;
  readonly healAmount = 8;
  classAbilityUsesLeft = 1;
  // ---- Énergie : ressource du menu Techniques. Regénère chaque tour ; l'attaque de base en donne. ----
  energy = 3;
  readonly maxEnergy = 6;
  readonly energyRegen = 2;
  mistTurns = 0; // Potion de brume : esquive garantie (même contre les charges)
  enemySpecialUsed = false;
  dodgeTurnsLeft = 0;
  get dodgeChance() { return 40 + this.player.dodgeBonus; }
  readonly fleeChance = 55;
  playerFled = false;
  rewardGiven = false;
  empowerApplied = false;
  readonly empowerAtkBonus = 2;
  phase2 = false;
  events: CombatEvent[] = [];
  over = false;
  victory = false;
  ally: CombatAlly | null = null; // le Rival épargné, à tes côtés contre le Dévoreur (2 v 1)
  private companionAlly = false;  // l'allié courant est-il le compagnon de quête ? (PV à reporter, chute = échec)

  // ---- intents ----
  intent: Intent;                    // ce que l'ennemi fera à son prochain tour (affiché)
  private patternIdx = 0;
  private chargedIntent: Intent | null = null; // coup lourd armé par une charge
  private firstStrikeDone = false;   // pour Tempo (crit garanti) et Grêle (givre massif)

  constructor(ctx: GameContext, enemy: Monster) {
    this.ctx = ctx;
    this.enemy = enemy;
    // Écho arcanique / furtif : capacité de classe utilisable 2 fois
    if (ctx.player.hasTalent("m2b") || ctx.player.hasTalent("r2b")) this.classAbilityUsesLeft = 2;
    // Affixe Blindé : l'élite entre en scène cuirassée
    if (enemy.affix === "shielded") enemy.addArmor(3);

    if (enemy.nameKey === "mob.superboss") {
      this.addLog(T("combat.sboss1"));
      this.addLog(T("combat.sboss2", { name: enemy.name }));
      this.addLog(T("combat.sboss3"));
    } else if (enemy.nameKey === "mob.rival") {
      this.addLog(T("combat.rival1"));
      this.addLog(T("combat.rival2", { name: enemy.name }));
      this.addLog(T(`combat.rival.class.${ctx.player.classId}`));
      this.addLog(T("combat.rival3"));
    } else if (enemy.rank === MonsterRank.Boss) {
      this.addLog(T("combat.boss1"));
      this.addLog(T("combat.boss2", { name: enemy.name }));
      this.addLog(T("combat.boss3"));
    } else {
      this.addLog(T(enemy.feminine ? "combat.appear.f" : "combat.appear", { name: enemy.name }));
    }
    if (enemy.affix) this.addLog(T("combat.affix." + enemy.affix));

    if (ctx.legendaryEmpowerNextFight) {
      ctx.legendaryEmpowerNextFight = false;
      ctx.player.modifyAttack(this.empowerAtkBonus);
      this.empowerApplied = true;
      this.addLog(T("combat.empower"));
    }

    // Fin alliée : le Rival épargné se dresse contre le Dévoreur d'Âmes. Le dernier combat est un 2 v 1.
    if (!ctx.endless && ctx.rivalSpared && enemy.nameKey === "mob.superboss") {
      this.ally = {
        nameKey: "mob.rival", sprite: "rival",
        maxHp: 80, hp: 80,
        attack: Math.max(7, Math.round(ctx.player.attack * 0.6)),
        alive: true,
      };
      this.addLog(T("combat.ally.join", { name: T("mob.rival") }));
    }

    // Compagnon de quête : s'il est en vie et te suit, il combat à tes côtés (PV persistants).
    if (!this.ally && ctx.companion && ctx.companion.alive) {
      const c = ctx.companion;
      this.ally = { nameKey: c.nameKey, sprite: c.sprite, maxHp: c.maxHp, hp: c.hp, attack: c.attack, alive: true };
      this.companionAlly = true;
      this.addLog(T("combat.ally.join", { name: T(c.nameKey) }));
    }

    this.intent = this.rollIntent();
  }

  get player() { return this.ctx.player; }
  get isOver() { return this.player.isDead || this.enemy.isDead || this.playerFled; }

  addLog(s: string) { this.log.push(s); if (this.log.length > 60) this.log.shift(); }
  private emit(e: CombatEvent) { this.events.push(e); }
  drainEvents(): CombatEvent[] { const e = this.events; this.events = []; return e; }
  private roll(pct: number) { return this.ctx.rng.next(0, 100) < pct; }
  private hasCurse(id: string) { return this.ctx.runCurses.includes(id); }

  // ===== Tour complet : action joueur → spéciale/phase 2 → tour ennemi → statuts =====
  playTurn(action: CombatActionId, itemId?: string) {
    if (this.over) return;

    if (this.player.hasStatus("stun")) {
      this.addLog(T("combat.stunned.player"));
      this.emit({ type: "stunPlayer" });
    } else {
      this.executePlayerAction(action, itemId);
    }
    this.checkPhase2();
    this.checkEnemySpecial();
    this.checkEnemyDead();

    if (this.isOver) { this.finish(); return; }

    if (this.enemy.hasStatus("stun")) {
      this.addLog(T("combat.stunned.enemy", { name: this.enemy.name }));
      this.emit({ type: "stunEnemy" });
      // le télégraphe reste armé : l'ennemi gelé reprendra là où il en était
    } else {
      this.resolveEnemyTurn();
      if (!this.enemy.isDead && !this.player.isDead) this.intent = this.rollIntent();
    }
    this.allyTurn(); // le Rival riposte à ton côté (2 v 1)
    if (this.dodgeTurnsLeft > 0) this.dodgeTurnsLeft--;
    this.energy = Math.min(this.maxEnergy, this.energy + this.energyRegen); // regen d'Énergie

    this.tickStatuses();
    this.checkEnemyDead(); // mort par poison/brûlure/saignement/allié

    if (this.player.isDead) {
      this.addLog(T("combat.playerdead"));
      this.emit({ type: "playerDead" });
      this.finish();
      return;
    }
    if (this.isOver) this.finish();
  }

  // ===== Tour de l'allié : le Rival frappe le Dévoreur à son tour =====
  private allyTurn() {
    const a = this.ally;
    if (!a || !a.alive || this.enemy.isDead || this.player.isDead) return;
    const crit = this.roll(22);
    const raw = crit ? Math.round(a.attack * 1.7) : a.attack;
    const dealt = this.enemy.takeDamage(raw);
    this.addLog(T(crit ? "combat.ally.crit" : "combat.ally.hit", { name: T(a.nameKey), n: dealt }));
    this.emit({ type: "allyHit", value: dealt });
  }

  // ===== Fin de tour : les dégâts sur la durée rongent, les statuts expirent =====
  private tickStatuses() {
    const p = this.player, e = this.enemy;
    const pPoison = p.getStatus("poison");
    if (pPoison && pPoison.turns > 0) {
      p.hp -= pPoison.power;
      this.addLog(T("combat.poison.player", { n: pPoison.power }));
      this.emit({ type: "poisonPlayer", value: pPoison.power });
    }
    if (!e.isDead) {
      const ePoison = e.getStatus("poison");
      if (ePoison && ePoison.turns > 0) {
        e.hp -= ePoison.power;
        this.addLog(T("combat.poison.enemy", { name: e.name, n: ePoison.power }));
        this.emit({ type: "poisonEnemy", value: ePoison.power });
      }
      const burn = e.getStatus("burn");
      if (burn && burn.turns > 0) {
        e.hp -= burn.power;
        this.addLog(T("combat.burn.tick", { name: e.name, n: burn.power }));
        this.emit({ type: "burn", value: burn.power });
      }
      const bleed = e.getStatus("bleed");
      if (bleed && bleed.turns > 0) {
        e.hp -= bleed.power;
        this.addLog(T("combat.bleed.tick", { name: e.name, n: bleed.power }));
        this.emit({ type: "bleed", value: bleed.power });
        // Résonance de Sang : le sang versé te revient
        if (hasResonance(p, "blood") && bleed.power > 0) {
          p.heal(bleed.power);
          this.addLog(T("combat.res.blood.heal", { n: bleed.power }));
        }
      }
    }
    for (const c of [p, e]) {
      for (const s of c.statuses) s.turns--;
      c.statuses = c.statuses.filter(s => s.turns > 0);
    }
  }

  // ===== Frappe du joueur : cœur des hooks de boons =====
  // Retourne les dégâts totaux infligés. isEcho évite les récursions d'écho infinies.
  private strike(baseMult: number, opts: { autoCrit?: boolean; pierce?: boolean; isEcho?: boolean; label?: "attack" | "class" | "skill" } = {}): number {
    const p = this.player, e = this.enemy;
    const base = Math.max(1, Math.round(p.attack * baseMult));
    let crit = opts.autoCrit ?? false;
    // Tempo : la première frappe de chaque combat est un crit garanti
    if (!this.firstStrikeDone && p.boonLevel("tempo") > 0) crit = true;
    if (!crit) crit = this.roll(p.critChancePercent);
    // Écho de Tempête : les échos peuvent critiquer si la résonance est éveillée
    if (opts.isEcho && crit && !hasResonance(p, "storm")) crit = false;

    let dmg = base;
    if (crit) {
      dmg = Math.round(base * (p.critMultiplierPercent / 100));
      dmg = Math.max(dmg, base + 1);
    }
    // Immolation : +20%/cumul contre un ennemi qui brûle
    const immo = p.boonLevel("immolate");
    if (immo > 0 && e.hasStatus("burn")) dmg = Math.round(dmg * (1 + 0.2 * immo));
    // Frénésie : +18%/cumul sous 50% PV
    const fren = p.boonLevel("frenzy");
    if (fren > 0 && p.hp <= p.maxHp * 0.5) dmg = Math.round(dmg * (1 + 0.18 * fren));

    let dealt: number;
    if (opts.pierce) { e.hp -= dmg; dealt = dmg; }
    else dealt = e.takeDamage(dmg);

    // Vol de vie
    let heal = 0;
    if (p.lifeStealPercent > 0 && dealt > 0) {
      heal = Math.floor(dealt * (p.lifeStealPercent / 100));
      if (heal > 0) p.heal(heal);
    }

    // ---- log + event du coup principal ----
    if (opts.label === "class") {
      // le log de la capacité est écrit par l'appelant ; on émet juste l'event
      // (variant = classe → chorégraphie signature côté scène de combat)
      this.emit({ type: "classAbility", value: dealt, variant: p.classId });
    } else if (opts.label === "skill") {
      // dégâts silencieux : executeSkill gère le log et l'animation de la compétence
    } else if (opts.isEcho) {
      this.addLog(T("combat.echo", { n: dealt }));
      this.emit({ type: "echoHit", value: dealt });
    } else {
      let log = crit ? T("combat.crit", { n: dealt }) : T("combat.attack", { n: dealt });
      if (heal > 0) log += " " + T("combat.lifesteal", { n: heal });
      this.addLog(log);
      this.emit({ type: crit ? "playerCrit" : "playerHit", value: dealt });
    }

    // ---- Foudre : les crits foudroient (dégâts bonus, ignore l'armure) ----
    const thunder = p.boonLevel("thunder");
    if (crit && thunder > 0 && !e.isDead) {
      const bolt = Math.max(1, Math.round(dealt * 0.35 * thunder));
      e.hp -= bolt;
      this.addLog(T("combat.thunder", { n: bolt }));
      this.emit({ type: "thunder", value: bolt });
    }

    this.applyOnHitBoons(crit);

    // ---- Combustion (résonance de Braise) : frapper un ennemi qui brûle fait détoner la brûlure ----
    if (hasResonance(p, "fire") && !e.isDead) {
      const burnPow = e.statusPower("burn");
      if (burnPow > 0 && !opts.isEcho) {
        e.hp -= burnPow;
        this.addLog(T("combat.res.fire", { n: burnPow }));
        this.emit({ type: "combustion", value: burnPow });
      }
    }

    // ---- Épines (affixe d'élite) : le fer se paie ----
    if (e.affix === "thorns" && !e.isDead && dealt > 0) {
      const back = Math.max(1, Math.round(dealt * 0.2));
      p.hp -= back;
      this.addLog(T("combat.thorns", { n: back }));
      this.emit({ type: "thorns", value: back });
    }

    this.firstStrikeDone = true;

    // ---- Écho de Tempête : la frappe se rejoue (une seule fois, à 50%) ----
    const echo = p.boonLevel("echo");
    if (!opts.isEcho && echo > 0 && !e.isDead) {
      let chance = 15 * echo;
      if (hasResonance(p, "storm")) chance += 15;
      if (this.roll(chance)) dealt += this.strike(baseMult * 0.5, { ...opts, isEcho: true, label: "attack" });
    }
    return dealt;
  }

  // Statuts appliqués par les boons à chaque frappe (même les échos)
  private applyOnHitBoons(crit: boolean) {
    const p = this.player, e = this.enemy;
    if (e.isDead) return;
    // Braise
    const kindle = p.boonLevel("kindle");
    if (kindle > 0) { e.addStatus("burn", 3, 2 * kindle); this.emit({ type: "burn", value: 0 }); }
    const ignite = p.boonLevel("ignite");
    if (crit && ignite > 0) { e.addStatus("burn", 3, 3 * ignite); this.emit({ type: "burn", value: 0 }); }
    // Givre
    const frost = p.boonLevel("frostbite");
    if (frost > 0) { e.addStatus("chill", 4, frost); this.emit({ type: "chill", value: e.statusPower("chill") }); }
    const hail = p.boonLevel("hail");
    if (hail > 0 && !this.firstStrikeDone) { e.addStatus("chill", 5, 3 * hail); this.emit({ type: "chill", value: e.statusPower("chill") }); }
    const zero = p.boonLevel("absolutezero");
    if (zero > 0 && this.roll(12 * zero) && !e.hasStatus("stun")) {
      e.addStatus("stun", 1);
      this.addLog(T("combat.freeze", { name: e.name }));
      this.emit({ type: "freeze" });
    }
    // Cœur de glace : ton armure croît avec le givre de l'ennemi (recalcul simple, borné)
    // (implémenté comme bonus de réduction dans les dégâts ennemis — voir enemyDamage)
    // Sang
    const lacer = p.boonLevel("laceration");
    if (lacer > 0) { e.addStatus("bleed", 4, 2 * lacer); this.emit({ type: "bleed", value: 0 }); }
  }

  private executePlayerAction(action: CombatActionId, itemId?: string) {
    switch (action) {
      case "attack":
        this.strike(1, { label: "attack" });
        this.energy = Math.min(this.maxEnergy, this.energy + 1); // l'attaque de base génère de l'Énergie
        break;
      case "skill":
        this.executeSkill(itemId); // itemId réutilisé pour transporter l'id de compétence
        break;
      case "heal": {
        if (this.healsLeft <= 0) return;
        this.healsLeft--;
        let amount = this.healAmount + (this.player.hasTalent("w2a") ? 4 : 0);
        // Malédiction d'Attrition : les soins de combat sont diminués de moitié
        if (this.hasCurse("attrition")) amount = Math.ceil(amount / 2);
        this.player.heal(amount);
        this.addLog(T("combat.heal", { n: amount }));
        this.emit({ type: "heal", value: amount });
        break;
      }
      case "dodge": {
        this.dodgeTurnsLeft = Math.max(this.dodgeTurnsLeft, 2);
        this.addLog(T("combat.dodge", { n: this.dodgeChance }));
        this.emit({ type: "dodgeUp" });
        break;
      }
      case "flee": {
        if (this.roll(this.fleeChance)) {
          this.playerFled = true;
          this.addLog(T("combat.flee.ok"));
          this.emit({ type: "fleeOk" });
        } else {
          this.addLog(T("combat.flee.fail"));
          this.emit({ type: "fleeFail" });
        }
        break;
      }
      case "class": {
        if (this.classAbilityUsesLeft <= 0) return;
        this.classAbilityUsesLeft--;
        const p = this.player;
        switch (p.classId) {
          case "warrior": {
            const dmg = this.strike(3, { label: "class" });
            this.addLog(T("combat.classability.warrior", { n: dmg }));
            break;
          }
          case "mage": {
            const mul = p.hasTalent("m1b") ? 1.5 : 1;
            const dmg = this.strike(2.2 * mul, { pierce: true, label: "class" });
            this.addLog(T("combat.classability.mage", { n: dmg }));
            break;
          }
          case "rogue": {
            const dmg = this.strike(1, { autoCrit: true, label: "class" });
            this.dodgeTurnsLeft = Math.max(this.dodgeTurnsLeft, 2);
            this.addLog(T("combat.classability.rogue", { n: dmg }));
            break;
          }
        }
        break;
      }
      case "item": {
        const item = this.player.inventory.find(i => i.consumable && i.id === itemId);
        if (!item) return;
        this.player.removeFromInventory(item);
        switch (item.id) {
          case "Bomb": {
            const dmg = 12;
            this.enemy.hp -= dmg; // ignore l'armure
            this.enemy.addStatus("stun", 1);
            this.addLog(T("combat.item.bomb", { n: dmg, name: this.enemy.name }));
            this.emit({ type: "itemUse", value: dmg });
            break;
          }
          case "MistPotion": {
            this.mistTurns = 1;
            this.addLog(T("combat.item.mist"));
            this.emit({ type: "itemUse" });
            break;
          }
          case "RecallScroll": {
            this.playerFled = true;
            this.addLog(T("combat.item.scroll"));
            this.emit({ type: "fleeOk" });
            break;
          }
        }
        break;
      }
    }
  }

  // ===== Exécuteur de compétence : interprète les briques SkillOp (voir skills.ts) =====
  // C'est le "moteur" de la couture : le contenu ne fait qu'assembler des ops, tout passe ici.
  private executeSkill(id?: string) {
    const sk = id ? SKILLS[id] : undefined;
    if (!sk || !this.player.skills.includes(sk.id)) return;
    if (this.energy < sk.cost) { this.emit({ type: "fleeFail" }); return; } // sécurité (l'UI grise déjà)
    this.energy -= sk.cost;
    const p = this.player, e = this.enemy;
    this.addLog(T("combat.skill.use", { name: T(sk.nameKey) }));
    for (const op of sk.ops) {
      switch (op.t) {
        case "dmg": {
          const dealt = this.strike(op.mult, { pierce: op.pierce, autoCrit: op.autoCrit, label: "skill" });
          if (op.sig) this.emit({ type: "classAbility", value: dealt, variant: p.classId });
          else this.emit({ type: "skillHit", value: dealt, variant: sk.color });
          break;
        }
        case "status": {
          const tgt = op.who === "enemy" ? e : p;
          tgt.addStatus(op.kind, op.turns, op.power ?? 0);
          this.emitStatusFx(op.kind, op.who, op.power ?? 0);
          break;
        }
        case "armorBreak":
          e.modifyArmor(-op.amount);
          this.emit({ type: "armorBreak", value: op.amount });
          break;
        case "selfArmor":
          p.addArmor(op.amount);
          this.emit({ type: "dodgeUp" });
          break;
        case "dodge":
          this.dodgeTurnsLeft = Math.max(this.dodgeTurnsLeft, op.turns);
          this.emit({ type: "dodgeUp" });
          break;
        case "heal":
          p.heal(op.amount);
          this.emit({ type: "heal", value: op.amount });
          break;
      }
    }
  }

  // fx d'un statut appliqué par une compétence → réutilise les events existants
  private emitStatusFx(kind: string, who: "enemy" | "self", power: number) {
    switch (kind) {
      case "burn": this.emit({ type: "burn", value: power }); break;
      case "bleed": this.emit({ type: "bleed", value: power }); break;
      case "chill": this.emit({ type: "chill", value: power }); break;
      case "poison": this.emit({ type: who === "enemy" ? "poisonEnemy" : "poisonPlayer", value: power }); break;
      case "stun": this.emit({ type: who === "enemy" ? "stunEnemy" : "stunPlayer" }); break;
    }
  }

  private checkPhase2() {
    if (this.phase2 || this.enemy.rank !== MonsterRank.Boss || this.enemy.isDead) return;
    if (this.enemy.maxHp <= 0 || this.enemy.hp > Math.floor(this.enemy.maxHp / 2)) return;
    this.phase2 = true;
    this.enemy.heal(18);
    this.enemy.modifyAttack(+5);
    this.enemy.addArmor(2);
    this.enemy.modifyCritChance(+15);
    this.enemy.modifyCritMultiplierPercent(+50);
    const variant = this.enemy.nameKey === "mob.superboss" ? "sphase"
      : this.enemy.nameKey === "mob.rival" ? "rphase" : "phase2";
    this.addLog(T(`combat.${variant}.a`));
    this.addLog(T(`combat.${variant}.b`, { name: this.enemy.name }));
    this.addLog(T(`combat.${variant}.c`));
    this.emit({ type: "phase2" });
    // Le boss change de pattern : nouveau télégraphe immédiat
    this.patternIdx = 0;
    this.chargedIntent = null;
    this.intent = this.rollIntent();
  }

  // Capacité spéciale au franchissement d'un seuil de PV — 1 fois par combat.
  // Les buffs immédiats restent immédiats ; les gros coups deviennent des CHARGES lisibles.
  private checkEnemySpecial() {
    if (this.enemySpecialUsed || this.enemy.isDead || this.enemy.maxHp <= 0) return;
    const hpPct = this.enemy.hp / this.enemy.maxHp;
    const forceCharge = (mult: number, flat = 0) => {
      this.enemySpecialUsed = true;
      this.chargedIntent = null;
      this.intent = I.charge(mult, flat);
      this.addLog(T("combat.special.telegraph", { name: this.enemy.name }));
    };
    switch (this.enemy.nameKey) {
      case "mob.golem": if (hpPct <= 0.5) forceCharge(3, 5); break;
      case "mob.nightslime":
        if (hpPct <= 0.5) { this.enemySpecialUsed = true; this.intent = I.leech(2, 50); }
        break;
      case "mob.warden":
      case "mob.warden.enraged":
        if (hpPct <= 0.5) {
          this.enemySpecialUsed = true;
          this.enemy.addArmor(4);
          this.addLog(T("combat.special.warden", { name: this.enemy.name }));
          this.emit({ type: "enemyBuff", variant: this.enemy.nameKey });
        }
        break;
      case "mob.boss": if (hpPct <= 0.75) forceCharge(3, 5); break;
      case "mob.spider":
        if (hpPct <= 0.5) { this.enemySpecialUsed = true; this.intent = I.venom(2, 2, 3); }
        break;
      case "mob.superboss": if (hpPct <= 0.75) forceCharge(2.5, 5); break;
      case "mob.rival":
        if (hpPct <= 0.6) { this.enemySpecialUsed = true; this.intent = I.pierce(2.2, 3); }
        break;
      case "mob.gargoyle":
        if (hpPct <= 0.5) {
          this.enemySpecialUsed = true;
          const heal = Math.round(this.enemy.maxHp * 0.25);
          this.enemy.heal(heal);
          this.addLog(T("combat.special.gargoyle", { name: this.enemy.name, n: heal }));
          this.emit({ type: "enemyBuff", variant: this.enemy.nameKey });
        }
        break;
    }
  }

  private checkEnemyDead() {
    if (!this.enemy.isDead) return;
    this.addLog(T(this.enemy.feminine ? "combat.dead.f" : "combat.dead", { name: this.enemy.name }));
    if (!this.rewardGiven && !this.playerFled) {
      this.rewardGiven = true;
      const xp = this.enemy.rollXp(this.ctx.rng);
      const gold = this.enemy.rollGold(this.ctx.rng);
      const hadPassive = this.player.classPassiveUnlocked;
      const ups = this.player.gainXp(xp);
      this.player.addGold(gold);
      this.ctx.awardKillEssence(this.enemy);
      // Transfusion : le sang des vaincus te répare
      const trans = this.player.boonLevel("transfusion");
      if (trans > 0) {
        const heal = Math.max(1, Math.round(this.player.maxHp * 0.06 * trans));
        this.player.heal(heal);
        this.addLog(T("combat.transfusion", { n: heal }));
      }
      this.addLog(T("combat.reward", { xp, gold }));
      this.ctx.pushLog(T("combat.reward", { xp, gold }), LogKind.Loot);
      this.emit({ type: "reward" });
      // Prime : abattre la cible nommée accomplit la quête et verse la récompense.
      if (this.enemy.nameKey === "mob.gnawer" && this.ctx.questStatus("bounty_gnaw") === "active") {
        this.ctx.completeQuest("bounty_gnaw");
        this.player.addGold(100);
        this.ctx.pushLog(T("bounty.reward"), LogKind.Loot);
      }
      if (ups > 0) {
        this.addLog(T("combat.levelup", { n: this.player.level }));
        this.emit({ type: "levelup" });
      }
      if (!hadPassive && this.player.classPassiveUnlocked) {
        const passiveName = T(`class.passive.${this.player.classId}`);
        this.addLog(T("class.passive.gained", { name: passiveName }));
        this.ctx.pushLog(T("class.passive.gained", { name: passiveName }), LogKind.System);
        this.emit({ type: "levelup" });
      }
      if (this.enemy.rank === MonsterRank.MiniBoss) this.ctx.onMiniBossDefeated();
      if (this.enemy.nameKey === "mob.rival") {
        this.addLog(T("combat.rivaldead1"));
        this.ctx.pushLog(T("combat.rivaldead2"), LogKind.System);
        this.ctx.onRivalDefeated();
      } else if (this.enemy.rank === MonsterRank.Boss) {
        // mots de fin propres à chaque boss (dernier souffle)
        const dk = this.enemy.nameKey === "mob.superboss" ? "combat.devourerdead"
          : this.enemy.nameKey === "mob.boss" ? "combat.kingdead" : "combat.bossdead1";
        this.addLog(T(dk));
        this.ctx.pushLog(T("combat.bossdead2"), LogKind.System);
      }
    }
    this.emit({ type: "enemyDead" });
  }

  // ===== Tour ennemi : résolution de l'intent télégraphé =====
  private rollIntent(): Intent {
    // Une charge résolue arme le coup lourd correspondant
    if (this.chargedIntent) { const c = this.chargedIntent; this.chargedIntent = null; return c; }
    const pattern = patternFor(this.enemy.nameKey, this.phase2);
    const intent = pattern[this.patternIdx % pattern.length];
    this.patternIdx++;
    return intent;
  }

  // Dégâts ennemis avec Givre (ATK réduite), résonances et affixes.
  private enemyRaw(mult: number, flat = 0): number {
    let raw = Math.max(1, Math.round(this.enemy.effectiveAttack * mult + flat));
    // Résonance de Givre : un ennemi engourdi frappe encore plus faiblement
    if (hasResonance(this.player, "frost") && this.enemy.hasStatus("chill"))
      raw = Math.max(1, Math.round(raw * 0.8));
    return raw;
  }

  // Armure effective du joueur (Cœur de glace : +1 ARM / 2 givres sur l'ennemi, par cumul)
  private playerBonusArmor(): number {
    const ice = this.player.boonLevel("iceheart");
    if (ice <= 0) return 0;
    return Math.floor(this.enemy.statusPower("chill") / 2) * ice;
  }

  private hurtPlayer(raw: number, pierce = false): number {
    let dmg: number;
    if (pierce) dmg = raw;
    else {
      const bonus = this.playerBonusArmor();
      // Symétrie : une attaque inflige toujours au moins 1 dégât.
      dmg = raw <= 0 ? 0 : Math.max(1, raw - (this.player.armor + bonus));
    }
    // Le Rival te couvre : tant qu'il tient debout, il encaisse 40% de chaque coup à ta place.
    const a = this.ally;
    if (a && a.alive && dmg > 1) {
      const soak = Math.min(dmg - 1, Math.ceil(dmg * 0.4));
      if (soak > 0) {
        dmg -= soak;
        a.hp -= soak;
        this.emit({ type: "allyCover", value: soak });
        this.addLog(T("combat.ally.cover", { name: T(a.nameKey), n: soak }));
        if (a.hp <= 0) {
          a.alive = false;
          this.emit({ type: "allyFall" });
          this.addLog(T("combat.ally.fall", { name: T(a.nameKey) }));
        }
      }
    }
    this.player.hp -= dmg;
    // Cendres : encaisser embrase l'agresseur
    const ashes = this.player.boonLevel("ashes");
    if (ashes > 0 && dmg > 0 && !this.enemy.isDead) {
      this.enemy.addStatus("burn", 3, 2 * ashes);
      this.emit({ type: "burn", value: 0 });
    }
    return dmg;
  }

  private resolveEnemyTurn() {
    if (this.enemy.isDead) return;
    const it = this.intent;

    // ---- CHARGE : l'ennemi arme son coup, le joueur a un tour pour réagir ----
    if (it.kind === "charge") {
      this.chargedIntent = { ...I.heavy(it.mult, it.flat), unavoidable: false };
      this.addLog(T("combat.enemy.charge", { name: this.enemy.name }));
      this.emit({ type: "enemyCharge", variant: this.enemy.nameKey });
      return;
    }
    // ---- GUARD : buff défensif ----
    if (it.kind === "guard") {
      this.enemy.addArmor(it.arm ?? 2);
      this.addLog(T("combat.enemy.guard", { name: this.enemy.name, n: it.arm ?? 2 }));
      this.emit({ type: "enemyGuard", variant: this.enemy.nameKey });
      return;
    }

    // ---- Attaques : Brume > esquive > coup ----
    if (this.mistTurns > 0) {
      this.mistTurns--;
      this.addLog(T("combat.mist.dodge", { name: this.enemy.name }));
      this.emit({ type: "playerDodge" });
      return;
    }

    const isHeavy = it.kind === "heavy";
    const bruteHeavy = isHeavy && this.enemy.affix === "brute";
    let dodgedHalf = false;
    if (!it.unavoidable) {
      if (this.dodgeTurnsLeft > 0) {
        if (isHeavy) {
          // Un coup lourd télégraphé ne s'évite pas totalement : la garde le mitige de moitié
          if (!bruteHeavy) { dodgedHalf = true; this.addLog(T("combat.heavy.braced", { name: this.enemy.name })); }
        } else if (this.roll(this.dodgeChance)) {
          this.addLog(T("combat.dodged", { name: this.enemy.name }));
          this.emit({ type: "playerDodge" });
          return;
        } else {
          this.addLog(T("combat.nododge", { name: this.enemy.name }));
        }
      } else if (!isHeavy && this.player.hasTalent("r2a") && this.roll(15)) {
        this.addLog(T("combat.dodged", { name: this.enemy.name }));
        this.emit({ type: "playerDodge" });
        return;
      }
    }

    // ---- Résolution du coup ----
    const swings = this.enemy.affix === "swift" && it.kind === "attack" ? 2 : 1;
    for (let s = 0; s < swings; s++) {
      if (this.player.isDead) break;
      const multEff = (swings === 2 ? it.mult * 0.6 : it.mult) * (dodgedHalf ? 0.5 : 1);
      let raw = this.enemyRaw(multEff, dodgedHalf ? Math.round((it.flat ?? 0) / 2) : (it.flat ?? 0));
      const pierce = it.kind === "pierce";
      const dmg = this.hurtPlayer(raw, pierce);

      switch (it.kind) {
        case "attack":
          this.addLog(T("combat.enemyhit", { name: this.enemy.name, n: dmg }));
          this.emit({ type: "enemyHit", value: dmg });
          break;
        case "heavy":
          this.addLog(T("combat.enemy.heavy", { name: this.enemy.name, n: dmg }));
          this.emit({ type: "enemySpecial", value: dmg, variant: this.enemy.nameKey });
          break;
        case "pierce":
          this.addLog(T("combat.enemy.pierce", { name: this.enemy.name, n: dmg }));
          this.emit({ type: "enemySpecial", value: dmg, variant: this.enemy.nameKey });
          break;
        case "leech": {
          const heal = Math.max(1, Math.round(dmg * ((it.healPct ?? 50) / 100)));
          this.enemy.heal(heal);
          this.addLog(T("combat.enemy.leech", { name: this.enemy.name, n: dmg, heal }));
          this.emit({ type: "enemyLeech", value: dmg, variant: this.enemy.nameKey });
          break;
        }
        case "venom":
          if (it.poison) this.player.addStatus("poison", it.poison.turns, it.poison.power);
          this.addLog(T("combat.enemy.venom", { name: this.enemy.name, n: dmg }));
          this.emit({ type: "enemySpecial", value: dmg, variant: this.enemy.nameKey });
          break;
      }
      // Affixe Vampirique : se nourrit de chaque coup
      if (this.enemy.affix === "vampiric" && dmg > 0) {
        const vheal = Math.max(1, Math.round(dmg * 0.3));
        this.enemy.heal(vheal);
        this.addLog(T("combat.affix.vampiric.proc", { name: this.enemy.name, n: vheal }));
      }
    }
  }

  private finish() {
    this.over = true;
    this.victory = this.enemy.isDead;
    this.player.clearStatuses(); // les statuts ne survivent pas au combat
    if (this.empowerApplied) {
      this.player.modifyAttack(-this.empowerAtkBonus);
      this.empowerApplied = false;
    }
    // Compagnon : report des PV subis ; s'il est tombé, sa quête échoue DÉFINITIVEMENT.
    if (this.companionAlly && this.ctx.companion) {
      const c = this.ctx.companion, a = this.ally;
      c.hp = Math.max(0, a?.hp ?? 0);
      c.alive = !!a?.alive;
      if (!c.alive) {
        this.addLog(T("companion.fallen", { name: T(c.nameKey) }));
        this.ctx.failQuest(c.questId);
        this.ctx.companion = null; // mort pour de bon
      }
    }
  }
}
