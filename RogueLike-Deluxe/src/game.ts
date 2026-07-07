// ===== État global du jeu + navigation entre scènes (câblée par main.ts) =====
import { GameContext } from "./context";
import { WorldRenderer } from "./render";
import { Settings } from "./save";
import { ClassId } from "./entities";

export const G: {
  ctx: GameContext;
  world: WorldRenderer;
  settings: Settings;
} = {
  ctx: null as any,
  world: null as any,
  settings: { lang: "fr", musicVol: 0.7, sfxVol: 0.8 },
};

// Navigation — les implémentations sont assignées dans main.ts pour éviter les imports circulaires
export const Flow: {
  startNew: (classId: ClassId) => void;
  continueGame: () => void;
  toMenu: () => void;
  toExplore: () => void;
  startCombat: (monster: any) => void;
  bossEncounter: (monster: any) => void;
  loreCinematic: (cineKey: string) => void;
  bossIntroThenLevel4: () => void;
  depthsIntroThenLevel5: () => void;
  swordCinematic: () => void;
  endScreen: (victory: boolean, trueEnding?: boolean) => void;
  merchant: (merchant: any) => void;
  // ===== Descente Infinie =====
  endlessHub: () => void;
  startEndless: (classId: ClassId) => void;
  relicDraft: () => void;
  runSummary: () => void;
} = {} as any;
