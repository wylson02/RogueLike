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

}
