// ===== GameContext + services + logique d'exploration =====
// Port de App/GameContext.cs, ExplorationState.cs, VisionService, DoorService,
// SafeZoneService, MonsterSpawnService, Map3Scripting, ConnectivityFixService, BossSpawnFixService
import { Pos, P, key, eqPos, move, Dir, DIRS4, Tile, GameMap, RNG, TimeSystem, manhattan } from "./core";
import { Player, Monster, MonsterCatalog, MonsterRank, Pnj, Chest, ChestType, Seal, Merchant, Altar, Shrine, Trap, Prop, LoreMark } from "./entities";
import { Item, ItemCatalog, rollLoot, NIGHT_MERCHANT_NAME } from "./items";
import { createLevel, hasLevel } from "./levels";
import { generateFloor, isBossDepth } from "./procgen";
import { rollCurse } from "./boons";
import { PNJ_SKILL_GIFTS, SKILLS } from "./skills";
import { T } from "./i18n";

export enum LogKind { Info, Loot, Combat, Warning, System }
export interface LogEntry { kind: LogKind; text: string; time: number; }

export type GameEvent =
  | { type: "combat"; monster: Monster }
  | { type: "swordCinematic" }
  | { type: "bossIntro" }
  | { type: "depthsIntro" }
  | { type: "end"; victory: boolean }
  | { type: "merchant"; merchant: Merchant }
  | { type: "levelLoaded"; level: number }
  | { type: "floorCleared"; depth: number }
  | { type: "altar"; altar: Altar }
  | { type: "shrine"; amount: number }
  | { type: "secret"; pos: Pos }
  | { type: "lore"; mark: LoreMark }
  | { type: "creedChoice"; id: string }
  | { type: "shake"; power: number }
  | { type: "sfx"; name: string }
  | { type: "fx"; name: string; pos: Pos };

export interface ToastData { text: string; color: string; bg: string; until: number; }

const MAP1_ARMORY_DOOR: Pos = P(5, 13);
const MAP2_PRISON_CHEST: Pos = P(28, 4);
const MAP3_CENTRAL_DOORS: Pos[] = [P(18, 6), P(25, 6), P(21, 4), P(21, 9)];
const MAP3_EXIT_DOORS: Pos[] = [P(35, 7), P(35, 11)];

export class GameContext {
  map!: GameMap;
  player: Player;
  monsters: Monster[] = [];
  items: Item[] = [];
  chests: Chest[] = [];
  pnjs: Pnj[] = [];
  seals: Seal[] = [];
  merchant: Merchant | null = null;
  nightMerchant: Merchant | null = null;
  altars: Altar[] = [];   // autels maudits (Descente) : boon épique contre malédiction
  shrines: Shrine[] = []; // sanctuaires (Descente) : soin unique
  traps: Trap[] = [];     // pièges du labyrinthe (map 2)
  props: Prop[] = [];     // décor immersif (torches éclairantes, ossements...)
  loreMarks: LoreMark[] = []; // points de lore découvrables

  sealsActivated = 0;
  hasLegendarySword = false;
  miniBossDefeated = false;
  legendaryEmpowerNextFight = false;
  map3LastSealHintShown = false;
  prisonerFreed = false;
  rivalDefeated = false;

  // ===== LE SERMENT : axe moral de campagne (Briser vs Perpétuer la Boucle) =====
  // oath < 0 : Emprise (tu embrasses la Boucle, tu descends vers le trône)
  // oath > 0 : Clémence (tu cherches à briser la Boucle, à racheter le Rival)
  oath = 0;
  choices: Record<string, string> = {}; // choiceId -> option retenue (mémoire des actes)
  rivalSpared = false;

  // ===== Descente Infinie (roguelite procédural) =====
  endless = false;            // le run en cours est-il une Descente Infinie ?
  runDepth = 0;               // étage procédural courant
  runEssence = 0;             // essence accumulée pendant le run (banque à la mort/sortie)
  runKills = 0;               // monstres tués ce run
  essenceMult = 1;            // multiplicateur d'essence issu de la méta ("avarice")
  runCurses: string[] = [];   // malédictions acceptées aux autels (ids de boons.ts/CURSES)
  private exitPlaced = false; // la sortie de l'étage courant est-elle révélée ?
  private pendingExit: Pos | null = null; // où révéler la sortie une fois l'étage nettoyé

  // ===== Arène de Vesna (mode défi par vagues) =====
  arenaWave = 1;           // prochaine vague à affronter (persisté)
  arenaActive = false;     // une vague est en cours
  arenaQueue: Monster[] = []; // combats restants dans la vague courante

  rng = new RNG();
  time = new TimeSystem(24);

  visible = new Set<string>();
  discovered = new Set<string>();

  log: LogEntry[] = [];
  toast: ToastData | null = null;
  currentLevel = 1;

  events: GameEvent[] = [];
  private nightSpawnBlockUntil = 0;

  constructor() {
    this.player = new Player(P(1, 1));
  }

  emit(e: GameEvent) { this.events.push(e); }
  drainEvents(): GameEvent[] { const e = this.events; this.events = []; return e; }

  // ===== Log =====
  pushLog(text: string, kind: LogKind = LogKind.Info) {
    if (!text) return;
    const last = this.log[this.log.length - 1];
    if (last && last.text === text && last.kind === kind) return;
    this.log.push({ kind, text, time: performance.now() });
    if (this.log.length > 30) this.log.splice(0, this.log.length - 30);
  }

  showToast(text: string, color = "#fff", bg = "#7a1a1a", ticks = 8) {
    this.toast = { text, color, bg, until: this.time.tick + Math.max(1, ticks) };
  }
  clearToastIfExpired() {
    if (this.toast && this.time.tick >= this.toast.until) this.toast = null;
  }

  // ===== Requêtes =====
  monsterAt(p: Pos): Monster | null { return this.monsters.find(m => !m.isDead && eqPos(m.pos, p)) ?? null; }
  itemAt(p: Pos): Item | null { return this.items.find(i => eqPos(i.pos, p)) ?? null; }
  chestAt(p: Pos): Chest | null { return this.chests.find(c => !c.isOpened && eqPos(c.pos, p)) ?? null; }
  pnjAt(p: Pos): Pnj | null { return this.pnjs.find(n => eqPos(n.pos, p)) ?? null; }
  sealAt(p: Pos): Seal | null { return this.seals.find(s => !s.isActivated && eqPos(s.pos, p)) ?? null; }
  altarAt(p: Pos): Altar | null { return this.altars.find(a => !a.used && eqPos(a.pos, p)) ?? null; }
  shrineAt(p: Pos): Shrine | null { return this.shrines.find(s => !s.used && eqPos(s.pos, p)) ?? null; }
  trapAt(p: Pos): Trap | null { return this.traps.find(t => eqPos(t.pos, p)) ?? null; }
  loreMarkAt(p: Pos): LoreMark | null { return this.loreMarks.find(l => !l.seen && eqPos(l.pos, p)) ?? null; }
  isMerchantAt(p: Pos): boolean { return !!this.merchant && eqPos(this.merchant.pos, p); }
  isDoorClosed(p: Pos): boolean { return this.map.inBounds(p) && this.map.get(p) === Tile.DoorClosed; }
  openDoor(p: Pos) { if (this.map.inBounds(p) && this.map.get(p) === Tile.DoorClosed) this.map.set(p.x, p.y, Tile.DoorOpen); }
  closeDoor(p: Pos) { if (this.map.inBounds(p) && this.map.get(p) === Tile.DoorOpen) this.map.set(p.x, p.y, Tile.DoorClosed); }

  isSafeZone(p: Pos): boolean {
    if (this.endless) return false; // les zones sûres sont propres aux cartes scénarisées
    // Map3 : salle marchand
    if (this.currentLevel === 3 && p.x >= 35 && p.x <= 42 && p.y >= 5 && p.y <= 10) return true;
    // Map1 : armurerie verrouillée (évite un softlock si un spawn nocturne y apparaît
    // alors que Lysa exige que tous les monstres soient morts)
    if (this.currentLevel === 1 && p.x >= 1 && p.x <= 4 && p.y >= 11 && p.y <= 16) return true;
    return false;
  }

  // ===== Vision =====
  updateVision() {
    const radius = Math.max(1, this.player.visionRadius + this.player.lightBonus);
    this.visible.clear();
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const x = this.player.pos.x + dx, y = this.player.pos.y + dy;
        if (x < 0 || y < 0 || x >= this.map.width || y >= this.map.height) continue;
        const k = x + "," + y;
        this.visible.add(k);
        this.discovered.add(k);
      }
    const pk = key(this.player.pos);
    this.visible.add(pk); this.discovered.add(pk);
  }

  // ===== Chargement de niveau =====
  loadLevel(level: number) {
    const data = createLevel(level);
    this.log = [];
    this.monsters = data.monsters;
    this.items = data.items;
    this.chests = data.chests;
    this.pnjs = data.pnjs;
    this.seals = data.seals;
    this.merchant = data.merchant;
    this.altars = [];
    this.shrines = [];
    this.traps = data.traps ?? [];
    this.props = data.props ?? [];
    this.loreMarks = data.loreMarks ?? [];

    this.visible.clear(); this.discovered.clear();
    this.sealsActivated = 0;
    this.hasLegendarySword = false;
    this.miniBossDefeated = false;
    this.legendaryEmpowerNextFight = false;
    this.map3LastSealHintShown = false;
    this.toast = null;

    this.map = data.map;
    this.player.setPosition(data.playerStart);
    this.player.healToFull();
    this.currentLevel = level;
    this.nightSpawnBlockUntil = 0;
    this.nightMerchant = null;
    this.arenaActive = false;
    this.arenaQueue = [];

    this.pushLog(T("level.loaded", { level }), LogKind.System);
    // Niveau 3 : la sortie est VOLONTAIREMENT scellée derrière les portes (puzzle des sceaux).
    // Le creusage auto perçait des trous à côté des portes → on l'exclut ici pour préserver le puzzle.
    if (level !== 3) this.ensureAllExitsReachable(this.player.pos);
    if (level >= 4) this.ensureBossReachable();
    this.updateVision();
    this.emit({ type: "levelLoaded", level });
  }

  // ===== Descente Infinie : démarre un run et charge un étage procédural =====
  startEndlessRun(essenceMult = 1) {
    this.endless = true;
    this.runDepth = 0;
    this.runEssence = 0;
    this.runKills = 0;
    this.essenceMult = essenceMult;
    this.runCurses = [];
    this.arenaWave = 1;
    this.loadProceduralFloor(1);
  }

  advanceEndlessFloor() { this.loadProceduralFloor(this.runDepth + 1); }

  loadProceduralFloor(depth: number) {
    const data = generateFloor(depth, this.rng);
    this.log = [];
    this.monsters = data.monsters;
    this.items = data.items;
    this.chests = data.chests;
    this.pnjs = data.pnjs;
    this.seals = data.seals;
    this.merchant = data.merchant;
    this.altars = data.altars ?? [];
    this.shrines = data.shrines ?? [];
    this.traps = []; // pas de pièges scriptés en Descente procédurale
    this.props = [];
    this.loreMarks = [];

    this.visible.clear(); this.discovered.clear();
    this.sealsActivated = 0;
    this.hasLegendarySword = false;
    this.miniBossDefeated = false;
    this.legendaryEmpowerNextFight = false;
    this.map3LastSealHintShown = false;
    this.toast = null;

    this.map = data.map;
    this.player.setPosition(data.playerStart);
    // Soin partiel entre les étages — sauf sous la malédiction de Famine.
    if (depth > 1 && !this.runCurses.includes("famine"))
      this.player.heal(Math.round(this.player.maxHp * 0.25));
    this.endless = true;
    this.runDepth = depth;
    this.currentLevel = depth;
    this.nightSpawnBlockUntil = 0;
    this.nightMerchant = null;
    this.arenaActive = false;
    this.arenaQueue = [];

    const boss = isBossDepth(depth);
    // Étage de boss : la sortie apparaît une fois l'arène nettoyée (le boss est le dernier monstre).
    this.exitPlaced = !boss;
    this.pendingExit = boss ? P(data.playerStart.x, data.playerStart.y) : null;
    if (boss) {
      const b = this.monsters.find(m => m.rank === MonsterRank.Boss) ?? this.monsters[this.monsters.length - 1];
      if (b) this.pendingExit = P(b.pos.x, b.pos.y);
      this.pushLog(T("endless.bossfloor", { depth }), LogKind.Warning);
    } else {
      this.pushLog(T("endless.floor", { depth }), LogKind.System);
    }

    if (this.exitPlaced) this.ensureAllExitsReachable(this.player.pos);
    this.updateVision();
    this.emit({ type: "levelLoaded", level: depth });
  }

  // Étage de boss nettoyé → révèle la sortie. Appelé chaque frame côté ExploreScene (bon marché).
  checkEndlessBossExit() {
    if (!this.endless || this.exitPlaced) return;
    if (this.monsters.some(m => !m.isDead)) return;
    let at = this.pendingExit ?? this.player.pos;
    // La sortie ne doit jamais apparaître sous le joueur (sinon il ne peut pas « entrer » dedans).
    if (eqPos(at, this.player.pos)) at = this.freeFloorNear(at) ?? at;
    this.map.set(at.x, at.y, Tile.Exit);
    this.exitPlaced = true;
    this.ensureAllExitsReachable(this.player.pos);
    this.pushLog(T("endless.exitopen"), LogKind.System);
    this.showToast(T("endless.exitopen.toast"), "#c8f0ff", "#10344a", 10);
    this.emit({ type: "sfx", name: "doorsOpen" });
    this.updateVision();
  }

  // Case de sol la plus proche de `p` qui n'est pas celle du joueur (balayage exhaustif : ne peut
  // pas échouer sur une vraie carte). Sert à ne jamais faire apparaître la sortie sous le joueur.
  private freeFloorNear(p: Pos): Pos | null {
    let best: Pos | null = null, bestD = Infinity;
    for (let y = 0; y < this.map.height; y++)
      for (let x = 0; x < this.map.width; x++) {
        if (this.map.tiles[y][x] !== Tile.Floor) continue;
        if (x === this.player.pos.x && y === this.player.pos.y) continue;
        const d = Math.abs(x - p.x) + Math.abs(y - p.y);
        if (d < bestD) { bestD = d; best = P(x, y); }
      }
    return best;
  }

  // Récompense d'essence à chaque monstre tué en Descente (élites/boss valent davantage).
  awardKillEssence(m: Monster) {
    if (!this.endless) return;
    let base = 2 + Math.floor(this.runDepth * 0.6);
    if (m.elite) base *= 3;
    if (m.rank === MonsterRank.MiniBoss) base *= 4;
    if (m.rank === MonsterRank.Boss) base *= 8;
    const gain = Math.round(base * this.essenceMult);
    this.runEssence += gain;
    this.runKills++;
  }

  // ===== Temps / spawns nocturnes =====
  blockNightSpawnsForTicks(ticks: number) {
    this.nightSpawnBlockUntil = Math.max(this.nightSpawnBlockUntil, this.time.tick + Math.max(0, ticks));
  }

  advanceTimeAfterPlayerMove() {
    const phaseFlip = this.time.advance();
    if (phaseFlip) {
      if (this.time.isNight) {
        this.pushLog(T("night.falls"), LogKind.Warning);
        this.emit({ type: "sfx", name: "night" });
        // Équilibrage : buff nocturne appliqué UNE fois par nuit (+2 ATK)
        for (const m of this.monsters) if (!m.isDead && !m.nightBuffed) { m.modifyAttack(+2); m.nightBuffed = true; }
      } else {
        this.pushLog(T("day.breaks"), LogKind.System);
        this.emit({ type: "sfx", name: "day" });
        for (const m of this.monsters) if (m.nightBuffed) { m.modifyAttack(-2); m.nightBuffed = false; }
        if (this.nightMerchant) {
          this.nightMerchant = null;
          this.pushLog(T("night.merchant.gone"), LogKind.System);
        }
      }
    }
    this.tryNightSpawn();
    this.tryNightMerchantSpawn();
    this.clearToastIfExpired();
  }

  private tryNightMerchantSpawn() {
    if (!this.time.isNight) return;
    if (this.nightMerchant) return;
    if (this.currentLevel === 4) return;
    if (this.rng.next(0, 100) > 8) return;
    const pos = this.findSpawnCell();
    if (!pos) return;
    this.nightMerchant = new Merchant(pos, NIGHT_MERCHANT_NAME);
    this.pushLog(T("night.merchant.spawn"), LogKind.Warning);
    this.pushLog(T("nyx.line"), LogKind.System);
    this.emit({ type: "sfx", name: "spawn" });
    this.emit({ type: "fx", name: "spawn", pos });
  }

  private tryNightSpawn() {
    if (!this.time.isNight) return;
    if (this.time.tick < this.nightSpawnBlockUntil) return;
    const alive = this.monsters.filter(m => !m.isDead).length;
    if (alive >= 10) return;
    if (this.rng.next(0, 100) > 20) return;
    const pos = this.findSpawnCell();
    if (!pos) return;
    const mob = MonsterCatalog.nightSlime(pos);
    if (this.time.isNight) { mob.modifyAttack(+2); mob.nightBuffed = true; }
    this.monsters.push(mob);
    this.pushLog(T("night.spawn"), LogKind.Warning);
    this.emit({ type: "sfx", name: "spawn" });
    this.emit({ type: "fx", name: "spawn", pos });
  }

  private findSpawnCell(): Pos | null {
    const margin = 1;
    for (let i = 0; i < 80; i++) {
      const p = P(this.rng.next(margin, this.map.width - margin), this.rng.next(margin, this.map.height - margin));
      if (this.isValidSpawnCell(p)) return p;
    }
    for (let y = margin; y < this.map.height - margin; y++)
      for (let x = margin; x < this.map.width - margin; x++) {
        const p = P(x, y);
        if (this.isValidSpawnCell(p)) return p;
      }
    return null;
  }

  private isValidSpawnCell(p: Pos): boolean {
    if (!this.map.isWalkable(p)) return false;
    if (eqPos(p, this.player.pos)) return false;
    if (this.monsterAt(p) || this.itemAt(p) || this.chestAt(p) || this.sealAt(p) || this.isMerchantAt(p) || this.pnjAt(p)) return false;
    if (this.altarAt(p) || this.shrineAt(p)) return false;
    if (this.nightMerchant && eqPos(this.nightMerchant.pos, p)) return false;
    if (this.isSafeZone(p)) return false;
    // évite les cases collées aux murs
    for (const d of DIRS4) {
      const q = move(p, d);
      if (!this.map.inBounds(q) || this.map.get(q) === Tile.Wall) return false;
    }
    return true;
  }

  // ===== Ramassage d'objets =====
  tryPickup(at: Pos): boolean {
    const item = this.itemAt(at);
    if (!item) return false;
    this.items.splice(this.items.indexOf(item), 1);
    if (item.autoApply) {
      item.apply(this.player);
      this.pushLog(T("item.pickup.used", { item: item.name }), LogKind.Loot);
    } else {
      this.player.addToInventory(item);
      if (item.autoEquip) {
        this.player.removeFromInventory(item);
        this.player.equip(item);
        this.pushLog(T("item.autoequip", { item: item.name }), LogKind.System);
      } else {
        this.pushLog(T("item.pickup.inv", { item: item.name }), LogKind.Loot);
      }
    }
    this.emit({ type: "sfx", name: "pickup" });
    this.emit({ type: "fx", name: "pickup", pos: at });
    return true;
  }

  openChest(chest: Chest) {
    if (chest.isOpened) return;
    chest.open();
    const loot = chest.type === ChestType.AbyssKeyChest
      ? ItemCatalog.create("AbyssKey", chest.pos)
      : rollLoot(this.rng, chest.pos);
    const chestLabel =
      chest.type === ChestType.TorchOnly ? T("chest.torch") :
      chest.type === ChestType.Legendary ? T("chest.legendary") :
      chest.type === ChestType.LanternChest ? T("chest.lantern") :
      chest.type === ChestType.AbyssKeyChest ? T("chest.abyss") : T("chest.normal");
    if (loot.autoApply) {
      loot.apply(this.player);
      this.pushLog(T("chest.open", { chest: chestLabel, item: loot.name, how: T("chest.used") }), LogKind.Loot);
    } else {
      this.player.addToInventory(loot);
      this.pushLog(T("chest.open", { chest: chestLabel, item: loot.name, how: T("chest.inv") }), LogKind.Loot);
    }
    if (chest.type === ChestType.AbyssKeyChest) {
      this.pushLog(T("abyss.key"), LogKind.System);
      this.showToast(T("abyss.key.toast"), "#ffe6e6", "#3a0a14", 10);
    }
    this.emit({ type: "sfx", name: "chest" });
    this.emit({ type: "fx", name: "chest", pos: chest.pos });
  }

  // ===== Autel maudit : sceller le pacte — applique une malédiction, renvoie son id =====
  acceptAltar(altar: Altar): string {
    altar.used = true;
    const curse = rollCurse(this.rng, this.runCurses);
    this.runCurses.push(curse.id);
    curse.apply?.(this.player);
    this.updateVision(); // la malédiction de Pénombre réduit la vision immédiatement
    this.pushLog(T("altar.cursed", { name: T(curse.nameKey) }), LogKind.Warning);
    this.emit({ type: "sfx", name: "curse" });
    return curse.id;
  }

  refuseAltar(altar: Altar) {
    altar.used = true;
    this.pushLog(T("altar.refused"), LogKind.System);
  }

  // ===== Arène de Vesna : vagues de monstres enchaînées, sans soin entre les combats =====
  arenaNextReward(): number { return 25 + this.arenaWave * 15; }
  isArenaChampionWave(): boolean { return this.arenaWave % 5 === 0; }

  private buildArenaWave(wave: number): Monster[] {
    const mk = MonsterCatalog;
    const defs: ((p: Pos) => Monster)[] = [];
    if (wave % 25 === 0) {
      // vague spéciale : la fosse conjure une ombre du Rival
      defs.push(mk.theRival);
    } else if (wave % 5 === 0) {
      // vague champion : le Gardien (enragé toutes les 10 vagues)
      defs.push(wave % 10 === 0 ? mk.sealWardenEnraged : mk.sealWarden);
    } else {
      const pool = [mk.slime, mk.spider, mk.nightSlime, mk.golem, mk.gargoyle];
      const count = Math.min(3, 1 + Math.floor(wave / 3));
      for (let i = 0; i < count; i++) defs.push(pool[this.rng.next(0, pool.length)]);
    }
    return defs.map(f => {
      const m = f(P(-1, -1));
      m.maxHp = Math.round(m.maxHp * (1 + wave * 0.12));
      m.hp = m.maxHp;
      m.modifyAttack(Math.floor(wave / 2));
      return m;
    });
  }

  startArenaWave(): Monster {
    this.arenaQueue = this.buildArenaWave(this.arenaWave);
    this.arenaActive = true;
    this.pushLog(T("arena.start", { wave: this.arenaWave, n: this.arenaQueue.length }), LogKind.Combat);
    return this.arenaQueue.shift()!;
  }

  nextArenaFight(): Monster | null { return this.arenaQueue.shift() ?? null; }

  finishArenaWave() {
    this.arenaActive = false;
    const gold = this.arenaNextReward();
    this.player.addGold(gold);
    this.pushLog(T("arena.cleared", { wave: this.arenaWave, gold }), LogKind.Loot);
    this.showToast(T("arena.toast", { wave: this.arenaWave }), "#ffe9c0", "#4a3010", 10);
    if (this.arenaWave % 5 === 0) {
      const relic = ItemCatalog.create(this.arenaWave % 10 === 0 ? "AbyssRelic" : "SunRelic", P(-1, -1));
      this.player.addToInventory(relic);
      this.pushLog(T("arena.bonus", { item: relic.name }), LogKind.Loot);
    }
    this.arenaWave++;
  }

  abortArena() {
    if (!this.arenaActive) return;
    this.arenaActive = false;
    this.arenaQueue = [];
    this.pushLog(T("arena.fled"), LogKind.Warning);
  }

  // Post-jeu : le Roi vaincu, la clé en poche → un passage s'ouvre derrière le trône
  openAbyssPortal() {
    this.map.set(40, 9, Tile.Exit);
    this.map.set(41, 9, Tile.Floor);
    this.pushLog(T("abyss.portal"), LogKind.System);
    this.showToast(T("abyss.portal.toast"), "#ffe6e6", "#3a0a14", 12);
    this.updateVision();
  }

  // ===== Map3 scripting =====
  private openDoors(list: Pos[]) { for (const p of list) this.openDoor(p); }
  private closeDoors(list: Pos[]) { for (const p of list) this.closeDoor(p); }

  openCentralDoors() { this.openDoors(MAP3_CENTRAL_DOORS); }

  triggerLegendarySwordEvent(fromPos: Pos) {
    if (this.currentLevel !== 3 || !this.hasLegendarySword) return;
    this.closeDoors(MAP3_CENTRAL_DOORS);
    this.closeDoors(MAP3_EXIT_DOORS);
    this.pushLog(T("sword.doors"), LogKind.System);
    this.pushLog(T("sword.doors2"), LogKind.System);

    const spawn = this.findSpawnBehind(fromPos);
    const enraged = this.rng.next(0, 100) < 10;
    const warden = enraged ? MonsterCatalog.sealWardenEnraged(spawn) : MonsterCatalog.sealWarden(spawn);
    this.monsters.push(warden);
    if (enraged) this.pushLog(T("warden.enraged"), LogKind.System);
    this.pushLog(T("warden.spawn"), LogKind.Combat);
    this.pushLog(T("warden.line"), LogKind.System);
    this.emit({ type: "sfx", name: "warden" });
    this.emit({ type: "fx", name: "spawn", pos: spawn });
    this.updateVision();
  }

  onMiniBossDefeated() {
    if (this.arenaActive) return; // un Gardien d'arène ne déclenche pas le script des portes
    if (this.currentLevel !== 3 || !this.hasLegendarySword) return;
    this.miniBossDefeated = true;
    this.openDoors(MAP3_CENTRAL_DOORS);
    this.openDoors(MAP3_EXIT_DOORS);
    this.pushLog(T("warden.dead1"), LogKind.System);
    this.pushLog(T("warden.dead2"), LogKind.System);
    this.player.heal(4);
    this.blockNightSpawnsForTicks(30);
    this.pushLog(T("warden.breath", { n: 4 }), LogKind.Info);
    this.pushLog(T("warden.quiet"), LogKind.System);
  }

  // Le Rival vaincu : la boucle vacille. Ce n'est pas une fin de partie — et surtout,
  // son sort (et donc le Serment) se décide APRÈS le combat, dans le Verdict (resolveRivalFate).
  onRivalDefeated() {
    this.rivalDefeated = true;
    this.player.heal(15);
  }

  // ===== LE SERMENT : mémoire et bascule morale =====
  // Seuil de basculement : il faut être CONSTANT (un seul choix ne suffit pas à te définir).
  static readonly CREED_THRESHOLD = 4;

  // Palier moral courant : -1 Emprise, 0 Équilibre, +1 Clémence.
  creedTier(): -1 | 0 | 1 {
    if (this.oath >= GameContext.CREED_THRESHOLD) return 1;
    if (this.oath <= -GameContext.CREED_THRESHOLD) return -1;
    return 0;
  }

  // Fin de campagne déterminée par le cumul des choix.
  decideEnding(): "redemption" | "balance" | "dominion" {
    const t = this.creedTier();
    return t > 0 ? "redemption" : t < 0 ? "dominion" : "balance";
  }

  // Enregistre un choix moral et déplace l'axe. Signale un franchissement de palier.
  recordChoice(id: string, option: string, oathDelta: number) {
    this.choices[id] = option;
    const before = this.creedTier();
    this.oath += oathDelta;
    const after = this.creedTier();
    if (after === before) return;
    if (after > 0) {
      this.pushLog(T("creed.cross.break"), LogKind.System);
      this.showToast(T("creed.toast.break"), "#cfe8ff", "#12324a", 12);
    } else if (after < 0) {
      this.pushLog(T("creed.cross.perp"), LogKind.System);
      this.showToast(T("creed.toast.perp"), "#ffd0d0", "#3a0a14", 12);
    } else {
      this.pushLog(T("creed.cross.balance"), LogKind.System);
    }
  }

  // Le Verdict : récompense mécanique du sort réservé au Rival (l'oath est géré par recordChoice).
  resolveRivalFate(spare: boolean) {
    this.rivalSpared = spare;
    if (spare) {
      // Tu relèves le Rival. Pas de boost : sa vraie valeur, c'est qu'il combattra
      // le Dévoreur d'Âmes à tes côtés (2 v 1). Il te remet d'abord sur pied.
      this.player.healToFull();
      this.pushLog(T("rival.spared.reward"), LogKind.Loot);
    } else {
      // Tu consumes son écho : sa puissance devient la tienne.
      this.player.addToInventory(ItemCatalog.create("EchoShard", P(-1, -1)));
      this.player.modifyAttack(+3);
      this.pushLog(T("rival.slain.reward"), LogKind.Loot);
    }
  }

  private findSpawnBehind(preferred: Pos): Pos {
    if (this.map.isWalkable(preferred) && !this.monsterAt(preferred) && !eqPos(preferred, this.player.pos)) return preferred;
    for (const d of [Dir.Left, Dir.Right, Dir.Up, Dir.Down]) {
      const p = move(this.player.pos, d);
      if (this.map.isWalkable(p) && !this.monsterAt(p) && !eqPos(p, this.player.pos)) return p;
    }
    return preferred;
  }

  // ===== Déplacement joueur (port d'ExplorationState.Update) =====
  tryMove(dir: Dir): void {
    if (dir === Dir.None) return;
    const prev = this.player.pos;
    const next = move(prev, dir);
    if (!this.map.inBounds(next)) return;

    // Porte fermée
    if (this.isDoorClosed(next)) {
      if (this.currentLevel === 1 && eqPos(next, MAP1_ARMORY_DOOR)) {
        const keyItem = this.player.inventory.find(i => i.id === "Map1ArmoryKey");
        if (!keyItem) {
          this.pushLog(T("door.locked"), LogKind.Warning);
          this.emit({ type: "sfx", name: "locked" });
          return;
        }
        this.player.removeFromInventory(keyItem);
        this.openDoor(next);
        this.pushLog(T("door.armory"), LogKind.System);
        this.emit({ type: "sfx", name: "door" });
        this.player.setPosition(next);
        this.updateVision();
        this.advanceTimeAfterPlayerMove();
        this.monstersTurn();
        return;
      }
      this.pushLog(T("door.sealed"), LogKind.Warning);
      this.emit({ type: "sfx", name: "locked" });
      return;
    }

    // Mur fissuré : il cède sous la poussée — une salle secrète se dévoile
    if (this.map.get(next) === Tile.Cracked) {
      this.map.set(next.x, next.y, Tile.Floor);
      this.pushLog(T("secret.crumble"), LogKind.System);
      this.showToast(T("secret.toast"), "#ffe9c0", "#3a2a10", 8);
      this.emit({ type: "secret", pos: next });
      this.emit({ type: "shake", power: 1 });
      this.emit({ type: "sfx", name: "secret" });
      this.emit({ type: "fx", name: "secret", pos: next });
      this.updateVision();
      this.advanceTimeAfterPlayerMove();
      this.monstersTurn();
      return;
    }

    if (!this.map.isWalkable(next)) { this.emit({ type: "sfx", name: "bump" }); return; }

    // Sentinelle bloque la sortie (Map1)
    const pnjBlock = this.pnjAt(next);
    if (pnjBlock && this.currentLevel === 1 && pnjBlock.name === "Sentinelle") {
      if (!this.player.hasAnyWeapon()) {
        this.pushLog(T("guard.halt"), LogKind.Warning);
        this.emit({ type: "sfx", name: "guard" });
        return;
      }
      this.pushLog(T("guard.pass"), LogKind.System);
      if (this.tryMoveGuardAside(pnjBlock, prev))
        this.showToast(T("guard.aside"), "#08130a", "#5abf6e", 8);
      this.updateVision();
      return;
    }

    // Coffre (avant de bouger)
    const chest = this.chestAt(next);
    if (chest) {
      this.player.setPosition(next);
      this.openChest(chest);
      this.updateVision();
      this.advanceTimeAfterPlayerMove();
      this.monstersTurn();
      return;
    }

    // Combat si on marche sur un monstre
    const enemy = this.monsterAt(next);
    if (enemy) {
      this.emit({ type: "combat", monster: enemy });
      return;
    }

    // Déplacement
    this.player.setPosition(next);
    this.emit({ type: "sfx", name: "step" });

    // Marchand
    if (this.isMerchantAt(next) && this.merchant) {
      this.updateVision();
      this.emit({ type: "merchant", merchant: this.merchant });
      return;
    }
    // Marchande ambulante (nocturne)
    if (this.nightMerchant && eqPos(this.nightMerchant.pos, next)) {
      this.updateVision();
      this.emit({ type: "merchant", merchant: this.nightMerchant });
      return;
    }

    // Autel maudit (Descente) : le choix appartient au joueur — la scène gère le pacte
    const altar = this.altarAt(next);
    if (altar) {
      this.updateVision();
      this.emit({ type: "sfx", name: "altar" });
      this.emit({ type: "altar", altar });
      return;
    }

    // Sanctuaire (Descente) : une source claire — soin unique
    const shrine = this.shrineAt(next);
    if (shrine) {
      shrine.used = true;
      const amount = Math.round(this.player.maxHp * 0.4);
      this.player.heal(amount);
      this.pushLog(T("shrine.used", { n: amount }), LogKind.Loot);
      this.showToast(T("shrine.toast"), "#c8f0ff", "#10344a", 8);
      this.emit({ type: "shrine", amount });
      this.emit({ type: "sfx", name: "shrine" });
      this.emit({ type: "fx", name: "shrine", pos: next });
      this.updateVision();
      this.advanceTimeAfterPlayerMove();
      this.monstersTurn();
      return;
    }

    // Piège du labyrinthe : se déclenche quand on marche dessus (une fois)
    const trap = this.trapAt(next);
    if (trap && !trap.sprung) {
      trap.sprung = true;
      if (trap.kind === "spikes") {
        const dmg = 8; // danger environnemental : ignore l'armure
        this.player.hp -= dmg;
        this.pushLog(T("trap.spikes", { n: dmg }), LogKind.Warning);
        this.showToast(T("trap.spikes.toast"), "#ffd0d0", "#3a0a0a", 6);
      } else {
        this.player.addStatus("poison", 3, 2); // le poison mordra dès le prochain combat
        this.pushLog(T("trap.gas"), LogKind.Warning);
        this.showToast(T("trap.gas.toast"), "#d0ffd0", "#0a2a0a", 6);
      }
      this.emit({ type: "sfx", name: "trap" });
      this.emit({ type: "fx", name: trap.kind === "spikes" ? "trap_spikes" : "trap_gas", pos: next });
      if (this.player.isDead) { this.emit({ type: "end", victory: false }); return; }
      this.updateVision();
      this.advanceTimeAfterPlayerMove();
      this.monstersTurn();
      return;
    }

    // Point de lore : révélation cinématique (une fois)
    const lore = this.loreMarkAt(next);
    if (lore) {
      lore.seen = true;
      this.updateVision();
      this.emit({ type: "sfx", name: "seal" });
      this.emit({ type: "lore", mark: lore });
      return;
    }

    // Sceaux (Map3)
    const seal = this.sealAt(next);
    if (seal) {
      seal.activate();
      this.sealsActivated = Math.min(3, this.sealsActivated + 1);
      this.emit({ type: "sfx", name: "seal" });
      this.emit({ type: "fx", name: "seal", pos: next });
      if (this.currentLevel === 3 && this.sealsActivated === 2 && !this.map3LastSealHintShown) {
        this.map3LastSealHintShown = true;
        this.pushLog(T("seal.hint"), LogKind.System);
      }
      this.pushLog(T("seal.activated", { id: seal.id, n: this.sealsActivated }), LogKind.System);
      if (this.sealsActivated >= 3) {
        this.openCentralDoors();
        this.pushLog(T("seal.doorsopen"), LogKind.System);
        this.emit({ type: "sfx", name: "doorsOpen" });
      }
      this.updateVision();
      this.advanceTimeAfterPlayerMove();
      this.monstersTurn();
      return;
    }

    // PNJ (dialogue)
    const pnj = this.pnjAt(next);
    if (pnj) {
      this.emit({ type: "sfx", name: "talk" });
      if (this.currentLevel === 1 && pnj.name === "Lysa") {
        const allDead = !this.monsters.some(m => !m.isDead);
        if (!allDead) {
          this.pushLog(T("lysa.scared"), LogKind.Warning);
        } else {
          pnj.setMessageKey("lysa.thanks");
          this.pushLog(T("pnj.talk", { name: pnj.name, msg: pnj.talk() }), LogKind.System);
          const giftName = pnj.giveGift();
          if (giftName) {
            const gift = ItemCatalog.create(giftName, next);
            this.player.addToInventory(gift);
            this.pushLog(T("pnj.gift", { item: gift.name }), LogKind.Loot);
            this.emit({ type: "sfx", name: "pickup" });
          }
        }
      } else if (pnj.name === "Rival") {
        // Première rencontre (niveau 1) : LE SERMENT s'ouvre — comment réponds-tu au Rival ?
        if (this.currentLevel === 1 && !this.choices["rival_l1"]) {
          this.emit({ type: "creedChoice", id: "rival_l1" });
          return;
        }
        let key = "rival.lvl1";
        if (this.currentLevel === 1) key = this.choices["rival_l1"] === "hand" ? "rival.lvl1.hand" : "rival.lvl1.blade";
        else if (this.currentLevel === 2) key = this.choices["rival_l1"] === "hand" ? "rival.lvl2.hand" : "rival.lvl2";
        else if (this.currentLevel === 3) key = this.hasLegendarySword ? "rival.lvl3.sword" : "rival.lvl3.nosword";
        pnj.setMessageKey(key);
        this.pushLog(T("pnj.talk", { name: pnj.name, msg: pnj.talk() }), LogKind.System);
      } else if (pnj.name === "Torvin") {
        const chestOpened = this.chests.find(c => eqPos(c.pos, MAP2_PRISON_CHEST))?.isOpened ?? false;
        if (!chestOpened) {
          this.pushLog(T("prisoner.locked"), LogKind.Warning);
        } else if (!this.choices["torvin"]) {
          // LE SERMENT DE TORVIN : le libérer, ou saisir le pacte brisé qui le consume.
          this.emit({ type: "creedChoice", id: "torvin" });
          return;
        } else {
          this.pushLog(T("pnj.talk", { name: pnj.name, msg: pnj.talk() }), LogKind.System);
        }
      } else if (PNJ_SKILL_GIFTS[pnj.name]) {
        // PNJ enseignant : à la fin de son dialogue, il te transmet SA technique unique (une fois).
        const skillId = PNJ_SKILL_GIFTS[pnj.name];
        this.pushLog(T("pnj.talk", { name: pnj.name, msg: pnj.talk() }), LogKind.System);
        if (!this.player.skills.includes(skillId)) {
          this.pushLog(T("pnj.talk", { name: pnj.name, msg: T(`skillgift.${skillId}.offer`) }), LogKind.System);
          this.player.learnSkill(skillId);
          pnj.setMessageKey(`skillgift.${skillId}.after`); // au prochain passage : un écho de gratitude
          const skillName = T(SKILLS[skillId].nameKey);
          this.pushLog(T("skill.learned", { name: skillName }), LogKind.Loot);
          this.showToast(T("skill.learned.toast", { name: skillName }), "#e8d8ff", "#2a1a4a", 10);
          this.emit({ type: "sfx", name: "levelup" });
        }
      } else {
        this.pushLog(T("pnj.talk", { name: pnj.name, msg: pnj.talk() }), LogKind.System);
        const giftName = pnj.giveGift();
        if (giftName) {
          const gift = ItemCatalog.create(giftName, next);
          this.player.addToInventory(gift);
          this.pushLog(T("pnj.gift", { item: gift.name }), LogKind.Loot);
          this.emit({ type: "sfx", name: "pickup" });
        }
      }
    }

    // Ramassage d'objet
    const item = this.itemAt(next);
    if (item) {
      const picked = this.tryPickup(next);
      if (picked && this.currentLevel === 3 && item.id === "LegendarySword") {
        this.hasLegendarySword = true;
        this.legendaryEmpowerNextFight = true;
        this.emit({ type: "swordCinematic" });
        this.showToast(T("sword.toast"), "#ffe6e6", "#6e1111", 10);
        this.pushLog(T("sword.pick"), LogKind.System);
        this.triggerLegendarySwordEvent(prev);
      }
    }

    // Sortie
    if (this.map.get(next) === Tile.Exit) {
      // Descente Infinie : la sortie mène au draft de relique puis à l'étage suivant.
      if (this.endless) {
        this.emit({ type: "floorCleared", depth: this.runDepth });
        return;
      }
      if (this.currentLevel === 1 && !this.player.hasAnyWeapon()) {
        this.pushLog(T("guard.comeback"), LogKind.Warning);
        this.player.setPosition(prev);
        this.updateVision();
        return;
      }
      const nextLevel = this.currentLevel + 1;
      if (!hasLevel(nextLevel)) {
        this.emit({ type: "end", victory: true });
        return;
      }
      if (this.currentLevel === 3 && nextLevel === 4) {
        this.pushLog(T("level.lastdoor"), LogKind.System);
        this.emit({ type: "bossIntro" });
        return; // le scene manager chargera le niveau après la cinématique
      }
      if (this.currentLevel === 4 && nextLevel === 5) {
        this.emit({ type: "depthsIntro" });
        return; // le scene manager chargera le niveau 5 après la cinématique
      }
      this.pushLog(T("level.exit", { level: nextLevel }), LogKind.System);
      this.emit({ type: "sfx", name: "exit" });
      this.loadLevel(nextLevel);
      return;
    }

    this.updateVision();
    this.advanceTimeAfterPlayerMove();
    this.monstersTurn();
  }

  // ===== Tour des monstres =====
  monstersTurn() {
    for (const m of this.monsters) {
      if (m.isDead) continue;
      const dist = manhattan(m.pos, this.player.pos);
      if (dist <= 1) continue;
      const dir = this.chooseMonsterMove(m);
      if (dir === Dir.None) continue;
      const next = move(m.pos, dir);
      if (!this.map.isWalkable(next)) continue;
      if (this.monsterAt(next)) continue;
      if (eqPos(next, this.player.pos)) continue;
      m.setPosition(next);
    }
  }

  private chooseMonsterMove(m: Monster): Dir {
    const dist = manhattan(m.pos, this.player.pos);
    const inRange = dist <= m.aggroRange;

    if (inRange) {
      if (m.aiKind === "flee") return this.chooseFleeMove(m, dist);
      return this.chooseChaseMove(m, dist);
    }
    // Hors de portée d'aggro : comportement idle propre à chaque type d'IA.
    if (m.aiKind === "ambush") return Dir.None; // reste tapi, n'erre pas
    if (m.aiKind === "patrol") return this.choosePatrolMove(m);
    return this.rng.pick(DIRS4); // aggro / random / flee (hors de portée) : errance
  }

  private chooseChaseMove(m: Monster, dist: number): Dir {
    let bestDir = Dir.None;
    let bestDist = dist;
    for (const d of DIRS4) {
      const next = move(m.pos, d);
      if (!this.map.isWalkable(next)) continue;
      if (this.monsterAt(next)) continue;
      if (eqPos(next, this.player.pos)) continue;
      const nd = manhattan(next, this.player.pos);
      if (nd < bestDist) { bestDist = nd; bestDir = d; }
    }
    if (bestDir === Dir.None) return this.rng.pick(DIRS4);
    return bestDir;
  }

  private chooseFleeMove(m: Monster, dist: number): Dir {
    let bestDir = Dir.None;
    let bestDist = dist;
    for (const d of DIRS4) {
      const next = move(m.pos, d);
      if (!this.map.isWalkable(next)) continue;
      if (this.monsterAt(next)) continue;
      if (eqPos(next, this.player.pos)) continue;
      const nd = manhattan(next, this.player.pos);
      if (nd > bestDist) { bestDist = nd; bestDir = d; }
    }
    if (bestDir === Dir.None) return this.rng.pick(DIRS4); // acculé : s'agite au hasard
    return bestDir;
  }

  private choosePatrolMove(m: Monster): Dir {
    const maxRange = 3;
    const isValid = (d: Dir) => {
      const next = move(m.pos, d);
      if (!this.map.isWalkable(next)) return false;
      if (this.monsterAt(next)) return false;
      if (eqPos(next, this.player.pos)) return false;
      if (manhattan(next, m.spawnPos) > maxRange) return false;
      return true;
    };
    if (m.patrolDir !== null && isValid(m.patrolDir)) return m.patrolDir;
    const options = DIRS4.filter(isValid);
    if (options.length === 0) { m.patrolDir = null; return Dir.None; }
    const chosen = options[this.rng.next(0, options.length)];
    m.patrolDir = chosen;
    return chosen;
  }

  private tryMoveGuardAside(guard: Pnj, playerFrom: Pos): boolean {
    const candidates = [playerFrom, ...DIRS4.map(d => move(guard.pos, d))];
    for (const p of candidates) {
      if (!this.map.inBounds(p) || !this.map.isWalkable(p)) continue;
      if (eqPos(p, this.player.pos)) continue;
      if (this.monsterAt(p) || this.pnjAt(p)) continue;
      guard.setPosition(p);
      return true;
    }
    return false;
  }

  // ===== Connectivité — port de ConnectivityFixService =====
  ensureAllExitsReachable(start: Pos) {
    const exits: Pos[] = [];
    for (let y = 0; y < this.map.height; y++)
      for (let x = 0; x < this.map.width; x++)
        if (this.map.get(P(x, y)) === Tile.Exit) exits.push(P(x, y));
    for (const exit of exits) {
      if (this.isReachable(start, exit)) continue;
      for (const p of this.lPath(start, exit)) if (this.isDoorClosed(p)) this.openDoor(p);
      if (this.isReachable(start, exit)) continue;
      for (const p of this.lPath(start, exit)) this.digCell(p);
      if (!this.isReachable(start, exit)) {
        let cur = P(start.x, start.y);
        while (cur.x !== exit.x) { cur = P(cur.x + Math.sign(exit.x - cur.x), cur.y); this.digCell(cur); }
        while (cur.y !== exit.y) { cur = P(cur.x, cur.y + Math.sign(exit.y - cur.y)); this.digCell(cur); }
      }
    }
  }

  private isReachable(start: Pos, target: Pos): boolean {
    if (!this.map.inBounds(start) || !this.map.inBounds(target)) return false;
    const q: Pos[] = [start];
    const seen = new Set<string>([key(start)]);
    while (q.length) {
      const cur = q.shift()!;
      if (eqPos(cur, target)) return true;
      for (const d of DIRS4) {
        const n = move(cur, d);
        if (!this.map.inBounds(n) || seen.has(key(n))) continue;
        if (!this.map.isWalkable(n) || this.isDoorClosed(n)) continue;
        seen.add(key(n)); q.push(n);
      }
    }
    return false;
  }

  private *lPath(a: Pos, b: Pos): Generator<Pos> {
    const sx = Math.sign(b.x - a.x), sy = Math.sign(b.y - a.y);
    let cur = P(a.x, a.y);
    while (cur.x !== b.x) { cur = P(cur.x + sx, cur.y); yield cur; }
    while (cur.y !== b.y) { cur = P(cur.x, cur.y + sy); yield cur; }
  }

  private digCell(p: Pos) {
    if (!this.map.inBounds(p)) return;
    if (this.isDoorClosed(p)) { this.openDoor(p); return; }
    const t = this.map.get(p);
    if (t === Tile.Wall || t === Tile.Cracked) this.map.set(p.x, p.y, Tile.Floor);
  }

  // ===== Boss atteignable — port de BossSpawnFixService =====
  ensureBossReachable() {
    const boss = this.monsters.find(m => !m.isDead && m.rank === MonsterRank.Boss)
      ?? this.monsters[this.monsters.length - 1];
    if (!boss) return;
    const b = boss.pos;
    const hasNeighbor = DIRS4.some(d => { const n = move(b, d); return this.map.inBounds(n) && this.map.isWalkable(n); });
    if (!hasNeighbor) {
      for (const d of DIRS4) {
        const n = move(b, d);
        if (this.map.inBounds(n) && this.map.get(n) === Tile.Wall) { this.map.set(n.x, n.y, Tile.Floor); break; }
      }
    }
    if (!this.isReachable(this.player.pos, b)) {
      let cur = P(this.player.pos.x, this.player.pos.y);
      while (cur.x !== b.x) { cur = P(cur.x + Math.sign(b.x - cur.x), cur.y); this.digCell(cur); }
      while (cur.y !== b.y) { cur = P(cur.x, cur.y + Math.sign(b.y - cur.y)); this.digCell(cur); }
    }
  }
}
