using System;
using System.Collections.Generic;
using System.Text;

namespace RogueLike.App.States;

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

        if (!ctx.CanMoveTo(next)) return;

        ctx.Player.SetPosition(next);
    }
}
