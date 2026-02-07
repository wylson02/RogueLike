namespace RogueLike.Domain.Items;

using RogueLike.Domain.Entities;

public sealed class LanternItem : Item
{
    public override string Name => "Lanterne";
    public override char Glyph => 'L'; // même si elle ne sera pas au sol, Item l'exige souvent
    public override string Description => "Augmente la vision de +2 (rayon).";
    public override bool AutoApplyOnPickup => true;

    public LanternItem(Position pos) : base(pos) { }

    public override void Apply(Player player)
    {
        player.IncreaseVision(2);
    }
}
