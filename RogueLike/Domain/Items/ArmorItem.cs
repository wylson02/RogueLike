namespace RogueLike.Domain.Items;

using RogueLike.Domain.Entities;

public sealed class ArmorItem : Item, IEquipable
{
    public override char Glyph => 'A';
    public override string Name => "Armure";
    public override string Description => "Protège contre les coups. Augmente l'armure.";
    public override bool AutoApplyOnPickup => false;

    public EquipSlot Slot => EquipSlot.Armor;

    private const int ArmorBonus = 2;

    public ArmorItem(Position position) : base(position) { }

    public override void Apply(Player player) => player.Equip(this);

    public void OnEquip(Player player) => player.ModifyArmor(+ArmorBonus);
    public void OnUnequip(Player player) => player.ModifyArmor(-ArmorBonus);

    public override IEnumerable<string> GetStatsLines()
    {
        yield return $"+{ArmorBonus} ARM";
        yield return "Équipable (Armure)";
    }
}
