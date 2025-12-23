using System;
using System.Collections.Generic;
using System.Text;

namespace RogueLike.Domain.Entities
{
    using RogueLike.Domain;

    public abstract class Entity
    {
        public Position Pos { get; protected set; }

        public abstract char Glyph { get; }

        protected Entity(Position pos)
        {
            Pos = pos;
        }

        public void SetPosition(Position pos)
        {
            Pos = pos;
        }
    }
}
