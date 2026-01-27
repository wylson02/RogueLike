using System;
using System.Collections.Generic;
using System.Text;

namespace RogueLike.Domain.Items;

using RogueLike.Domain.Entities;

public abstract class Item
{
    public Position Position { get; }
    public abstract char Glyph { get; }
    public abstract string Name { get; }

    protected Item(Position position)
    {
        Position = position;
    }

    public abstract void Apply(Player player);
}
