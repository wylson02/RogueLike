// ===== Gestionnaire de scènes + transitions =====
import { VW, VH } from "./render";

export interface Scene {
  update(dt: number): void;
  draw(g: CanvasRenderingContext2D): void;
  enter?(): void;
}

class SceneManagerCls {
  private stack: Scene[] = [];
  private fade = 0;          // 0..1 opacité du voile
  private fadeDir = 0;       // 1 = fondu sortant, -1 = fondu entrant
  private pending: (() => void) | null = null;
  fadeSpeed = 3.2;

  get current(): Scene | null { return this.stack[this.stack.length - 1] ?? null; }

  /** remplace toute la pile avec fondu */
  switchTo(make: () => Scene) {
    this.pending = () => { this.stack = [make()]; this.current?.enter?.(); };
    this.fadeDir = 1;
  }
  /** remplace sans fondu */
  switchNow(s: Scene) { this.stack = [s]; s.enter?.(); }
  /** superpose (pause, inventaire…) */
  push(s: Scene) { this.stack.push(s); s.enter?.(); }
  pop() { this.stack.pop(); }

  update(dt: number) {
    if (this.fadeDir !== 0) {
      this.fade += this.fadeDir * dt * this.fadeSpeed;
      if (this.fade >= 1 && this.pending) {
        this.fade = 1;
        this.pending();
        this.pending = null;
        this.fadeDir = -1;
      } else if (this.fade <= 0 && this.fadeDir === -1) {
        this.fade = 0; this.fadeDir = 0;
      }
    }
    if (this.fadeDir !== 1) this.current?.update(dt);
  }

  draw(g: CanvasRenderingContext2D) {
    // les scènes sous-jacentes sont dessinées pour les overlays
    for (const s of this.stack) s.draw(g);
    if (this.fade > 0) {
      g.fillStyle = `rgba(5,4,10,${Math.min(1, this.fade)})`;
      g.fillRect(0, 0, VW, VH);
    }
  }
}

export const SceneManager = new SceneManagerCls();

// ===== Helpers UI partagés =====
export function panel(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, title?: string) {
  g.fillStyle = "rgba(12,9,20,.92)";
  g.beginPath(); g.roundRect(x, y, w, h, 10); g.fill();
  g.strokeStyle = "rgba(150,140,190,.5)";
  g.lineWidth = 2;
  g.beginPath(); g.roundRect(x, y, w, h, 10); g.stroke();
  g.strokeStyle = "rgba(150,140,190,.18)";
  g.beginPath(); g.roundRect(x + 4, y + 4, w - 8, h - 8, 7); g.stroke();
  if (title) {
    g.font = `bold 18px 'Courier New',monospace`;
    const tw = g.measureText(title).width + 28;
    g.fillStyle = "#1c1430";
    g.beginPath(); g.roundRect(x + (w - tw) / 2, y - 14, tw, 28, 6); g.fill();
    g.strokeStyle = "rgba(180,160,220,.6)";
    g.beginPath(); g.roundRect(x + (w - tw) / 2, y - 14, tw, 28, 6); g.stroke();
    g.fillStyle = "#e8d8a0";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(title, x + w / 2, y + 1);
  }
}

export function dimBackground(g: CanvasRenderingContext2D, a = 0.6) {
  g.fillStyle = `rgba(5,4,10,${a})`;
  g.fillRect(0, 0, VW, VH);
}
