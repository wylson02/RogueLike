using System;
using System.Collections.Generic;
using System.Text;

namespace RogueLike.Domain.Entities;

using RogueLike.Domain;

public sealed class Player : Character
{
    public override char Glyph => '@';

    public Player(Position pos)
        : base(pos, hp: 30, attack: 5)
    {
    }
}
