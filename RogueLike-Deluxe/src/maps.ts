// ===== Cartes — port 1:1 de Domain/Catalogs/MapCatalog.cs =====
import { GameMap, MapBuilder, Tile } from "./core";

function drawRoom(b: MapBuilder, x: number, y: number, w: number, h: number) {
  for (let xx = x; xx < x + w; xx++) { b.setTile(xx, y, Tile.Wall); b.setTile(xx, y + h - 1, Tile.Wall); }
  for (let yy = y; yy < y + h; yy++) { b.setTile(x, yy, Tile.Wall); b.setTile(x + w - 1, yy, Tile.Wall); }
}

export const MapCatalog = {
  level1(): GameMap {
    const map = new MapBuilder(30, 18)
      .drawBorder(Tile.Wall)
      .drawRect(1, 4, 6, 1, Tile.Wall)
      .drawRect(13, 1, 1, 4, Tile.Wall)
      .drawRect(11, 5, 6, 1, Tile.Wall)
      .drawRect(11, 6, 1, 2, Tile.Wall)
      .drawRect(11, 9, 1, 2, Tile.Wall)
      .drawRect(11, 11, 6, 1, Tile.Wall)
      .drawRect(16, 5, 1, 6, Tile.Wall)
      .drawRect(13, 12, 1, 2, Tile.Wall)
      .drawRect(14, 13, 7, 1, Tile.Wall)
      .drawRect(14, 15, 7, 1, Tile.Wall)
      .drawRect(13, 15, 1, 2, Tile.Wall)
      .drawRect(1, 10, 5, 1, Tile.Wall)
      .drawRect(5, 10, 1, 7, Tile.Wall)
      .setTile(29, 8, Tile.Exit)
      .build();
    // Porte verrouillée vers l'armurerie (bas-gauche)
    map.set(5, 13, Tile.DoorClosed);
    return map;
  },

  level2(): GameMap {
    return new MapBuilder(35, 22)
      .drawBorder(Tile.Wall)
      .drawRect(1, 10, 5, 1, Tile.Wall)
      .drawRect(1, 12, 5, 1, Tile.Wall)
      .drawRect(7, 8, 1, 10, Tile.Wall)
      .drawRect(3, 14, 4, 1, Tile.Wall)
      .drawRect(1, 16, 4, 1, Tile.Wall)
      .drawRect(1, 19, 11, 1, Tile.Wall)
      .drawRect(8, 17, 6, 1, Tile.Wall)
      .drawRect(14, 15, 1, 5, Tile.Wall)
      .drawRect(16, 17, 1, 4, Tile.Wall)
      .drawRect(14, 15, 5, 1, Tile.Wall)
      .drawRect(19, 15, 1, 4, Tile.Wall)
      .drawRect(19, 20, 1, 1, Tile.Wall)
      .drawRect(21, 13, 1, 8, Tile.Wall)
      .drawRect(9, 13, 12, 1, Tile.Wall)
      .drawRect(9, 14, 1, 2, Tile.Wall)
      .drawRect(10, 15, 3, 1, Tile.Wall)
      .drawRect(8, 11, 9, 1, Tile.Wall)
      .drawRect(18, 11, 7, 1, Tile.Wall)
      .drawRect(24, 12, 1, 8, Tile.Wall)
      .drawRect(25, 19, 2, 1, Tile.Wall)
      .drawRect(29, 19, 5, 1, Tile.Wall)
      .drawRect(25, 11, 8, 1, Tile.Wall)
      .drawRect(32, 12, 1, 5, Tile.Wall)
      .drawRect(30, 12, 1, 7, Tile.Wall)
      .drawRect(26, 17, 4, 1, Tile.Wall)
      .drawRect(25, 15, 4, 1, Tile.Wall)
      .drawRect(26, 13, 4, 1, Tile.Wall)
      .drawRect(13, 8, 1, 3, Tile.Wall)
      .drawRect(14, 8, 7, 1, Tile.Wall)
      .drawRect(21, 8, 1, 3, Tile.Wall)
      .drawRect(5, 6, 1, 3, Tile.Wall)
      .drawRect(6, 6, 4, 1, Tile.Wall)
      .drawRect(9, 7, 1, 3, Tile.Wall)
      .drawRect(2, 4, 1, 5, Tile.Wall)
      .drawRect(3, 4, 9, 1, Tile.Wall)
      .drawRect(11, 5, 1, 5, Tile.Wall)
      .drawRect(12, 6, 12, 1, Tile.Wall)
      .drawRect(23, 7, 1, 4, Tile.Wall)
      .drawRect(1, 2, 12, 1, Tile.Wall)
      .drawRect(14, 3, 7, 1, Tile.Wall)
      .drawRect(21, 3, 1, 3, Tile.Wall)
      .drawRect(25, 2, 1, 8, Tile.Wall)
      .drawRect(26, 9, 7, 1, Tile.Wall)
      .drawRect(32, 10, 1, 1, Tile.Wall)
      .drawRect(14, 1, 10, 1, Tile.Wall)
      .drawRect(26, 2, 7, 1, Tile.Wall)
      .drawRect(27, 4, 7, 1, Tile.Wall)
      .drawRect(26, 6, 7, 1, Tile.Wall)
      .setTile(33, 18, Tile.Exit)
      .build();
  },

  level3(): GameMap {
    const b = new MapBuilder(44, 18).drawBorder(Tile.Wall);
    // Salle marchand (haut droite)
    drawRoom(b, 35, 5, 9, 6);
    // Salle boss (bas droite)
    drawRoom(b, 35, 10, 9, 6);
    // Portes sortie
    b.setTile(35, 7, Tile.DoorClosed);
    b.setTile(35, 11, Tile.DoorClosed);
    // Exit dans salle boss
    b.setTile(40, 12, Tile.Exit);
    // Salle centrale
    drawRoom(b, 18, 4, 8, 6);
    // Portes salle centrale
    b.setTile(18, 6, Tile.DoorClosed);
    b.setTile(25, 6, Tile.DoorClosed);
    b.setTile(21, 4, Tile.DoorClosed);
    b.setTile(21, 9, Tile.DoorClosed);
    // Obstacles
    b.drawRect(8, 6, 6, 1, Tile.Wall);
    b.drawRect(10, 12, 6, 1, Tile.Wall);
    b.drawRect(28, 12, 3, 1, Tile.Wall);
    b.drawRect(28, 3, 3, 1, Tile.Wall);
    return b.build();
  },

  // Donjon post-jeu : nef sombre à colonnades, le Dévoreur d'Âmes au fond
  level5Depths(): GameMap {
    const b = new MapBuilder(30, 19).drawBorder(Tile.Wall);
    for (const px of [7, 13, 19]) {
      b.drawRect(px, 4, 2, 2, Tile.Wall);
      b.drawRect(px, 13, 2, 2, Tile.Wall);
    }
    // alcôves latérales aux trésors
    b.drawRect(3, 5, 3, 1, Tile.Wall);
    b.drawRect(3, 13, 3, 1, Tile.Wall);
    // estrade du Dévoreur
    b.drawRect(24, 6, 1, 2, Tile.Wall);
    b.drawRect(24, 11, 1, 2, Tile.Wall);
    return b.build();
  },

  level4BossArena(): GameMap {
    const b = new MapBuilder(44, 19).drawBorder(Tile.Wall);
    b.drawRect(1, 7, 18, 1, Tile.Wall);
    b.drawRect(1, 11, 18, 1, Tile.Wall);
    b.drawRect(18, 8, 1, 3, Tile.Wall);
    drawRoom(b, 18, 6, 10, 7);
    b.setTile(18, 9, Tile.Floor);
    b.setTile(27, 9, Tile.Floor);
    drawRoom(b, 29, 4, 14, 11);
    b.drawRect(32, 6, 1, 2, Tile.Wall);
    b.drawRect(39, 6, 1, 2, Tile.Wall);
    b.drawRect(32, 11, 1, 2, Tile.Wall);
    b.drawRect(39, 11, 1, 2, Tile.Wall);
    b.drawRect(40, 8, 2, 3, Tile.Wall);
    return b.build();
  },
};
