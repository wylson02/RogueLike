namespace RogueLike.Domain.Items.Quest;

using RogueLike.Domain.Entities;

public sealed class Map1ToMap2KeyItem : Item
{
    public override string Name => "Clé (Temple)";
    public override bool AutoApplyOnPickup => false;

    public override string Description => "Clé pour ouvrir une mystérieuse porte...";
    public override char Glyph => 'k';

    public Map1ToMap2KeyItem(Position pos) : base(pos) { }

    public override void Apply(Player player)
    {
        // Clé non-utilisable depuis l’inventaire
        // (on pourrait afficher un message via ctx, mais Apply n'a pas ctx)
    }
}




//namespace RogueLike.Domain.Items.Quest;

//using RogueLike.Domain.Entities;

//public sealed class Map1ArmorKey : KeyQuest
//{
//    public Map1ArmorKey(Entity owner)
//        : base("Clé du Coffre d'Armure", KeyQuestType.Map1_ArmorDoor, owner)
//    {
//    }
//}