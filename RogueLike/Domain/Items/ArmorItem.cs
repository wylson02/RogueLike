using System;
using System.Collections.Generic;
using System.Text;

namespace RogueLike.Domain.Items;

using RogueLike.Domain.Entities;

internal sealed class ArmorItem : Item
{
    public override char Glyph => '$';
    public override string Name => "Armor";

    public ArmorItem(Position pos) : base(pos) { }

    public override void Apply(Player player)
    {
        player.AddArmor(10);
    }
}
