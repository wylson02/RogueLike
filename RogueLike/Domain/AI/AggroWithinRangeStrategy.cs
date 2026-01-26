namespace RogueLike.Domain.AI;

using RogueLike.App;
using RogueLike.Domain;
using RogueLike.Domain.Entities;

public sealed class AggroWithinRangeStrategy : IMoveStrategy
{
    private readonly int _range;
    private readonly IMoveStrategy _fallback;

    public AggroWithinRangeStrategy(int range = 3, IMoveStrategy? fallback = null)
    {
        _range = range;
        _fallback = fallback ?? new RandomWalkStrategy();
    }

    public Direction ChooseMove(Monster m, GameContext ctx)
    {
        int dist = Manhattan(m.Pos, ctx.Player.Pos);

        if (dist > _range)
            return _fallback.ChooseMove(m, ctx);

        var bestDir = Direction.None;
        int bestDist = dist;

        foreach (var dir in new[] { Direction.Up, Direction.Down, Direction.Left, Direction.Right })
        {
            var next = m.Pos.Move(dir);

            if (!ctx.Map.IsWalkable(next)) continue;
            if (ctx.MonsterAt(next) is not null) continue;
            if (next == ctx.Player.Pos) continue;

            int nd = Manhattan(next, ctx.Player.Pos);
            if (nd < bestDist)
            {
                bestDist = nd;
                bestDir = dir;
            }
        }

        if (bestDir == Direction.None)
            return _fallback.ChooseMove(m, ctx);

        return bestDir;
    }

    private static int Manhattan(Position a, Position b)
        => Math.Abs(a.X - b.X) + Math.Abs(a.Y - b.Y);
}
