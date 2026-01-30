namespace RogueLike.Domain.Items;

using RogueLike.Domain.Entities;
using RogueLike.Domain.Items.Quest;

public static class ItemCatalog
{
    public static Item LifeGem(Position pos) => new LifeGemItem(pos);
    public static Item Armor(Position pos) => new ArmorItem(pos);
    public static Item Sword(Position pos) => new SwordItem(pos);
    public static Item LegendarySword(Position pos) => new LegendarySwordItem(pos);
    public static Item CritCharm(Position pos) => new CritCharmItem(pos);
    public static Item VampRing(Position pos) => new VampRingItem(pos);
    public static Item Torch(Position pos) => new TorchItem(pos);
    public static Item Map1ToMap2Key(Position pos) => new Map1ToMap2KeyItem(pos);



    public static Item Create(string id, Position pos)
    {
        return id switch
        {
            "LifeGem" => LifeGem(pos),
            "Armor" => Armor(pos),
            "Sword" => Sword(pos),
            "LegendarySword" => LegendarySword(pos),
            "CritCharm" => CritCharm(pos),
            "VampRing" => VampRing(pos),
            "Torch" => Torch(pos),
            "Map1ToMap2Key" => Map1ToMap2Key(pos),


            _ => throw new ArgumentException($"Item inconnu: {id}")
        };
    }


}
