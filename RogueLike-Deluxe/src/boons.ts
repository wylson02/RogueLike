// ===== Reliques de Descente : bonus permanents draftables (1 parmi 3) entre les étages =====
// Contrairement à l'équipement (1 par slot), les boons s'empilent librement — c'est le
// moteur de build du mode Descente Infinie (façon Hades/Slay the Spire).
import { Player } from "./entities";
import { RNG } from "./core";

export type Rarity = "common" | "rare" | "epic";

export interface Boon {
  id: string;
  nameKey: string;
  descKey: string;
  rarity: Rarity;
  sprite: string;        // icône réutilisée du catalogue d'objets
  apply: (p: Player) => void;
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#a8c0d8", rare: "#8a5fd0", epic: "#ffb03a",
};
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, rare: 30, epic: 12 };

export const BOONS: Boon[] = [
  // ---- communs ----
  { id: "vigor", nameKey: "boon.vigor", descKey: "boon.vigor.d", rarity: "common", sprite: "it_gem",
    apply: p => { p.maxHp += 8; p.hp += 8; } },
  { id: "edge", nameKey: "boon.edge", descKey: "boon.edge.d", rarity: "common", sprite: "it_sword",
    apply: p => p.modifyAttack(+2) },
  { id: "plating", nameKey: "boon.plating", descKey: "boon.plating.d", rarity: "common", sprite: "it_armor",
    apply: p => p.modifyArmor(+1) },
  { id: "focus", nameKey: "boon.focus", descKey: "boon.focus.d", rarity: "common", sprite: "it_charm",
    apply: p => p.modifyCritChance(+6) },
  { id: "leech", nameKey: "boon.leech", descKey: "boon.leech.d", rarity: "common", sprite: "it_ring",
    apply: p => p.modifyLifeSteal(+6) },
  { id: "torchlight", nameKey: "boon.torchlight", descKey: "boon.torchlight.d", rarity: "common", sprite: "it_lantern",
    apply: p => p.increaseVision(1) },

  // ---- rares ----
  { id: "titanheart", nameKey: "boon.titanheart", descKey: "boon.titanheart.d", rarity: "rare", sprite: "it_gem",
    apply: p => { p.maxHp += 16; p.hp = p.maxHp; } },
  { id: "warblade", nameKey: "boon.warblade", descKey: "boon.warblade.d", rarity: "rare", sprite: "it_sword",
    apply: p => { p.modifyAttack(+3); p.modifyCritChance(+5); } },
  { id: "aegis", nameKey: "boon.aegis", descKey: "boon.aegis.d", rarity: "rare", sprite: "it_sunrelic",
    apply: p => { p.modifyArmor(+2); p.modifyCritChance(+6); } },
  { id: "bloodpact", nameKey: "boon.bloodpact", descKey: "boon.bloodpact.d", rarity: "rare", sprite: "it_ring",
    apply: p => { p.modifyLifeSteal(+10); p.modifyAttack(+1); } },

  // ---- épiques ----
  { id: "executioner", nameKey: "boon.executioner", descKey: "boon.executioner.d", rarity: "epic", sprite: "it_charm",
    apply: p => { p.modifyCritChance(+15); p.modifyCritMultiplierPercent(+40); } },
  { id: "berserker", nameKey: "boon.berserker", descKey: "boon.berserker.d", rarity: "epic", sprite: "it_abyssrelic",
    apply: p => { p.modifyAttack(+6); p.maxHp = Math.max(10, p.maxHp - 6); p.hp = Math.min(p.hp, p.maxHp); } },
  { id: "vampirelord", nameKey: "boon.vampirelord", descKey: "boon.vampirelord.d", rarity: "epic", sprite: "it_ring",
    apply: p => { p.modifyLifeSteal(+18); p.modifyAttack(+2); } },
  { id: "colossus", nameKey: "boon.colossus", descKey: "boon.colossus.d", rarity: "epic", sprite: "it_armor",
    apply: p => { p.maxHp += 24; p.hp = p.maxHp; p.modifyArmor(+2); } },
];

const byId = new Map(BOONS.map(b => [b.id, b]));
export function boonById(id: string): Boon | undefined { return byId.get(id); }

// Tire `n` boons distincts, pondérés par rareté ; la profondeur augmente la chance de rare/épique.
export function draftBoons(rng: RNG, depth: number, n = 3): Boon[] {
  const pool = [...BOONS];
  const depthBonus = Math.min(30, depth * 1.5);
  const weightOf = (b: Boon) => {
    let w = RARITY_WEIGHT[b.rarity];
    if (b.rarity === "rare") w += depthBonus;
    if (b.rarity === "epic") w += depthBonus * 0.8;
    return w;
  };
  const out: Boon[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const total = pool.reduce((a, b) => a + weightOf(b), 0);
    let r = rng.float() * total;
    let idx = 0;
    for (let j = 0; j < pool.length; j++) { r -= weightOf(pool[j]); if (r <= 0) { idx = j; break; } }
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}
