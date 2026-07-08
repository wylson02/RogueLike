// ===== Compétences de combat : la COUTURE entre le système (gameplay) et le contenu (univers) =====
// - Le SYSTÈME (moteur) exécute les `SkillOp` ci-dessous : c'est la palette de briques.
// - Le CONTENU se contente d'ASSEMBLER des `Skill` à partir de ces briques + des textes i18n,
//   sans toucher au moteur. Ajouter une compétence = ajouter une entrée dans SKILLS.
import type { ClassId, StatusKind } from "./entities";

// ---- Briques d'effet (la palette figée que le contenu peut composer) ----
export type SkillOp =
  // inflige des dégâts (mult = multiplicateur de l'ATK). sig = joue l'animation signature de la classe.
  | { t: "dmg"; mult: number; pierce?: boolean; autoCrit?: boolean; sig?: boolean }
  // applique un statut existant (poison/stun/burn/bleed/chill) sur l'ennemi ou soi
  | { t: "status"; who: "enemy" | "self"; kind: StatusKind; turns: number; power?: number }
  // brise l'armure de l'ennemi
  | { t: "armorBreak"; amount: number }
  // se cuirasse (armure sur soi)
  | { t: "selfArmor"; amount: number }
  // se met en garde (tours d'esquive)
  | { t: "dodge"; turns: number }
  // se soigne
  | { t: "heal"; amount: number };

export interface Skill {
  id: string;
  classId: ClassId;      // kit de base auquel appartient la compétence
  nameKey: string;       // i18n (contenu)
  descKey: string;       // i18n (contenu)
  cost: number;          // coût en Énergie
  ops: SkillOp[];        // ce qu'elle fait (composé de briques)
  color: string;         // teinte de la bannière / UI
}

// ===== Catalogue — le CONTENU remplit/étend ceci (bouchons de Phase 1 pour tester la couture) =====
export const SKILLS: Record<string, Skill> = {
  // ---- Guerrier ----
  w_smash: {
    id: "w_smash", classId: "warrior", nameKey: "skill.w_smash.name", descKey: "skill.w_smash.desc",
    cost: 3, color: "#ffae57", ops: [{ t: "dmg", mult: 3, sig: true }],
  },
  w_break: {
    id: "w_break", classId: "warrior", nameKey: "skill.w_break.name", descKey: "skill.w_break.desc",
    cost: 2, color: "#d0d0d8", ops: [{ t: "dmg", mult: 1.2 }, { t: "armorBreak", amount: 3 }],
  },
  w_bulwark: {
    id: "w_bulwark", classId: "warrior", nameKey: "skill.w_bulwark.name", descKey: "skill.w_bulwark.desc",
    cost: 2, color: "#8fd4ff", ops: [{ t: "selfArmor", amount: 4 }, { t: "dodge", turns: 2 }],
  },
  w_rally: { // enrichissement : un second souffle (soin + garde) pour tenir dans la durée
    id: "w_rally", classId: "warrior", nameKey: "skill.w_rally.name", descKey: "skill.w_rally.desc",
    cost: 3, color: "#ffcf7a", ops: [{ t: "heal", amount: 8 }, { t: "selfArmor", amount: 3 }],
  },
  // ---- Mage ----
  m_bolt: {
    id: "m_bolt", classId: "mage", nameKey: "skill.m_bolt.name", descKey: "skill.m_bolt.desc",
    cost: 3, color: "#b6a6ff", ops: [{ t: "dmg", mult: 2.2, pierce: true, sig: true }],
  },
  m_frost: {
    id: "m_frost", classId: "mage", nameKey: "skill.m_frost.name", descKey: "skill.m_frost.desc",
    cost: 2, color: "#7ad4ff", ops: [{ t: "dmg", mult: 1 }, { t: "status", who: "enemy", kind: "chill", turns: 3, power: 3 }],
  },
  m_ember: {
    id: "m_ember", classId: "mage", nameKey: "skill.m_ember.name", descKey: "skill.m_ember.desc",
    cost: 2, color: "#ff7a3a", ops: [{ t: "status", who: "enemy", kind: "burn", turns: 3, power: 3 }],
  },
  m_nova: { // enrichissement : une déflagration de cendres (impact + brûlure prolongée)
    id: "m_nova", classId: "mage", nameKey: "skill.m_nova.name", descKey: "skill.m_nova.desc",
    cost: 3, color: "#ff9a4a", ops: [{ t: "dmg", mult: 1.8 }, { t: "status", who: "enemy", kind: "burn", turns: 3, power: 3 }],
  },
  // ---- Voleur ----
  r_assassinate: {
    id: "r_assassinate", classId: "rogue", nameKey: "skill.r_assassinate.name", descKey: "skill.r_assassinate.desc",
    cost: 3, color: "#ffd84a", ops: [{ t: "dmg", mult: 1, autoCrit: true, sig: true }, { t: "dodge", turns: 2 }],
  },
  r_expose: {
    id: "r_expose", classId: "rogue", nameKey: "skill.r_expose.name", descKey: "skill.r_expose.desc",
    cost: 2, color: "#c8a8ff", ops: [{ t: "dmg", mult: 1 }, { t: "armorBreak", amount: 3 }],
  },
  r_venom: {
    id: "r_venom", classId: "rogue", nameKey: "skill.r_venom.name", descKey: "skill.r_venom.desc",
    cost: 2, color: "#7ae87a", ops: [{ t: "dmg", mult: 1 }, { t: "status", who: "enemy", kind: "poison", turns: 3, power: 2 }],
  },
  r_eviscerate: { // enrichissement : une frappe qui éviscère (impact + saignement fort)
    id: "r_eviscerate", classId: "rogue", nameKey: "skill.r_eviscerate.name", descKey: "skill.r_eviscerate.desc",
    cost: 3, color: "#ff4a6a", ops: [{ t: "dmg", mult: 1.6 }, { t: "status", who: "enemy", kind: "bleed", turns: 4, power: 3 }],
  },

  // ===== Compétences UNIQUES offertes par des PNJ (hors kit de classe) =====
  // Elles ne figurent dans AUCUN kit de départ (voir STARTER_KITS) : seul un PNJ peut te les enseigner,
  // et toute classe peut les apprendre. Chacune porte la marque de celui qui la transmet.
  pnj_orin_wall: { // Orin, le vétéran des Catacombes : la garde qui l'a gardé en vie
    id: "pnj_orin_wall", classId: "warrior", nameKey: "skill.pnj_orin_wall.name", descKey: "skill.pnj_orin_wall.desc",
    cost: 2, color: "#b8c0d0", ops: [{ t: "selfArmor", amount: 5 }, { t: "dodge", turns: 2 }],
  },
  pnj_aelis_breath: { // Aelis, dont les mains ne tiennent plus la lame mais referment les plaies
    id: "pnj_aelis_breath", classId: "mage", nameKey: "skill.pnj_aelis_breath.name", descKey: "skill.pnj_aelis_breath.desc",
    cost: 3, color: "#7ae8c8", ops: [{ t: "heal", amount: 14 }, { t: "selfArmor", amount: 2 }],
  },
  pnj_elya_sunder: { // Elya, l'érudite des sceaux : toute chose a sa faille
    id: "pnj_elya_sunder", classId: "mage", nameKey: "skill.pnj_elya_sunder.name", descKey: "skill.pnj_elya_sunder.desc",
    cost: 3, color: "#c8a8ff", ops: [{ t: "dmg", mult: 1.5 }, { t: "armorBreak", amount: 5 }, { t: "status", who: "enemy", kind: "chill", turns: 3, power: 2 }],
  },
  pnj_vesna_gambit: { // Vesna, survivante des Profondeurs : un seul coup, porté juste
    id: "pnj_vesna_gambit", classId: "rogue", nameKey: "skill.pnj_vesna_gambit.name", descKey: "skill.pnj_vesna_gambit.desc",
    cost: 3, color: "#ffd84a", ops: [{ t: "dmg", mult: 1.8, autoCrit: true }, { t: "dodge", turns: 2 }],
  },
};

// Kit de départ explicite par classe (compétences enrichies : 4 par classe).
// Les compétences uniques de PNJ n'y figurent PAS — c'est ce qui les garde uniques.
const STARTER_KITS: Record<ClassId, string[]> = {
  warrior: ["w_smash", "w_break", "w_bulwark", "w_rally"],
  mage: ["m_bolt", "m_frost", "m_ember", "m_nova"],
  rogue: ["r_assassinate", "r_expose", "r_venom", "r_eviscerate"],
};

export function defaultKit(classId: ClassId): string[] {
  return [...STARTER_KITS[classId]];
}

// Quel PNJ enseigne quelle technique unique (nom du PNJ → id de compétence).
// Le branchement se fait dans context.ts, à la fin du dialogue du PNJ.
export const PNJ_SKILL_GIFTS: Record<string, string> = {
  Orin: "pnj_orin_wall",
  Aelis: "pnj_aelis_breath",
  Elya: "pnj_elya_sunder",
  Vesna: "pnj_vesna_gambit",
};
