namespace RogueLike.Domain.Entities;

using RogueLike.Domain;
using RogueLike.Domain.AI;

public sealed class Monster : Character
{
    public override char Glyph => 'M';
    public string Name { get; }
    public IMoveStrategy MoveStrategy { get; }

    public Monster(string name, Position pos, int hp, int attack, IMoveStrategy strategy)
        : base(pos, hp, attack)
    {
        Name = name;
        MoveStrategy = strategy;
    }
}
