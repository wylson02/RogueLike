// ===== Objets — port de Domain/Items =====
import { Pos, P, RNG } from "./core";
import { Player, EquipSlot } from "./entities";
import { T } from "./i18n";

export class Item {
  id: string;
  pos: Pos;
  sprite: string;
  nameKey: string;
  descKey: string;
  autoApply: boolean;      // AutoApplyOnPickup
  canSell: boolean;
  autoEquip: boolean;      // AutoEquipOnPickup
  slot?: EquipSlot;
  legendary = false;
  quest = false;
  bonuses: { atk?: number; arm?: number; crit?: number; ls?: number };
  applyFn?: (p: Player) => void;

  constructor(o: Partial<Item> & { id: string; sprite: string; nameKey: string; descKey: string }) {
    this.id = o.id;
    this.pos = o.pos ?? P(-1, -1);
    this.sprite = o.sprite;
    this.nameKey = o.nameKey;
    this.descKey = o.descKey;
    this.autoApply = o.autoApply ?? true;
    this.canSell = o.canSell ?? true;
    this.autoEquip = o.autoEquip ?? false;
    this.slot = o.slot;
    this.legendary = o.legendary ?? false;
    this.quest = o.quest ?? false;
    this.bonuses = o.bonuses ?? {};
    this.applyFn = o.applyFn;
  }

  get name() { return T(this.nameKey); }
  get description() { return T(this.descKey); }

  onEquip(p: Player) {
    const b = this.bonuses;
    if (b.atk) p.modifyAttack(+b.atk);
    if (b.arm) p.modifyArmor(+b.arm);
    if (b.crit) p.modifyCritChance(+b.crit);
    if (b.ls) p.modifyLifeSteal(+b.ls);
  }
  onUnequip(p: Player) {
    const b = this.bonuses;
    if (b.atk) p.modifyAttack(-b.atk);
    if (b.arm) p.modifyArmor(-b.arm);
    if (b.crit) p.modifyCritChance(-b.crit);
    if (b.ls) p.modifyLifeSteal(-b.ls);
  }

  apply(p: Player) {
    if (this.applyFn) { this.applyFn(p); return; }
    if (this.slot !== undefined) p.equip(this);
  }

  statsLines(): string[] {
    const out: string[] = [];
    const b = this.bonuses;
    if (b.atk) out.push(T("stat.atk", { n: b.atk }));
    if (b.arm) out.push(T("stat.arm", { n: b.arm }));
    if (b.crit) out.push(T("stat.crit", { n: b.crit }));
    if (b.ls) out.push(T("stat.ls", { n: b.ls }));
    if (this.id === "LifeGem") out.push(T("stat.hp", { n: 10 }));
    if (this.slot === EquipSlot.Weapon) out.push(T("stat.equip.w"));
    if (this.slot === EquipSlot.Armor) out.push(T("stat.equip.a"));
    if (this.slot === EquipSlot.Accessory) out.push(T("stat.equip.acc"));
    if (this.slot === EquipSlot.Relic) out.push(T("stat.equip.relic"));
    if (this.legendary) out.push(T("stat.legendary"));
    if (this.quest) out.push(T("stat.quest"));
    return out;
  }
}

// ===== Catalogue — port de ItemCatalog.cs =====
export const ItemCatalog = {
  sword: (pos: Pos) => new Item({
    id: "Sword", pos, sprite: "it_sword", nameKey: "item.sword", descKey: "item.sword.d",
    autoApply: false, slot: EquipSlot.Weapon, bonuses: { atk: 2 },
  }),
  armor: (pos: Pos) => new Item({
    id: "Armor", pos, sprite: "it_armor", nameKey: "item.armor", descKey: "item.armor.d",
    autoApply: false, slot: EquipSlot.Armor, bonuses: { arm: 2 },
  }),
  lifeGem: (pos: Pos) => new Item({
    id: "LifeGem", pos, sprite: "it_gem", nameKey: "item.gem", descKey: "item.gem.d",
    autoApply: true, applyFn: (p) => p.heal(10),
  }),
  critCharm: (pos: Pos) => new Item({
    id: "CritCharm", pos, sprite: "it_charm", nameKey: "item.charm", descKey: "item.charm.d",
    autoApply: false, slot: EquipSlot.Accessory, bonuses: { crit: 15 },
  }),
  vampRing: (pos: Pos) => new Item({
    id: "VampRing", pos, sprite: "it_ring", nameKey: "item.ring", descKey: "item.ring.d",
    autoApply: false, slot: EquipSlot.Accessory, bonuses: { ls: 10 },
  }),
  torch: (pos: Pos) => new Item({
    id: "Torch", pos, sprite: "it_torch", nameKey: "item.torch", descKey: "item.torch.d",
    autoApply: true, applyFn: (p) => { if (p.lightBonus < 5) p.setLightBonus(1); },
  }),
  lantern: (pos: Pos) => new Item({
    id: "Lantern", pos, sprite: "it_lantern", nameKey: "item.lantern", descKey: "item.lantern.d",
    autoApply: true, applyFn: (p) => p.increaseVision(2),
  }),
  legendarySword: (pos: Pos) => new Item({
    id: "LegendarySword", pos, sprite: "it_legend", nameKey: "item.legend", descKey: "item.legend.d",
    autoApply: false, canSell: false, autoEquip: true, legendary: true,
    slot: EquipSlot.Weapon, bonuses: { atk: 6, crit: 10, ls: 5 },
  }),
  sunRelic: (pos: Pos) => new Item({
    id: "SunRelic", pos, sprite: "it_sunrelic", nameKey: "item.sunrelic", descKey: "item.sunrelic.d",
    autoApply: false, slot: EquipSlot.Relic, bonuses: { arm: 2, crit: 8 },
  }),
  abyssRelic: (pos: Pos) => new Item({
    id: "AbyssRelic", pos, sprite: "it_abyssrelic", nameKey: "item.abyssrelic", descKey: "item.abyssrelic.d",
    autoApply: false, slot: EquipSlot.Relic, bonuses: { atk: 2, ls: 8 },
  }),
  echoShard: (pos: Pos) => new Item({
    id: "EchoShard", pos, sprite: "it_echoshard", nameKey: "item.echoshard", descKey: "item.echoshard.d",
    autoApply: false, canSell: false, legendary: true, slot: EquipSlot.Relic, bonuses: { atk: 3, ls: 10 },
  }),
  map1ArmoryKey: (pos: Pos) => new Item({
    id: "Map1ArmoryKey", pos, sprite: "it_key", nameKey: "item.armorykey", descKey: "item.armorykey.d",
    autoApply: false, canSell: false, quest: true,
  }),
  abyssKey: (pos: Pos) => new Item({
    id: "AbyssKey", pos, sprite: "it_abysskey", nameKey: "item.abysskey", descKey: "item.abysskey.d",
    autoApply: false, canSell: false, quest: true, legendary: true,
  }),
  create(id: string, pos: Pos): Item {
    switch (id) {
      case "Sword": return this.sword(pos);
      case "Armor": return this.armor(pos);
      case "LifeGem": return this.lifeGem(pos);
      case "CritCharm": return this.critCharm(pos);
      case "VampRing": return this.vampRing(pos);
      case "Torch": return this.torch(pos);
      case "Lantern": return this.lantern(pos);
      case "LegendarySword": return this.legendarySword(pos);
      case "Map1ArmoryKey": return this.map1ArmoryKey(pos);
      case "AbyssKey": return this.abyssKey(pos);
      case "SunRelic": return this.sunRelic(pos);
      case "AbyssRelic": return this.abyssRelic(pos);
      case "EchoShard": return this.echoShard(pos);
      default: throw new Error("Item inconnu: " + id);
    }
  },
};

// ===== Table de butin — port de LootTable.cs =====
const LOOT_POOL = ["LifeGem", "LifeGem", "Sword", "Armor", "CritCharm", "VampRing", "LegendarySword", "SunRelic"];
export function rollLoot(rng: RNG, pos: Pos): Item {
  return ItemCatalog.create(LOOT_POOL[rng.next(0, LOOT_POOL.length)], pos);
}

// ===== Prix de vente — port de MerchantState.SellPrice =====
export function sellPrice(item: Item): number {
  switch (item.id) {
    case "LegendarySword": return 50;
    case "AbyssRelic": return 20;
    case "SunRelic": return 18;
    case "VampRing": return 13;
    case "CritCharm": return 12;
    case "LifeGem": return 11;
    case "Armor": return 10;
    case "Sword": return 9;
    default: return 6;
  }
}

// ===== Stock du marchand — port de MerchantState =====
export const MERCHANT_STOCK: { labelKey: string; id: string; price: number }[] = [
  { labelKey: "shop.stock.sword", id: "Sword", price: 18 },
  { labelKey: "shop.stock.armor", id: "Armor", price: 20 },
  { labelKey: "shop.stock.gem", id: "LifeGem", price: 22 },
  { labelKey: "shop.stock.charm", id: "CritCharm", price: 24 },
  { labelKey: "shop.stock.ring", id: "VampRing", price: 26 },
  { labelKey: "shop.stock.abyssrelic", id: "AbyssRelic", price: 34 },
];

// ===== Marchande ambulante (nocturne, rare) — objets rares à prix majoré =====
export const NIGHT_MERCHANT_NAME = "Nyx la Rôdeuse";
export const NIGHT_MERCHANT_STOCK: { labelKey: string; id: string; price: number }[] = [
  { labelKey: "shop.stock.night.sunrelic", id: "SunRelic", price: 46 },
  { labelKey: "shop.stock.night.abyssrelic", id: "AbyssRelic", price: 48 },
  { labelKey: "shop.stock.night.lantern", id: "Lantern", price: 40 },
];
