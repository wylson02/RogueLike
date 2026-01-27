namespace RogueLike.Domain.Items;

using RogueLike.Domain.Entities;

public sealed class CritCharmItem : Item, IEquipable
{
    public override char Glyph => 'C';
    public override string Name => "Talisman de Critique";
    public override string Description => "Aiguise tes réflexes. Augmente les chances de critique.";
    public override bool AutoApplyOnPickup => false;

    public EquipSlot Slot => EquipSlot.Accessory;

    private const int CritBonus = 15;

    public CritCharmItem(Position pos) : base(pos) { }

    public override void Apply(Player player) => player.Equip(this);

    public void OnEquip(Player player) => player.ModifyCritChance(+CritBonus);
    public void OnUnequip(Player player) => player.ModifyCritChance(-CritBonus);

    public override IEnumerable<string> GetStatsLines()
    {
        yield return $"+{CritBonus}% CRIT";
        yield return "Équipable (Accessoire)";
    }
}
