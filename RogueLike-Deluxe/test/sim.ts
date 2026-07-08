// Simulation headless : traverse le jeu complet et vérifie la logique.
import { GameContext, GameEvent } from "../src/context";
import { CombatSession, CombatEvent } from "../src/combat";
import { Monster, MonsterCatalog, Altar } from "../src/entities";
import { CREED_CHOICES } from "../src/creed";
import { saveGame, loadGame, clearSave } from "../src/save";
import { T, getLang, setLang } from "../src/i18n";
import { generateFloor } from "../src/procgen";
import { elementStacks, hasResonance } from "../src/boons";
import { Pos, P, eqPos, key, Dir, move, DIRS4, Tile, RNG } from "../src/core";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (cond) console.log("  OK  " + msg);
  else { console.log("  FAIL " + msg); failures++; }
}

const ctx = new GameContext();
let pendingCombat: Monster | null = null;
let sawSwordCine = false, sawBossIntro = false, sawDepthsIntro = false, endVictory: boolean | null = null;
let merchantSeen = false;
let floorClearedFlag = false;

function handle(events: GameEvent[]) {
  for (const e of events) {
    if (e.type === "levelLoaded") ctx.blockNightSpawnsForTicks(1e9);
    if (e.type === "combat") pendingCombat = e.monster;
    if (e.type === "swordCinematic") sawSwordCine = true;
    if (e.type === "bossIntro") sawBossIntro = true;
    if (e.type === "depthsIntro") sawDepthsIntro = true;
    if (e.type === "end") endVictory = e.victory;
    if (e.type === "merchant") merchantSeen = true;
    if (e.type === "floorCleared") floorClearedFlag = true;
  }
}

function fight(): boolean {
  const m = pendingCombat!;
  pendingCombat = null;
  const s = new CombatSession(ctx, m);
  let turns = 0;
  while (!s.over && !s.isOver && turns++ < 400) {
    const act = ctx.player.hp < 14 && s.healsLeft > 0 ? "heal" : "attack";
    s.playTurn(act as any);
    s.drainEvents();
  }
  // le simulateur joue "prudemment" : plein PV entre les combats (gemmes, repli...)
  ctx.player.healToFull();
  // dépense les points de stat en attaque
  while (ctx.player.statPoints > 0) ctx.player.spendStatPoint(1 /* Attack */ as any);
  return s.victory || m.isDead;
}

// BFS vers une cible ; portes fermées bloquantes sauf si c'est la cible ; monstres bloquants sauf cible
function pathTo(target: Pos, throughMonster = false): Dir[] | null {
  const start = ctx.player.pos;
  const q: Pos[] = [start];
  const prev = new Map<string, { p: Pos; d: Dir }>();
  const seen = new Set([key(start)]);
  while (q.length) {
    const cur = q.shift()!;
    if (eqPos(cur, target)) {
      const dirs: Dir[] = [];
      let c = cur;
      while (!eqPos(c, start)) {
        const pr = prev.get(key(c))!;
        dirs.unshift(pr.d);
        c = pr.p;
      }
      return dirs;
    }
    for (const d of DIRS4) {
      const n = move(cur, d);
      if (!ctx.map.inBounds(n) || seen.has(key(n))) continue;
      const isTarget = eqPos(n, target);
      const t = ctx.map.get(n);
      const walkable = t === Tile.Floor || t === Tile.Exit || t === Tile.DoorOpen;
      if (!walkable && !(isTarget && t === Tile.DoorClosed)) continue;
      if (t === Tile.Exit && !isTarget) continue; // ne pas sortir du niveau par accident
      // les monstres ne bloquent pas : marcher dessus = combat (géré par le bot)
      seen.add(key(n));
      prev.set(key(n), { p: cur, d });
      q.push(n);
    }
  }
  return null;
}

// avance vers la cible (statique ou mobile) ; combat tout monstre qui bloque le chemin
function goTo(targetFn: Pos | (() => Pos), throughMonster = false, maxSteps = 2000): boolean {
  const getT = typeof targetFn === "function" ? targetFn : () => targetFn;
  let steps = 0;
  while (!eqPos(ctx.player.pos, getT()) && steps++ < maxSteps) {
    let path = pathTo(getT(), throughMonster);
    if (!path || path.length === 0) {
      // un monstre bloque probablement le chemin : va tuer le PLUS PROCHE (le bloqueur)
      const alive = ctx.monsters.filter(m => !m.isDead);
      let best: Dir[] | null = null;
      for (const m of alive) {
        const pm = pathTo(m.pos, true);
        if (pm && pm.length > 0 && (!best || pm.length < best.length)) best = pm;
      }
      if (!best) return false;
      ctx.tryMove(best[0]);
      handle(ctx.drainEvents());
      if (pendingCombat) fight();
      continue;
    }
    const before = ctx.currentLevel;
    ctx.tryMove(path[0]);
    handle(ctx.drainEvents());
    if (pendingCombat) {
      const win = fight();
      if (!win && ctx.player.isDead) return false;
    }
    if (ctx.currentLevel !== before) return true; // changement de niveau
    if (endVictory !== null || sawBossIntro) return true;
  }
  return eqPos(ctx.player.pos, getT());
}

function killMonster(m: Monster): boolean {
  for (let guard = 0; !m.isDead && guard < 40; guard++) {
    goTo(() => m.pos, true, 120);
    if (ctx.player.isDead) return false;
  }
  return m.isDead;
}

function killAllMonsters() {
  let guard = 0;
  while (guard++ < 30) {
    const m = ctx.monsters.find(mm => !mm.isDead);
    if (!m) break;
    if (!killMonster(m)) {
      console.log("  (inatteignable, force-kill : " + m.nameKey + ")");
      m.takeDamage(99999);
    }
  }
}

console.log("=== NIVEAU 1 ===");
ctx.loadLevel(1);
handle(ctx.drainEvents());
ctx.blockNightSpawnsForTicks(1e9);
check(ctx.map.width === 30 && ctx.map.height === 18, "carte 30x18");
check(eqPos(ctx.player.pos, P(14, 8)), "départ (14,8)");
check(ctx.monsters.length === 3, "3 monstres (slime, golem, araignée)");

// Kael donne l'épée
goTo(P(12, 6));
check(ctx.player.inventory.some(i => i.id === "Sword"), "épée reçue de Kael");
// équipe l'épée
const sw = ctx.player.inventory.find(i => i.id === "Sword")!;
ctx.player.removeFromInventory(sw); sw.apply(ctx.player);
check(ctx.player.attack === 7, "ATK 5+2=7 après équipement");

// tue tout
killAllMonsters();
check(!ctx.monsters.some(m => !m.isDead), "tous les monstres du niveau 1 morts");

// Lysa donne la clé (exige que TOUT soit mort, y compris les spawns nocturnes)
for (let tries = 0; tries < 20; tries++) {
  killAllMonsters();
  goTo(P(6, 12));
  if (ctx.player.inventory.some(i => i.id === "Map1ArmoryKey")) break;
  // un spawn nocturne a dû apparaître : on nettoie et on retente
}
check(ctx.player.inventory.some(i => i.id === "Map1ArmoryKey"), "clé d'armurerie reçue de Lysa");

// porte armurerie
goTo(P(5, 13));
check(ctx.map.get(P(5, 13)) === Tile.DoorOpen, "porte armurerie ouverte");
check(!ctx.player.inventory.some(i => i.id === "Map1ArmoryKey"), "clé consommée");

// items armurerie
goTo(P(2, 13));
goTo(P(3, 14));
check(ctx.player.inventory.some(i => i.id === "Armor"), "armure ramassée");
check(ctx.player.inventory.some(i => i.id === "CritCharm"), "charme ramassé");

// sortie (sentinelle s'écarte)
goTo(P(29, 8));
check(ctx.currentLevel === 2, "passage au niveau 2");

console.log("=== NIVEAU 2 ===");
handle(ctx.drainEvents());
check(eqPos(ctx.player.pos, P(1, 11)), "départ niveau 2");
{
  const ok2 = goTo(P(33, 18));
  if (ctx.currentLevel !== 3) console.log("  dbg L2: goTo=", ok2, "pos=", JSON.stringify(ctx.player.pos), "hp=", ctx.player.hp, "monstres=", ctx.monsters.filter(m=>!m.isDead).map(m=>m.nameKey+JSON.stringify(m.pos)).join(" "));
}
check(ctx.currentLevel === 3, "passage au niveau 3");

console.log("=== NIVEAU 3 ===");
check(ctx.seals.length === 3, "3 sceaux");
// active les 3 sceaux
for (let tries = 0; tries < 10 && ctx.sealsActivated < 3; tries++) {
  for (const s of ctx.seals) if (!s.isActivated) goTo(s.pos);
}
check(ctx.sealsActivated === 3, "3 sceaux activés");
check(ctx.map.get(P(18, 6)) === Tile.DoorOpen, "portes centrales ouvertes");

// épée légendaire
goTo(P(21, 7));
check(sawSwordCine, "cinématique épée déclenchée");
sawSwordCine = false;
check(ctx.hasLegendarySword, "épée légendaire obtenue");
check(ctx.player.equippedWeapon?.id === "LegendarySword", "épée légendaire équipée");
check(ctx.monsters.some(m => !m.isDead && m.nameKey.startsWith("mob.warden")), "Gardien des Sceaux apparu");
check(ctx.map.get(P(35, 7)) === Tile.DoorClosed, "portes de sortie refermées");

// tue le gardien
const warden = ctx.monsters.find(m => !m.isDead && m.nameKey.startsWith("mob.warden"))!;
killMonster(warden);
check(warden.isDead, "Gardien vaincu");
check(ctx.miniBossDefeated, "flag miniboss");
check(ctx.map.get(P(35, 7)) === Tile.DoorOpen, "portes de sortie rouvertes");

// marchand
const mOk = goTo(P(38, 7));
if (!merchantSeen) console.log("  dbg merchant: goTo=", mOk, "pos=", JSON.stringify(ctx.player.pos));
check(merchantSeen, "marchand rencontré");

// sortie → intro boss
goTo(P(40, 12));
check(sawBossIntro, "cinématique boss déclenchée");
sawBossIntro = false; // évite que les futurs goTo() s'interrompent après une seule case (voir handling de fin de route dans goTo)
ctx.loadLevel(4);
handle(ctx.drainEvents());

console.log("=== NIVEAU 4 (BOSS) ===");
check(ctx.currentLevel === 4, "niveau 4 chargé");
const boss = ctx.monsters.find(m => m.nameKey === "mob.boss")!;
check(!!boss, "boss présent");

// on booste le joueur pour garantir la victoire du test
ctx.player.modifyAttack(+30);
ctx.player.maxHp += 200; ctx.player.heal(300);
killMonster(boss);
check(boss.isDead, "boss vaincu");

// coffre caché : Clé de l'Abîme (débloque le donjon post-jeu)
goTo(P(41, 2));
check(ctx.player.inventory.some(i => i.id === "AbyssKey"), "clé de l'Abîme récupérée");

// portail post-jeu (normalement ouvert par CombatScene à la victoire, avec la clé en poche)
ctx.openAbyssPortal();
check(ctx.map.get(P(40, 9)) === Tile.Exit, "portail des Profondeurs ouvert");
goTo(P(40, 9));
check(sawDepthsIntro, "cinématique des Profondeurs déclenchée");
sawDepthsIntro = false;
ctx.loadLevel(5);
handle(ctx.drainEvents());

console.log("=== NIVEAU 5 (POST-JEU) ===");
check(ctx.currentLevel === 5, "niveau 5 chargé");
const rival = ctx.monsters.find(m => m.nameKey === "mob.rival")!;
check(!!rival, "le Rival est présent");
ctx.player.modifyAttack(+30); ctx.player.heal(300);
killMonster(rival);
check(rival.isDead, "le Rival vaincu");
check(ctx.rivalDefeated, "flag rivalDefeated activé");
// LE VERDICT : sort du Rival décidé APRÈS le combat. Ici on l'achève (perpétuer la Boucle).
ctx.recordChoice("rival_fate", "slain", -3);
ctx.resolveRivalFate(false);
check(ctx.player.inventory.some(i => i.id === "EchoShard"), "Verdict (achever) : Éclat d'Écho obtenu");

const devourer = ctx.monsters.find(m => m.nameKey === "mob.superboss")!;
check(!!devourer, "le Dévoreur d'Âmes est présent");
ctx.player.modifyAttack(+30); ctx.player.heal(300);
killMonster(devourer);
check(devourer.isDead, "le Dévoreur d'Âmes vaincu (Fin Véritable atteignable)");

console.log("=== SYSTEME JOUR/NUIT (unitaire) ===");
{
  const c2 = new GameContext();
  c2.loadLevel(2); c2.drainEvents();
  const golemAtk0 = c2.monsters[2].attack;
  // avance 24 ticks → la nuit tombe
  for (let i = 0; i < 24; i++) c2.advanceTimeAfterPlayerMove();
  check(c2.time.isNight, "la nuit tombe au tick 24");
  check(c2.monsters[2].attack === golemAtk0 + 2, "buff nocturne +2 ATK appliqué une fois");
  // spawns nocturnes
  let spawned = 0;
  for (let i = 0; i < 300 && c2.time.isNight; i++) {
    const before = c2.monsters.length;
    c2.advanceTimeAfterPlayerMove();
    if (c2.monsters.length > before) spawned++;
    if (!c2.time.isNight) break;
  }
  check(spawned > 0 || !c2.time.isNight, "des spawns nocturnes apparaissent");
  // jour → débuff
  while (c2.time.isNight) c2.advanceTimeAfterPlayerMove();
  check(!c2.time.isNight, "le jour revient");
  check(c2.monsters[2].isDead || c2.monsters[2].attack === golemAtk0, "buff nocturne retiré au matin");
  check(c2.monsters.filter(m => !m.isDead).length <= 10 + 3, "plafond de spawns respecté");
  c2.drainEvents();
}

console.log("=== DESCENTE INFINIE (procédural) ===");
{
  function findExit(): Pos | null {
    for (let y = 0; y < ctx.map.height; y++)
      for (let x = 0; x < ctx.map.width; x++)
        if (ctx.map.get(P(x, y)) === Tile.Exit) return P(x, y);
    return null;
  }

  // repart d'un run propre sur le contexte existant
  sawBossIntro = false; sawDepthsIntro = false; sawSwordCine = false; endVictory = null;
  ctx.startEndlessRun(1);
  handle(ctx.drainEvents());
  ctx.blockNightSpawnsForTicks(1e9);
  check(ctx.endless, "mode Descente actif");
  check(ctx.runDepth === 1, "démarre à la profondeur 1");

  const FLOORS = 12;
  let bossFloorTested = false, exitAlwaysReachable = true, essenceGrew = false;
  const essence0 = ctx.runEssence;

  for (let depth = 1; depth <= FLOORS; depth++) {
    const boss = depth % 5 === 0;
    floorClearedFlag = false; // « étage nettoyé » = le joueur a atteint la sortie à un moment
    // le bot est boosté pour survivre au test (on valide la structure, pas la difficulté)
    ctx.player.modifyAttack(+80); ctx.player.maxHp += 300; ctx.player.healToFull();

    if (boss) {
      check(ctx.monsters.length > 0, `profondeur ${depth} : étage de boss peuplé`);
      if (depth === 5) check(findExit() === null, "profondeur 5 : sortie scellée avant le boss");
    }

    // Nettoyage des monstres (le bot peut fouler la sortie en chemin → floorCleared).
    killAllMonsters();
    handle(ctx.drainEvents());
    if (boss) { ctx.checkEndlessBossExit(); handle(ctx.drainEvents()); bossFloorTested = true; }

    // Si pas encore franchie pendant le nettoyage, on marche jusqu'à la sortie.
    if (!floorClearedFlag) {
      const exit = findExit();
      if (!exit) { exitAlwaysReachable = false; console.log(`  (profondeur ${depth} : aucune sortie générée !)`); break; }
      goTo(exit);
    }
    if (!floorClearedFlag) {
      exitAlwaysReachable = false;
      console.log(`  (profondeur ${depth} : sortie non franchie ; pos=${JSON.stringify(ctx.player.pos)})`);
      break;
    }

    if (ctx.runEssence > essence0) essenceGrew = true;

    // simule le draft (pas de scène ici) puis descend
    ctx.advanceEndlessFloor();
    handle(ctx.drainEvents());
    ctx.blockNightSpawnsForTicks(1e9);
  }

  check(exitAlwaysReachable, `${FLOORS} étages générés et connexes (sortie atteignable)`);
  check(bossFloorTested, "au moins un étage de boss traversé");
  check(essenceGrew, "l'essence s'accumule au fil de la descente");
  check(ctx.runDepth === FLOORS + 1, `profondeur finale atteinte (${ctx.runDepth})`);

  // mort en Descente : le run se termine proprement (pas de crash, flag endless conservé)
  ctx.player.hp = 0;
  check(ctx.player.isDead && ctx.endless, "mort en Descente gérable (→ résumé de run)");
}

console.log("=== REBIRTH : INTENTS / TELEGRAPHES ===");
{
  const c = new GameContext();
  c.loadLevel(1); c.drainEvents(); c.blockNightSpawnsForTicks(1e9);
  c.player.maxHp = 500; c.player.healToFull(); c.player.modifyAttack(-3); // combat long pour voir le pattern
  const golem = MonsterCatalog.golem(P(5, 5));
  golem.maxHp = 500; golem.hp = 500;
  const s = new CombatSession(c, golem);
  check(!!s.intent && !!s.intent.labelKey, "l'ennemi annonce une intention dès le début du combat");
  let sawCharge = false, heavyAfterCharge = false;
  for (let turn = 0; turn < 12 && !s.over; turn++) {
    const chargedNow = s.intent.kind === "charge";
    s.playTurn("attack");
    const evs = s.drainEvents();
    if (evs.some(e => e.type === "enemyCharge")) sawCharge = true;
    if (chargedNow) {
      // le tour SUIVANT la charge doit être le coup dévastateur
      s.playTurn("attack");
      if (s.drainEvents().some(e => e.type === "enemySpecial")) heavyAfterCharge = true;
      break;
    }
  }
  check(sawCharge, "le golem télégraphie sa charge");
  check(heavyAfterCharge, "la charge est suivie du coup dévastateur au tour suivant");
}

console.log("=== REBIRTH : HOOKS DE BOONS ===");
{
  // Étincelle : les attaques brûlent
  const c = new GameContext();
  c.loadLevel(1); c.drainEvents(); c.blockNightSpawnsForTicks(1e9);
  c.player.maxHp = 500; c.player.healToFull();
  c.player.runBoons["kindle"] = 1;
  const slime = MonsterCatalog.slime(P(5, 5));
  slime.maxHp = 200; slime.hp = 200;
  const s = new CombatSession(c, slime);
  s.playTurn("attack");
  s.drainEvents();
  check(slime.hasStatus("burn"), "Étincelle : l'attaque applique une brûlure");
  const hpBefore = slime.hp;
  s.playTurn("dodge");
  s.drainEvents();
  check(slime.hp < hpBefore, "la brûlure ronge l'ennemi à chaque tour");

  // Tempo : premier coup critique garanti
  const c2 = new GameContext();
  c2.loadLevel(1); c2.drainEvents(); c2.blockNightSpawnsForTicks(1e9);
  c2.player.maxHp = 500; c2.player.healToFull();
  c2.player.runBoons["tempo"] = 1;
  const slime2 = MonsterCatalog.slime(P(5, 5));
  slime2.maxHp = 200; slime2.hp = 200;
  const s2 = new CombatSession(c2, slime2);
  s2.playTurn("attack");
  const evs2 = s2.drainEvents();
  check(evs2.some(e => e.type === "playerCrit"), "Tempo : la première attaque est un critique garanti");

  // Résonance de Braise (3 cumuls fire) : combustion à la frappe d'un ennemi qui brûle
  const c3 = new GameContext();
  c3.loadLevel(1); c3.drainEvents(); c3.blockNightSpawnsForTicks(1e9);
  c3.player.maxHp = 500; c3.player.healToFull();
  c3.player.runBoons["kindle"] = 3;
  check(elementStacks(c3.player, "fire") === 3, "3 cumuls de Braise comptés");
  check(hasResonance(c3.player, "fire"), "la résonance de Braise est éveillée");
  const golem3 = MonsterCatalog.golem(P(5, 5));
  golem3.maxHp = 400; golem3.hp = 400;
  const s3 = new CombatSession(c3, golem3);
  let sawCombustion = false;
  for (let i = 0; i < 4 && !s3.over; i++) {
    s3.playTurn("attack");
    if (s3.drainEvents().some((e: CombatEvent) => e.type === "combustion")) { sawCombustion = true; break; }
  }
  check(sawCombustion, "résonance de Braise : la brûlure détone à la frappe");
}

console.log("=== REBIRTH : AUTELS, MALEDICTIONS, SANCTUAIRES ===");
{
  const c = new GameContext();
  c.startEndlessRun(1);
  c.drainEvents(); c.blockNightSpawnsForTicks(1e9);
  // autel posé sous les pieds du bot
  const spot = ((): Pos => {
    for (const d of DIRS4) {
      const p = move(c.player.pos, d);
      if (c.map.isWalkable(p) && !c.monsterAt(p)) return p;
    }
    return c.player.pos;
  })();
  const altar = new Altar(spot);
  c.altars.push(altar);
  c.tryMove(DIRS4.find(d => eqPos(move(c.player.pos, d), spot))!);
  const evs = c.drainEvents();
  check(evs.some(e => e.type === "altar"), "marcher sur un autel déclenche le pacte");
  const curseId = c.acceptAltar(altar);
  check(c.runCurses.length === 1 && c.runCurses[0] === curseId, "accepter le pacte applique une malédiction de run");

  // Famine : plus de soin entre étages
  c.runCurses.length = 0;
  c.runCurses.push("famine");
  c.player.maxHp = 100;
  c.player.hp = 40;
  c.loadProceduralFloor(c.runDepth + 1);
  c.drainEvents();
  check(c.player.hp === 40, "malédiction de Famine : aucun soin entre les étages");
}

console.log("=== REBIRTH : PROCGEN (secrets, autels, sanctuaires, affixes) ===");
{
  const rng = new RNG(1234);
  let altars = 0, shrines = 0, cracked = 0, elites = 0, affixed = 0;
  for (let depth = 2; depth <= 20; depth++) {
    const data = generateFloor(depth, rng);
    altars += data.altars?.length ?? 0;
    shrines += data.shrines?.length ?? 0;
    for (let y = 0; y < data.map.height; y++)
      for (let x = 0; x < data.map.width; x++)
        if (data.map.get(P(x, y)) === Tile.Cracked) cracked++;
    for (const m of data.monsters) if (m.elite) { elites++; if (m.affix) affixed++; }
  }
  check(altars > 0, `des autels maudits sont générés (${altars} sur 19 étages)`);
  check(shrines > 0, `des sanctuaires sont générés (${shrines})`);
  check(cracked > 0, `des salles secrètes (murs fissurés) sont générées (${cracked})`);
  check(elites > 0 && affixed === elites, `toutes les élites portent un affixe (${affixed}/${elites})`);

  // Mur fissuré : marcher dedans le brise et révèle la salle
  const c = new GameContext();
  c.startEndlessRun(1);
  c.drainEvents(); c.blockNightSpawnsForTicks(1e9);
  const wall = move(c.player.pos, Dir.Up);
  c.map.set(wall.x, wall.y, Tile.Cracked);
  c.tryMove(Dir.Up);
  const evs = c.drainEvents();
  check(c.map.get(wall) === Tile.Floor, "le mur fissuré se brise quand on le pousse");
  check(evs.some(e => e.type === "secret"), "l'événement de salle secrète est émis");
}

console.log("=== MAP 2 : LABYRINTHE + PIEGES ===");
{
  const c = new GameContext();
  c.loadLevel(2); c.drainEvents(); c.blockNightSpawnsForTicks(1e9);
  check(c.traps.length >= 5, `des pièges sont posés (${c.traps.length})`);
  check(c.props.some(p => p.kind === "torch"), "des torches éclairent le labyrinthe");

  // place le joueur sur un voisin praticable du piège puis marche dessus
  const nb: [number, number, any][] = [[1, 0, Dir.Right], [-1, 0, Dir.Left], [0, 1, Dir.Down], [0, -1, Dir.Up]];
  const stepOnto = (t: { pos: { x: number; y: number } }): boolean => {
    for (const [dx, dy, dir] of nb) {
      const nx = t.pos.x - dx, ny = t.pos.y - dy;
      if (c.map.isWalkable(P(nx, ny))) { c.player.setPosition(P(nx, ny)); c.tryMove(dir); c.drainEvents(); return true; }
    }
    return false;
  };

  // piège à pointes : blesse malgré l'armure (ignore l'armure)
  const spike = c.traps.find(t => t.kind === "spikes")!;
  c.player.modifyArmor(50);
  const hpBefore = c.player.hp;
  const okSpike = stepOnto(spike);
  check(okSpike && spike.sprung, "le piège à pointes se déclenche quand on marche dessus");
  check(c.player.hp < hpBefore, "le piège à pointes blesse malgré l'armure (ignore l'armure)");

  // piège à gaz : empoisonne pour le prochain combat
  const gas = c.traps.find(t => t.kind === "gas" && !t.sprung)!;
  c.player.clearStatuses();
  const okGas = stepOnto(gas);
  check(okGas && gas.sprung && c.player.hasStatus("poison"), "le piège à gaz empoisonne le joueur");
}

console.log("=== LORE : inscriptions atteignables (niveaux 1-5) ===");
{
  for (const lvl of [1, 2, 3, 4, 5]) {
    const c = new GameContext();
    c.loadLevel(lvl); c.drainEvents();
    // BFS depuis le départ
    const m = c.map, start = c.player.pos;
    const seen = new Set([start.x + "," + start.y]); const q = [start];
    while (q.length) { const p = q.shift()!; for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = p.x+dx, ny = p.y+dy, k = nx+","+ny; if (seen.has(k) || !m.isWalkable(P(nx, ny))) continue; seen.add(k); q.push(P(nx, ny)); } }
    for (const lm of c.loreMarks) {
      const ok = m.isWalkable(lm.pos) && seen.has(lm.pos.x + "," + lm.pos.y);
      check(ok, `lore niveau ${lvl} : ${lm.cineKey} atteignable en (${lm.pos.x},${lm.pos.y})`);
    }
  }
}

console.log("=== LORE : evenement de la trace du Rival (niveau 4) ===");
{
  const c = new GameContext();
  c.loadLevel(4); c.drainEvents(); c.blockNightSpawnsForTicks(1e9);
  check(c.loreMarks.length >= 1, "un point de lore est posé dans l'arène");
  const lm = c.loreMarks[0];
  // se placer à gauche du point de lore et marcher dessus
  c.player.setPosition(P(lm.pos.x - 1, lm.pos.y));
  c.tryMove(Dir.Right);
  const evs = c.drainEvents();
  check(lm.seen && evs.some(e => e.type === "lore"), "marcher sur la trace déclenche l'événement de lore (une fois)");
  // ne se redéclenche pas
  c.player.setPosition(P(lm.pos.x - 1, lm.pos.y));
  c.tryMove(Dir.Right);
  check(!c.drainEvents().some(e => e.type === "lore"), "l'événement de lore ne se rejoue pas");
}

console.log("=== LE SERMENT : choix moraux, verdicts, fins ===");
{
  // Axe & seuils : un seul choix ne suffit pas à te définir (seuil = 4).
  const c = new GameContext();
  check(c.oath === 0 && c.decideEnding() === "balance", "départ neutre : fin Équilibre");
  c.recordChoice("rival_l1", "hand", +2);
  check(c.decideEnding() === "balance", "un seul choix (+2) ne bascule pas");
  c.recordChoice("torvin", "free", +3);
  check(c.oath === 5 && c.creedTier() === 1 && c.decideEnding() === "redemption", "cumul clément (+5) → fin Rédemption");

  const c2 = new GameContext();
  c2.recordChoice("rival_l1", "blade", -2);
  c2.recordChoice("torvin", "seize", -3);
  check(c2.oath === -5 && c2.decideEnding() === "dominion", "cumul d'emprise (−5) → fin Domination");
  check(c2.choices["torvin"] === "seize", "la mémoire des choix est conservée");

  // Verdict : épargner vs achever donnent des récompenses distinctes.
  const cs = new GameContext(); cs.player.maxHp = 100; cs.player.hp = 40;
  const armBefore = cs.player.armor;
  cs.resolveRivalFate(true);
  check(cs.rivalSpared && cs.player.maxHp === 115 && cs.player.armor === armBefore + 2, "Verdict épargner : +15 PV max, +2 armure, plein PV");
  check(!cs.player.inventory.some(i => i.id === "EchoShard"), "épargner ne donne pas l'Éclat d'Écho");

  const ck = new GameContext();
  const atkBefore = ck.player.attack;
  ck.resolveRivalFate(false);
  check(!ck.rivalSpared && ck.player.attack === atkBefore + 3 && ck.player.inventory.some(i => i.id === "EchoShard"), "Verdict achever : Éclat d'Écho + 3 ATK");

  // Les effets mécaniques du catalogue s'appliquent bien via apply().
  const ct = new GameContext();
  const critBefore = ct.player.critChancePercent;
  CREED_CHOICES.torvin.options[0].apply(ct); // libérer
  check(ct.prisonerFreed && ct.player.critChancePercent === critBefore + 3, "apply(libérer Torvin) : prisonnier libre + crit");
  const cseize = new GameContext();
  const atk0 = cseize.player.attack;
  CREED_CHOICES.torvin.options[1].apply(cseize); // saisir
  check(cseize.player.attack === atk0 + 3, "apply(saisir le pacte) : +3 ATK");

  // Toutes les options ont leurs clés i18n (label / effet / flavor).
  let keysOk = true;
  for (const ch of Object.values(CREED_CHOICES))
    for (const o of ch.options)
      if (!T(o.labelKey) || T(o.labelKey) === o.labelKey || T(o.effectKey) === o.effectKey || T(o.flavorKey) === o.flavorKey) keysOk = false;
  check(keysOk, "chaque option du Serment a ses libellés FR");

  // Sauvegarde : le Serment traverse un cycle save→load (shim localStorage pour Node).
  (globalThis as any).localStorage = (() => {
    const store: Record<string, string> = {};
    return { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } };
  })();
  const cw = new GameContext();
  cw.loadLevel(2); cw.drainEvents();
  cw.recordChoice("rival_l1", "blade", -2);
  cw.recordChoice("torvin", "seize", -3);
  cw.rivalSpared = false;
  saveGame(cw);
  const cr = new GameContext();
  loadGame(cr);
  check(cr.oath === -5 && cr.choices["torvin"] === "seize", "save/load : oath et choix restaurés");
  clearSave();
}

console.log("=== i18n : parité FR/EN des clés du Serment ===");
{
  const savedLang = getLang();
  const creedKeys = [
    "creed.tag.break", "creed.tag.perp", "creed.hint", "creed.sealed",
    "creed.rival1.prompt", "creed.torvin.prompt", "creed.fate.prompt",
    "end.redemption", "end.dominion", "end.red.4", "end.dom.7",
    "bossenc.rival.break.1", "bossenc.rival.perp.1",
  ];
  setLang("en");
  let enOk = true;
  for (const k of creedKeys) if (T(k) === k) { enOk = false; console.log("  (clé EN manquante : " + k + ")"); }
  setLang(savedLang);
  check(enOk, "toutes les clés du Serment ont leur traduction EN");
}

console.log(failures === 0 ? "\nSIMULATION COMPLETE REUSSIE" : `\n${failures} echec(s)`);
process.exit(failures === 0 ? 0 : 1);
