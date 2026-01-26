namespace RogueLike.App;

using RogueLike.Domain.AI;
using RogueLike.Domain.Entities;
using RogueLike.Domain;
using System.Linq;
using RogueLike.App.States;

public sealed class GameContext
{
    public GameMap Map { get; }
    public Player Player { get; }
    public List<Monster> Monsters { get; } = new();
    public Random Rng { get; } = new();
    private const int MaxAliveMonsters = 10;  
    private const int MaxNightSpawnsPerNight = 2; 
    private int _nightSpawnedThisNight = 0;

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

    public TimeSystem Time { get; } = new TimeSystem(phaseLength: 24);

    private bool _nightBuffApplied = false;

    public void AdvanceTimeAfterPlayerMove()
    {
        bool phaseChanged = Time.Advance();

        if (phaseChanged)
        {
            if (Time.IsNight)
            {
                ApplyNightStart();
            }
            else
            {
                ApplyDayStart();
            }
        }

        if (Time.IsNight && Time.Tick % 10 == 0)
        {
            TrySpawnNightMonster();
        }
    }

    private void ApplyNightStart()
    {
        _nightSpawnedThisNight = 0;

        if (_nightBuffApplied) return;
        _nightBuffApplied = true;

        foreach (var m in Monsters.Where(m => !m.IsDead))
            m.ModifyAttack(+2);

        // ajouter petit message
        // AddLog("La nuit tombe... Les monstres deviennent plus dangereux.");
    }

    private void ApplyDayStart()
    {
        if (!_nightBuffApplied) return;
        _nightBuffApplied = false;

        foreach (var m in Monsters.Where(m => !m.IsDead))
            m.ModifyAttack(-1);

        // AddLog("Le jour se lève. Les monstres redeviennent normaux.");
    }

    private void TrySpawnNightMonster()
    {
        // cap global
        int alive = Monsters.Count(m => !m.IsDead);
        if (alive >= MaxAliveMonsters) return;

        // cap par nuit
        if (_nightSpawnedThisNight >= MaxNightSpawnsPerNight) return;

        // essaie de trouver une case libre
        for (int tries = 0; tries < 60; tries++)
        {
            var p = new Position(Rng.Next(1, Map.Width - 1), Rng.Next(1, Map.Height - 1));

            if (!Map.IsWalkable(p)) continue;
            if (p == Player.Pos) continue;
            if (MonsterAt(p) is not null) continue;

            Monsters.Add(new Monster("Night Slime", p, hp: 6, attack: 2, strategy: new AggroWithinRangeStrategy(3)));
            _nightSpawnedThisNight++;
            return;
        }
    }


}
