namespace RogueLike.Domain.Entities;

using System.Collections.Generic;
using RogueLike.Domain.Items;

public sealed class Player : Character
{
    public override char Glyph => '@';

    // ===== INVENTAIRE / EQUIPEMENT =====
    public List<Item> Inventory { get; } = new();

    public Item? EquippedWeapon { get; private set; }
    public Item? EquippedArmor { get; private set; }
    public Item? EquippedAccessory { get; private set; }

    // ===== GOLD =====
    public int Gold { get; private set; } = 0;

    public void AddGold(int amount) => Gold += Math.Max(0, amount);

    public bool SpendGold(int amount)
    {
        if (amount < 0) return false;
        if (Gold < amount) return false;
        Gold -= amount;
        return true;
    }

    // ===== XP / NIVEAUX =====
    public int Level { get; private set; } = 1;
    public int Xp { get; private set; } = 0;
    public int StatPoints { get; private set; } = 0;
    public int XpToNext => 20 + (Level - 1) * 10;

    public Player(Position pos) : base(pos, hp: 30, attack: 5)
    {
    }

    public void GainXp(int amount)
    {
        if (amount <= 0) return;

        Xp += amount;

        while (Xp >= XpToNext)
        {
            Xp -= XpToNext;
            Level++;
            StatPoints += 1;
        }
    }

    public bool SpendStatPoint(StatType stat)
    {
        if (StatPoints <= 0) return false;

        StatPoints--;

        switch (stat)
        {
            case StatType.MaxHp:
                MaxHp += 2;
                Hp += 2;
                break;

            case StatType.Attack:
                ModifyAttack(+1);
                break;

            case StatType.Armor:
                ModifyArmor(+1);
                break;

            case StatType.CritChance:
                ModifyCritChance(+2); // +2%
                break;

            case StatType.LifeSteal:
                ModifyLifeSteal(+2); // +2%
                break;
        }

        return true;
    }

    // ===== INVENTAIRE =====
    public void AddToInventory(Item item) => Inventory.Add(item);
    public void RemoveFromInventory(Item item) => Inventory.Remove(item);

    // ===== EQUIPEMENT =====
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
