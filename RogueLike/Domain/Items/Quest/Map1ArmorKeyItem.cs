namespace RogueLike.Domain.Items.Quest;

using RogueLike.Domain;
using RogueLike.Domain.Entities;

public sealed class Map1ArmoryKeyItem : Item
{
    public override char Glyph => 'k';

    public override string Name => "Clé de l'Armurerie";
    public override string Description => "Ouvre la porte verrouillée de la petite salle en bas à gauche.";

    public Map1ArmoryKeyItem(Position pos) : base(pos)
    {
    }

    // ✅ Objet de quête : on ne l'utilise pas comme une potion.
    // L'ouverture de la porte est gérée dans ExplorationState.
    public override void Apply(Player player)
    {
        // Rien
    }

    public override string[] GetStatsLines()
        => new[] { "Objet de quête", "Ouvre une porte spéciale" };
}
