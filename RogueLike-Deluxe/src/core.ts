// ===== Types de base, RNG, positions — port fidèle de Domain/ =====

export interface Pos { x: number; y: number; }
export const P = (x: number, y: number): Pos => ({ x, y });
export const eqPos = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;
export const key = (p: Pos) => p.x + "," + p.y;
export const manhattan = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export enum Dir { None, Up, Down, Left, Right }
export const DIRS4 = [Dir.Up, Dir.Down, Dir.Left, Dir.Right];

export function move(p: Pos, d: Dir): Pos {
  switch (d) {
    case Dir.Up: return P(p.x, p.y - 1);
    case Dir.Down: return P(p.x, p.y + 1);
    case Dir.Left: return P(p.x - 1, p.y);
    case Dir.Right: return P(p.x + 1, p.y);
    default: return P(p.x, p.y);
  }
}

export enum Tile { Floor, Wall, Exit, DoorClosed, DoorOpen }

// RNG — équivalent de System.Random (Next(min,max) : max exclusif)
export class RNG {
  private s: number;
  constructor(seed?: number) { this.s = (seed ?? (Date.now() ^ (Math.random() * 0xffffffff))) >>> 0; }
  private u32(): number {
    // xorshift32
    let x = this.s;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    this.s = x;
    return x;
  }
  float(): number { return this.u32() / 0x100000000; }
  next(minInc: number, maxExc: number): number {
    if (maxExc <= minInc) return minInc;
    return minInc + Math.floor(this.float() * (maxExc - minInc));
  }
  chance(percent: number): boolean { return this.next(0, 100) < percent; }
  pick<T>(arr: T[]): T { return arr[this.next(0, arr.length)]; }
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ===== Système jour/nuit — port de App/TimeSystem.cs =====
export class TimeSystem {
  tick = 0;
  isNight = false;
  readonly phaseLength: number;
  constructor(phaseLength = 24) { this.phaseLength = Math.max(4, phaseLength); }
  get progress01() { return (this.tick % this.phaseLength) / this.phaseLength; }
  advance(): boolean {
    this.tick++;
    if (this.tick % this.phaseLength === 0) { this.isNight = !this.isNight; return true; }
    return false;
  }
}

// ===== Carte — port de Domain/GameMap.cs + MapBuilder =====
export class GameMap {
  tiles: Tile[][];
  width: number; height: number;
  constructor(tiles: Tile[][]) {
    this.tiles = tiles;
    this.height = tiles.length;
    this.width = tiles[0].length;
  }
  inBounds(p: Pos) { return p.x >= 0 && p.y >= 0 && p.x < this.width && p.y < this.height; }
  get(p: Pos): Tile { return this.tiles[p.y][p.x]; }
  set(x: number, y: number, t: Tile) { if (this.inBounds(P(x, y))) this.tiles[y][x] = t; }
  isWalkable(p: Pos): boolean {
    if (!this.inBounds(p)) return false;
    const t = this.get(p);
    return t === Tile.Floor || t === Tile.Exit || t === Tile.DoorOpen;
  }
}

export class MapBuilder {
  private t: Tile[][];
  constructor(w: number, h: number) {
    this.t = Array.from({ length: h }, () => Array(w).fill(Tile.Floor));
  }
  drawBorder(tile: Tile): MapBuilder {
    const h = this.t.length, w = this.t[0].length;
    for (let x = 0; x < w; x++) { this.t[0][x] = tile; this.t[h - 1][x] = tile; }
    for (let y = 0; y < h; y++) { this.t[y][0] = tile; this.t[y][w - 1] = tile; }
    return this;
  }
  drawRect(x: number, y: number, w: number, h: number, tile: Tile): MapBuilder {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++)
        if (yy >= 0 && yy < this.t.length && xx >= 0 && xx < this.t[0].length)
          this.t[yy][xx] = tile;
    return this;
  }
  setTile(x: number, y: number, tile: Tile): MapBuilder {
    if (y >= 0 && y < this.t.length && x >= 0 && x < this.t[0].length) this.t[y][x] = tile;
    return this;
  }
  build(): GameMap { return new GameMap(this.t); }
}
