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
}
