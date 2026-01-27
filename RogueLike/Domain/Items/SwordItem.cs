namespace RogueLike.Domain.Items;

using RogueLike.Domain.Entities;

public sealed class SwordItem : Item, IEquipable
{
    public override char Glyph => 'S';
    public override string Name => "Épée";
    public override string Description => "Une lame simple mais fiable. Augmente l'attaque.";
    public override bool AutoApplyOnPickup => false;

    public EquipSlot Slot => EquipSlot.Weapon;

    private const int AttackBonus = 2;

    public SwordItem(Position position) : base(position) { }

    public override void Apply(Player player) => player.Equip(this);

    public void OnEquip(Player player) => player.ModifyAttack(+AttackBonus);
    public void OnUnequip(Player player) => player.ModifyAttack(-AttackBonus);

    public override IEnumerable<string> GetStatsLines()
    {
        yield return $"+{AttackBonus} ATK";
        yield return "Équipable (Arme)";
    }
}
