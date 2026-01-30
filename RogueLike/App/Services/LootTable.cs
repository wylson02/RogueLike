namespace RogueLike.App.Services;

using RogueLike.Domain;
using RogueLike.Domain.Items;



public static class LootTable
{

    private static readonly Func<Position, Item>[] _pool =
    {
        pos => ItemCatalog.LifeGem(pos),
        pos => ItemCatalog.LifeGem(pos),

        pos => ItemCatalog.Sword(pos),
        pos => ItemCatalog.Armor(pos),

        pos => ItemCatalog.CritCharm(pos),
        pos => ItemCatalog.VampRing(pos),

        pos => ItemCatalog.LegendarySword(pos),

    };

    public static Item Roll(Random rng, Position spawnPos)
    {
        int i = rng.Next(0, _pool.Length);
        return _pool[i](spawnPos);
    }

    public static Item RollTorch(Position pos)
    {
        return ItemCatalog.Torch(pos);
    }

    public static Item RollLantern(Position pos)
    {
        return ItemCatalog.Lantern(pos);

    }
}
