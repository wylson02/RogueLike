// ===== Méta-progression persistante : l'Essence gagnée en run achète des améliorations définitives =====
// C'est la boucle "roguelite" : on meurt, on revient plus fort. Stockée à part de la sauvegarde d'histoire.
import { Player } from "./entities";

const META_KEY = "abyss-meta-v1";

export interface MetaData {
  essence: number;
  bestDepth: number;
  runs: number;
  upgrades: Record<string, number>;
}

export interface MetaUpgrade {
  id: string;
  nameKey: string;
  descKey: string;
  maxLevel: number;
  cost: (level: number) => number;   // coût pour passer de `level` à `level+1`
  apply: (p: Player, level: number) => void;
}

export const META_UPGRADES: MetaUpgrade[] = [
  { id: "vitality", nameKey: "meta.vitality", descKey: "meta.vitality.d", maxLevel: 8,
    cost: l => 30 + l * 25, apply: (p, l) => { p.maxHp += l * 6; p.hp = p.maxHp; } },
  { id: "power", nameKey: "meta.power", descKey: "meta.power.d", maxLevel: 6,
    cost: l => 40 + l * 35, apply: (p, l) => p.modifyAttack(+l) },
  { id: "fortune", nameKey: "meta.fortune", descKey: "meta.fortune.d", maxLevel: 6,
    cost: l => 40 + l * 30, apply: (p, l) => p.modifyCritChance(+l * 3) },
  { id: "resolve", nameKey: "meta.resolve", descKey: "meta.resolve.d", maxLevel: 5,
    cost: l => 45 + l * 35, apply: (p, l) => p.modifyArmor(+l) },
  { id: "greed", nameKey: "meta.greed", descKey: "meta.greed.d", maxLevel: 5,
    cost: l => 50 + l * 40, apply: (p, l) => { (p as any).startGoldBonus = l * 25; p.addGold(l * 25); } },
  { id: "avarice", nameKey: "meta.avarice", descKey: "meta.avarice.d", maxLevel: 5,
    cost: l => 60 + l * 45, apply: () => { /* multiplicateur d'essence, appliqué à la récolte */ } },
];

const upgradeById = new Map(META_UPGRADES.map(u => [u.id, u]));

const DEFAULT_META: MetaData = { essence: 0, bestDepth: 0, runs: 0, upgrades: {} };

export function loadMeta(): MetaData {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return { ...DEFAULT_META, ...JSON.parse(raw) };
  } catch { }
  return { ...DEFAULT_META, upgrades: {} };
}

export function saveMeta(m: MetaData) {
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { }
}

export function upgradeLevel(m: MetaData, id: string): number { return m.upgrades[id] ?? 0; }

// Coût pour améliorer, ou null si au max.
export function nextUpgradeCost(m: MetaData, id: string): number | null {
  const u = upgradeById.get(id); if (!u) return null;
  const lvl = upgradeLevel(m, id);
  if (lvl >= u.maxLevel) return null;
  return u.cost(lvl);
}

export function buyUpgrade(m: MetaData, id: string): boolean {
  const cost = nextUpgradeCost(m, id);
  if (cost === null || m.essence < cost) return false;
  m.essence -= cost;
  m.upgrades[id] = upgradeLevel(m, id) + 1;
  return true;
}

// Applique toutes les améliorations achetées à un joueur en début de run.
export function applyMetaToPlayer(p: Player, m: MetaData) {
  for (const u of META_UPGRADES) {
    const lvl = upgradeLevel(m, u.id);
    if (lvl > 0) u.apply(p, lvl);
  }
}

// Multiplicateur d'essence issu de l'amélioration "avarice".
export function essenceMultiplier(m: MetaData): number {
  return 1 + upgradeLevel(m, "avarice") * 0.2;
}
