namespace RogueLike.Domain.Catalogs;

using RogueLike.Domain;

public static class MapCatalog
{
    public static GameMap Level1()
    {
        string[] raw =
        {
            "####################",
            "#..................E",
            "#..####............#",
            "#..#...............#",
            "#..#....######.....#",
            "#..#...............#",
            "#..##########......#",
            "#..................#",
            "####################",
        };

        return GameMap.BuildFromRaw(raw);

    }
}
