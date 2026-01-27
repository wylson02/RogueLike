namespace RogueLike.Domain.Catalogs;

using RogueLike.Domain;
using RogueLike.Domain.Maps;

public static class MapCatalog
{
    public static GameMap Level1()
    {
        var map = new MapBuilder(30, 15)
            .DrawBorder(TileType.Wall)
            .DrawRect(1, 4, 5, 1, TileType.Wall)
            .DrawRect(1, 10, 5, 1, TileType.Wall)
            .DrawRect(5, 10, 1, 4, TileType.Wall)
            // .SetTile(18, 1, TileType.Exit)
            // .SetTile(10, 3, TileType.DoorClosed)
            .Build();

        return map;
    }
}
