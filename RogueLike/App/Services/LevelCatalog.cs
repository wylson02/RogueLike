namespace RogueLike.App.Services;

using RogueLike.Domain;
using RogueLike.Domain.Catalogs;
using RogueLike.Domain.Items;

public static class LevelCatalog
{
    public static LevelData CreateLevel1()
    {
        return new LevelData
        {
            Map = MapCatalog.Level1(),
            PlayerStart = new Position(1, 1),

            Monsters = new()
            {
                MonsterCatalog.Slime(new Position(10, 3)),
                MonsterCatalog.Golem(new Position(14, 6))
            },

            Items = new()
            {
                ItemCatalog.LifeGem(new Position(2, 1)),
                ItemCatalog.Armor(new Position(5, 5)),
                ItemCatalog.Sword(new Position(9, 7)),
            }
        };
    }
}
