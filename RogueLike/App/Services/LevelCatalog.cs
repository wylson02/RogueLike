namespace RogueLike.App.Services;

using RogueLike.Domain;
using RogueLike.Domain.Catalogs;
using RogueLike.Domain.Entities;
using RogueLike.Domain.Items;
using static RogueLike.Domain.Entities.Chest;

public static class LevelCatalog
{
    public static LevelData CreateLevel(int level)
        => level switch
        {
            1 => CreateLevel1(),
            3 => CreateLevel3(),
            _ => CreateLevel1()
        };

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

    public static LevelData CreateLevel3()
    {
        return new LevelData
        {
            Map = MapCatalog.Level3(),
            PlayerStart = new Position(32, 8), // spawn à droite

            Monsters = new()
            {
                MonsterCatalog.Slime(new Position(10, 4)),
                MonsterCatalog.Golem(new Position(14, 12)),
            },

            Items = new()
            {
                // Épée de légende au centre (derrière les portes)
                new LegendarySwordItem(new Position(21, 7))
            },

            Seals = new()
            {
                // 3 sceaux à activer
                new Seal(1, new Position(4, 3)),
                new Seal(2, new Position(4, 14)),
                new Seal(3, new Position(30, 2)),
            },

            Merchant = new Merchant(new Position(38, 7), "Vesna la Troqueuse"),

            Chests = new()
            {
                new Chest(new Position(8, 13), ChestType.Normal),
                new Chest(new Position(28, 13), ChestType.Legendary),
            },
        };
    }
}
