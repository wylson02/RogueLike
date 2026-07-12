// ===== Le Codex : bestiaire + échos de lore découverts =====
// Persistance GLOBALE (indépendante de la sauvegarde d'histoire, comme le Panthéon) :
// tout ce que tu as croisé au fil des parties reste consigné.

const CODEX_KEY = "abyss-codex-v1";

interface CodexData { kills: Record<string, number>; lore: string[]; }

function load(): CodexData {
  try {
    const raw = localStorage.getItem(CODEX_KEY);
    if (raw) return { kills: {}, lore: [], ...JSON.parse(raw) };
  } catch { }
  return { kills: {}, lore: [] };
}
function save(d: CodexData) {
  try { localStorage.setItem(CODEX_KEY, JSON.stringify(d)); } catch { }
}

export function codexRecordKill(nameKey: string) {
  const d = load();
  d.kills[nameKey] = (d.kills[nameKey] ?? 0) + 1;
  save(d);
}
export function codexKills(nameKey: string): number { return load().kills[nameKey] ?? 0; }

export function codexRecordLore(cineKey: string) {
  const d = load();
  if (!d.lore.includes(cineKey)) { d.lore.push(cineKey); save(d); }
}
export function codexLoreFound(): string[] { return load().lore; }

// ===== Bestiaire : les créatures de l'Abîme, dans l'ordre de la descente =====
export interface BestiaryEntry { nameKey: string; sprite: string; descKey: string; boss?: boolean; }
export const BESTIARY: BestiaryEntry[] = [
  { nameKey: "mob.slime", sprite: "slime", descKey: "codex.slime" },
  { nameKey: "mob.nightslime", sprite: "nightslime", descKey: "codex.nightslime" },
  { nameKey: "mob.spider", sprite: "spider", descKey: "codex.spider" },
  { nameKey: "mob.golem", sprite: "golem", descKey: "codex.golem" },
  { nameKey: "mob.gargoyle", sprite: "gargoyle", descKey: "codex.gargoyle" },
  { nameKey: "mob.gnawer", sprite: "spider", descKey: "codex.gnawer" },
  { nameKey: "mob.minotaur", sprite: "minotaur", descKey: "codex.minotaur", boss: true },
  { nameKey: "mob.warden", sprite: "warden", descKey: "codex.warden", boss: true },
  { nameKey: "mob.rival", sprite: "rival", descKey: "codex.rival", boss: true },
  { nameKey: "mob.boss", sprite: "boss", descKey: "codex.boss", boss: true },
  { nameKey: "mob.superboss", sprite: "avatar", descKey: "codex.superboss", boss: true },
  { nameKey: "mob.epicecho", sprite: "boss", descKey: "codex.epicecho" },
];

// Les échos de lore existants (pour le compteur X / total)
export const LORE_KEYS = ["lore.inscription1", "lore.inscription2", "lore.inscription3", "lore.rivaltrace", "lore.inscription5"];
