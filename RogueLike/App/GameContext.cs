namespace RogueLike.App;

using RogueLike.App.Services;
using RogueLike.Domain.AI;
using RogueLike.Domain.Entities;
using RogueLike.Domain;
using System.Linq;
using RogueLike.App.States;
using RogueLike.Domain.Items;

public sealed class GameContext
{
    public GameMap Map { get; }
    public Player Player { get; }

    public List<Monster> Monsters { get; } = new();
    public List<Item> Items { get; } = new();

    // ✅ Coffres
    public List<Chest> Chests { get; } = new();

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

    public Item? ItemAt(Position pos)
        => Items.FirstOrDefault(i => i.Position == pos);

    public void RemoveItem(Item item)
        => Items.Remove(item);

    public Chest? ChestAt(Position pos)
        => Chests.FirstOrDefault(c => !c.IsOpened && c.Pos == pos);

    public bool IsBlocked(Position p)
    {
        if (!Map.IsWalkable(p)) return true;
        if (MonsterAt(p) is not null) return true;
        return false;
    }

    public TimeSystem Time { get; } = new TimeSystem(phaseLength: 24);

    private bool _nightBuffApplied = false;

    public string LastMessage { get; private set; } = "";

    public void AddMessage(string msg)
    {
        LastMessage = msg;
    }


    public void OpenChest(Chest chest)
    {
        if (chest.IsOpened) return;

        chest.Open();

        var loot = LootTable.Roll(Rng, chest.Pos);

        if (loot.AutoApplyOnPickup)
        {
            loot.Apply(Player);
            AddMessage($"Coffre ouvert ! Tu trouves {loot.Name} (utilisé).");
        }
        else
        {
            Player.AddToInventory(loot);
            AddMessage($"Coffre ouvert ! Tu trouves {loot.Name} (inventaire).");
        }
    }

    public void AdvanceTimeAfterPlayerMove()
    {
        bool phaseChanged = Time.Advance();

        if (phaseChanged)
        {
            if (Time.IsNight)
                ApplyNightStart();
            else
                ApplyDayStart();
        }

        if (Time.IsNight && Time.Tick % 10 == 0)
            TrySpawnNightMonster();
    }

    private void ApplyNightStart()
    {
        _nightSpawnedThisNight = 0;

        if (_nightBuffApplied) return;
        _nightBuffApplied = true;

        foreach (var m in Monsters.Where(m => !m.IsDead))
            m.ModifyAttack(+2);
    }

    private void ApplyDayStart()
    {
        if (!_nightBuffApplied) return;
        _nightBuffApplied = false;

        foreach (var m in Monsters.Where(m => !m.IsDead))
            m.ModifyAttack(-1);
    }

    private void TrySpawnNightMonster()
    {
        int alive = Monsters.Count(m => !m.IsDead);
        if (alive >= MaxAliveMonsters) return;

        if (_nightSpawnedThisNight >= MaxNightSpawnsPerNight) return;

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
