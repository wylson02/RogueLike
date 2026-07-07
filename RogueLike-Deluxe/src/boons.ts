// ===== Boons de Descente : le moteur de build émergent du mode Descente Infinie =====
// Quatre éléments (Braise, Givre, Sang, Tempête) + boons neutres. Contrairement à
// l'ancien système (pures sommes de stats), la plupart des boons sont des HOOKS lus
// par le combat (à-la-frappe, au-crit, au-kill, au-subi) : ils se COMBINENT au lieu
// de s'additionner. À 3 cumuls d'un même élément, une RÉSONANCE s'éveille et
// transforme le build (les brûlures détonent, les échos critiquent, le sang guérit…).
import { Player } from "./entities";
import { RNG } from "./core";

export type Rarity = "common" | "rare" | "epic";
export type Element = "fire" | "frost" | "blood" | "storm" | "neutral";

export interface Boon {
  id: string;
  nameKey: string;
  descKey: string;
  rarity: Rarity;
  element: Element;
  sprite: string;          // icône réutilisée du catalogue d'objets
  maxStacks: number;       // un boon peut être re-drafté jusqu'à ce plafond
  apply?: (p: Player) => void; // effet immédiat éventuel (stats) ; les hooks sont lus par le combat
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#a8c0d8", rare: "#8a5fd0", epic: "#ffb03a",
};
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, rare: 30, epic: 12 };

export const ELEMENT_COLOR: Record<Element, string> = {
  fire: "#ff7a3a", frost: "#7ad4ff", blood: "#ff4a6a", storm: "#ffe14a", neutral: "#c0b6d8",
};
export const ELEMENT_ICON: Record<Element, string> = {
  fire: "🔥", frost: "❄", blood: "🩸", storm: "⚡", neutral: "◆",
};

export const BOONS: Boon[] = [
  // ======== BRAISE (burn : dégâts sur la durée qui s'empilent) ========
  { id: "kindle", nameKey: "boon.kindle", descKey: "boon.kindle.d", rarity: "common", element: "fire",
    sprite: "it_torch", maxStacks: 3 },        // les attaques appliquent brûlure (2/cumul, 3 tours)
  { id: "ignite", nameKey: "boon.ignite", descKey: "boon.ignite.d", rarity: "rare", element: "fire",
    sprite: "it_charm", maxStacks: 2 },        // les crits appliquent +3 brûlure/cumul
  { id: "immolate", nameKey: "boon.immolate", descKey: "boon.immolate.d", rarity: "epic", element: "fire",
    sprite: "it_abyssrelic", maxStacks: 2 },   // +20%/cumul de dégâts aux ennemis qui brûlent
  { id: "ashes", nameKey: "boon.ashes", descKey: "boon.ashes.d", rarity: "common", element: "fire",
    sprite: "it_bomb", maxStacks: 3, apply: p => p.modifyAttack(+1) }, // +1 ATK ; brûle l'ennemi quand tu encaisses (2/cumul)

  // ======== GIVRE (chill : réduit l'ATK ennemie, contrôle) ========
  { id: "frostbite", nameKey: "boon.frostbite", descKey: "boon.frostbite.d", rarity: "common", element: "frost",
    sprite: "it_mist", maxStacks: 3 },         // les attaques givrent (−1 ATK ennemie/cumul, s'empile)
  { id: "iceheart", nameKey: "boon.iceheart", descKey: "boon.iceheart.d", rarity: "rare", element: "frost",
    sprite: "it_armor", maxStacks: 2, apply: p => p.modifyArmor(+2) }, // +2 ARM ; +1 ARM par tranche de 2 givres sur l'ennemi
  { id: "absolutezero", nameKey: "boon.absolutezero", descKey: "boon.absolutezero.d", rarity: "epic", element: "frost",
    sprite: "it_gem", maxStacks: 2 },          // 12%/cumul de geler (étourdir) l'ennemi à la frappe
  { id: "hail", nameKey: "boon.hail", descKey: "boon.hail.d", rarity: "common", element: "frost",
    sprite: "it_lantern", maxStacks: 3 },      // premier coup de chaque combat : givre massif (3/cumul)

  // ======== SANG (vol de vie, saignement, puissance à bas PV) ========
  { id: "leech", nameKey: "boon.leech", descKey: "boon.leech.d", rarity: "common", element: "blood",
    sprite: "it_ring", maxStacks: 3, apply: p => p.modifyLifeSteal(+6) },
  { id: "laceration", nameKey: "boon.laceration", descKey: "boon.laceration.d", rarity: "rare", element: "blood",
    sprite: "it_sword", maxStacks: 2 },        // les attaques entaillent (saignement 2/cumul, 4 tours)
  { id: "frenzy", nameKey: "boon.frenzy", descKey: "boon.frenzy.d", rarity: "epic", element: "blood",
    sprite: "it_abyssrelic", maxStacks: 2 },   // sous 50% PV : +18% dégâts/cumul
  { id: "transfusion", nameKey: "boon.transfusion", descKey: "boon.transfusion.d", rarity: "common", element: "blood",
    sprite: "it_gem", maxStacks: 3 },          // au kill : soigne 6%/cumul des PV max

  // ======== TEMPÊTE (crit, échos, foudre en chaîne) ========
  { id: "conductor", nameKey: "boon.conductor", descKey: "boon.conductor.d", rarity: "common", element: "storm",
    sprite: "it_charm", maxStacks: 3, apply: p => p.modifyCritChance(+6) },
  { id: "echo", nameKey: "boon.echo", descKey: "boon.echo.d", rarity: "rare", element: "storm",
    sprite: "it_echoshard", maxStacks: 2 },    // 15%/cumul de rejouer l'attaque à 50% de dégâts
  { id: "thunder", nameKey: "boon.thunder", descKey: "boon.thunder.d", rarity: "epic", element: "storm",
    sprite: "it_sunrelic", maxStacks: 2 },     // les crits foudroient : +35%/cumul de dégâts (ignore l'armure)
  { id: "tempo", nameKey: "boon.tempo", descKey: "boon.tempo.d", rarity: "common", element: "storm",
    sprite: "it_scroll", maxStacks: 1 },       // la première attaque de chaque combat est un crit garanti

  // ======== NEUTRES (fondations de stats — inchangés en esprit) ========
  { id: "vigor", nameKey: "boon.vigor", descKey: "boon.vigor.d", rarity: "common", element: "neutral",
    sprite: "it_gem", maxStacks: 5, apply: p => { p.maxHp += 8; p.hp += 8; } },
  { id: "edge", nameKey: "boon.edge", descKey: "boon.edge.d", rarity: "common", element: "neutral",
    sprite: "it_sword", maxStacks: 5, apply: p => p.modifyAttack(+2) },
  { id: "plating", nameKey: "boon.plating", descKey: "boon.plating.d", rarity: "common", element: "neutral",
    sprite: "it_armor", maxStacks: 4, apply: p => p.modifyArmor(+1) },
  { id: "titanheart", nameKey: "boon.titanheart", descKey: "boon.titanheart.d", rarity: "rare", element: "neutral",
    sprite: "it_gem", maxStacks: 3, apply: p => { p.maxHp += 16; p.hp = p.maxHp; } },
  { id: "warblade", nameKey: "boon.warblade", descKey: "boon.warblade.d", rarity: "rare", element: "neutral",
    sprite: "it_sword", maxStacks: 3, apply: p => { p.modifyAttack(+3); p.modifyCritChance(+5); } },
  { id: "berserker", nameKey: "boon.berserker", descKey: "boon.berserker.d", rarity: "epic", element: "neutral",
    sprite: "it_abyssrelic", maxStacks: 2,
    apply: p => { p.modifyAttack(+6); p.maxHp = Math.max(10, p.maxHp - 6); p.hp = Math.min(p.hp, p.maxHp); } },
  { id: "colossus", nameKey: "boon.colossus", descKey: "boon.colossus.d", rarity: "epic", element: "neutral",
    sprite: "it_armor", maxStacks: 2, apply: p => { p.maxHp += 24; p.hp = p.maxHp; p.modifyArmor(+2); } },
];

const byId = new Map(BOONS.map(b => [b.id, b]));
export function boonById(id: string): Boon | undefined { return byId.get(id); }

// Cumuls totaux d'un élément — seuil de résonance à 3.
export const RESONANCE_THRESHOLD = 3;
export function elementStacks(p: Player, el: Element): number {
  let n = 0;
  for (const [id, stacks] of Object.entries(p.runBoons)) {
    const b = byId.get(id);
    if (b && b.element === el) n += stacks;
  }
  return n;
}
export function hasResonance(p: Player, el: Element): boolean {
  return el !== "neutral" && elementStacks(p, el) >= RESONANCE_THRESHOLD;
}
export function activeResonances(p: Player): Element[] {
  return (["fire", "frost", "blood", "storm"] as Element[]).filter(el => hasResonance(p, el));
}

// Tire `n` boons distincts, pondérés par rareté ; la profondeur augmente rare/épique ;
// les boons déjà au plafond de cumuls sont exclus. epicOnly = draft d'autel maudit.
export function draftBoons(rng: RNG, depth: number, n = 3, opts?: { epicOnly?: boolean; player?: Player }): Boon[] {
  let pool = BOONS.filter(b => {
    if (opts?.player && (opts.player.runBoons[b.id] ?? 0) >= b.maxStacks) return false;
    if (opts?.epicOnly && b.rarity !== "epic") return false;
    return true;
  });
  if (pool.length === 0) pool = BOONS.filter(b => !opts?.epicOnly || b.rarity === "epic");
  const depthBonus = Math.min(30, depth * 1.5);
  const weightOf = (b: Boon) => {
    let w = RARITY_WEIGHT[b.rarity];
    if (b.rarity === "rare") w += depthBonus;
    if (b.rarity === "epic") w += depthBonus * 0.8;
    // Légère pondération vers les éléments déjà investis : les builds se dessinent naturellement.
    if (opts?.player && b.element !== "neutral") w += elementStacks(opts.player, b.element) * 6;
    return w;
  };
  const out: Boon[] = [];
  const local = [...pool];
  for (let i = 0; i < n && local.length; i++) {
    const total = local.reduce((a, b) => a + weightOf(b), 0);
    let r = rng.float() * total;
    let idx = 0;
    for (let j = 0; j < local.length; j++) { r -= weightOf(local[j]); if (r <= 0) { idx = j; break; } }
    out.push(local.splice(idx, 1)[0]);
  }
  return out;
}

// Prend un boon : effet immédiat + enregistrement du cumul. Renvoie les résonances
// nouvellement éveillées (pour le feedback visuel/sonore).
export function takeBoon(p: Player, b: Boon): Element[] {
  const before = activeResonances(p);
  p.addBoon(b.id);
  b.apply?.(p);
  const after = activeResonances(p);
  return after.filter(el => !before.includes(el));
}

// ===== Malédictions de run (autels maudits) : le prix du pouvoir =====
export interface Curse {
  id: string;
  nameKey: string;
  descKey: string;
  apply?: (p: Player) => void; // effet immédiat ; les effets continus sont lus par le contexte/combat
}

export const CURSES: Curse[] = [
  { id: "fragility", nameKey: "curse.fragility", descKey: "curse.fragility.d",
    apply: p => { p.maxHp = Math.max(15, Math.round(p.maxHp * 0.9)); p.hp = Math.min(p.hp, p.maxHp); } },
  { id: "famine", nameKey: "curse.famine", descKey: "curse.famine.d" },   // plus de soin entre les étages
  { id: "gloom", nameKey: "curse.gloom", descKey: "curse.gloom.d",
    apply: p => { p.visionRadius = Math.max(2, p.visionRadius - 1); } },
  { id: "attrition", nameKey: "curse.attrition", descKey: "curse.attrition.d" }, // soins de combat −50%
];

export function curseById(id: string): Curse | undefined { return CURSES.find(c => c.id === id); }
export function rollCurse(rng: RNG, existing: string[]): Curse {
  const pool = CURSES.filter(c => !existing.includes(c.id));
  return pool.length ? pool[rng.next(0, pool.length)] : CURSES[rng.next(0, CURSES.length)];
}
