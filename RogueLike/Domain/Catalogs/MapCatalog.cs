namespace RogueLike.Domain.Catalogs;

using RogueLike.Domain;
using RogueLike.Domain.Maps;

public static class MapCatalog
{
    public static GameMap Level1()
    {
        var map = new MapBuilder(30, 18)
            .DrawBorder(TileType.Wall)
            .DrawRect(1, 4, 6, 1, TileType.Wall)

            .DrawRect(13, 1, 1, 4, TileType.Wall)

            .DrawRect(11, 5, 6, 1, TileType.Wall)
            .DrawRect(11, 6, 1, 2, TileType.Wall)
            .DrawRect(11, 9, 1, 2, TileType.Wall)
            .DrawRect(11, 11, 6, 1, TileType.Wall)
            .DrawRect(16, 5, 1, 6, TileType.Wall)

            .DrawRect(13, 12, 1, 2, TileType.Wall)
            .DrawRect(14, 13, 7, 1, TileType.Wall)
            .DrawRect(14, 15, 7, 1, TileType.Wall)
            .DrawRect(13, 15, 1, 2, TileType.Wall)

            .DrawRect(1, 10, 5, 1, TileType.Wall)
            .DrawRect(5, 10, 1, 7, TileType.Wall)
            .SetTile(29, 8, TileType.Exit)
            .Build();

        return map;
    }

    public static GameMap Level2()
    {
        var map = new MapBuilder(35, 22)
            .DrawBorder(TileType.Wall)
            .DrawRect(1, 10, 5, 1, TileType.Wall)
            .DrawRect(1, 12, 5, 1, TileType.Wall)
            .DrawRect(7, 8, 1, 10, TileType.Wall)
            .DrawRect(3, 14, 4, 1, TileType.Wall)
            .DrawRect(1, 16, 4, 1, TileType.Wall)
            .DrawRect(1, 19, 11, 1, TileType.Wall)
            .DrawRect(8, 17, 6, 1, TileType.Wall)
            .DrawRect(14, 15, 1, 5, TileType.Wall)
            .DrawRect(16, 17, 1, 4, TileType.Wall)
            .DrawRect(14, 15, 5, 1, TileType.Wall)
            .DrawRect(19, 15, 1, 4, TileType.Wall)
            .DrawRect(19, 20, 1, 1, TileType.Wall)
            .DrawRect(21, 13, 1, 8, TileType.Wall)
            .DrawRect(9, 13, 12, 1, TileType.Wall)
            .DrawRect(9, 14, 1, 2, TileType.Wall)
            .DrawRect(10, 15, 3, 1, TileType.Wall)
            .DrawRect(8, 11, 9, 1, TileType.Wall)
            .DrawRect(18, 11, 7, 1, TileType.Wall)
            .DrawRect(24, 12, 1, 8, TileType.Wall)
            .DrawRect(25, 19, 2, 1, TileType.Wall)
            .DrawRect(29, 19, 5, 1, TileType.Wall)
            .DrawRect(25, 11, 8, 1, TileType.Wall)
            .DrawRect(32, 12, 1, 5, TileType.Wall)
            .DrawRect(30, 12, 1, 7, TileType.Wall)
            .DrawRect(26, 17, 4, 1, TileType.Wall)
            .DrawRect(25, 15, 4, 1, TileType.Wall)
            .DrawRect(26, 13, 4, 1, TileType.Wall)
            .DrawRect(13, 8, 1, 3, TileType.Wall)
            .DrawRect(14, 8, 7, 1, TileType.Wall)
            .DrawRect(21, 8, 1, 3, TileType.Wall)
            .DrawRect(5, 6, 1, 3, TileType.Wall)
            .DrawRect(6, 6, 4, 1, TileType.Wall)
            .DrawRect(9, 7, 1, 3, TileType.Wall)
            .DrawRect(2, 4, 1, 5, TileType.Wall)
            .DrawRect(3, 4, 9, 1, TileType.Wall)
            .DrawRect(11, 5, 1, 5, TileType.Wall)
            .DrawRect(12, 6, 12, 1, TileType.Wall)
            .DrawRect(23, 7, 1, 4, TileType.Wall)
            .DrawRect(1, 2, 12, 1, TileType.Wall)
            .DrawRect(14, 3, 7, 1, TileType.Wall)
            .DrawRect(21, 3, 1, 3, TileType.Wall)
            .DrawRect(25, 2, 1, 8, TileType.Wall)
            .DrawRect(26, 9, 7, 1, TileType.Wall)
            .DrawRect(32, 10, 1, 1, TileType.Wall)
            .DrawRect(14, 1, 10, 1, TileType.Wall)
            .DrawRect(26, 2, 7, 1, TileType.Wall)
            .DrawRect(27, 4, 7, 1, TileType.Wall)
            .DrawRect(26, 6, 7, 1, TileType.Wall)
            .SetTile(33, 18, TileType.Exit)
            .Build();

        return map;
    }

    public static GameMap Level3()
    {
        const int W = 44;
        const int H = 18;

        var b = new MapBuilder(W, H)
            .DrawBorder(TileType.Wall);

        // Salle marchand (haut droite)
        DrawRoom(b, x: 35, y: 5, w: 8, h: 6);
        // Salle boss (bas droite)
        DrawRoom(b, x: 35, y: 10, w: 8, h: 6);

        // Portes sortie
        b.SetTile(35, 7, TileType.DoorClosed);
        b.SetTile(35, 11, TileType.DoorClosed);

        // Exit dans salle boss
        b.SetTile(40, 12, TileType.Exit);

        // Salle centrale
        DrawRoom(b, x: 18, y: 4, w: 8, h: 6);

        // Portes salle centrale
        b.SetTile(18, 6, TileType.DoorClosed); // Ouest
        b.SetTile(25, 6, TileType.DoorClosed); // Est
        b.SetTile(21, 4, TileType.DoorClosed); // Nord
        b.SetTile(21, 9, TileType.DoorClosed); // Sud

        // Obstacles
        b.DrawRect(8, 6, 6, 1, TileType.Wall);
        b.DrawRect(10, 12, 6, 1, TileType.Wall);
        b.DrawRect(28, 12, 3, 1, TileType.Wall);
        b.DrawRect(28, 3, 3, 1, TileType.Wall);

        return b.Build();
    }

    // ===================== LEVEL 4 (BOSS) =====================
    public static GameMap Level4_BossArena()
    {
        // Arène cinématique : couloir -> arche -> trône
        const int W = 44;
        const int H = 19;

        var b = new MapBuilder(W, H)
            .DrawBorder(TileType.Wall);

        // Couloir
        b.DrawRect(1, 7, 18, 1, TileType.Wall);
        b.DrawRect(1, 11, 18, 1, TileType.Wall);
        b.DrawRect(18, 8, 1, 3, TileType.Wall);

        // Arche centrale
        DrawRoom(b, x: 18, y: 6, w: 10, h: 7);
        b.SetTile(18, 9, TileType.Floor);
        b.SetTile(27, 9, TileType.Floor);

        // Salle trône
        DrawRoom(b, x: 29, y: 4, w: 14, h: 11);

        // Colonnes décor
        b.DrawRect(32, 6, 1, 2, TileType.Wall);
        b.DrawRect(39, 6, 1, 2, TileType.Wall);
        b.DrawRect(32, 11, 1, 2, TileType.Wall);
        b.DrawRect(39, 11, 1, 2, TileType.Wall);

        // Trône
        b.DrawRect(40, 8, 2, 3, TileType.Wall);

        return b.Build();
    }

    private static void DrawRoom(MapBuilder b, int x, int y, int w, int h)
    {
        for (int xx = x; xx < x + w; xx++)
        {
            b.SetTile(xx, y, TileType.Wall);
            b.SetTile(xx, y + h - 1, TileType.Wall);
        }

        for (int yy = y; yy < y + h; yy++)
        {
            b.SetTile(x, yy, TileType.Wall);
            b.SetTile(x + w - 1, yy, TileType.Wall);
        }
    }
}
