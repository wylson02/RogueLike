namespace RogueLike.App.Services;

using RogueLike.Domain;
using RogueLike.Domain.Catalogs;
using RogueLike.Domain.Entities;
using static RogueLike.Domain.Entities.Chest;

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

            Chests = new()
            {
                new Chest(new Position(2, 2), ChestType.TorchOnly),
                new Chest(new Position(7, 6), ChestType.Normal),
                new Chest(new Position(12, 2), ChestType.Legendary),
            },

        };
    }
}
