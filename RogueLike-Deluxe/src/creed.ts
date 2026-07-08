// ===== LE SERMENT — catalogue des choix moraux de campagne =====
// Chaque choix est un vrai embranchement : conséquence mécanique (build) + poids narratif
// (déplace l'axe `oath` de GameContext) + mémoire (choices[id]) que le reste du jeu relit.
// L'axe : Briser la Boucle (oath > 0) <—> Perpétuer la Boucle (oath < 0).
import type { GameContext } from "./context";

export interface CreedOption {
  id: string;
  labelKey: string;    // intitulé de la voie
  effectKey: string;   // conséquence mécanique, en une ligne
  flavorKey: string;   // ce que ce choix dit de toi
  oath: number;        // > 0 = briser, < 0 = perpétuer
  side: "break" | "perpetuate";
  apply: (ctx: GameContext) => void; // effets MÉCANIQUES uniquement (l'oath est géré à part)
}

export interface CreedChoice {
  id: string;
  titleKey: string;
  sprite?: string;
  spriteGlow?: string;
  quoteKey: string;    // réplique d'ambiance : le personnage te parle
  promptKey: string;   // la question posée
  options: [CreedOption, CreedOption]; // [voie de la Rupture (gauche), voie de l'Emprise (droite)]
}

const setTorvinMsg = (ctx: GameContext, key: string) => {
  const t = ctx.pnjs.find(n => n.name === "Torvin");
  t?.setMessageKey(key);
};

export const CREED_CHOICES: Record<string, CreedChoice> = {
  // ── Niveau 1 : la première rencontre du Rival donne le ton de toute la campagne ──
  rival_l1: {
    id: "rival_l1",
    titleKey: "creed.rival1.title",
    sprite: "rival",
    spriteGlow: "#8a3fd0",
    quoteKey: "creed.rival1.quote",
    promptKey: "creed.rival1.prompt",
    options: [
      {
        id: "hand", side: "break", oath: +2,
        labelKey: "creed.rival1.hand", effectKey: "creed.rival1.hand.fx", flavorKey: "creed.rival1.hand.flavor",
        apply: () => { /* la main tendue ne coûte ni ne rapporte de stat : c'est un serment */ },
      },
      {
        id: "blade", side: "perpetuate", oath: -2,
        labelKey: "creed.rival1.blade", effectKey: "creed.rival1.blade.fx", flavorKey: "creed.rival1.blade.flavor",
        apply: (ctx) => { ctx.player.modifyCritChance(+4); }, // la soif de gloire aiguise ta lame
      },
    ],
  },

  // ── Niveau 2 : Le Serment de Torvin (le prisonnier des Catacombes du Serment) ──
  torvin: {
    id: "torvin",
    titleKey: "creed.torvin.title",
    sprite: "warden",
    spriteGlow: "#8a5fd0",
    quoteKey: "creed.torvin.quote",
    promptKey: "creed.torvin.prompt",
    options: [
      {
        id: "free", side: "break", oath: +3,
        labelKey: "creed.torvin.free", effectKey: "creed.torvin.free.fx", flavorKey: "creed.torvin.free.flavor",
        apply: (ctx) => {
          ctx.prisonerFreed = true;
          ctx.player.modifyArmor(+1);
          ctx.player.modifyCritChance(+3);
          setTorvinMsg(ctx, "prisoner.thanks");
        },
      },
      {
        id: "seize", side: "perpetuate", oath: -3,
        labelKey: "creed.torvin.seize", effectKey: "creed.torvin.seize.fx", flavorKey: "creed.torvin.seize.flavor",
        apply: (ctx) => {
          // Tu arraches le pacte brisé qui nourrit la cellule : Torvin s'éteint, sa force passe en toi.
          ctx.player.modifyAttack(+3);
          ctx.player.modifyCritMultiplierPercent(+15);
          setTorvinMsg(ctx, "prisoner.forsaken");
        },
      },
    ],
  },

  // ── Niveau 5 : LE VERDICT — après avoir battu le Rival, tu décides de son sort ──
  rival_fate: {
    id: "rival_fate",
    titleKey: "creed.fate.title",
    sprite: "rival",
    spriteGlow: "#c02840",
    quoteKey: "creed.fate.quote",
    promptKey: "creed.fate.prompt",
    options: [
      {
        id: "spare", side: "break", oath: +3,
        labelKey: "creed.fate.spare", effectKey: "creed.fate.spare.fx", flavorKey: "creed.fate.spare.flavor",
        apply: (ctx) => ctx.resolveRivalFate(true),
      },
      {
        id: "slay", side: "perpetuate", oath: -3,
        labelKey: "creed.fate.slay", effectKey: "creed.fate.slay.fx", flavorKey: "creed.fate.slay.flavor",
        apply: (ctx) => ctx.resolveRivalFate(false),
      },
    ],
  },
};

export function getCreedChoice(id: string): CreedChoice | null {
  return CREED_CHOICES[id] ?? null;
}
