// ===== Système de quêtes =====
// État par quête, persistant en sauvegarde. "failed" est DÉFINITIF (le compagnon mort ne
// revient pas, la quête ne peut plus être refaite). Le contenu (définitions) est ci-dessous ;
// la logique de progression vit dans GameContext (start/complete/fail) et les scènes.
export type QuestStatus = "inactive" | "active" | "done" | "failed";

export interface QuestDef {
  id: string;
  nameKey: string;
  objectiveKey: string;   // objectif affiché dans le journal
  level: number;          // map où la quête se déroule
}

export const QUESTS: Record<string, QuestDef> = {
  // Escorte : un survivant blessé à ramener vivant jusqu'à la sortie.
  escort_bram: { id: "escort_bram", nameKey: "quest.escort.name", objectiveKey: "quest.escort.obj", level: 1 },
  // Clé : ouvrir l'armurerie verrouillée avec la clé de Lysa.
  armory: { id: "armory", nameKey: "quest.armory.name", objectiveKey: "quest.armory.obj", level: 1 },
  // Chasse : traquer et abattre une élite nommée.
  bounty_gnaw: { id: "bounty_gnaw", nameKey: "quest.bounty.name", objectiveKey: "quest.bounty.obj", level: 2 },
};

export function questDef(id: string): QuestDef | undefined { return QUESTS[id]; }
