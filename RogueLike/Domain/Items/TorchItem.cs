namespace RogueLike.Domain.Items;

using RogueLike.Domain.Entities;

public sealed class TorchItem : Item
{
    public TorchItem(Position position) : base(position) { }

    public override char Glyph => 'T';
    public override string Name => "une torche (+2 vision)";
    public override string Description => "Augmente la vision de +2 (rayon).";

    public override void Apply(Player player)
    {
        if (player.LightBonus >= 5) return;
        player.SetLightBonus(1);
        // 2 -> 4 si tu pars à 2
    }
}
