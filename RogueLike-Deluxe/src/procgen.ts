// ===== Génération procédurale de donjon — cœur du mode "Descente Infinie" =====
// Salles rectangulaires reliées par des couloirs en L ; connectivité garantie par
// le chaînage des couloirs (chaque salle est reliée à la suivante).
import { Tile, Pos, P, RNG, GameMap, manhattan } from "./core";
import { Monster, MonsterCatalog, Chest, ChestType, Merchant, Pnj, Seal, Altar, Shrine, ELITE_AFFIXES } from "./entities";
import { Item, ItemCatalog } from "./items";
import type { LevelData } from "./levels";

interface Room { x: number; y: number; w: number; h: number; }
const roomCenter = (r: Room): Pos => P(Math.floor(r.x + r.w / 2), Math.floor(r.y + r.h / 2));

// Monstres disponibles selon la profondeur (difficulté croissante).
function monsterPool(depth: number): ((p: Pos) => Monster)[] {
  const c = MonsterCatalog;
  if (depth <= 2) return [c.slime, c.slime, c.nightSlime, c.spider];
  if (depth <= 5) return [c.slime, c.spider, c.nightSlime, c.golem, c.gargoyle];
  return [c.spider, c.golem, c.gargoyle, c.gargoyle, c.golem];
}

// Boss de fin d'étage, cyclés et mis à l'échelle. Toutes les 5 profondeurs.
function bossForDepth(depth: number): (p: Pos) => Monster {
  const c = MonsterCatalog;
  const cycle = [c.sealWarden, c.abyssKing, c.theRival, c.sealWardenEnraged, c.soulDevourer];
  return cycle[Math.floor((depth / 5 - 1)) % cycle.length];
}

export function isBossDepth(depth: number): boolean { return depth % 5 === 0; }

// Applique le scaling de profondeur à un monstre fraîchement créé.
function scaleMonster(m: Monster, depth: number, boss: boolean): Monster {
  const hpMul = 1 + depth * (boss ? 0.10 : 0.14);
  m.maxHp = Math.round(m.maxHp * hpMul);
  m.hp = m.maxHp;
  m.modifyAttack(Math.floor(depth / 2) + (boss ? 2 : 0));
  m.minGold = Math.round(m.minGold * (1 + depth * 0.12));
  m.maxGold = Math.round(m.maxGold * (1 + depth * 0.12));
  m.minXp = Math.round(m.minXp * (1 + depth * 0.1));
  m.maxXp = Math.round(m.maxXp * (1 + depth * 0.1));
  return m;
}

// Transforme un monstre normal en élite : plus coriace, plus rentable, marqué visuellement.
// Chaque élite reçoit un AFFIXE de combat (Épines, Vampirique, Véloce, Brute, Blindé).
function makeElite(m: Monster, depth: number, rng?: RNG): Monster {
  m.elite = true;
  if (rng) m.affix = ELITE_AFFIXES[rng.next(0, ELITE_AFFIXES.length)];
  m.maxHp = Math.round(m.maxHp * 1.7);
  m.hp = m.maxHp;
  m.modifyAttack(2 + Math.floor(depth / 3));
  m.modifyCritChance(10);
  m.addArmor(1);
  m.minGold *= 2; m.maxGold *= 2;
  m.minXp = Math.round(m.minXp * 1.6); m.maxXp = Math.round(m.maxXp * 1.6);
  m.aggroRange += 1;
  return m;
}

function carveRoom(tiles: Tile[][], r: Room) {
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++)
      tiles[y][x] = Tile.Floor;
}

// Couloir en L entre deux points (largeur 1), creusé dans les murs.
function carveCorridor(tiles: Tile[][], a: Pos, b: Pos, rng: RNG) {
  let cur = P(a.x, a.y);
  const horizFirst = rng.next(0, 2) === 0;
  const stepX = () => { while (cur.x !== b.x) { cur = P(cur.x + Math.sign(b.x - cur.x), cur.y); tiles[cur.y][cur.x] = Tile.Floor; } };
  const stepY = () => { while (cur.y !== b.y) { cur = P(cur.x, cur.y + Math.sign(b.y - cur.y)); tiles[cur.y][cur.x] = Tile.Floor; } };
  if (horizFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
}

function roomsOverlap(a: Room, b: Room, pad = 1): boolean {
  return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x &&
         a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}

// Génère un étage procédural complet, renvoyé sous la forme d'un LevelData.
export function generateFloor(depth: number, rng: RNG): LevelData {
  const boss = isBossDepth(depth);
  // Taille qui croît doucement avec la profondeur, plafonnée.
  const w = Math.min(52, 34 + Math.floor(depth * 1.2) + rng.next(0, 5));
  const h = Math.min(30, 20 + Math.floor(depth * 0.7) + rng.next(0, 4));
  const tiles: Tile[][] = Array.from({ length: h }, () => Array(w).fill(Tile.Wall));

  // ---- Salles ----
  const rooms: Room[] = [];
  const targetRooms = boss ? 5 : Math.min(11, 5 + Math.floor(depth / 2) + rng.next(0, 3));
  let attempts = 0;
  while (rooms.length < targetRooms && attempts++ < 200) {
    const rw = rng.next(5, 9), rh = rng.next(4, 7);
    const rx = rng.next(1, w - rw - 1), ry = rng.next(1, h - rh - 1);
    const cand: Room = { x: rx, y: ry, w: rw, h: rh };
    if (rooms.some(r => roomsOverlap(r, cand))) continue;
    rooms.push(cand);
  }
  // Toujours au moins 2 salles.
  if (rooms.length < 2) {
    rooms.length = 0;
    rooms.push({ x: 2, y: 2, w: 6, h: 5 });
    rooms.push({ x: w - 8, y: h - 7, w: 6, h: 5 });
  }
  for (const r of rooms) carveRoom(tiles, r);

  // ---- Couloirs : relie chaque salle à la précédente (chaîne = connexe) ----
  for (let i = 1; i < rooms.length; i++)
    carveCorridor(tiles, roomCenter(rooms[i - 1]), roomCenter(rooms[i]), rng);
  // Quelques boucles pour éviter le donjon purement linéaire.
  const extra = Math.min(3, Math.floor(rooms.length / 3));
  for (let i = 0; i < extra; i++) {
    const a = rooms[rng.next(0, rooms.length)], b = rooms[rng.next(0, rooms.length)];
    if (a !== b) carveCorridor(tiles, roomCenter(a), roomCenter(b), rng);
  }

  const map = new GameMap(tiles);

  // ---- Départ (1re salle) & sortie (salle la plus éloignée) ----
  const start = roomCenter(rooms[0]);
  let exitRoom = rooms[1];
  let bestD = -1;
  for (const r of rooms.slice(1)) {
    const d = manhattan(roomCenter(r), start);
    if (d > bestD) { bestD = d; exitRoom = r; }
  }
  const exitPos = roomCenter(exitRoom);

  const monsters: Monster[] = [];
  const items: Item[] = [];
  const chests: Chest[] = [];
  const occupied = new Set<string>([start.x + "," + start.y, exitPos.x + "," + exitPos.y]);
  const freeCellIn = (r: Room): Pos | null => {
    for (let tries = 0; tries < 20; tries++) {
      const p = P(rng.next(r.x, r.x + r.w), rng.next(r.y, r.y + r.h));
      const k = p.x + "," + p.y;
      if (map.isWalkable(p) && !occupied.has(k)) { occupied.add(k); return p; }
    }
    return null;
  };

  if (boss) {
    // Étage de boss : la sortie n'apparaît qu'après la victoire (gérée par le contexte).
    const bpos = exitPos;
    const bossM = scaleMonster(bossForDepth(depth)(P(bpos.x, bpos.y)), depth, true);
    monsters.push(bossM);
    // Deux gardes d'élite pour épicer l'arène.
    for (const r of rooms.slice(1, 3)) {
      const p = freeCellIn(r);
      if (p) monsters.push(makeElite(scaleMonster(monsterPool(depth)[rng.next(0, monsterPool(depth).length)](p), depth, false), depth, rng));
    }
    // Un coffre légendaire en récompense anticipée.
    const cRoom = rooms[rng.next(1, rooms.length)];
    const cp = freeCellIn(cRoom);
    if (cp) chests.push(new Chest(cp, ChestType.Legendary));
  } else {
    map.set(exitPos.x, exitPos.y, Tile.Exit);
    // Monstres : densité croissante, sauf dans la salle de départ.
    const pool = monsterPool(depth);
    const monsterRooms = rooms.slice(1);
    const perRoom = Math.min(3, 1 + Math.floor(depth / 3));
    for (const r of monsterRooms) {
      const n = rng.next(1, perRoom + 1);
      for (let i = 0; i < n; i++) {
        const p = freeCellIn(r);
        if (!p) continue;
        let m = scaleMonster(pool[rng.next(0, pool.length)](p), depth, false);
        if (rng.next(0, 100) < 12 + depth) m = makeElite(m, depth, rng);
        monsters.push(m);
      }
    }
    // Coffres.
    const chestCount = 1 + rng.next(0, 2);
    for (let i = 0; i < chestCount; i++) {
      const r = rooms[rng.next(1, rooms.length)];
      const p = freeCellIn(r);
      if (p) chests.push(new Chest(p, rng.next(0, 100) < 22 ? ChestType.Legendary : ChestType.Normal));
    }
    // Gemme de vie occasionnelle au sol.
    if (rng.next(0, 100) < 55) {
      const r = rooms[rng.next(1, rooms.length)];
      const p = freeCellIn(r);
      if (p) items.push(ItemCatalog.lifeGem(p));
    }
  }

  // Marchand ambulant tous les 3 étages (hors étage de boss).
  let merchant: Merchant | null = null;
  if (!boss && depth % 3 === 0) {
    const r = rooms[rng.next(1, rooms.length)];
    const p = freeCellIn(r);
    if (p) merchant = new Merchant(p, "Vesna la Troqueuse");
  }

  // ---- Événements d'étage : le risque/récompense de la Descente ----
  const altars: Altar[] = [];
  const shrines: Shrine[] = [];
  if (!boss) {
    // Autel maudit (~30% des étages dès la profondeur 2) : boon épique contre malédiction.
    if (depth >= 2 && rng.next(0, 100) < 30) {
      const r = rooms[rng.next(1, rooms.length)];
      const p = freeCellIn(r);
      if (p) altars.push(new Altar(p));
    }
    // Sanctuaire (~25%) : une source de soin unique.
    if (rng.next(0, 100) < 25) {
      const r = rooms[rng.next(1, rooms.length)];
      const p = freeCellIn(r);
      if (p) shrines.push(new Shrine(p));
    }
    // Salle secrète (~55%) : un mur fissuré cache une poche au trésor légendaire.
    if (rng.next(0, 100) < 55) carveSecretRoom(map, rooms, rng, chests);
  }

  const pnjs: Pnj[] = [];
  const seals: Seal[] = [];
  return { map, playerStart: start, monsters, items, chests, pnjs, seals, merchant, altars, shrines };
}

// Creuse une poche 3×3 derrière un mur d'une salle, scellée par un mur FISSURÉ que le
// joueur peut enfoncer. Le trésor est toujours légendaire : la curiosité paie.
function carveSecretRoom(map: GameMap, rooms: Room[], rng: RNG, chests: Chest[]) {
  const DIRS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (let tries = 0; tries < 80; tries++) {
    const r = rooms[rng.next(0, rooms.length)];
    const [dx, dy] = DIRS[rng.next(0, 4)];
    // case de la salle collée au bord choisi
    const edge = dx !== 0
      ? P(dx < 0 ? r.x : r.x + r.w - 1, rng.next(r.y, r.y + r.h))
      : P(rng.next(r.x, r.x + r.w), dy < 0 ? r.y : r.y + r.h - 1);
    const wall = P(edge.x + dx, edge.y + dy);       // le futur mur fissuré
    const center = P(wall.x + dx * 2, wall.y + dy * 2); // centre de la poche 3×3
    // toute la zone (poche + fissure) doit être du mur plein, à ≥1 case du bord
    let ok = map.inBounds(P(wall.x, wall.y)) && map.get(wall) === Tile.Wall;
    for (let yy = center.y - 1; yy <= center.y + 1 && ok; yy++)
      for (let xx = center.x - 1; xx <= center.x + 1 && ok; xx++) {
        if (xx <= 0 || yy <= 0 || xx >= map.width - 1 || yy >= map.height - 1) { ok = false; break; }
        if (map.get(P(xx, yy)) !== Tile.Wall) ok = false;
      }
    // la case entre la fissure et la poche doit aussi être creusable
    const link = P(wall.x + dx, wall.y + dy);
    if (ok && (!map.inBounds(link) || (map.get(link) !== Tile.Wall))) ok = false;
    if (!ok) continue;

    for (let yy = center.y - 1; yy <= center.y + 1; yy++)
      for (let xx = center.x - 1; xx <= center.x + 1; xx++)
        map.set(xx, yy, Tile.Floor);
    map.set(link.x, link.y, Tile.Floor);
    map.set(wall.x, wall.y, Tile.Cracked);
    chests.push(new Chest(center, ChestType.Legendary));
    return;
  }
}
