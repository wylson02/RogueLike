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

  // Niveau 2 — Les Catacombes du Serment. Vrai labyrinthe tressé : tout est mur,
  // on CREUSE 4 salles-repères + des couloirs qui serpentent + des IMPASSES qui
  // payent (trésor ou piège au bout). Deux boucles pour ne pas être un pur arbre.
  // Ancres préservées : départ (1,11), sortie (33,18), coffre-prison (28,4).
  level2(): GameMap {
    const F = Tile.Floor;
    const b = new MapBuilder(35, 22).drawRect(0, 0, 35, 22, Tile.Wall);
    // Creuse un couloir 1-large le long d'une polyligne (segments horiz./vert.).
    const carve = (pts: [number, number][]) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        if (x1 === x2) for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) b.setTile(x1, y, F);
        else for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) b.setTile(x, y1, F);
      }
    };

    // ---- Salles-repères ----
    b.drawRect(14, 10, 5, 4, F);  // Rotonde centrale (x14-18, y10-13)
    b.drawRect(26, 2, 5, 4, F);   // Quartier-prison NE — Torvin + coffre (x26-30, y2-5)
    b.drawRect(2, 16, 5, 4, F);   // Salle-refuge SO — Orin & Aelis (x2-6, y16-19)
    b.drawRect(29, 16, 5, 4, F);  // Salle de la sortie SE — gargouille (x29-33, y16-19)

    // ---- Couloirs principaux (serpentent) ----
    carve([[1, 11], [4, 11], [4, 8], [8, 8], [8, 12], [11, 12], [11, 11], [14, 11]]); // départ → rotonde
    carve([[17, 10], [17, 7], [13, 7], [13, 4], [18, 4], [18, 7], [22, 7], [22, 4], [26, 4]]); // rotonde → prison (nord)
    carve([[15, 13], [15, 17], [6, 17]]);                     // rotonde → sud → refuge
    carve([[18, 12], [23, 12], [23, 17], [29, 17]]);          // rotonde → est → sortie
    carve([[30, 5], [30, 11], [24, 11], [24, 12], [23, 12]]); // prison → sud → route est (BOUCLE)

    // ---- Impasses qui payent (trésor / piège au bout) ----
    carve([[4, 8], [4, 4], [2, 4]]);      // impasse NO → coffre (2,4)
    carve([[8, 8], [8, 4]]);              // impasse N → piège (8,4)
    carve([[13, 4], [10, 4], [10, 2]]);   // impasse N → coffre (10,2)
    carve([[18, 7], [18, 9]]);            // courte impasse (piège 18,9)
    carve([[23, 14], [27, 14]]);          // impasse est → piège (27,14)
    carve([[15, 15], [11, 15], [11, 19]]);// impasse sud → coffre (11,19)
    carve([[3, 16], [3, 14]]);            // impasse refuge (piège 3,14)
    carve([[29, 18], [26, 18], [26, 20]]);// impasse SE (piège 26,20)

    b.setTile(33, 18, Tile.Exit);
    return b.build();
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
