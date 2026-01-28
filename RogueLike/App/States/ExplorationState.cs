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
        var cmd = ConsoleInput.ReadExplorationCommand();

        if (cmd.InventoryRequested)
        {
            ctx.State = new InventoryState(previous: this);
            return;
        }

        if (cmd.ProgressionRequested)
        {
            ctx.State = new ProgressionState(previous: this);
            return;
        }

        var dir = cmd.Direction;
        if (dir == Direction.None) return;

        var next = ctx.Player.Pos.Move(dir);
        if (!ctx.Map.IsWalkable(next)) return;

        // Coffre
        var chest = ctx.ChestAt(next);
        if (chest is not null)
        {
            ctx.Player.SetPosition(next);
            ctx.OpenChest(chest);

            ctx.UpdateVision();
            ctx.AdvanceTimeAfterPlayerMove();
            MonstersTurn(ctx);
            return;
        }

        // Combat
        var enemy = ctx.MonsterAt(next);
        if (enemy is not null)
        {
            ctx.State = new CombatState(enemy);
            return;
        }

        // Déplacement normal
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
