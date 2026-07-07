// ===== Entités — port de Domain/Entities + Builders + AI =====
import { Pos, P, RNG, clamp, Dir } from "./core";
import type { Item } from "./items";
import { T } from "./i18n";

export abstract class Character {
  pos: Pos;
  maxHp: number; hp: number;
  attack: number; armor = 0;
  critChancePercent = 0;
  lifeStealPercent = 0;
  critMultiplierPercent = 200;

  constructor(pos: Pos, hp: number, attack: number) {
    this.pos = pos; this.maxHp = hp; this.hp = hp; this.attack = attack;
  }
  get isDead() { return this.hp <= 0; }
  setPosition(p: Pos) { this.pos = P(p.x, p.y); }
  takeDamage(amount: number): number {
    const dmg = Math.max(0, amount - this.armor);
    this.hp -= dmg;
    return dmg;
  }
  heal(amount: number) { this.hp = Math.min(this.maxHp, this.hp + Math.max(0, amount)); }
  healToFull() { this.hp = this.maxHp; }
  modifyAttack(d: number) { this.attack = Math.max(1, this.attack + d); }
  modifyArmor(d: number) { this.armor = Math.max(0, this.armor + d); }
  addArmor(n: number) { this.armor += Math.max(0, n); }
  modifyCritChance(d: number) { this.critChancePercent = clamp(this.critChancePercent + d, 0, 100); }
  modifyLifeSteal(d: number) { this.lifeStealPercent = clamp(this.lifeStealPercent + d, 0, 100); }
  modifyCritMultiplierPercent(d: number) { this.critMultiplierPercent = clamp(this.critMultiplierPercent + d, 150, 400); }
}

export enum EquipSlot { Weapon, Armor, Accessory, Relic }
export const MAX_WEAPON_UPGRADE = 5;
export enum StatType { MaxHp, Attack, Armor, CritChance, LifeSteal }
export type ForgeSlot = EquipSlot.Weapon | EquipSlot.Armor;

export type ClassId = "warrior" | "mage" | "rogue";

export class Player extends Character {
  inventory: Item[] = [];
  equippedWeapon: Item | null = null;
  equippedArmor: Item | null = null;
  equippedAccessory: Item | null = null;
  equippedRelic: Item | null = null;
  gold = 0;
  level = 1;
  xp = 0;
  statPoints = 0;
  visionRadius = 3;
  lightBonus = 0;
  classId: ClassId = "warrior";
  weaponUpgradeLevel = 0;
  armorUpgradeLevel = 0;
  dodgeBonus = 0;
  classPassiveUnlocked = false;

  constructor(pos: Pos) { super(pos, 70, 5); }

  get xpToNext() { return 20 + (this.level - 1) * 10; }

  addGold(n: number) { this.gold += Math.max(0, n); }
  spendGold(n: number): boolean {
    if (n < 0 || this.gold < n) return false;
    this.gold -= n; return true;
  }
  setLightBonus(b: number) { this.lightBonus = b; }
  increaseVision(n: number) { this.visionRadius += n; }

  gainXp(amount: number): number {
    if (amount <= 0) return 0;
    this.xp += amount;
    let ups = 0;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.statPoints++;
      ups++;
    }
    if (!this.classPassiveUnlocked && this.level >= 5) {
      this.classPassiveUnlocked = true;
      applyClassPassive(this);
    }
    return ups;
  }

  spendStatPoint(stat: StatType): boolean {
    if (this.statPoints <= 0) return false;
    this.statPoints--;
    switch (stat) {
      case StatType.MaxHp: this.maxHp += 2; this.hp += 2; break;
      case StatType.Attack: this.modifyAttack(+1); break;
      case StatType.Armor: this.modifyArmor(+1); break;
      case StatType.CritChance: this.modifyCritChance(+2); break;
      case StatType.LifeSteal: this.modifyLifeSteal(+2); break;
    }
    return true;
  }

  addToInventory(i: Item) { this.inventory.push(i); }
  removeFromInventory(i: Item) {
    const idx = this.inventory.indexOf(i);
    if (idx >= 0) this.inventory.splice(idx, 1);
  }

  equip(item: Item) {
    if (item.slot === undefined) return;
    const swap = (cur: Item | null): Item | null => {
      if (cur) { cur.onUnequip?.(this); this.inventory.push(cur); }
      item.onEquip?.(this);
      return item;
    };
    if (item.slot === EquipSlot.Weapon) this.equippedWeapon = swap(this.equippedWeapon);
    else if (item.slot === EquipSlot.Armor) this.equippedArmor = swap(this.equippedArmor);
    else if (item.slot === EquipSlot.Relic) this.equippedRelic = swap(this.equippedRelic);
    else this.equippedAccessory = swap(this.equippedAccessory);
  }

  hasAnyWeapon(): boolean {
    if (this.equippedWeapon) return true;
    return this.inventory.some(i => i.slot === EquipSlot.Weapon);
  }

  // Forge du marchand : améliore l'arme (ATK) ou l'armure (ARM) équipée, jusqu'à MAX_WEAPON_UPGRADE paliers.
  nextUpgradeCost(slot: ForgeSlot): number | null {
    const lvl = slot === EquipSlot.Weapon ? this.weaponUpgradeLevel : this.armorUpgradeLevel;
    if (lvl >= MAX_WEAPON_UPGRADE) return null;
    return 40 + lvl * 30;
  }
  upgradeSlot(slot: ForgeSlot): boolean {
    const cost = this.nextUpgradeCost(slot);
    const equipped = slot === EquipSlot.Weapon ? this.equippedWeapon : this.equippedArmor;
    if (cost === null || !equipped || !this.spendGold(cost)) return false;
    if (slot === EquipSlot.Weapon) { this.weaponUpgradeLevel++; this.modifyAttack(+2); }
    else { this.armorUpgradeLevel++; this.modifyArmor(+1); }
    return true;
  }
  // Conservés pour compatibilité (arme = comportement historique)
  nextWeaponUpgradeCost(): number | null { return this.nextUpgradeCost(EquipSlot.Weapon); }
  upgradeWeapon(): boolean { return this.upgradeSlot(EquipSlot.Weapon); }
}

// Capacité permanente débloquée au niveau 5 — une profondeur de classe au-delà des stats de départ.
export function applyClassPassive(p: Player) {
  switch (p.classId) {
    case "warrior": p.maxHp += 10; p.hp += 10; p.addArmor(3); break;
    case "mage": p.modifyCritMultiplierPercent(+20); break;
    case "rogue": p.dodgeBonus += 15; break;
  }
}

// ===== Classes jouables : stats de départ + capacité active (1×/combat) =====
export interface ClassDef { id: ClassId; nameKey: string; descKey: string; abilityNameKey: string; }

export const ClassCatalog: Record<ClassId, ClassDef> = {
  warrior: { id: "warrior", nameKey: "class.warrior.name", descKey: "class.warrior.desc", abilityNameKey: "act.class.warrior" },
  mage: { id: "mage", nameKey: "class.mage.name", descKey: "class.mage.desc", abilityNameKey: "act.class.mage" },
  rogue: { id: "rogue", nameKey: "class.rogue.name", descKey: "class.rogue.desc", abilityNameKey: "act.class.rogue" },
};

// Applique les deltas de stats de départ d'une classe à un joueur fraîchement créé.
export function applyClass(p: Player, id: ClassId) {
  p.classId = id;
  switch (id) {
    case "warrior":
      p.maxHp += 20; p.hp = p.maxHp;
      p.addArmor(3);
      break;
    case "mage":
      p.maxHp -= 15; p.hp = p.maxHp;
      p.modifyAttack(+3);
      p.modifyCritChance(+10);
      break;
    case "rogue":
      p.modifyLifeSteal(+15);
      p.modifyCritChance(+10);
      p.increaseVision(1);
      break;
  }
}

export enum MonsterRank { Normal, MiniBoss, Boss }
export type AiKind = "aggro" | "random" | "patrol" | "ambush" | "flee";

export class Monster extends Character {
  nameKey: string;
  rank: MonsterRank;
  aggroRange: number;
  sprite: string;
  minGold: number; maxGold: number;
  minXp: number; maxXp: number;
  feminine: boolean; // accord grammatical FR de "combat.appear" (Un/Une {name} surgit !)
  nightBuffed = false; // équilibrage : buff nocturne appliqué une fois
  elite = false;       // variante élite (mode Descente Infinie) : boostée, récompense majorée
  aiKind: AiKind;
  spawnPos: Pos;               // pour le comportement "patrol"
  patrolDir: Dir | null = null; // direction courante de patrouille

  constructor(o: {
    nameKey: string; pos: Pos; hp: number; attack: number;
    minGold: number; maxGold: number; minXp: number; maxXp: number;
    rank?: MonsterRank; aggroRange?: number; sprite: string; feminine?: boolean; aiKind?: AiKind;
  }) {
    super(o.pos, o.hp, o.attack);
    this.nameKey = o.nameKey;
    this.rank = o.rank ?? MonsterRank.Normal;
    this.aggroRange = o.aggroRange ?? 3;
    this.sprite = o.sprite;
    this.minGold = o.minGold; this.maxGold = o.maxGold;
    this.minXp = o.minXp; this.maxXp = o.maxXp;
    this.feminine = o.feminine ?? false;
    this.aiKind = o.aiKind ?? "aggro";
    this.spawnPos = P(o.pos.x, o.pos.y);
  }
  get name() { return T(this.nameKey); }
  rollGold(rng: RNG) { return this.minGold === this.maxGold ? this.minGold : rng.next(this.minGold, this.maxGold + 1); }
  rollXp(rng: RNG) { return this.minXp === this.maxXp ? this.minXp : rng.next(this.minXp, this.maxXp + 1); }
}

// ===== Catalogue de monstres — port de MonsterCatalog.cs =====
export const MonsterCatalog = {
  slime: (pos: Pos) => new Monster({
    nameKey: "mob.slime", pos, hp: 11, attack: 6,
    minGold: 3, maxGold: 7, minXp: 6, maxXp: 10, aggroRange: 3, sprite: "slime",
  }),
  golem: (pos: Pos) => new Monster({
    nameKey: "mob.golem", pos, hp: 24, attack: 5,
    minGold: 10, maxGold: 18, minXp: 6, maxXp: 10, aggroRange: 3, sprite: "golem", aiKind: "patrol",
  }),
  nightSlime: (pos: Pos) => new Monster({
    nameKey: "mob.nightslime", pos, hp: 6, attack: 2,
    minGold: 2, maxGold: 5, minXp: 6, maxXp: 10, aggroRange: 3, sprite: "nightslime", aiKind: "flee",
  }),
  spider: (pos: Pos) => new Monster({
    nameKey: "mob.spider", pos, hp: 10, attack: 6,
    minGold: 6, maxGold: 11, minXp: 9, maxXp: 15, aggroRange: 5, sprite: "spider", feminine: true, aiKind: "ambush",
  }),
  gargoyle: (pos: Pos) => new Monster({
    nameKey: "mob.gargoyle", pos, hp: 26, attack: 6,
    minGold: 16, maxGold: 26, minXp: 16, maxXp: 24, aggroRange: 4, sprite: "gargoyle", feminine: true,
  }),
  sealWarden: (pos: Pos) => new Monster({
    nameKey: "mob.warden", pos, hp: 32, attack: 7,
    minGold: 30, maxGold: 55, minXp: 25, maxXp: 40,
    rank: MonsterRank.MiniBoss, aggroRange: 6, sprite: "warden",
  }),
  sealWardenEnraged: (pos: Pos) => new Monster({
    nameKey: "mob.warden.enraged", pos, hp: 44, attack: 8,
    minGold: 45, maxGold: 80, minXp: 35, maxXp: 55,
    rank: MonsterRank.MiniBoss, aggroRange: 7, sprite: "warden",
  }),
  abyssKing: (pos: Pos) => {
    const m = new Monster({
      nameKey: "mob.boss", pos, hp: 95, attack: 10,
      minGold: 160, maxGold: 220, minXp: 110, maxXp: 160,
      rank: MonsterRank.Boss, aggroRange: 9, sprite: "boss",
    });
    m.addArmor(2);
    m.modifyCritChance(12);
    m.modifyCritMultiplierPercent(50);
    return m;
  },
  // Le Rival — écho du joueur, dernier obstacle avant le Dévoreur d'Âmes (niveau 5)
  theRival: (pos: Pos) => {
    const m = new Monster({
      nameKey: "mob.rival", pos, hp: 70, attack: 9,
      minGold: 80, maxGold: 120, minXp: 60, maxXp: 90,
      rank: MonsterRank.Boss, aggroRange: 8, sprite: "rival",
    });
    m.addArmor(1);
    m.modifyCritChance(10);
    m.modifyCritMultiplierPercent(30);
    return m;
  },
  // Super-boss du donjon post-jeu (niveau 5)
  soulDevourer: (pos: Pos) => {
    const m = new Monster({
      nameKey: "mob.superboss", pos, hp: 140, attack: 13,
      minGold: 300, maxGold: 400, minXp: 200, maxXp: 300,
      rank: MonsterRank.Boss, aggroRange: 10, sprite: "avatar",
    });
    m.addArmor(3);
    m.modifyCritChance(15);
    m.modifyCritMultiplierPercent(50);
    return m;
  },
};

// ===== PNJ / Coffres / Sceaux / Marchand =====
export class Pnj {
  pos: Pos;
  name: string;
  msgKey: string;
  giftName: string;
  hasGivenGift = false;
  constructor(pos: Pos, name: string, msgKey: string, giftName = "") {
    this.pos = pos; this.name = name; this.msgKey = msgKey; this.giftName = giftName;
  }
  setPosition(p: Pos) { this.pos = P(p.x, p.y); }
  talk() { return T(this.msgKey); }
  setMessageKey(k: string) { this.msgKey = k; }
  giveGift(): string | null {
    if (this.hasGivenGift || !this.giftName) return null;
    this.hasGivenGift = true;
    return this.giftName;
  }
}

export enum ChestType { Normal, TorchOnly, Legendary, LanternChest, AbyssKeyChest }
export class Chest {
  pos: Pos; isOpened = false; type: ChestType;
  constructor(pos: Pos, type = ChestType.Normal) { this.pos = pos; this.type = type; }
  open() { this.isOpened = true; }
}

export class Seal {
  pos: Pos; id: number; isActivated = false;
  constructor(id: number, pos: Pos) { this.id = id; this.pos = pos; }
  activate() { this.isActivated = true; }
}

export class Merchant {
  pos: Pos; name: string;
  constructor(pos: Pos, name = "Marchand") { this.pos = pos; this.name = name; }
}
