// ===== LE PANTHÉON — 3e mode de jeu : boss-rush action temps réel =====
// Cinq Colosses, un par niveau, verrouillés en cascade. Battre le Colosse N débloque le N+1.
// Combat entièrement neuf (voir epicCombat.ts) : arène d'action, esquive à i-frames, endurance,
// phases de boss — sans rien réutiliser du tour-par-tour des autres modes.
import type { CinePage } from "./cinematics";
import { T } from "./i18n";

// Panoplie d'attaques que le moteur (epicCombat) sait interpréter.
//  sweep      : arc de mêlée devant le boss
//  slam       : impact au sol verrouillé sur ta position (roule hors du cercle)
//  dash       : ruée horizontale, la masse du boss est la hitbox
//  projectile : tir qui file au ras du sol (roule au travers ou écarte-toi)
//  shockwave  : deux ondes partant dans les deux sens (roule AU TRAVERS)
//  combo      : plusieurs frappes de mêlée enchaînées
//  dive       : le boss s'envole puis s'écrase sur toi — une ombre traque ta position (ROULE)
//  volley     : salve de plusieurs projectiles espacés
//  spin       : frappe tournoyante des DEUX côtés à la fois (écarte-toi ou roule)
//  ---- Colosses secrets (mécaniques d'un autre niveau) ----
//  zones      : éruptions au sol télégraphées en motif — tiens-toi dans les interstices (bullet-hell)
//  rain       : pluie de météores depuis le ciel à des positions étalées — trouve les trous
//  beam       : rayon vertical qui balaie l'arène — roule au travers (i-frames) ou fuis du bon côté
//  teleport   : le boss se dissout et réapparaît en te flanquant, puis frappe autour de lui
//  phantom    : des spectres surgissent et te tirent dessus en tenaille (feu croisé)
export type EpicAttackKind =
  | "sweep" | "slam" | "dash" | "projectile" | "shockwave" | "combo" | "dive" | "volley" | "spin"
  | "zones" | "rain" | "beam" | "teleport" | "phantom";

export interface EpicAttack {
  kind: EpicAttackKind;
  labelKey: string;    // nom du coup (bannière de télégraphe)
  color: string;       // teinte de la zone de danger / de l'effet
  windup: number;      // durée du télégraphe (fenêtre pour lire et se placer)
  active: number;      // durée de vie de la hitbox
  recovery: number;    // fenêtre de vulnérabilité après le coup (moment de punir)
  range: number;       // portée (rayon du slam/sweep, distance du dash, portée du tir)
  dmg: number;         // dégâts au héros
  speed?: number;      // vitesse du projectile / de la ruée (px/s)
  hits?: number;       // nombre de frappes (combo) ou de projectiles (volley)
  minDist?: number;    // distance mini pour que l'IA choisisse ce coup
  maxDist?: number;    // distance maxi
  fromPhase?: number;  // coup débloqué à partir de cette phase (0 = dès le début)
}

export interface EpicBoss {
  id: string;
  nameKey: string;
  titleKey: string;
  sprite: string;
  glow: string;              // couleur du halo/aura
  hp: number;
  contactDmg: number;        // dégâts en touchant le corps du boss
  moveSpeed: number;         // vitesse d'approche (px/s)
  size: number;              // taille de rendu du sprite
  attacks: EpicAttack[];
  phaseAt: number[];         // fractions de PV déclenchant un changement de phase (ex. [0.5])
  phaseSpeedup: number;      // accélération par phase (les durées *= 1 - phaseSpeedup*phase)
  bg: [string, string, string]; // dégradé de fond de l'arène
  intro: () => CinePage[];   // cinématique de rencontre
}

// Petit helper d'intro : deux pages, portrait du Colosse + réplique.
function intro(sprite: string, glow: string, nameKey: string, l1: string, l2: string): () => CinePage[] {
  return () => [
    { sprite, spriteGlow: glow, title: T(nameKey),
      lines: [{ text: l1, color: "#e8d0d8", size: 18 }], sfx: "roar" },
    { sprite, spriteGlow: glow, title: T(nameKey),
      lines: [{ text: l2, color: "#ffb0b0", size: 18 }] },
  ];
}

// ===== Le héros épique (loadout fixe, commun à tous les niveaux) =====
export const EPIC_HERO = {
  maxHp: 120,
  moveSpeed: 230,
  lightDmg: 14,
  lightWindup: 0.10, lightActive: 0.10, lightRecovery: 0.20, lightReach: 78, lightCost: 12,
  heavyDmg: 34,
  heavyWindup: 0.32, heavyActive: 0.12, heavyRecovery: 0.34, heavyReach: 92, heavyCost: 28,
  rollDur: 0.42, rollIFrames: 0.28, rollDist: 190, rollCost: 22,
  maxStamina: 100, staminaRegen: 42, staminaRegenBlock: 12,
  blockDrainPerHit: 26, blockReduce: 0.82, parryWindow: 0.18,
  flasks: 4, flaskHeal: 46, flaskDur: 0.8,
};

// ===== Les cinq Colosses =====
// Chaque Colosse s'ouvre avec un arsenal de base, puis RÉVÈLE de nouveaux coups en phase 2+
// (fromPhase) : le combat ne se joue jamais deux fois pareil au fil des barres de vie.
export const EPIC_BOSSES: EpicBoss[] = [
  // 1 — LE COLOSSE DE PIERRE : lent, télégraphes énormes, punitions généreuses. Apprentissage.
  //     Phase 2 : découvre le Fracas Céleste (ton premier vrai « roule ou meurs »).
  {
    id: "golem", nameKey: "epic.golem", titleKey: "epic.golem.t", sprite: "golem", glow: "#8a5fd0",
    hp: 260, contactDmg: 8, moveSpeed: 58, size: 168,
    phaseAt: [0.4], phaseSpeedup: 0.14,
    bg: ["#141024", "#1c1430", "#0e0a18"],
    attacks: [
      { kind: "slam", labelKey: "epic.mv.slam", color: "#c8873a", windup: 0.85, active: 0.22, recovery: 0.75, range: 120, dmg: 22, maxDist: 170 },
      { kind: "sweep", labelKey: "epic.mv.sweep", color: "#d0d0d8", windup: 0.6, active: 0.18, recovery: 0.6, range: 130, dmg: 18, maxDist: 150 },
      { kind: "shockwave", labelKey: "epic.mv.quake", color: "#c8a060", windup: 0.75, active: 0.9, recovery: 0.7, range: 620, dmg: 16, speed: 260 },
      { kind: "dive", labelKey: "epic.mv.skyfall", color: "#c8873a", windup: 1.5, active: 0.24, recovery: 0.95, range: 150, dmg: 26, fromPhase: 1 },
    ],
    intro: intro("golem", "#8a5fd0", "epic.golem",
      "Une montagne se dresse. La pierre a appris à haïr.",
      "« Nul ne passe. Nul ne demeure. »"),
  },
  // 2 — LA GARGOUILLE D'ALBÂTRE : rapide, ruées, éclats. Punit l'immobilisme.
  //     Phase 2 : salve d'éclats + piqué fatal depuis les cintres.
  {
    id: "gargoyle", nameKey: "epic.gargoyle", titleKey: "epic.gargoyle.t", sprite: "gargoyle", glow: "#7ad4ff",
    hp: 250, contactDmg: 9, moveSpeed: 118, size: 150,
    phaseAt: [0.45], phaseSpeedup: 0.16,
    bg: ["#0e1626", "#122034", "#080e18"],
    attacks: [
      { kind: "dash", labelKey: "epic.mv.swoop", color: "#7ad4ff", windup: 0.5, active: 0.35, recovery: 0.55, range: 340, dmg: 20, speed: 720, minDist: 120 },
      { kind: "sweep", labelKey: "epic.mv.talons", color: "#bfeaff", windup: 0.4, active: 0.16, recovery: 0.45, range: 110, dmg: 16, maxDist: 130 },
      { kind: "projectile", labelKey: "epic.mv.shard", color: "#a0e0ff", windup: 0.45, active: 2.2, recovery: 0.4, range: 900, dmg: 15, speed: 430 },
      { kind: "volley", labelKey: "epic.mv.volley", color: "#a0e0ff", windup: 0.55, active: 1.8, recovery: 0.5, range: 900, dmg: 12, speed: 420, hits: 3, fromPhase: 1 },
      { kind: "dive", labelKey: "epic.mv.skyfall", color: "#bfeaff", windup: 1.25, active: 0.22, recovery: 0.7, range: 130, dmg: 22, fromPhase: 1 },
    ],
    intro: intro("gargoyle", "#7ad4ff", "epic.gargoyle",
      "Elle décroche du plafond dans un cri d'albâtre.",
      "« Cours donc. Mes serres aiment ça. »"),
  },
  // 3 — LE GARDIEN DÉCHU : garde la distance, ondes runiques et volées. Récompense l'agressivité.
  //     Phase 2 : salve runique + explosion tournoyante des deux côtés.
  {
    id: "warden", nameKey: "epic.warden", titleKey: "epic.warden.t", sprite: "warden", glow: "#8a5fd0",
    hp: 310, contactDmg: 10, moveSpeed: 72, size: 158,
    phaseAt: [0.5], phaseSpeedup: 0.15,
    bg: ["#160e26", "#1e1230", "#0c0818"],
    attacks: [
      { kind: "shockwave", labelKey: "epic.mv.runewave", color: "#8a5fd0", windup: 0.6, active: 1.0, recovery: 0.55, range: 640, dmg: 17, speed: 300 },
      { kind: "projectile", labelKey: "epic.mv.bolt", color: "#c8a8ff", windup: 0.35, active: 2.4, recovery: 0.35, range: 950, dmg: 14, speed: 480 },
      { kind: "slam", labelKey: "epic.mv.seal", color: "#c8b0e0", windup: 0.7, active: 0.2, recovery: 0.85, range: 130, dmg: 24, maxDist: 160 },
      { kind: "volley", labelKey: "epic.mv.volley", color: "#c8a8ff", windup: 0.5, active: 1.9, recovery: 0.45, range: 950, dmg: 12, speed: 460, hits: 4, fromPhase: 1 },
      { kind: "spin", labelKey: "epic.mv.spin", color: "#8a5fd0", windup: 0.6, active: 0.24, recovery: 0.7, range: 150, dmg: 20, fromPhase: 1 },
    ],
    intro: intro("warden", "#8a5fd0", "epic.warden",
      "Le Gardien des Sceaux revient, brisé mais debout.",
      "« Tu ne devrais pas être ici. Personne ne devrait. »"),
  },
  // 4 — L'ÉCHO DU RIVAL : duelliste agile, combos rapides, ruées. Le vrai test de skill.
  //     Phase 2 : tourbillon + plongeon traître. Il devient déloyal.
  {
    id: "rival", nameKey: "epic.rival", titleKey: "epic.rival.t", sprite: "rival", glow: "#c8a8ff",
    hp: 290, contactDmg: 10, moveSpeed: 132, size: 148,
    phaseAt: [0.5], phaseSpeedup: 0.18,
    bg: ["#1a1024", "#241436", "#100a1c"],
    attacks: [
      { kind: "combo", labelKey: "epic.mv.flurry", color: "#c8a8ff", windup: 0.4, active: 0.14, recovery: 0.7, range: 100, dmg: 11, hits: 3, maxDist: 120 },
      { kind: "dash", labelKey: "epic.mv.lunge", color: "#e0d0ff", windup: 0.42, active: 0.3, recovery: 0.6, range: 320, dmg: 19, speed: 780, minDist: 110 },
      { kind: "projectile", labelKey: "epic.mv.crescent", color: "#a87fe0", windup: 0.4, active: 2.0, recovery: 0.45, range: 900, dmg: 14, speed: 520 },
      { kind: "spin", labelKey: "epic.mv.spin", color: "#c8a8ff", windup: 0.5, active: 0.2, recovery: 0.6, range: 140, dmg: 18, fromPhase: 1 },
      { kind: "dive", labelKey: "epic.mv.dive", color: "#e0d0ff", windup: 1.15, active: 0.2, recovery: 0.6, range: 130, dmg: 22, fromPhase: 1 },
    ],
    intro: intro("rival", "#c8a8ff", "epic.rival",
      "Ton reflet t'attend, lame déjà tirée.",
      "« Voyons lequel de nous deux ment sur sa force. »"),
  },
  // 5 — L'AVATAR DE L'ABÎME : final. TOUTES les mécaniques, dévoilées phase après phase,
  //     jusqu'à l'ANÉANTISSEMENT — un plongeon cataclysmique qui déchaîne des ondes à l'impact.
  {
    id: "avatar", nameKey: "epic.avatar", titleKey: "epic.avatar.t", sprite: "avatar", glow: "#ff3050",
    hp: 440, contactDmg: 12, moveSpeed: 104, size: 182,
    phaseAt: [0.66, 0.33], phaseSpeedup: 0.12,
    bg: ["#1a0710", "#2a0c14", "#120508"],
    attacks: [
      // Phase 1 (base)
      { kind: "slam", labelKey: "epic.mv.cataclysm", color: "#c02840", windup: 0.7, active: 0.24, recovery: 0.7, range: 155, dmg: 26, maxDist: 190 },
      { kind: "dash", labelKey: "epic.mv.devour", color: "#ff5060", windup: 0.5, active: 0.34, recovery: 0.6, range: 380, dmg: 22, speed: 780, minDist: 120 },
      { kind: "shockwave", labelKey: "epic.mv.abyss", color: "#7a1020", windup: 0.6, active: 1.0, recovery: 0.6, range: 700, dmg: 18, speed: 340 },
      { kind: "projectile", labelKey: "epic.mv.void", color: "#ff6a7a", windup: 0.35, active: 2.2, recovery: 0.4, range: 960, dmg: 15, speed: 520 },
      // Phase 2 (dévoile)
      { kind: "combo", labelKey: "epic.mv.rend", color: "#ff9090", windup: 0.36, active: 0.14, recovery: 0.6, range: 115, dmg: 12, hits: 3, maxDist: 125, fromPhase: 1 },
      { kind: "volley", labelKey: "epic.mv.meteor", color: "#ff6a7a", windup: 0.5, active: 2.0, recovery: 0.45, range: 960, dmg: 13, speed: 500, hits: 4, fromPhase: 1 },
      { kind: "spin", labelKey: "epic.mv.spin", color: "#ff5060", windup: 0.5, active: 0.24, recovery: 0.6, range: 160, dmg: 20, fromPhase: 1 },
      { kind: "dive", labelKey: "epic.mv.skyfall", color: "#ff5060", windup: 1.2, active: 0.24, recovery: 0.6, range: 150, dmg: 24, fromPhase: 1 },
      // Phase 3 (l'ultime)
      { kind: "dive", labelKey: "epic.mv.annihilation", color: "#ff3050", windup: 1.4, active: 0.3, recovery: 0.95, range: 200, dmg: 30, fromPhase: 2 },
    ],
    intro: intro("avatar", "#ff3050", "epic.avatar",
      "L'Abîme prend chair. Le sol lui-même retient son souffle.",
      "« J'ai dévoré des mondes. Tu seras une miette. »"),
  },

  // ====================================================================
  //  COLOSSES SECRETS — révélés seulement après avoir vaincu les 5 premiers.
  //  Apparences ET mécaniques d'un autre niveau : téléportation, bullet-hell,
  //  rayons balayants, feu croisé spectral. On ne recycle rien.
  // ====================================================================

  // 6 — LE TISSEUR DE NÉANT : entité eldritch flottante. Se téléporte, sème des runes
  //     qui explosent (bullet-hell), et en phase 2 déchaîne rayon de vide + spectres en tenaille.
  {
    id: "voidweaver", nameKey: "epic.voidweaver", titleKey: "epic.voidweaver.t", sprite: "voidweaver", glow: "#9a6aff",
    hp: 340, contactDmg: 10, moveSpeed: 60, size: 168,
    phaseAt: [0.55], phaseSpeedup: 0.12,
    bg: ["#0c0a1e", "#140e2c", "#070510"],
    attacks: [
      { kind: "projectile", labelKey: "epic.mv.voidbolt", color: "#9a6aff", windup: 0.4, active: 2.4, recovery: 0.4, range: 950, dmg: 15, speed: 510 },
      { kind: "teleport", labelKey: "epic.mv.blink", color: "#c8a8ff", windup: 0.5, active: 0.22, recovery: 0.5, range: 120, dmg: 20 },
      { kind: "zones", labelKey: "epic.mv.runezone", color: "#78dcff", windup: 0.5, active: 0.24, recovery: 0.7, range: 0, dmg: 18, hits: 6 },
      { kind: "beam", labelKey: "epic.mv.voidbeam", color: "#9a6aff", windup: 0.9, active: 2.6, recovery: 0.7, range: 48, dmg: 16, speed: 380, fromPhase: 1 },
      { kind: "phantom", labelKey: "epic.mv.spectres", color: "#c8a8ff", windup: 0.5, active: 0.3, recovery: 0.6, range: 0, dmg: 14, hits: 3, speed: 480, fromPhase: 1 },
    ],
    intro: intro("voidweaver", "#9a6aff", "epic.voidweaver",
      "L'air se déchire. Un œil s'ouvre là où il n'y avait rien.",
      "« Tu regardes le vide. Le vide te regarde en retour. »"),
  },
  // 7 — LA CHIMÈRE D'OS : bête sauvage et véloce. Ruées, morsures en rafale, pluie de météores,
  //     et en phase 2 échos d'os (spectres) + bond fracassant. La pression permanente.
  {
    id: "bonechimera", nameKey: "epic.bonechimera", titleKey: "epic.bonechimera.t", sprite: "bonechimera", glow: "#ff5a30",
    hp: 360, contactDmg: 12, moveSpeed: 130, size: 176,
    phaseAt: [0.5], phaseSpeedup: 0.16,
    bg: ["#1a1206", "#241a0a", "#0d0904"],
    attacks: [
      { kind: "dash", labelKey: "epic.mv.rampage", color: "#ff5a30", windup: 0.42, active: 0.34, recovery: 0.5, range: 380, dmg: 22, speed: 820, minDist: 120 },
      { kind: "combo", labelKey: "epic.mv.maw", color: "#ff8a60", windup: 0.36, active: 0.14, recovery: 0.6, range: 120, dmg: 12, hits: 3, maxDist: 130 },
      { kind: "rain", labelKey: "epic.mv.meteorstorm", color: "#ff6a40", windup: 0.5, active: 0.3, recovery: 0.7, range: 0, dmg: 15, hits: 8 },
      { kind: "phantom", labelKey: "epic.mv.boneechoes", color: "#ffb090", windup: 0.5, active: 0.3, recovery: 0.55, range: 0, dmg: 14, hits: 3, speed: 500, fromPhase: 1 },
      { kind: "dive", labelKey: "epic.mv.pounce", color: "#ff5a30", windup: 1.05, active: 0.22, recovery: 0.55, range: 140, dmg: 24, fromPhase: 1 },
      { kind: "spin", labelKey: "epic.mv.spin", color: "#ff8a60", windup: 0.45, active: 0.2, recovery: 0.55, range: 150, dmg: 20, fromPhase: 1 },
    ],
    intro: intro("bonechimera", "#ff5a30", "epic.bonechimera",
      "Un fracas d'ossements. Trois gueules hurlent d'une seule voix.",
      "« VIANDE. ENFIN. »"),
  },
  // 8 — L'ORIGINE : le vrai final secret. Tyran cosmique aux TROIS phases, possède TOUT
  //     l'arsenal du Panthéon dévoilé phase après phase, jusqu'à l'OUBLI — un plongeon
  //     apocalyptique qui libère des ondes. Le combat ultime.
  {
    id: "origin", nameKey: "epic.origin", titleKey: "epic.origin.t", sprite: "origin", glow: "#ffd84a",
    hp: 560, contactDmg: 14, moveSpeed: 112, size: 192,
    phaseAt: [0.66, 0.33], phaseSpeedup: 0.11,
    bg: ["#1a0a04", "#2a1408", "#0a0604"],
    attacks: [
      // Phase 1 — le jugement
      { kind: "slam", labelKey: "epic.mv.genesis", color: "#ffd84a", windup: 0.68, active: 0.24, recovery: 0.62, range: 165, dmg: 26, maxDist: 205 },
      { kind: "dash", labelKey: "epic.mv.smite", color: "#ffb020", windup: 0.46, active: 0.32, recovery: 0.55, range: 400, dmg: 22, speed: 830, minDist: 120 },
      { kind: "projectile", labelKey: "epic.mv.starbolt", color: "#fff0a0", windup: 0.34, active: 2.2, recovery: 0.36, range: 960, dmg: 15, speed: 560 },
      { kind: "beam", labelKey: "epic.mv.judgment", color: "#ffd84a", windup: 0.85, active: 2.5, recovery: 0.6, range: 52, dmg: 18, speed: 410 },
      // Phase 2 — l'ascension
      { kind: "zones", labelKey: "epic.mv.singularity", color: "#ff5a30", windup: 0.5, active: 0.26, recovery: 0.6, range: 0, dmg: 18, hits: 7, fromPhase: 1 },
      { kind: "teleport", labelKey: "epic.mv.warp", color: "#fff0a0", windup: 0.42, active: 0.22, recovery: 0.5, range: 135, dmg: 20, fromPhase: 1 },
      { kind: "spin", labelKey: "epic.mv.spin", color: "#ffb020", windup: 0.46, active: 0.24, recovery: 0.55, range: 168, dmg: 20, fromPhase: 1 },
      { kind: "combo", labelKey: "epic.mv.rend", color: "#ff9090", windup: 0.34, active: 0.14, recovery: 0.55, range: 122, dmg: 12, hits: 3, maxDist: 132, fromPhase: 1 },
      // Phase 3 — l'apocalypse
      { kind: "rain", labelKey: "epic.mv.starfall", color: "#ffd84a", windup: 0.5, active: 0.3, recovery: 0.6, range: 0, dmg: 16, hits: 10, fromPhase: 2 },
      { kind: "phantom", labelKey: "epic.mv.legion", color: "#fff0a0", windup: 0.5, active: 0.3, recovery: 0.55, range: 0, dmg: 15, hits: 3, speed: 540, fromPhase: 2 },
      { kind: "dive", labelKey: "epic.mv.oblivion", color: "#ff3050", windup: 1.3, active: 0.3, recovery: 0.9, range: 210, dmg: 30, fromPhase: 2 },
    ],
    intro: intro("origin", "#ffd84a", "epic.origin",
      "Avant les Sceaux, avant l'Abîme, avant le premier cri — il était là.",
      "« Je suis ce qui reste quand tout le reste a brûlé. »"),
  },
];

// Les 5 premiers Colosses sont publics ; à partir de cet index, ils sont SECRETS
// (cachés jusqu'à ce que les 5 premiers soient vaincus et la révélation jouée).
export const EPIC_SECRET_START = 5;

// ===== Persistance des déblocages (clé dédiée, indépendante de la sauvegarde d'histoire) =====
const EPIC_KEY = "abyss-epic-v1";

interface EpicData { cleared: number; revealed?: boolean; ranks?: Record<number, string>; } // vaincus (0..8) + secrets + meilleurs rangs

function load(): EpicData {
  try {
    const raw = localStorage.getItem(EPIC_KEY);
    if (raw) return { cleared: 0, ...JSON.parse(raw) };
  } catch { }
  return { cleared: 0 };
}
function save(d: EpicData) {
  try { localStorage.setItem(EPIC_KEY, JSON.stringify(d)); } catch { }
}

// Nombre de niveaux jouables (les vaincus + le suivant), plafonné au total.
export function epicUnlockedCount(): number {
  return Math.min(EPIC_BOSSES.length, load().cleared + 1);
}
export function epicClearedCount(): number { return load().cleared; }
export function isEpicUnlocked(index: number): boolean { return index < epicUnlockedCount(); }
export function isEpicCleared(index: number): boolean { return index < load().cleared; }

// Marque le Colosse `index` comme vaincu (débloque le suivant). Idempotent.
export function markEpicCleared(index: number) {
  const d = load();
  if (index + 1 > d.cleared) { d.cleared = index + 1; save(d); }
}

// ===== Révélation des Colosses secrets =====
export function isEpicRevealed(): boolean { return !!load().revealed; }
// Les 5 premiers sont vaincus mais la cinématique de révélation n'a pas encore été jouée.
export function epicShouldReveal(): boolean {
  const d = load();
  return !d.revealed && d.cleared >= EPIC_SECRET_START;
}
export function markEpicRevealed() { const d = load(); d.revealed = true; save(d); }

// ===== Rangs de combat (S > A > B > C) : on ne garde que le meilleur =====
const RANK_ORDER = ["C", "B", "A", "S"];
export function epicBestRank(index: number): string | null { return load().ranks?.[index] ?? null; }
export function recordEpicRank(index: number, rank: string) {
  const d = load();
  d.ranks = d.ranks ?? {};
  const cur = d.ranks[index];
  if (cur === undefined || RANK_ORDER.indexOf(rank) > RANK_ORDER.indexOf(cur)) { d.ranks[index] = rank; save(d); }
}

// Nombre de cartes à afficher dans le menu : 5, ou les 8 une fois les secrets dévoilés.
export function epicVisibleCount(): number {
  return isEpicRevealed() ? EPIC_BOSSES.length : Math.min(EPIC_SECRET_START, EPIC_BOSSES.length);
}
