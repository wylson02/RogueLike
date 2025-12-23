using System;
using System.Collections.Generic;
using System.Text;

namespace RogueLike.App;

using RogueLike.Domain;
using RogueLike.Domain.Entities;

public sealed class GameContext
{
    public GameMap Map { get; }
    public Player Player { get; }

    public GameContext(GameMap map, Player player)
    {
        Map = map;
        Player = player;
    }

    public bool CanMoveTo(Position p) => Map.IsWalkable(p);
}

