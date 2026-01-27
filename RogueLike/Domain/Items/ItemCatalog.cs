namespace RogueLike.Domain.Items;

using RogueLike.Domain.Entities;

public static class ItemCatalog
{
    public static Item LifeGem(Position pos) => new LifeGemItem(pos);
    public static Item Armor(Position pos) => new ArmorItem(pos);
    public static Item Sword(Position pos) => new SwordItem(pos);
}
