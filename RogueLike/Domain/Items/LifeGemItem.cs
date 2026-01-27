using System;
using System.Collections.Generic;
using System.Text;

namespace RogueLike.Domain.Items;

using RogueLike.Domain.Entities;

internal sealed class LifeGemItem : Item
{
    public override char Glyph => '$';
    public override string Name => "Life Gem";

    public LifeGemItem(Position pos) : base(pos) { }

    public override void Apply(Player player)
    {
        player.Heal(5);
    }
}

