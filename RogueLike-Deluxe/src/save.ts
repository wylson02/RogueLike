// ===== Sauvegarde (localStorage) =====
import { GameContext } from "./context";
import { Player } from "./entities";
import { ItemCatalog } from "./items";
import { P } from "./core";
import { Lang } from "./i18n";

const SAVE_KEY = "abyss-seals-save-v1";
const SETTINGS_KEY = "abyss-seals-settings-v1";

interface SaveData {
  level: number;
  p: {
    maxHp: number; hp: number; attack: number; armor: number;
    crit: number; ls: number; critMul: number;
    gold: number; level: number; xp: number; statPoints: number;
    visionRadius: number; lightBonus: number;
    inv: string[];
    eqW: string | null; eqA: string | null; eqAcc: string | null;
  };
}

export function saveGame(ctx: GameContext) {
  try {
    const p = ctx.player;
    const data: SaveData = {
      level: ctx.currentLevel,
      p: {
        maxHp: p.maxHp, hp: p.hp, attack: p.attack, armor: p.armor,
        crit: p.critChancePercent, ls: p.lifeStealPercent, critMul: p.critMultiplierPercent,
        gold: p.gold, level: p.level, xp: p.xp, statPoints: p.statPoints,
        visionRadius: p.visionRadius, lightBonus: p.lightBonus,
        inv: p.inventory.map(i => i.id),
        eqW: p.equippedWeapon?.id ?? null,
        eqA: p.equippedArmor?.id ?? null,
        eqAcc: p.equippedAccessory?.id ?? null,
      },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* stockage indisponible */ }
}

export function hasSave(): boolean {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function savedLevel(): number {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return 1;
    return (JSON.parse(raw) as SaveData).level ?? 1;
  } catch { return 1; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { }
}

// Restaure le joueur + niveau. Retourne le niveau à charger, ou null si pas de save.
export function loadGame(ctx: GameContext): number | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    const p = new Player(P(1, 1));
    const s = data.p;
    p.maxHp = s.maxHp; p.hp = s.hp; p.attack = s.attack; p.armor = s.armor;
    (p as any).critChancePercent = s.crit;
    (p as any).lifeStealPercent = s.ls;
    (p as any).critMultiplierPercent = s.critMul;
    (p as any).gold = s.gold;
    (p as any).level = s.level;
    (p as any).xp = s.xp;
    (p as any).statPoints = s.statPoints;
    p.visionRadius = s.visionRadius; p.lightBonus = s.lightBonus;
    for (const id of s.inv) { try { p.inventory.push(ItemCatalog.create(id, P(-1, -1))); } catch { } }
    // équipement restauré SANS ré-appliquer les bonus (déjà inclus dans les stats)
    if (s.eqW) p.equippedWeapon = ItemCatalog.create(s.eqW, P(-1, -1));
    if (s.eqA) p.equippedArmor = ItemCatalog.create(s.eqA, P(-1, -1));
    if (s.eqAcc) p.equippedAccessory = ItemCatalog.create(s.eqAcc, P(-1, -1));
    ctx.player = p;
    return data.level ?? 1;
  } catch { return null; }
}

export interface Settings { lang: Lang; musicVol: number; sfxVol: number; }
export function saveSettings(s: Settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { }
}
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { lang: "fr", musicVol: 0.7, sfxVol: 0.8, ...JSON.parse(raw) };
  } catch { }
  return { lang: "fr", musicVol: 0.7, sfxVol: 0.8 };
}
