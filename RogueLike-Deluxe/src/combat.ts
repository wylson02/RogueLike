// ===== Combat tour par tour — port de CombatState.cs + CombatContext.cs + Actions =====
import { GameContext, LogKind } from "./context";
import { Monster, MonsterRank } from "./entities";
import { T } from "./i18n";

export type CombatActionId = "attack" | "heal" | "dodge" | "flee" | "class" | "item";

export interface CombatEvent {
  type: "playerHit" | "playerCrit" | "enemyHit" | "playerDodge" | "heal" | "dodgeUp"
      | "fleeOk" | "fleeFail" | "enemyDead" | "playerDead" | "phase2" | "levelup" | "reward"
      | "classAbility" | "enemySpecial" | "enemyBuff"
      | "itemUse" | "poisonEnemy" | "poisonPlayer" | "stunEnemy" | "stunPlayer";
  value?: number;
}

export class CombatSession {
  ctx: GameContext;
  enemy: Monster;
  log: string[] = [];
  healsLeft = 2;
  readonly healAmount = 8;
  classAbilityUsesLeft = 1;
  mistTurns = 0; // Potion de brume : esquive garantie (même contre les spéciales)
  enemySpecialUsed = false;
  private pendingSpecial: "golem" | "nightslime" | "boss" | "spider" | "superboss" | "rival" | null = null;
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

  constructor(ctx: GameContext, enemy: Monster) {
    this.ctx = ctx;
    this.enemy = enemy;
    // Écho arcanique / furtif : capacité de classe utilisable 2 fois
    if (ctx.player.hasTalent("m2b") || ctx.player.hasTalent("r2b")) this.classAbilityUsesLeft = 2;

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

    if (ctx.legendaryEmpowerNextFight) {
      ctx.legendaryEmpowerNextFight = false;
      ctx.player.modifyAttack(this.empowerAtkBonus);
      this.empowerApplied = true;
      this.addLog(T("combat.empower"));
    }
  }

  get player() { return this.ctx.player; }
  get isOver() { return this.player.isDead || this.enemy.isDead || this.playerFled; }

  addLog(s: string) { this.log.push(s); if (this.log.length > 60) this.log.shift(); }
  private emit(e: CombatEvent) { this.events.push(e); }
  drainEvents(): CombatEvent[] { const e = this.events; this.events = []; return e; }
  private roll(pct: number) { return this.ctx.rng.next(0, 100) < pct; }

  // Joue un tour complet : action joueur → phase 2 → récompense → tour ennemi → statuts
  playTurn(action: CombatActionId, itemId?: string) {
    if (this.over) return;

    // Étourdi : le joueur perd son action
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
    } else {
      this.resolveEnemyTurn();
    }
    if (this.dodgeTurnsLeft > 0) this.dodgeTurnsLeft--;

    this.tickStatuses();
    this.checkEnemyDead(); // mort par poison

    if (this.player.isDead) {
      this.addLog(T("combat.playerdead"));
      this.emit({ type: "playerDead" });
      this.finish();
      return;
    }
    if (this.isOver) this.finish();
  }

  // Fin de tour : le poison ronge les deux camps, les statuts expirent
  private tickStatuses() {
    const pPoison = this.player.getStatus("poison");
    if (pPoison && pPoison.turns > 0) {
      this.player.hp -= pPoison.power;
      this.addLog(T("combat.poison.player", { n: pPoison.power }));
      this.emit({ type: "poisonPlayer", value: pPoison.power });
    }
    const ePoison = this.enemy.getStatus("poison");
    if (ePoison && ePoison.turns > 0 && !this.enemy.isDead) {
      this.enemy.hp -= ePoison.power;
      this.addLog(T("combat.poison.enemy", { name: this.enemy.name, n: ePoison.power }));
      this.emit({ type: "poisonEnemy", value: ePoison.power });
    }
    for (const c of [this.player, this.enemy]) {
      for (const s of c.statuses) s.turns--;
      c.statuses = c.statuses.filter(s => s.turns > 0);
    }
  }

  private executePlayerAction(action: CombatActionId, itemId?: string) {
    switch (action) {
      case "attack": {
        const baseDmg = Math.max(1, this.player.attack);
        const crit = this.roll(this.player.critChancePercent);
        let dmg = baseDmg;
        if (crit) {
          dmg = Math.round(baseDmg * (this.player.critMultiplierPercent / 100));
          dmg = Math.max(dmg, baseDmg + 1);
        }
        this.enemy.takeDamage(dmg);
        let heal = 0;
        if (this.player.lifeStealPercent > 0 && dmg > 0) {
          heal = Math.floor(dmg * (this.player.lifeStealPercent / 100));
          if (heal > 0) this.player.heal(heal);
        }
        let log = crit ? T("combat.crit", { n: dmg }) : T("combat.attack", { n: dmg });
        if (heal > 0) log += " " + T("combat.lifesteal", { n: heal });
        this.addLog(log);
        this.emit({ type: crit ? "playerCrit" : "playerHit", value: dmg });
        break;
      }
      case "heal": {
        if (this.healsLeft <= 0) return;
        this.healsLeft--;
        // Second souffle (Guerrier palier 2) : soins de combat renforcés
        const amount = this.healAmount + (this.player.hasTalent("w2a") ? 4 : 0);
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
            const dmg = Math.round(p.attack * 3);
            this.enemy.takeDamage(dmg);
            this.addLog(T("combat.classability.warrior", { n: dmg }));
            this.emit({ type: "classAbility", value: dmg });
            break;
          }
          case "mage": {
            // Surcharge (Mage palier 1) : Explosion Arcanique +50%
            const mul = p.hasTalent("m1b") ? 1.5 : 1;
            const dmg = Math.round((p.attack * 2.2 + 5) * mul);
            this.enemy.hp -= dmg; // ignore l'armure de la cible
            this.addLog(T("combat.classability.mage", { n: dmg }));
            this.emit({ type: "classAbility", value: dmg });
            break;
          }
          case "rogue": {
            const baseDmg = Math.max(1, p.attack);
            const dmg = Math.max(Math.round(baseDmg * (p.critMultiplierPercent / 100)), baseDmg + 1);
            this.enemy.takeDamage(dmg);
            if (p.lifeStealPercent > 0) {
              const heal = Math.floor(dmg * (p.lifeStealPercent / 100));
              if (heal > 0) p.heal(heal);
            }
            this.dodgeTurnsLeft = Math.max(this.dodgeTurnsLeft, 2);
            this.addLog(T("combat.classability.rogue", { n: dmg }));
            this.emit({ type: "classAbility", value: dmg });
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

  private checkPhase2() {
    if (this.phase2 || this.enemy.rank !== MonsterRank.Boss || this.enemy.isDead) return;
    if (this.enemy.maxHp <= 0 || this.enemy.hp > Math.floor(this.enemy.maxHp / 2)) return;
    this.phase2 = true;
    // Buffs de la phase 2 (fusion des deux déclencheurs du code original)
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
  }

  // Capacités spéciales des monstres — 1 fois par combat, au franchissement d'un seuil de PV.
  private checkEnemySpecial() {
    if (this.enemySpecialUsed || this.enemy.isDead || this.enemy.maxHp <= 0) return;
    const hpPct = this.enemy.hp / this.enemy.maxHp;
    switch (this.enemy.nameKey) {
      case "mob.golem":
        if (hpPct <= 0.5) { this.enemySpecialUsed = true; this.pendingSpecial = "golem"; }
        break;
      case "mob.nightslime":
        if (hpPct <= 0.5) { this.enemySpecialUsed = true; this.pendingSpecial = "nightslime"; }
        break;
      case "mob.warden":
      case "mob.warden.enraged":
        if (hpPct <= 0.5) {
          this.enemySpecialUsed = true;
          this.enemy.addArmor(4);
          this.addLog(T("combat.special.warden", { name: this.enemy.name }));
          this.emit({ type: "enemyBuff" });
        }
        break;
      case "mob.boss":
        if (hpPct <= 0.75) { this.enemySpecialUsed = true; this.pendingSpecial = "boss"; }
        break;
      case "mob.spider":
        if (hpPct <= 0.5) { this.enemySpecialUsed = true; this.pendingSpecial = "spider"; }
        break;
      case "mob.superboss":
        if (hpPct <= 0.75) { this.enemySpecialUsed = true; this.pendingSpecial = "superboss"; }
        break;
      case "mob.rival":
        if (hpPct <= 0.6) { this.enemySpecialUsed = true; this.pendingSpecial = "rival"; }
        break;
      case "mob.gargoyle":
        if (hpPct <= 0.5) {
          this.enemySpecialUsed = true;
          const heal = Math.round(this.enemy.maxHp * 0.25);
          this.enemy.heal(heal);
          this.addLog(T("combat.special.gargoyle", { name: this.enemy.name, n: heal }));
          this.emit({ type: "enemyBuff" });
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
      this.addLog(T("combat.reward", { xp, gold }));
      this.ctx.pushLog(T("combat.reward", { xp, gold }), LogKind.Loot);
      this.emit({ type: "reward" });
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
        this.addLog(T("combat.bossdead1"));
        this.ctx.pushLog(T("combat.bossdead2"), LogKind.System);
      }
    }
    this.emit({ type: "enemyDead" });
  }

  private resolveEnemyTurn() {
    if (this.enemy.isDead) return;
    // Potion de brume : esquive garantie, y compris contre les attaques spéciales
    if (this.mistTurns > 0) {
      this.mistTurns--;
      this.addLog(T("combat.mist.dodge", { name: this.enemy.name }));
      this.emit({ type: "playerDodge" });
      return;
    }
    // Les attaques spéciales ignorent l'esquive du joueur.
    if (!this.pendingSpecial) {
      if (this.dodgeTurnsLeft > 0) {
        if (this.roll(this.dodgeChance)) {
          this.addLog(T("combat.dodged", { name: this.enemy.name }));
          this.emit({ type: "playerDodge" });
          return;
        }
        this.addLog(T("combat.nododge", { name: this.enemy.name }));
      } else if (this.player.hasTalent("r2a") && this.roll(15)) {
        // Ombre (Voleur palier 2) : esquive passive permanente
        this.addLog(T("combat.dodged", { name: this.enemy.name }));
        this.emit({ type: "playerDodge" });
        return;
      }
    }
    const atk = Math.max(1, this.enemy.attack);
    if (this.pendingSpecial === "golem") {
      this.pendingSpecial = null;
      const dmg = this.player.takeDamage(Math.round(atk * 3 + 5));
      this.addLog(T("combat.special.golem", { n: dmg }));
      this.emit({ type: "enemySpecial", value: dmg });
      return;
    }
    if (this.pendingSpecial === "nightslime") {
      this.pendingSpecial = null;
      const dmg = this.player.takeDamage(Math.round(atk * 2));
      const heal = Math.round(dmg * 0.5);
      if (heal > 0) this.enemy.heal(heal);
      this.addLog(T("combat.special.nightslime", { n: dmg, heal }));
      this.emit({ type: "enemySpecial", value: dmg });
      return;
    }
    if (this.pendingSpecial === "boss") {
      this.pendingSpecial = null;
      const dmg = this.player.takeDamage(Math.round(atk * 3 + 5));
      this.addLog(T("combat.special.boss", { name: this.enemy.name, n: dmg }));
      this.emit({ type: "enemySpecial", value: dmg });
      return;
    }
    if (this.pendingSpecial === "spider") {
      this.pendingSpecial = null;
      const dmg = this.player.takeDamage(Math.round(atk * 2 + 3));
      this.player.addStatus("poison", 3, 2); // venin : 2 dégâts/tour pendant 3 tours
      this.addLog(T("combat.special.spider", { n: dmg }));
      this.emit({ type: "enemySpecial", value: dmg });
      return;
    }
    if (this.pendingSpecial === "rival") {
      this.pendingSpecial = null;
      const classId = this.ctx.player.classId;
      let dmg = 0;
      if (classId === "warrior") {
        dmg = this.player.takeDamage(Math.round(atk * 3));
      } else if (classId === "mage") {
        dmg = Math.round(atk * 2.2 + 5);
        this.player.hp -= dmg; // ignore l'armure du joueur, comme la capacité qu'il imite
      } else {
        const raw = Math.max(atk + 1, Math.round(atk * (this.enemy.critMultiplierPercent / 100)));
        dmg = this.player.takeDamage(raw);
      }
      this.addLog(T(`combat.special.rival.${classId}`, { n: dmg }));
      this.emit({ type: "enemySpecial", value: dmg });
      return;
    }
    if (this.pendingSpecial === "superboss") {
      this.pendingSpecial = null;
      const dmg = this.player.takeDamage(Math.round(atk * 2.5 + 5));
      const heal = Math.max(1, Math.round(dmg * 0.8));
      this.enemy.heal(heal);
      this.addLog(T("combat.special.superboss", { name: this.enemy.name, n: dmg, heal }));
      this.emit({ type: "enemySpecial", value: dmg });
      return;
    }
    const dmg = this.player.takeDamage(atk);
    this.addLog(T("combat.enemyhit", { name: this.enemy.name, n: dmg }));
    this.emit({ type: "enemyHit", value: dmg });
  }

  private finish() {
    this.over = true;
    this.victory = this.enemy.isDead;
    this.player.clearStatuses(); // les statuts ne survivent pas au combat
    if (this.empowerApplied) {
      this.player.modifyAttack(-this.empowerAtkBonus);
      this.empowerApplied = false;
    }
  }
}
