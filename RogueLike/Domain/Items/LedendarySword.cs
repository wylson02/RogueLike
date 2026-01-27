namespace RogueLike.Domain.Items;

using RogueLike.Domain.Entities;

public sealed class LegendarySwordItem : Item, IEquipable
{
    public override char Glyph => 'L';
    public override string Name => "Épée de Légende";
    public override string Description =>
        "Une lame ancienne imprégnée de magie. Elle aspire la vie de ses ennemis et frappe parfois avec une précision divine.";

    public override bool AutoApplyOnPickup => false;

    public EquipSlot Slot => EquipSlot.Weapon;

    private const int AttackBonus = 6;
    private const int CritBonus = 10;
    private const int LifeStealBonus = 5;

    public LegendarySwordItem(Position position) : base(position) { }

    public override void Apply(Player player) => player.Equip(this);

    public void OnEquip(Player player)
    {
        player.ModifyAttack(+AttackBonus);
        player.ModifyCritChance(+CritBonus);
        player.ModifyLifeSteal(+LifeStealBonus);
    }

    public void OnUnequip(Player player)
    {
        player.ModifyAttack(-AttackBonus);
        player.ModifyCritChance(-CritBonus);
        player.ModifyLifeSteal(-LifeStealBonus);
    }

    public override IEnumerable<string> GetStatsLines()
    {
        yield return $"+{AttackBonus} ATK";
        yield return $"+{CritBonus}% CRIT";
        yield return $"+{LifeStealBonus}% Vol de vie";
        yield return "Équipable (Arme)";
        yield return "Objet légendaire";
    }
}
