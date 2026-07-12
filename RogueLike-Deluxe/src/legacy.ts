// ===== L'Héritage de la Boucle : la mémoire qui survit aux morts =====
// Persistance GLOBALE (localStorage, comme le Codex/Panthéon) : chaque run laisse une trace
// que la suivante relit. Alimente : la mort diégétique (le monde se souvient), le Spectre de
// ta dernière run (ton cadavre à récupérer), et le Rival qui apprend TON style au fil des Boucles.

const LEGACY_KEY = "abyss-legacy-v1";

interface Spectre { level: number; x: number; y: number; gold: number; }
interface LegacyData {
  deaths: number;              // nombre de fois où la Boucle t'a repris
  lastDeath: Spectre | null;   // où tu es tombé la dernière fois (→ ton Spectre)
  aggro: number;               // profil : coups portés (offensif)
  def: number;                 // profil : esquives / soins / fuites (défensif)
  greed: number;               // profil : or thésaurisé
}

function load(): LegacyData {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) return { deaths: 0, lastDeath: null, aggro: 0, def: 0, greed: 0, ...JSON.parse(raw) };
  } catch { }
  return { deaths: 0, lastDeath: null, aggro: 0, def: 0, greed: 0 };
}
function save(d: LegacyData) {
  try { localStorage.setItem(LEGACY_KEY, JSON.stringify(d)); } catch { }
}

// Appelé à la mort (campagne) : consigne l'endroit + verse le profil de combat du run.
export function recordDeath(level: number, x: number, y: number, gold: number, aggro: number, def: number) {
  const d = load();
  d.deaths++;
  d.lastDeath = { level, x, y, gold };
  d.aggro += aggro;
  d.def += def;
  d.greed += gold >= 60 ? 2 : gold >= 25 ? 1 : 0;
  save(d);
}

export function legacyDeaths(): number { return load().deaths; }

// Y a-t-il un Spectre à récupérer sur CET étage ? (ta dépouille de la dernière run)
export function spectreFor(level: number): Spectre | null {
  const d = load();
  return d.lastDeath && d.lastDeath.level === level ? d.lastDeath : null;
}

// Le Spectre est récupéré : on efface la dépouille (une seule reprise possible).
export function clearSpectre() {
  const d = load();
  d.lastDeath = null;
  save(d);
}

// Le Rival a appris ta façon de te battre : trait dominant, ou null si trop peu de données.
export type Playstyle = "aggro" | "def" | "greed";
export function legacyPlaystyle(): Playstyle | null {
  const d = load();
  const total = d.aggro + d.def + d.greed;
  if (total < 12) return null; // il lui faut t'avoir vu vivre (et mourir) assez souvent
  const max = Math.max(d.aggro, d.def, d.greed);
  if (max === d.greed && d.greed > d.aggro && d.greed > d.def) return "greed";
  return d.aggro >= d.def ? "aggro" : "def";
}
