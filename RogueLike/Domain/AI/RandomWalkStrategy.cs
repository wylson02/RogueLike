namespace RogueLike.Domain.AI;

using RogueLike.App;
using RogueLike.Domain;
using RogueLike.Domain.Entities;

public sealed class RandomWalkStrategy : IMoveStrategy
{
    public Direction ChooseMove(Monster m, GameContext ctx)
    {
        var dirs = new[]
        {
            Direction.Up,
            Direction.Down,
            Direction.Left,
            Direction.Right
        };

        return dirs[ctx.Rng.Next(dirs.Length)];
    }
}
