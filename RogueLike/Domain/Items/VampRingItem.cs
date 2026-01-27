namespace RogueLike.Domain.Items;

using RogueLike.Domain.Entities;

public sealed class VampRingItem : Item, IEquipable
{
    public override char Glyph => 'V';
    public override string Name => "Anneau Vampirique";
    public override string Description => "Rend une partie des dégâts infligés en PV.";
    public override bool AutoApplyOnPickup => false;

    public EquipSlot Slot => EquipSlot.Accessory;

    private const int LifeStealBonus = 10;

    public VampRingItem(Position pos) : base(pos) { }

    public override void Apply(Player player) => player.Equip(this);

    public void OnEquip(Player player) => player.ModifyLifeSteal(+LifeStealBonus);
    public void OnUnequip(Player player) => player.ModifyLifeSteal(-LifeStealBonus);

    public override IEnumerable<string> GetStatsLines()
    {
        yield return $"+{LifeStealBonus}% Vol de vie";
        yield return "Équipable (Accessoire)";
    }
}
