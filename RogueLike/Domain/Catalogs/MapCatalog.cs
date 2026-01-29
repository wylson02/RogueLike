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

        // Portes sortie (fermées tant que miniboss pas mort)
        b.SetTile(35, 7, TileType.DoorClosed);
        b.SetTile(35, 11, TileType.DoorClosed);

        // Exit dans salle boss
        b.SetTile(40, 12, TileType.Exit);

        // Salle centrale
        DrawRoom(b, x: 18, y: 4, w: 8, h: 6);

        // Portes salle centrale (fermées tant que 3 sceaux pas activés)
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
