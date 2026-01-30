namespace RogueLike.App.Services;

using RogueLike.Domain;
using RogueLike.Domain.Catalogs;
using RogueLike.Domain.Entities;
using RogueLike.Domain.Items;
using static RogueLike.Domain.Entities.Chest;

public static class LevelCatalog
{
    public const int FirstLevel = 1;
    public const int LastPlayableLevel = 3;

    public static bool HasLevel(int level)
    => level is >= FirstLevel and <= LastPlayableLevel;

    public static LevelData CreateLevel(int level)
    => level switch
    {
        1 => CreateLevel1(),
        2 => CreateLevel2(),
        3 => CreateLevel3(),
        _ => CreateLevel1()
    };

    public static LevelData CreateLevel1()
    {
        return new LevelData
        {
            Map = MapCatalog.Level1(),
            PlayerStart = new Position(14, 8),

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

            Pnjs = new()
{
new Pnj(
new Position(6, 10),
"Elya",
"Bonjour aventurier ! Prends cette gemme de vie.",
"LifeGem"
)
},
        };
    }

    public static LevelData CreateLevel2()
    {
        return new LevelData
        {
            Map = MapCatalog.Level2(),
            PlayerStart = new Position(1, 11),

            Monsters = new()
{
MonsterCatalog.Slime(new Position(10, 5)),
MonsterCatalog.Slime(new Position(18, 16)),
MonsterCatalog.Golem(new Position(26, 8)),
},

            Chests = new()
{
new Chest(new Position(3, 3), ChestType.Normal),
new Chest(new Position(16, 18), ChestType.Normal),
new Chest(new Position(28, 4), ChestType.Legendary),
},

            Pnjs = new()
{
new Pnj(
new Position(6, 19),
"Orin",
"La nuit ici mord fort… prépare-toi.",
"" // ✅ pas de null
)
},
        };
    }

    public static LevelData CreateLevel3()
    {
        return new LevelData
        {
            Map = MapCatalog.Level3(),
            PlayerStart = new Position(32, 8),

            Monsters = new()
{
MonsterCatalog.Slime(new Position(10, 4)),
MonsterCatalog.Golem(new Position(14, 12)),
},

            Items = new()
{
new LegendarySwordItem(new Position(21, 7))
},

            Seals = new()
{
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

            Pnjs = new()
{
new Pnj(
new Position(10, 8),
"Elya",
"On se retrouve encore… Tu vas au bout, cette fois.",
"" // ✅ pas de null
)
},
        };
    }
}