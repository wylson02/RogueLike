// ===== Sauvegarde (localStorage) =====
import { GameContext } from "./context";
import { Player, ClassId } from "./entities";
import { defaultKit } from "./skills";
import { QuestStatus } from "./quests";
import { ItemCatalog } from "./items";
import { P } from "./core";
import { Lang } from "./i18n";

const SAVE_KEY = "abyss-seals-save-v1";
const SETTINGS_KEY = "abyss-seals-settings-v1";

interface SaveData {
  level: number;
  arenaWave?: number;
  oath?: number;                       // LE SERMENT : axe moral de campagne
  choices?: Record<string, string>;    // mémoire des choix moraux
  rivalSpared?: boolean;
  questStates?: Record<string, string>; // état des quêtes (dont "failed" définitif)
  devourerFilmSeen?: boolean;
  companion?: { questId: string; nameKey: string; sprite: string; x: number; y: number; hp: number; maxHp: number; attack: number; alive: boolean } | null;
  p: {
    maxHp: number; hp: number; attack: number; armor: number;
    crit: number; ls: number; critMul: number;
    gold: number; level: number; xp: number; statPoints: number;
    visionRadius: number; lightBonus: number;
    classId: ClassId;
    weaponUpgradeLevel: number;
    armorUpgradeLevel?: number;
    dodgeBonus?: number;
    classPassiveUnlocked?: boolean;
    talents?: string[];
    skills?: string[];
    inv: string[];
    eqW: string | null; eqA: string | null; eqAcc: string | null; eqRelic: string | null;
  };
}

export function saveGame(ctx: GameContext) {
  try {
    const p = ctx.player;
    const data: SaveData = {
      level: ctx.currentLevel,
      arenaWave: ctx.arenaWave,
      oath: ctx.oath,
      choices: ctx.choices,
      rivalSpared: ctx.rivalSpared,
      questStates: ctx.questStates,
      devourerFilmSeen: ctx.devourerFilmSeen,
      companion: ctx.companion
        ? { questId: ctx.companion.questId, nameKey: ctx.companion.nameKey, sprite: ctx.companion.sprite, x: ctx.companion.pos.x, y: ctx.companion.pos.y, hp: ctx.companion.hp, maxHp: ctx.companion.maxHp, attack: ctx.companion.attack, alive: ctx.companion.alive }
        : null,
      p: {
        maxHp: p.maxHp, hp: p.hp, attack: p.attack, armor: p.armor,
        crit: p.critChancePercent, ls: p.lifeStealPercent, critMul: p.critMultiplierPercent,
        gold: p.gold, level: p.level, xp: p.xp, statPoints: p.statPoints,
        visionRadius: p.visionRadius, lightBonus: p.lightBonus,
        classId: p.classId,
        weaponUpgradeLevel: p.weaponUpgradeLevel,
        armorUpgradeLevel: p.armorUpgradeLevel,
        dodgeBonus: p.dodgeBonus,
        classPassiveUnlocked: p.classPassiveUnlocked,
        talents: p.talents,
        skills: p.skills,
        inv: p.inventory.map(i => i.id),
        eqW: p.equippedWeapon?.id ?? null,
        eqA: p.equippedArmor?.id ?? null,
        eqAcc: p.equippedAccessory?.id ?? null,
        eqRelic: p.equippedRelic?.id ?? null,
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
    p.classId = s.classId ?? "warrior"; // sauvegardes pré-classes : repli sur Guerrier
    p.armorUpgradeLevel = s.armorUpgradeLevel ?? 0;
    p.dodgeBonus = s.dodgeBonus ?? 0;
    p.classPassiveUnlocked = s.classPassiveUnlocked ?? false;
    p.talents = s.talents ?? []; // les bonus immédiats sont déjà cuits dans les stats sauvegardées
    p.skills = s.skills ?? defaultKit(p.classId); // sauvegardes pré-compétences : kit par défaut de la classe
    for (const id of s.inv) { try { p.inventory.push(ItemCatalog.create(id, P(-1, -1))); } catch { } }
    // équipement restauré SANS ré-appliquer les bonus (déjà inclus dans les stats)
    if (s.eqW) p.equippedWeapon = ItemCatalog.create(s.eqW, P(-1, -1));
    if (s.eqA) p.equippedArmor = ItemCatalog.create(s.eqA, P(-1, -1));
    if (s.eqAcc) p.equippedAccessory = ItemCatalog.create(s.eqAcc, P(-1, -1));
    if (s.eqRelic) p.equippedRelic = ItemCatalog.create(s.eqRelic, P(-1, -1));
    ctx.player = p;
    ctx.arenaWave = data.arenaWave ?? 1;
    ctx.oath = data.oath ?? 0;
    ctx.choices = data.choices ?? {};
    ctx.rivalSpared = data.rivalSpared ?? false;
    ctx.questStates = (data.questStates ?? {}) as Record<string, QuestStatus>;
    ctx.devourerFilmSeen = data.devourerFilmSeen ?? false;
    ctx.companion = data.companion
      ? { questId: data.companion.questId, nameKey: data.companion.nameKey, sprite: data.companion.sprite, pos: P(data.companion.x, data.companion.y), hp: data.companion.hp, maxHp: data.companion.maxHp, attack: data.companion.attack, alive: data.companion.alive }
      : null;
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
