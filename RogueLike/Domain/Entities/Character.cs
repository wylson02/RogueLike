using System;
using System.Collections.Generic;
using System.Text;

namespace RogueLike.Domain.Entities;

using RogueLike.Domain;

public abstract class Character : Entity
{
    public int MaxHp { get; protected set; }
    public int Hp { get; protected set; }
    public int Attack { get; protected set; }
    public int Armor { get; protected set; }

    public bool IsDead => Hp <= 0;
    public int CritChancePercent { get; private set; } = 0;
    public int LifeStealPercent { get; private set; } = 0;
    public int CritMultiplierPercent { get; private set; } = 200; 

    public void ModifyCritChance(int delta)
    {
        CritChancePercent = Math.Clamp(CritChancePercent + delta, 0, 100);
    }

    public void ModifyLifeSteal(int delta)
    {
        LifeStealPercent = Math.Clamp(LifeStealPercent + delta, 0, 100);
    }

    public void ModifyCritMultiplierPercent(int delta)
    {
        CritMultiplierPercent = Math.Clamp(CritMultiplierPercent + delta, 150, 400);
    }

    protected Character(Position pos, int hp, int attack)
        : base(pos)
    {
        MaxHp = hp;
        Hp = hp;
        Attack = attack;
    }

    public void TakeDamage(int amount)
    {
        int dmg = Math.Max(0, amount - Armor);
        Hp -= dmg;
    }


    public void AddAttack(int amount)
    {
        Attack += Math.Max(0, amount);
    }

    public void AddArmor(int amount)
    {
        Armor += Math.Max(0, amount);
    }


    public void Heal(int amount)
    {
        Hp = Math.Min(MaxHp, Hp + Math.Max(0, amount));
    }

    public void ModifyAttack(int delta)
    {
        Attack = Math.Max(1, Attack + delta);
    }

    public void ModifyArmor(int delta)
    {
        Armor = Math.Max(0, Armor + delta);
    }
    public void HealToFull()
    {
        Hp = MaxHp;
    }

    public void ClampHp()
    {
        if (Hp < 0) Hp = 0;
        if (Hp > MaxHp) Hp = MaxHp;
    }

}
