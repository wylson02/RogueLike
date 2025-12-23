using System;
using System.Collections.Generic;
using System.Text;

namespace RogueLike.App.States;

using RogueLike.App;

public interface IGameState
{
    string Name { get; }
    void Update(GameContext ctx);
}
