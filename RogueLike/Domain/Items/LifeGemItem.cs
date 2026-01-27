namespace RogueLike.Domain.Items;

using RogueLike.Domain.Entities;

public sealed class LifeGemItem : Item
{
    public override char Glyph => '$';
    public override string Name => "Gemme de vie";
    public override string Description => "Une gemme qui pulse d'énergie. Soigne le joueur.";

    public LifeGemItem(Position position) : base(position) { }

    public override void Apply(Player player)
    {
        player.Heal(10);
    }

    public override IEnumerable<string> GetStatsLines()
    {
        yield return "+10 PV";
    }
}
