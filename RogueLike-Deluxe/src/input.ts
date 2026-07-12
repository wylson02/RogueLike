// ===== Entrées clavier + manette =====
import { Dir } from "./core";

export type GameKey =
  | "up" | "down" | "left" | "right"
  | "confirm" | "cancel" | "inventory" | "progression" | "map"
  | "act1" | "act2" | "act3" | "act4" | "act5" | "act6" | "tabL" | "tabR";

// Liaisons par défaut : chaque action accepte plusieurs codes physiques (QWERTY/AZERTY, flèches, pavé).
export const DEFAULT_BINDS: Record<GameKey, string[]> = {
  up: ["ArrowUp", "KeyW"], down: ["ArrowDown", "KeyS"], left: ["ArrowLeft", "KeyA"], right: ["ArrowRight", "KeyD"],
  confirm: ["Enter", "Space", "NumpadEnter"], cancel: ["Escape"],
  inventory: ["KeyI"], progression: ["KeyC", "KeyP"], map: ["KeyM"],
  act1: ["Digit1", "Numpad1"], act2: ["Digit2", "Numpad2", "KeyH"], act3: ["Digit3", "Numpad3"],
  act4: ["Digit4", "Numpad4", "KeyF"], act5: ["Digit5", "Numpad5"], act6: ["Digit6", "Numpad6"],
  tabL: ["KeyQ"], tabR: ["KeyE"],
};

// Ordre d'affichage dans l'écran de remappage.
// Valider (confirm) et Annuler (cancel) sont VOLONTAIREMENT absents : ce sont les touches qui
// pilotent les menus — les laisser remappables permettrait de se bloquer (soft-lock).
export const BIND_ORDER: GameKey[] = [
  "up", "down", "left", "right",
  "act1", "act2", "act3", "act4", "act5", "act6", "tabL", "tabR", "inventory", "progression", "map",
];

// Actions qui doivent TOUJOURS garder au moins une touche (sinon on ne peut plus opérer les menus).
const ESSENTIAL: GameKey[] = ["up", "down", "confirm", "cancel"];

// Nom lisible d'un code clavier pour l'UI.
export function codeLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "Pav." + code.slice(6);
  if (code.startsWith("Arrow")) return { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" }[code] ?? code;
  return { Space: "ESPACE", Enter: "ENTRÉE", NumpadEnter: "Pav.ENTR", Escape: "ÉCHAP" }[code] ?? code;
}

class InputSys {
  private pressed = new Set<GameKey>();       // appuis "frais" (consommés une fois)
  private held = new Set<GameKey>();
  private repeatTimers = new Map<GameKey, number>();
  private padPrev: Record<number, boolean> = {};
  private padAxisPrev = { x: 0, y: 0 };
  private codeMap = new Map<string, GameKey>(); // code physique → action (reconstruit au remappage)
  private captureCb: ((code: string) => void) | null = null; // capture d'une touche (écran de réglages)
  onAny: (() => void) | null = null;

  attach(el: HTMLElement) {
    this.applyBindings(); // liaisons par défaut ; main.ts réapplique celles sauvegardées
    window.addEventListener("keydown", (e) => {
      // Capture pour le remappage : on avale la prochaine touche brute.
      if (this.captureCb) { e.preventDefault(); const cb = this.captureCb; this.captureCb = null; cb(e.code); return; }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab"].includes(e.code)) e.preventDefault();
      const k = this.mapKey(e);
      if (!k) return;
      if (!this.held.has(k)) { this.held.add(k); this.press(k); }
      this.onAny?.();
    });
    window.addEventListener("keyup", (e) => {
      const k = this.mapKey(e);
      if (k) this.held.delete(k);
    });
    window.addEventListener("blur", () => { this.held.clear(); });
    el.focus();
    el.addEventListener("click", () => el.focus());
  }

  // Calcule les liaisons effectives (défauts + surcharges), sans les committer.
  // Une surcharge remplace la touche de l'action et la retire de toute autre action (pas de doublon).
  private computeBinds(overrides?: Record<string, string>): Record<GameKey, string[]> {
    const binds: Record<GameKey, string[]> = {} as any;
    for (const k of Object.keys(DEFAULT_BINDS) as GameKey[]) binds[k] = [...DEFAULT_BINDS[k]];
    if (overrides) {
      for (const [action, code] of Object.entries(overrides)) {
        if (!(action in binds)) continue;
        for (const k of Object.keys(binds) as GameKey[]) binds[k] = binds[k].filter(c => c !== code);
        binds[action as GameKey] = [code];
      }
    }
    return binds;
  }

  // Reconstruit la table code→action à partir des défauts + surcharges du joueur.
  applyBindings(overrides?: Record<string, string>) {
    const binds = this.computeBinds(overrides);
    this.codeMap.clear();
    for (const k of Object.keys(binds) as GameKey[]) for (const c of binds[k]) this.codeMap.set(c, k);
  }

  // Un jeu de surcharges est-il sûr ? (aucune touche essentielle laissée orpheline → pas de soft-lock)
  validateBinds(overrides: Record<string, string>): boolean {
    const binds = this.computeBinds(overrides);
    return ESSENTIAL.every(a => binds[a].length > 0);
  }

  // Touche actuellement liée à une action (pour l'affichage).
  boundCode(action: GameKey): string {
    for (const [code, k] of this.codeMap) if (k === action) return code;
    return "—";
  }

  // Capture la prochaine touche pressée (écran de remappage).
  captureNext(cb: (code: string) => void) { this.captureCb = cb; }

  private mapKey(e: KeyboardEvent): GameKey | null {
    return this.codeMap.get(e.code) ?? null;
  }

  private press(k: GameKey) { this.pressed.add(k); }

  // Manette : à appeler chaque frame
  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && pads[0];
    if (!gp) return;
    const btn = (i: number) => !!gp.buttons[i]?.pressed;
    const fresh = (i: number, k: GameKey) => {
      const now = btn(i);
      if (now && !this.padPrev[i]) { this.press(k); this.held.add(k); this.onAny?.(); }
      if (!now && this.padPrev[i]) this.held.delete(k);
      this.padPrev[i] = now;
    };
    fresh(12, "up"); fresh(13, "down"); fresh(14, "left"); fresh(15, "right");
    fresh(0, "confirm");   // A
    fresh(1, "cancel");    // B
    fresh(2, "inventory"); // X
    fresh(3, "progression"); // Y
    fresh(4, "tabL"); fresh(5, "tabR");
    fresh(6, "act5"); // gâchette gauche (LT)
    fresh(7, "act6"); // gâchette droite (RT)
    // Stick gauche
    const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
    const th = 0.55;
    const dx = ax > th ? 1 : ax < -th ? -1 : 0;
    const dy = ay > th ? 1 : ay < -th ? -1 : 0;
    if (dx !== this.padAxisPrev.x) {
      if (dx === 1) { this.press("right"); this.held.add("right"); } else this.held.delete("right");
      if (dx === -1) { this.press("left"); this.held.add("left"); } else if (dx === 0) this.held.delete("left");
      this.padAxisPrev.x = dx;
    }
    if (dy !== this.padAxisPrev.y) {
      if (dy === 1) { this.press("down"); this.held.add("down"); } else this.held.delete("down");
      if (dy === -1) { this.press("up"); this.held.add("up"); } else if (dy === 0) this.held.delete("up");
      this.padAxisPrev.y = dy;
    }
  }

  // Répétition pour le déplacement continu (grille)
  moveDir(now: number): Dir {
    const dirs: [GameKey, Dir][] = [["up", Dir.Up], ["down", Dir.Down], ["left", Dir.Left], ["right", Dir.Right]];
    for (const [k, d] of dirs) {
      if (this.pressed.has(k)) { this.pressed.delete(k); this.repeatTimers.set(k, now + 260); return d; }
    }
    for (const [k, d] of dirs) {
      if (this.held.has(k)) {
        const t = this.repeatTimers.get(k) ?? 0;
        if (now >= t) { this.repeatTimers.set(k, now + 125); return d; }
      }
    }
    return Dir.None;
  }

  consume(k: GameKey): boolean {
    if (this.pressed.has(k)) { this.pressed.delete(k); return true; }
    return false;
  }

  // Touche actuellement maintenue (nécessaire au combat temps réel du Panthéon)
  isDown(k: GameKey): boolean { return this.held.has(k); }

  clear() { this.pressed.clear(); }
}

export const Input = new InputSys();
