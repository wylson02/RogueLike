// ===== Entités — port de Domain/Entities + Builders + AI =====
import { Pos, P, RNG, clamp, Dir } from "./core";
import type { Item } from "./items";
import { T } from "./i18n";
import { defaultKit } from "./skills";

// ===== Effets de statut (portée : un combat) =====
// poison/burn/bleed : dégâts par tour • stun : perd son tour • chill : réduit l'ATK effective
export type StatusKind = "poison" | "stun" | "burn" | "bleed" | "chill";
export interface StatusEffect { kind: StatusKind; turns: number; power: number; }
// Les statuts élémentaires s'empilent en puissance (c'est le moteur des builds Braise/Sang/Givre)
const STACKING_STATUS: StatusKind[] = ["burn", "bleed", "chill"];

export abstract class Character {
  pos: Pos;
  maxHp: number; hp: number;
  attack: number; armor = 0;
  critChancePercent = 0;
  lifeStealPercent = 0;
  critMultiplierPercent = 200;
  statuses: StatusEffect[] = [];

  constructor(pos: Pos, hp: number, attack: number) {
    this.pos = pos; this.maxHp = hp; this.hp = hp; this.attack = attack;
  }
  get isDead() { return this.hp <= 0; }
  setPosition(p: Pos) { this.pos = P(p.x, p.y); }
  takeDamage(amount: number): number {
    // Une attaque inflige toujours au moins 1 dégât (évite les impasses d'armure).
    const dmg = amount <= 0 ? 0 : Math.max(1, amount - this.armor);
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

  // Statuts : poison/stun se rafraîchissent (durée/puissance max) ; burn/bleed/chill
  // EMPILENT leur puissance (plafonnée) — c'est ce qui rend les builds élémentaires émergents.
  addStatus(kind: StatusKind, turns: number, power = 0) {
    const cur = this.statuses.find(s => s.kind === kind);
    if (cur) {
      cur.turns = Math.max(cur.turns, turns);
      if (STACKING_STATUS.includes(kind)) cur.power = Math.min(kind === "chill" ? 6 : 30, cur.power + power);
      else cur.power = Math.max(cur.power, power);
    } else this.statuses.push({ kind, turns, power });
  }
  hasStatus(kind: StatusKind): boolean { return this.statuses.some(s => s.kind === kind && s.turns > 0); }
  getStatus(kind: StatusKind): StatusEffect | null { return this.statuses.find(s => s.kind === kind) ?? null; }
  statusPower(kind: StatusKind): number { return this.getStatus(kind)?.power ?? 0; }
  // ATK effective en combat : le givre engourdit
  get effectiveAttack(): number { return Math.max(1, this.attack - this.statusPower("chill")); }
  clearStatuses() { this.statuses = []; }
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
  talents: string[] = []; // ids de talents choisis (ex. "w1a")
  skills: string[] = [];  // kit de compétences équipées (ids ; voir skills.ts). Rempli par la classe.
  // ===== Boons de run (Descente Infinie) : id → cumuls. Lus par le combat via les hooks. =====
  runBoons: Record<string, number> = {};

  boonLevel(id: string): number { return this.runBoons[id] ?? 0; }
  addBoon(id: string) { this.runBoons[id] = (this.runBoons[id] ?? 0) + 1; }

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

  hasTalent(id: string): boolean { return this.talents.includes(id); }

  // Apprend une compétence. Avec replaceId, elle prend la place de celle-ci dans le kit
  // (c'est l'API que les PNJ de Phase 2 appelleront pour offrir une technique unique).
  learnSkill(id: string, replaceId?: string) {
    if (this.skills.includes(id)) return;
    const idx = replaceId ? this.skills.indexOf(replaceId) : -1;
    if (idx >= 0) this.skills[idx] = id;
    else this.skills.push(id);
  }

  // Palier de talent en attente de choix : niv 3 → palier 1, niv 6 → palier 2
  pendingTalentTier(): 1 | 2 | null {
    if (this.level >= 3 && !this.talents.some(t => t[1] === "1")) return 1;
    if (this.level >= 6 && !this.talents.some(t => t[1] === "2")) return 2;
    return null;
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

// ===== Talents : choix aux niveaux 3 (palier 1) et 6 (palier 2), 2 options par classe =====
// Les talents "immédiats" appliquent leurs stats au choix ; les autres sont lus par le combat.
export interface TalentDef { id: string; nameKey: string; descKey: string; apply?: (p: Player) => void; }

export const TalentCatalog: Record<ClassId, Record<1 | 2, [TalentDef, TalentDef]>> = {
  warrior: {
    1: [
      { id: "w1a", nameKey: "talent.w1a", descKey: "talent.w1a.d", apply: p => p.modifyArmor(+2) },
      { id: "w1b", nameKey: "talent.w1b", descKey: "talent.w1b.d", apply: p => p.modifyAttack(+2) },
    ],
    2: [
      { id: "w2a", nameKey: "talent.w2a", descKey: "talent.w2a.d" }, // soins de combat +4
      { id: "w2b", nameKey: "talent.w2b", descKey: "talent.w2b.d", apply: p => { p.maxHp += 15; p.hp += 15; } },
    ],
  },
  mage: {
    1: [
      { id: "m1a", nameKey: "talent.m1a", descKey: "talent.m1a.d", apply: p => p.modifyCritChance(+10) },
      { id: "m1b", nameKey: "talent.m1b", descKey: "talent.m1b.d" }, // Explosion Arcanique +50%
    ],
    2: [
      { id: "m2a", nameKey: "talent.m2a", descKey: "talent.m2a.d", apply: p => p.modifyArmor(+2) },
      { id: "m2b", nameKey: "talent.m2b", descKey: "talent.m2b.d" }, // capacité 2×/combat
    ],
  },
  rogue: {
    1: [
      { id: "r1a", nameKey: "talent.r1a", descKey: "talent.r1a.d", apply: p => p.modifyAttack(+2) },
      { id: "r1b", nameKey: "talent.r1b", descKey: "talent.r1b.d", apply: p => p.modifyLifeSteal(+10) },
    ],
    2: [
      { id: "r2a", nameKey: "talent.r2a", descKey: "talent.r2a.d" }, // 15% d'esquive passive
      { id: "r2b", nameKey: "talent.r2b", descKey: "talent.r2b.d" }, // capacité 2×/combat
    ],
  },
};

export function chooseTalent(p: Player, def: TalentDef) {
  if (p.talents.includes(def.id)) return;
  p.talents.push(def.id);
  def.apply?.(p);
}

// Applique les deltas de stats de départ d'une classe à un joueur fraîchement créé.
export function applyClass(p: Player, id: ClassId) {
  p.classId = id;
  p.skills = defaultKit(id); // kit de compétences de départ de la classe
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

// ===== Affixes d'élites (Descente Infinie) : chaque élite a un twist de combat =====
// thorns : renvoie 20% des dégâts subis • vampiric : soigne 30% des dégâts infligés
// swift : frappe deux fois (60% chacune) • brute : ses coups lourds sont inesquivables
// shielded : +3 armure de départ
export type EliteAffix = "thorns" | "vampiric" | "swift" | "brute" | "shielded";
export const ELITE_AFFIXES: EliteAffix[] = ["thorns", "vampiric", "swift", "brute", "shielded"];

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
  affix: EliteAffix | null = null; // twist de combat des élites (Épines, Vampirique…)
  spokeIntro = false;  // le boss a-t-il déjà prononcé son dialogue de rencontre ?
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
  get name() {
    const base = T(this.nameKey);
    return this.affix ? `${base} — ${T("affix." + this.affix)}` : base;
  }
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

// Compagnon de quête : un PNJ recruté qui te suit sur la map et combat à tes côtés.
// PV persistants entre les combats ; s'il tombe, la quête liée échoue définitivement.
export interface Companion {
  questId: string;
  nameKey: string;   // clé i18n du nom affiché
  sprite: string;    // clé de sprite (rendu sur la map + en combat)
  pos: Pos;
  hp: number; maxHp: number;
  attack: number;
  alive: boolean;
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

// ===== Événements d'étage (Descente Infinie) =====
// Autel maudit : un boon épique contre une malédiction de run. Sanctuaire : soin unique.
export class Altar {
  pos: Pos; used = false;
  constructor(pos: Pos) { this.pos = pos; }
}
export class Shrine {
  pos: Pos; used = false;
  constructor(pos: Pos) { this.pos = pos; }
}

// Piège du labyrinthe : visible dans le halo, se déclenche quand on marche dessus.
export type TrapKind = "spikes" | "gas";
export class Trap {
  pos: Pos; kind: TrapKind; sprung = false;
  constructor(pos: Pos, kind: TrapKind) { this.pos = pos; this.kind = kind; }
}

// Décor purement visuel (non bloquant). Les torches émettent de la lumière.
export type PropKind = "torch" | "bones" | "column" | "cobweb" | "puddle" | "skull";
export class Prop {
  pos: Pos; kind: PropKind;
  constructor(pos: Pos, kind: PropKind) { this.pos = pos; this.kind = kind; }
}

// Point de lore découvrable : en marchant dessus, déclenche une cinématique de révélation.
export class LoreMark {
  pos: Pos; cineKey: string; sprite: string; seen = false;
  constructor(pos: Pos, cineKey: string, sprite: string) { this.pos = pos; this.cineKey = cineKey; this.sprite = sprite; }
}
