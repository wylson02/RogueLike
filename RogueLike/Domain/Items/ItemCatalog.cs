namespace RogueLike.Domain.Items;

using RogueLike.Domain.Entities;

public static class ItemCatalog
{
    public static Item LifeGem(Position pos) => new LifeGemItem(pos);
    public static Item Armor(Position pos) => new ArmorItem(pos);
    public static Item Sword(Position pos) => new SwordItem(pos);
    public static Item LegendarySword(Position pos) => new LegendarySwordItem(pos);
    public static Item CritCharm(Position pos) => new CritCharmItem(pos);
    public static Item VampRing(Position pos) => new VampRingItem(pos);
    public static Item Torch(Position pos) => new TorchItem(pos);



}
