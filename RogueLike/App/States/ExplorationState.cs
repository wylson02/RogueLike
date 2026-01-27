namespace RogueLike.App.States;

using System.Linq;
using RogueLike.App;
using RogueLike.Domain;
using RogueLike.UI;

public sealed class ExplorationState : IGameState
{
    public string Name => "Exploration";

    public void Update(GameContext ctx)
    {
        Direction dir = ConsoleInput.ReadDirection();
        if (dir == Direction.None) return;

        Position next = ctx.Player.Pos.Move(dir);

        if (!ctx.Map.IsWalkable(next)) return;

        var item = ctx.ItemAt(ctx.Player.Pos);
        if (item is not null)
        {
            item.Apply(ctx.Player);
            ctx.RemoveItem(item);
            ctx.AddMessage($"Vous avez trouvé {item.Name} !");
        }



        var enemy = ctx.MonsterAt(next);
        if (enemy is not null)
        {
            ctx.State = new CombatState(enemy);
            return;
        }

        ctx.Player.SetPosition(next);
        ctx.UpdateVision();
        ctx.AdvanceTimeAfterPlayerMove();
        MonstersTurn(ctx);
    }

    private static void MonstersTurn(GameContext ctx)
    {
        foreach (var m in ctx.Monsters.Where(m => !m.IsDead))
        {
            var dir = m.MoveStrategy.ChooseMove(m, ctx);
            if (dir == Direction.None) continue;

            var next = m.Pos.Move(dir);
            if (!ctx.Map.IsWalkable(next)) continue;
            if (ctx.MonsterAt(next) is not null) continue;
            if (next == ctx.Player.Pos) continue;

            m.SetPosition(next);
        }
    }
}
