namespace RogueLike.Domain.Items.Quest;

using RogueLike.Domain.Entities;
using RogueLike.Domain.Items;

public sealed class Map1ArmorDoorKeyItem : Item
{
    public override string Name => "Clé rouillée";
    public override string Description => "Une clé lourde et froide. Elle semble correspondre à une porte du temple.";
    public override char Glyph => 'k';

    public override bool AutoApplyOnPickup => false;
    public override bool CanSell => false;

    public Map1ArmorDoorKeyItem(Position pos) : base(pos) { }

    public override void Apply(Player player)
    {
        // Non-consommable via inventaire : sert automatiquement sur la porte concernée.
    }

    public override IEnumerable<string> GetStatsLines()
    {
        yield return "Objet de quête";
        yield return "Ouvre une porte sur la Map 1";
    }
}
