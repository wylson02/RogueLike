// ===== Niveaux — port 1:1 de App/Services/LevelCatalog.cs =====
import { GameMap, Pos, P } from "./core";
import { Monster, MonsterCatalog, Pnj, Chest, ChestType, Seal, Merchant, Altar, Shrine } from "./entities";
import { Item, ItemCatalog } from "./items";
import { MapCatalog } from "./maps";

export interface LevelData {
  map: GameMap;
  playerStart: Pos;
  monsters: Monster[];
  items: Item[];
  chests: Chest[];
  pnjs: Pnj[];
  seals: Seal[];
  merchant: Merchant | null;
  altars?: Altar[];   // événements d'étage (Descente Infinie uniquement)
  shrines?: Shrine[];
}

export const FIRST_LEVEL = 1;
export const LAST_LEVEL = 5;
export const hasLevel = (n: number) => n >= FIRST_LEVEL && n <= LAST_LEVEL;

export function createLevel(level: number): LevelData {
  switch (level) {
    case 2: return level2();
    case 3: return level3();
    case 4: return level4();
    case 5: return level5();
    default: return level1();
  }
}

function level1(): LevelData {
  return {
    map: MapCatalog.level1(),
    playerStart: P(14, 8),
    monsters: [
      MonsterCatalog.slime(P(10, 3)),
      MonsterCatalog.golem(P(14, 6)),
      MonsterCatalog.spider(P(20, 2)),
    ],
    items: [
      ItemCatalog.armor(P(2, 13)),
      ItemCatalog.critCharm(P(3, 14)),
    ],
    chests: [
      new Chest(P(7, 6), ChestType.Normal),
      new Chest(P(12, 2), ChestType.Legendary),
    ],
    pnjs: [
      new Pnj(P(12, 6), "Kael", "pnj.kael", "Sword"),
      new Pnj(P(6, 12), "Lysa", "pnj.lysa", "Map1ArmoryKey"),
      new Pnj(P(28, 8), "Sentinelle", "pnj.sentinelle"),
      new Pnj(P(22, 8), "Rival", "rival.lvl1"),
    ],
    seals: [],
    merchant: null,
  };
}

// Niveau 2 — Les Catacombes du Serment (labyrinthe designé, cf. MapCatalog.level2)
function level2(): LevelData {
  return {
    map: MapCatalog.level2(),
    playerStart: P(1, 11),
    monsters: [
      MonsterCatalog.spider(P(9, 3)),      // embuscade dans le couloir étroit du nord
      MonsterCatalog.slime(P(15, 3)),      // alcôve nord
      MonsterCatalog.golem(P(16, 11)),     // patrouille la rotonde centrale
      MonsterCatalog.slime(P(22, 17)),     // route sud
      MonsterCatalog.gargoyle(P(30, 17)),  // garde la salle de la sortie
    ],
    items: [],
    chests: [
      new Chest(P(3, 3), ChestType.Normal),      // alcôve NO (hors chemin optimal)
      new Chest(P(23, 19), ChestType.Normal),    // cul-de-sac sud
      new Chest(P(28, 4), ChestType.Legendary),  // coffre-prison (clé de Torvin) — ancre MAP2_PRISON_CHEST
    ],
    pnjs: [
      new Pnj(P(3, 17), "Orin", "pnj.orin"),     // salle-refuge SO
      new Pnj(P(5, 17), "Aelis", "pnj.aelis"),   // salle-refuge SO
      new Pnj(P(10, 11), "Rival", "rival.lvl2"), // sur l'épine d'entrée (chemin principal)
      new Pnj(P(28, 5), "Torvin", "prisoner.locked"), // quartier-prison, à côté du coffre
    ],
    seals: [],
    merchant: null,
  };
}

function level3(): LevelData {
  return {
    map: MapCatalog.level3(),
    playerStart: P(32, 8),
    monsters: [
      MonsterCatalog.slime(P(10, 4)),
      MonsterCatalog.golem(P(14, 12)),
      MonsterCatalog.gargoyle(P(30, 16)),
    ],
    items: [ItemCatalog.legendarySword(P(21, 7))],
    seals: [
      new Seal(1, P(4, 3)),
      new Seal(2, P(4, 14)),
      new Seal(3, P(30, 2)),
    ],
    merchant: new Merchant(P(38, 7), "Vesna la Troqueuse"),
    chests: [
      new Chest(P(8, 13), ChestType.Normal),
      new Chest(P(28, 13), ChestType.Legendary),
    ],
    pnjs: [
      new Pnj(P(10, 8), "Elya", "pnj.elya"),
      new Pnj(P(28, 8), "Rival", "rival.lvl3.nosword"),
    ],
  };
}

function level4(): LevelData {
  return {
    map: MapCatalog.level4BossArena(),
    playerStart: P(3, 9),
    monsters: [MonsterCatalog.abyssKing(P(34, 9))],
    items: [],
    // coffre caché dans le recoin nord-est : contient la Clé de l'Abîme (donjon post-jeu)
    chests: [new Chest(P(41, 2), ChestType.AbyssKeyChest)],
    seals: [],
    merchant: null,
    pnjs: [new Pnj(P(6, 9), "Vesna", "pnj.vesna")],
  };
}

// Donjon post-jeu : Les Profondeurs — accessible via le portail derrière le trône
function level5(): LevelData {
  return {
    map: MapCatalog.level5Depths(),
    playerStart: P(2, 9),
    monsters: [
      MonsterCatalog.gargoyle(P(10, 5)),
      MonsterCatalog.gargoyle(P(10, 13)),
      MonsterCatalog.theRival(P(17, 9)),
      MonsterCatalog.soulDevourer(P(26, 9)),
    ],
    items: [ItemCatalog.lifeGem(P(5, 9))],
    chests: [
      new Chest(P(4, 3), ChestType.Legendary),
      new Chest(P(4, 15), ChestType.Legendary),
    ],
    seals: [],
    merchant: null,
    pnjs: [],
  };
}
