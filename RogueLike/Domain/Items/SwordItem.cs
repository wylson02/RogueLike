using System;
using System.Collections.Generic;
using System.Text;

namespace RogueLike.Domain.Items;

using RogueLike.Domain.Entities;

internal sealed class SwordItem : Item
{
    public override char Glyph => '$';
    public override string Name => "Sword";

    public SwordItem(Position pos) : base(pos) { }

    public override void Apply(Player player)
    {
        player.AddAttack(5);
    }
}
