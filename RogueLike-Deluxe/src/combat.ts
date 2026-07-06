// ===== Combat tour par tour — port de CombatState.cs + CombatContext.cs + Actions =====
import { GameContext, LogKind } from "./context";
import { Monster, MonsterRank } from "./entities";
import { T } from "./i18n";

export type CombatActionId = "attack" | "heal" | "dodge" | "flee";

export interface CombatEvent {
  type: "playerHit" | "playerCrit" | "enemyHit" | "playerDodge" | "heal" | "dodgeUp"
      | "fleeOk" | "fleeFail" | "enemyDead" | "playerDead" | "phase2" | "levelup" | "reward";
  value?: number;
}

export class CombatSession {
  ctx: GameContext;
  enemy: Monster;
  log: string[] = [];
  healsLeft = 2;
  readonly healAmount = 8;
  dodgeTurnsLeft = 0;
  readonly dodgeChance = 40;
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

    if (enemy.rank === MonsterRank.Boss) {
      this.addLog(T("combat.boss1"));
      this.addLog(T("combat.boss2", { name: enemy.name }));
      this.addLog(T("combat.boss3"));
    } else {
      this.addLog(T("combat.appear", { name: enemy.name }));
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

  // Joue un tour complet : action joueur → phase 2 → récompense → tour ennemi
  playTurn(action: CombatActionId) {
    if (this.over) return;

    this.executePlayerAction(action);
    this.checkPhase2();
    this.checkEnemyDead();

    if (this.isOver) { this.finish(); return; }

    this.resolveEnemyTurn();
    if (this.dodgeTurnsLeft > 0) this.dodgeTurnsLeft--;

    if (this.player.isDead) {
      this.addLog(T("combat.playerdead"));
      this.emit({ type: "playerDead" });
      this.finish();
    }
  }

  private executePlayerAction(action: CombatActionId) {
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
        this.player.heal(this.healAmount);
        this.addLog(T("combat.heal", { n: this.healAmount }));
        this.emit({ type: "heal", value: this.healAmount });
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
    this.addLog(T("combat.phase2.a"));
    this.addLog(T("combat.phase2.b", { name: this.enemy.name }));
    this.addLog(T("combat.phase2.c"));
    this.emit({ type: "phase2" });
  }

  private checkEnemyDead() {
    if (!this.enemy.isDead) return;
    this.addLog(T("combat.dead", { name: this.enemy.name }));
    if (!this.rewardGiven && !this.playerFled) {
      this.rewardGiven = true;
      const xp = this.enemy.rollXp(this.ctx.rng);
      const gold = this.enemy.rollGold(this.ctx.rng);
      const ups = this.player.gainXp(xp);
      this.player.addGold(gold);
      this.addLog(T("combat.reward", { xp, gold }));
      this.ctx.pushLog(T("combat.reward", { xp, gold }), LogKind.Loot);
      this.emit({ type: "reward" });
      if (ups > 0) {
        this.addLog(T("combat.levelup", { n: this.player.level }));
        this.emit({ type: "levelup" });
      }
      if (this.enemy.rank === MonsterRank.MiniBoss) this.ctx.onMiniBossDefeated();
      if (this.enemy.rank === MonsterRank.Boss) {
        this.addLog(T("combat.bossdead1"));
        this.ctx.pushLog(T("combat.bossdead2"), LogKind.System);
      }
    }
    this.emit({ type: "enemyDead" });
  }

  private resolveEnemyTurn() {
    if (this.enemy.isDead) return;
    if (this.dodgeTurnsLeft > 0) {
      if (this.roll(this.dodgeChance)) {
        this.addLog(T("combat.dodged", { name: this.enemy.name }));
        this.emit({ type: "playerDodge" });
        return;
      }
      this.addLog(T("combat.nododge", { name: this.enemy.name }));
    }
    const raw = Math.max(1, this.enemy.attack);
    const dmg = this.player.takeDamage(raw);
    this.addLog(T("combat.enemyhit", { name: this.enemy.name, n: dmg }));
    this.emit({ type: "enemyHit", value: dmg });
  }

  private finish() {
    this.over = true;
    this.victory = this.enemy.isDead;
    if (this.empowerApplied) {
      this.player.modifyAttack(-this.empowerAtkBonus);
      this.empowerApplied = false;
    }
  }
}
