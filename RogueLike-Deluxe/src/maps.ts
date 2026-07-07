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

  // Niveau 2 — Les Catacombes du Serment. Labyrinthe designé : tout est mur,
  // on CREUSE salles + couloirs 1-large formant des boucles (routes tressées).
  // Ancres préservées : départ (1,11), sortie (33,18), coffre-prison (28,4).
  level2(): GameMap {
    const F = Tile.Floor;
    const b = new MapBuilder(35, 22).drawRect(0, 0, 35, 22, Tile.Wall);

    // ---- Salles (points de repère) ----
    b.drawRect(13, 9, 8, 5, F);   // Rotonde centrale (x13-20, y9-13)
    b.drawRect(2, 15, 7, 5, F);   // Salle-refuge SO — Orin & Aelis (x2-8, y15-19)
    b.drawRect(25, 2, 6, 5, F);   // Quartier-prison NE — Torvin + coffre (x25-30, y2-6)
    b.drawRect(27, 15, 7, 5, F);  // Salle de la sortie SE — gargouille (x27-33, y15-19)
    b.drawRect(2, 2, 4, 4, F);    // Alcôve NO à trésor (x2-5, y2-5)
    b.drawRect(13, 2, 5, 3, F);   // Alcôve N à trésor (x13-17, y2-4)

    // ---- Couloirs (les boucles tressées) ----
    b.drawRect(1, 11, 13, 1, F);  // Épine d'entrée : départ → rotonde
    b.drawRect(2, 5, 1, 7, F);    // vertical NO : alcôve NO ↔ entrée
    b.drawRect(2, 11, 1, 5, F);   // vertical refuge : entrée ↔ refuge
    b.drawRect(5, 3, 9, 1, F);    // couloir étroit N (embuscade araignée) : alcôve NO ↔ alcôve N
    b.drawRect(15, 4, 1, 6, F);   // alcôve N → rotonde
    b.drawRect(19, 4, 1, 6, F);   // rotonde → haut (vers prison)
    b.drawRect(19, 4, 7, 1, F);   // → prison (rejoint 25,4)
    b.drawRect(30, 6, 1, 6, F);   // prison → bas (2e accès prison = boucle)
    b.drawRect(16, 13, 1, 5, F);  // rotonde → route sud
    b.drawRect(16, 17, 12, 1, F); // route sud → salle sortie (rejoint 27,17)
    b.drawRect(20, 11, 11, 1, F); // route est (boucle) : rotonde → salle sortie
    b.drawRect(30, 11, 1, 5, F);  // route est → salle sortie
    b.drawRect(8, 17, 8, 1, F);   // refuge → route sud
    b.drawRect(23, 18, 1, 2, F);  // cul-de-sac sud à trésor

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
