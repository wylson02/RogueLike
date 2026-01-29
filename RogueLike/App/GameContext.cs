namespace RogueLike.App;

using RogueLike.App.Services;
using RogueLike.App.States;
using RogueLike.Domain;
using RogueLike.Domain.Catalogs;
using RogueLike.Domain.Entities;
using RogueLike.Domain.Items;
using System.Collections.Generic;
using static RogueLike.Domain.Entities.Chest;

public sealed class GameContext
{
    public GameMap Map { get; private set; }
    public Player Player { get; }

    public List<Monster> Monsters { get; } = new();
    public List<Item> GameItems { get; } = new();
    public List<Chest> Chests { get; } = new();

    // ===== Map 3 : scénario =====
    public List<Seal> Seals { get; } = new();
    public Merchant? Merchant { get; set; }

    public int SealsActivated { get; private set; } = 0;
    public bool HasLegendarySword { get; private set; } = false;
    public bool MiniBossDefeated { get; private set; } = false;

    public void IncrementSealsActivated()
        => SealsActivated = Math.Min(3, SealsActivated + 1);

    public void MarkLegendarySwordPicked()
        => HasLegendarySword = true;

    public void MarkMiniBossDefeated()
        => MiniBossDefeated = true;

    // ===== Doors helpers (Map3Scripting) =====
    public bool IsDoorClosed(Position pos)
        => Map.InBounds(pos) && Map.GetTile(pos) == TileType.DoorClosed;

    public void OpenDoor(Position pos)
    {
        if (!Map.InBounds(pos)) return;
        if (Map.GetTile(pos) == TileType.DoorClosed)
            Map.SetTile(pos, TileType.DoorOpen);
    }

    public void CloseDoor(Position pos)
    {
        if (!Map.InBounds(pos)) return;
        if (Map.GetTile(pos) == TileType.DoorOpen)
            Map.SetTile(pos, TileType.DoorClosed);
    }

    // ===== Generic queries =====
    public Monster? MonsterAt(Position p)
        => Monsters.FirstOrDefault(m => !m.IsDead && m.Pos == p);

    public Item? ItemAt(Position p)
        => GameItems.FirstOrDefault(i => i.Position == p);

    public void RemoveItem(Item item)
        => GameItems.Remove(item);

    public Chest? ChestAt(Position p)
        => Chests.FirstOrDefault(c => !c.IsOpened && c.Pos == p);

    public Seal? SealAt(Position p)
        => Seals.FirstOrDefault(s => !s.IsActivated && s.Pos == p);

    public bool IsMerchantAt(Position p)
        => Merchant is not null && Merchant.Pos == p;

    public bool IsBlocked(Position p)
    {
        if (!Map.IsWalkable(p)) return true;
        if (MonsterAt(p) is not null) return true;
        return false;
    }

    // ✅ Alias pour ne pas casser l’existant : une seule liste !
    public List<Item> Items => GameItems;

    // ===== Engine / State / Log =====
    public Random Rng { get; } = new();
    public HashSet<Position> VisibleTiles { get; } = new();
    public HashSet<Position> DiscoveredTiles { get; } = new();

    public IGameState State { get; set; }

    public enum LogKind { Info, Loot, Combat, Warning, System }
    public readonly record struct LogEntry(LogKind Kind, string Text);

    private const int LogCapacity = 30;
    private readonly List<LogEntry> _log = new();
    public IReadOnlyList<LogEntry> LogEntries => _log;

    public string LastMessage { get; private set; } = "";

    public void PushLog(string text, LogKind kind = LogKind.Info)
    {
        if (string.IsNullOrWhiteSpace(text)) return;

        if (_log.Count > 0 && _log[^1].Text == text && _log[^1].Kind == kind)
            return;

        _log.Add(new LogEntry(kind, text));

        if (_log.Count > LogCapacity)
            _log.RemoveRange(0, _log.Count - LogCapacity);

        LastMessage = text;
    }

    public void AddMessage(string msg) => PushLog(msg, LogKind.Info);

    // ===== Progression maps =====
    public int CurrentLevel { get; private set; } = 1;
    public void SetLevelIndex(int level) => CurrentLevel = level;

    public void LoadLevel(int level)
    {
        var data = LevelCatalog.CreateLevel(level);

        Monsters.Clear();
        GameItems.Clear();
        Chests.Clear();
        Seals.Clear();
        Merchant = null;

        VisibleTiles.Clear();
        DiscoveredTiles.Clear();

        SealsActivated = 0;
        HasLegendarySword = false;
        MiniBossDefeated = false;

        Map = data.Map;
        Player.SetPosition(data.PlayerStart);

        Monsters.AddRange(data.Monsters);
        GameItems.AddRange(data.Items);
        Chests.AddRange(data.Chests);

        Seals.AddRange(data.Seals);
        Merchant = data.Merchant;

        CurrentLevel = level;

        PushLog($"Niveau {level} chargé.", LogKind.System);
        UpdateVision();
    }

    // ===== Vision =====
    public void UpdateVision()
    {
        // int radius = Player.VisionRadius;
        int radius = 30;

        VisibleTiles.Clear();

        for (int dy = -radius; dy <= radius; dy++)
            for (int dx = -radius; dx <= radius; dx++)
            {
                int x = Player.Pos.X + dx;
                int y = Player.Pos.Y + dy;

                if (dx * dx + dy * dy > radius * radius) continue;
                if (x < 0 || y < 0 || x >= Map.Width || y >= Map.Height) continue;

                var p = new Position(x, y);
                VisibleTiles.Add(p);
                DiscoveredTiles.Add(p);
            }

        VisibleTiles.Add(Player.Pos);
        DiscoveredTiles.Add(Player.Pos);
    }

    // ===== Time system (inchangé) =====
    public TimeSystem Time { get; } = new TimeSystem(phaseLength: 24);

    private const int MaxAliveMonsters = 10;
    private const int MaxNightSpawnsPerNight = 2;
    private int _nightSpawnedThisNight = 0;

    private bool _nightBuffApplied = false;

    public void AdvanceTimeAfterPlayerMove()
    {
        bool phaseChanged = Time.Advance();

        if (phaseChanged)
        {
            if (Time.IsNight) ApplyNightStart();
            else ApplyDayStart();
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
            m.ModifyAttack(-2);
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

            Monsters.Add(MonsterCatalog.NightSlime(p));
            _nightSpawnedThisNight++;
            return;
        }
    }

    // ===== Chests =====
    public void OpenChest(Chest chest)
    {
        if (chest.IsOpened) return;

        chest.Open();

        var loot = chest.Type switch
        {
            ChestType.TorchOnly => LootTable.RollTorch(chest.Pos),
            ChestType.Legendary => LootTable.Roll(Rng, chest.Pos),
            _ => LootTable.Roll(Rng, chest.Pos)
        };

        string chestLabel = chest.Type switch
        {
            ChestType.TorchOnly => "coffre de torche",
            ChestType.Legendary => "COFFRE LÉGENDAIRE",
            _ => "coffre"
        };

        if (loot.AutoApplyOnPickup)
        {
            loot.Apply(Player);
            AddMessage($"Vous ouvrez un {chestLabel} ! Vous trouvez {loot.Name} (utilisé).");
        }
        else
        {
            Player.AddToInventory(loot);
            AddMessage($"Vous ouvrez un {chestLabel} ! Vous trouvez {loot.Name} (inventaire).");
        }
    }

    public GameContext(GameMap map, Player player, IGameState initialState)
    {
        Map = map;
        Player = player;
        State = initialState;
    }
}
