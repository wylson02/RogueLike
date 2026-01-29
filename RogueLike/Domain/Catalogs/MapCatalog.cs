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
            // .SetTile(18, 1, TileType.Exit)
            // .SetTile(10, 3, TileType.DoorClosed)
            .Build();

        return map;
    }
}
