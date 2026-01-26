namespace RogueLike.App;

using System.Linq;
using RogueLike.App.States;
using RogueLike.Domain;
using RogueLike.Domain.Entities;

public sealed class GameContext
{
    public GameMap Map { get; }
    public Player Player { get; }
    public List<Monster> Monsters { get; } = new();
    public Random Rng { get; } = new();

    public IGameState State { get; set; }

    public GameContext(GameMap map, Player player, IGameState initialState)
    {
        Map = map;
        Player = player;
        State = initialState;
    }

    public Monster? MonsterAt(Position p)
        => Monsters.FirstOrDefault(m => !m.IsDead && m.Pos == p);

    public bool IsBlocked(Position p)
    {
        if (!Map.IsWalkable(p)) return true;
        if (MonsterAt(p) is not null) return true;
        return false;
    }
}
