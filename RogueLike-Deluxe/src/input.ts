// ===== Entrées clavier + manette =====
import { Dir } from "./core";

export type GameKey =
  | "up" | "down" | "left" | "right"
  | "confirm" | "cancel" | "inventory" | "progression"
  | "act1" | "act2" | "act3" | "act4" | "tabL" | "tabR";

class InputSys {
  private pressed = new Set<GameKey>();       // appuis "frais" (consommés une fois)
  private held = new Set<GameKey>();
  private repeatTimers = new Map<GameKey, number>();
  private padPrev: Record<number, boolean> = {};
  private padAxisPrev = { x: 0, y: 0 };
  onAny: (() => void) | null = null;

  attach(el: HTMLElement) {
    window.addEventListener("keydown", (e) => {
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

  private mapKey(e: KeyboardEvent): GameKey | null {
    switch (e.code) {
      case "ArrowUp": case "KeyW": return "up";       // W = Z sur AZERTY (position physique)
      case "ArrowDown": case "KeyS": return "down";
      case "ArrowLeft": case "KeyA": return "left";   // A = Q sur AZERTY
      case "ArrowRight": case "KeyD": return "right";
      case "Enter": case "Space": case "NumpadEnter": return "confirm";
      case "Escape": return "cancel";
      case "KeyI": return "inventory";
      case "KeyC": case "KeyP": return "progression";
      case "Digit1": case "Numpad1": return "act1";
      case "Digit2": case "Numpad2": return "act2";
      case "Digit3": case "Numpad3": return "act3";
      case "Digit4": case "Numpad4": return "act4";
      case "KeyH": return "act2";  // Soigner
      case "KeyF": return "act4";  // Fuir
      case "KeyQ": return "tabL";
      case "KeyE": return "tabR";
      default: return null;
    }
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

  clear() { this.pressed.clear(); }
}

export const Input = new InputSys();
