namespace RogueLike.App.Services;

using RogueLike.Domain;
using RogueLike.Domain.Catalogs;
using RogueLike.Domain.Entities;
using RogueLike.Domain.Items;
using static RogueLike.Domain.Entities.Chest;

public static class LevelCatalog
{
    public const int FirstLevel = 1;
    public const int LastPlayableLevel = 4;

    public static bool HasLevel(int level)
        => level is >= FirstLevel and <= LastPlayableLevel;

    public static LevelData CreateLevel(int level)
        => level switch
        {
            1 => CreateLevel1(),
            2 => CreateLevel2(),
            3 => CreateLevel3(),
            4 => CreateLevel4(),
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

            Items = new()
            {
                ItemCatalog.Armor(new Position(2, 13)),
                ItemCatalog.CritCharm(new Position(3, 14)),
            },

            Chests = new()
            {
                new Chest(new Position(7, 6), ChestType.Normal),
                new Chest(new Position(12, 2), ChestType.Legendary),
            },

            Pnjs = new()
            {
                // 1) Donne une épée
                new Pnj(
                    new Position(12, 6),
                    "Kael",
                    "Tiens. Prends cette épée. Ici, la faiblesse tue.",
                    "Sword"
                ),

                // 2) Effrayée -> donne clé armurerie après nettoyage
                new Pnj(
                    new Position(6, 12),
                    "Lysa",
                    "N-non… je ne peux pas… Ils sont partout…",
                    "Map1ArmoryKey"
                ),

                // 3) ✅ Placé DEVANT la sortie (Exit est en (29,8), on met (28,8))
                new Pnj(
                    new Position(28, 8),
                    "Sentinelle",
                    "Halte. Aucun passage sans arme. Reviens avec une arme."
                ),
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
                    "La nuit ici mord fort… prépare-toi."
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
                    "On se retrouve encore… Tu vas au bout, cette fois."
                )
            },
        };
    }

    public static LevelData CreateLevel4()
    {
        return new LevelData
        {
            Map = MapCatalog.Level4_BossArena(),
            PlayerStart = new Position(3, 9),

            Monsters = new()
            {
                MonsterCatalog.AbyssKingBoss(new Position(34, 9)),
            },

            Pnjs = new()
            {
                new Pnj(
                    new Position(6, 9),
                    "Vesna",
                    "Je t’ai suivi… Cette porte n’aurait jamais dû s’ouvrir. Reviens vivant."
                )
            }
        };
    }
}
