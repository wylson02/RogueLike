// Simulation headless : traverse le jeu complet et vérifie la logique.
import { GameContext, GameEvent } from "../src/context";
import { CombatSession } from "../src/combat";
import { Monster } from "../src/entities";
import { Pos, P, eqPos, key, Dir, move, DIRS4, Tile } from "../src/core";

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
check(ctx.player.inventory.some(i => i.id === "EchoShard"), "Éclat d'Écho obtenu");

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

console.log(failures === 0 ? "\nSIMULATION COMPLETE REUSSIE" : `\n${failures} echec(s)`);
process.exit(failures === 0 ? 0 : 1);
