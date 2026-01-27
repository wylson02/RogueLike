namespace RogueLike.Domain.Entities;

using System.Collections.Generic;
using RogueLike.Domain.Items;

public sealed class Player : Character
{
    public override char Glyph => '@';

    public int Gold { get; private set; } = 0;

    public List<Item> Inventory { get; } = new();

    public Item? EquippedWeapon { get; private set; }
    public Item? EquippedArmor { get; private set; }
    public Item? EquippedAccessory { get; private set; }

    public Player(Position pos) : base(pos, hp: 30, attack: 5)
    {
    }

    public void AddGold(int amount)
        => Gold += Math.Max(0, amount);

    public bool SpendGold(int amount)
    {
        if (amount < 0) return false;
        if (Gold < amount) return false;
        Gold -= amount;
        return true;
    }

    public void AddToInventory(Item item) => Inventory.Add(item);
    public void RemoveFromInventory(Item item) => Inventory.Remove(item);

    public void Equip(Item item)
    {
        if (item is not IEquipable eq)
            return;

        if (eq.Slot == EquipSlot.Weapon)
        {
            SwapEquipWeapon(item, eq);
            return;
        }

        if (eq.Slot == EquipSlot.Armor)
        {
            SwapEquipArmor(item, eq);
            return;
        }

        if (eq.Slot == EquipSlot.Accessory)
        {
            SwapEquipAccessory(item, eq);
            return;
        }
    }

    private void SwapEquipWeapon(Item newItem, IEquipable eqNew)
    {
        if (EquippedWeapon is IEquipable eqOld)
        {
            eqOld.OnUnequip(this);
            Inventory.Add(EquippedWeapon!);
        }

        EquippedWeapon = newItem;
        eqNew.OnEquip(this);
    }

    private void SwapEquipArmor(Item newItem, IEquipable eqNew)
    {
        if (EquippedArmor is IEquipable eqOld)
        {
            eqOld.OnUnequip(this);
            Inventory.Add(EquippedArmor!);
        }

        EquippedArmor = newItem;
        eqNew.OnEquip(this);
    }

    private void SwapEquipAccessory(Item newItem, IEquipable eqNew)
    {
        if (EquippedAccessory is IEquipable eqOld)
        {
            eqOld.OnUnequip(this);
            Inventory.Add(EquippedAccessory!);
        }

        EquippedAccessory = newItem;
        eqNew.OnEquip(this);
    }
}
