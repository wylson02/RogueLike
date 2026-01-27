namespace RogueLike.Domain.Items;

using RogueLike.Domain.Entities;

public interface IEquipable
{
    EquipSlot Slot { get; }
    void OnEquip(Player player);
    void OnUnequip(Player player);
}
