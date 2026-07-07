// ===== Niveaux — port 1:1 de App/Services/LevelCatalog.cs =====
import { GameMap, Pos, P } from "./core";
import { Monster, MonsterCatalog, Pnj, Chest, ChestType, Seal, Merchant, Altar, Shrine, Trap, Prop, LoreMark } from "./entities";
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
  traps?: Trap[];     // pièges du labyrinthe (map 2)
  props?: Prop[];     // décor immersif (torches, ossements, colonnes...)
  loreMarks?: LoreMark[]; // points de lore découvrables (déclenchent une cinématique)
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
      MonsterCatalog.spider(P(13, 4)),     // embuscade dans le couloir sinueux du nord
      MonsterCatalog.slime(P(18, 4)),      // couloir nord
      MonsterCatalog.golem(P(16, 11)),     // patrouille la rotonde centrale
      MonsterCatalog.slime(P(15, 17)),     // route sud
      MonsterCatalog.gargoyle(P(30, 17)),  // garde la salle de la sortie
    ],
    items: [],
    chests: [
      new Chest(P(2, 4), ChestType.Normal),      // impasse NO
      new Chest(P(11, 19), ChestType.Normal),    // impasse sud
      new Chest(P(28, 4), ChestType.Legendary),  // coffre-prison (clé de Torvin) — ancre MAP2_PRISON_CHEST
    ],
    pnjs: [
      new Pnj(P(3, 18), "Orin", "pnj.orin"),     // salle-refuge SO
      new Pnj(P(5, 18), "Aelis", "pnj.aelis"),   // salle-refuge SO
      new Pnj(P(8, 12), "Rival", "rival.lvl2"),  // sur le chemin principal (couloir d'entrée)
      new Pnj(P(28, 5), "Torvin", "prisoner.locked"), // quartier-prison, à côté du coffre
    ],
    seals: [],
    merchant: null,
    // Pièges du labyrinthe : impasses (garde des trésors) + un ou deux chemins
    traps: [
      new Trap(P(8, 4), "spikes"),   // impasse nord
      new Trap(P(18, 9), "gas"),     // courte impasse près de la rotonde
      new Trap(P(27, 14), "spikes"), // impasse est
      new Trap(P(3, 14), "gas"),     // impasse refuge
      new Trap(P(26, 20), "spikes"), // impasse SE
      new Trap(P(10, 2), "gas"),     // impasse nord (garde une vue sur le coffre voisin)
      new Trap(P(4, 8), "spikes"),   // carrefour du chemin d'entrée (piège de passage)
    ],
    // Décor immersif : torches (braseros) qui éclairent + ossements/colonnes/toiles/flaques
    props: [
      new Prop(P(14, 10), "torch"), new Prop(P(18, 13), "torch"),   // rotonde
      new Prop(P(4, 11), "torch"),                                  // couloir d'entrée
      new Prop(P(26, 2), "torch"),                                  // prison
      new Prop(P(6, 16), "torch"),                                  // refuge
      new Prop(P(33, 16), "torch"),                                 // salle de sortie
      new Prop(P(23, 12), "torch"),                                 // carrefour est
      new Prop(P(16, 7), "cobweb"), new Prop(P(13, 7), "cobweb"),   // repaire de l'araignée
      new Prop(P(24, 11), "bones"), new Prop(P(15, 13), "bones"),
      new Prop(P(22, 7), "column"), new Prop(P(17, 10), "column"),
      new Prop(P(11, 12), "puddle"), new Prop(P(17, 12), "puddle"),
      new Prop(P(10, 4), "skull"), new Prop(P(30, 5), "skull"),
    ],
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
    // Sur le chemin du trône : la lame brisée du Rival — comment il est descendu jusqu'aux Profondeurs
    loreMarks: [new LoreMark(P(11, 9), "lore.rivaltrace", "rival_blade")],
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
