namespace RogueLike.App;

using RogueLike.App.Infrastructure;
using RogueLike.App.Infrastructure.Events;
using RogueLike.App.I18n;
using RogueLike.App.Services;
using RogueLike.App.States;
using RogueLike.Domain;
using RogueLike.Domain.Entities;
using RogueLike.Domain.Items;
using System.Collections.Generic;
using System.Linq;

public sealed class GameContext
{
    // ===== World state =====
    public GameMap Map { get; private set; }
    public Player Player { get; }

    public List<Pnj> Pnjs { get; } = new();
    public List<Monster> Monsters { get; } = new();
    public List<Item> GameItems { get; } = new();
    public List<Item> Items => GameItems;
    public List<Chest> Chests { get; } = new();

    // Map3 scénario
    public List<Seal> Seals { get; } = new();
    public Merchant? Merchant { get; set; }

    public int SealsActivated { get; private set; } = 0;
    public bool HasLegendarySword { get; private set; } = false;
    public bool MiniBossDefeated { get; private set; } = false;
    public bool LegendaryEmpowerNextFight { get; private set; } = false;
    public bool Map3LastSealHintShown { get; private set; } = false;

    // ===== Engine / randomness / time =====
    public Random Rng { get; } = new();
    public TimeSystem Time { get; } = new TimeSystem(phaseLength: 24);

    // ===== Vision (data) =====
    public HashSet<Position> VisibleTiles { get; } = new();
    public HashSet<Position> DiscoveredTiles { get; } = new();

    // ===== State pattern =====
    public IGameState State { get; set; }

    // ===== Events + i18n =====
    public GameEventBus Events { get; } = new();
    public Localizer Text { get; } = Localizer.CreateFrench();

    // ===== Services =====
    public VisionService Vision { get; }
    public MonsterSpawnService MonsterSpawner { get; }
    public ItemService ItemService { get; }
    public DoorService Doors { get; }
    public SafeZoneService SafeZones { get; }

    // ===== Log =====
    public enum LogKind { Info, Loot, Combat, Warning, System }
    public readonly record struct LogEntry(LogKind Kind, string Text);

    private const int LogCapacity = 30;
    private readonly List<LogEntry> _log = new();
    public IReadOnlyList<LogEntry> LogEntries => _log;
    public string LastMessage { get; private set; } = "";

    // ===== Progression =====
    public int CurrentLevel { get; private set; } = 1;

    // ===== Toast (UI-friendly banner) =====
    public sealed record Toast(string Text, ConsoleColor Fg, ConsoleColor Bg, int UntilTick);
    public Toast? ActiveToast { get; private set; }

    public void ShowToast(string text, ConsoleColor fg, ConsoleColor bg, int durationTicks = 8)
    {
        ActiveToast = new Toast(text, fg, bg, Time.Tick + Math.Max(1, durationTicks));
    }

    public void ClearToastIfExpired()
    {
        if (ActiveToast is null) return;
        if (Time.Tick >= ActiveToast.UntilTick) ActiveToast = null;
    }

    public GameContext(GameMap map, Player player, IGameState initialState)
    {
        Map = map;
        Player = player;
        State = initialState;

        SafeZones = new SafeZoneService();
        Doors = new DoorService();
        Vision = new VisionService();
        MonsterSpawner = new MonsterSpawnService(SafeZones);
        ItemService = new ItemService();
    }

    // ===== Queries =====
    public Monster? MonsterAt(Position p)
    => Monsters.FirstOrDefault(m => !m.IsDead && m.Pos == p);

    public Item? ItemAt(Position p)
    => GameItems.FirstOrDefault(i => i.Position == p);

    public void RemoveItem(Item item)
    => GameItems.Remove(item);

    public Chest? ChestAt(Position p)
    => Chests.FirstOrDefault(c => !c.IsOpened && c.Pos == p);

    public Pnj? PnjAt(Position p)
    => Pnjs.FirstOrDefault(n => n.Pos == p);

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

    // ===== Log =====
    public void PushLog(string text, LogKind kind = LogKind.Info)
    {
        if (string.IsNullOrWhiteSpace(text)) return;
        if (_log.Count > 0 && _log[^1].Text == text && _log[^1].Kind == kind) return;

        _log.Add(new LogEntry(kind, text));
        if (_log.Count > LogCapacity)
            _log.RemoveRange(0, _log.Count - LogCapacity);

        LastMessage = text;
        Events.Publish(new LogPushedEvent(kind.ToString(), text));
    }

    public void AddMessage(string msg) => PushLog(msg, LogKind.Info);

    // ===== High-level actions delegated to services =====
    public void UpdateVision() => Vision.Update(this);

    public void AdvanceTimeAfterPlayerMove()
    {
        MonsterSpawner.AdvanceTimeAfterPlayerMove(this);
        ClearToastIfExpired();
    }

    public void OpenChest(Chest chest) => ItemService.OpenChest(this, chest);

    // Doors
    public bool IsDoorClosed(Position pos) => Doors.IsDoorClosed(this, pos);
    public void OpenDoor(Position pos) => Doors.OpenDoor(this, pos);
    public void CloseDoor(Position pos) => Doors.CloseDoor(this, pos);

    public bool IsSafeZone(Position p) => SafeZones.IsSafeZone(this, p);

    // Map3 flags
    public void IncrementSealsActivated() => SealsActivated = Math.Min(3, SealsActivated + 1);
    public void MarkLegendarySwordPicked() => HasLegendarySword = true;
    public void MarkMiniBossDefeated() => MiniBossDefeated = true;
    public void GrantLegendaryEmpower() => LegendaryEmpowerNextFight = true;
    public void ConsumeLegendaryEmpower() => LegendaryEmpowerNextFight = false;
    public void ShowMap3LastSealHintOnce() => Map3LastSealHintShown = true;

    public void BlockNightSpawnsForTicks(int ticks) => MonsterSpawner.BlockNightSpawnsForTicks(ticks);

    public void LoadLevel(int level)
    {
        var data = LevelCatalog.CreateLevel(level);
        ClearLog();
        Pnjs.Clear();
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
        LegendaryEmpowerNextFight = false;
        Map3LastSealHintShown = false;

        ActiveToast = null;

        Map = data.Map;
        Player.SetPosition(data.PlayerStart);

        Monsters.AddRange(data.Monsters);
        GameItems.AddRange(data.Items);
        Chests.AddRange(data.Chests);
        Pnjs.AddRange(data.Pnjs);
        Seals.AddRange(data.Seals);
        Merchant = data.Merchant;

        CurrentLevel = level;
        MonsterSpawner.ResetForNewLevel();

        Console.ResetColor();
        Console.Clear();
        Console.SetCursorPosition(0, 0);

        PushLog(Text.T("level.loaded", ("level", level.ToString())), LogKind.System);
        UpdateVision();
    }
    // ===== Progression helpers (avoid touching Player internals) =====
    public bool TrySpendStatPoint()
    {
        // StatPoints setter est privé => on demande à Player d’exposer un moyen de consommer
        // Si ton Player a déjà une méthode SpendStatPoint() utilise-la ici.
        // Sinon fallback: on ne peut pas.
        var mi = Player.GetType().GetMethod("SpendStatPoint");
        if (mi is not null)
        {
            var ok = (bool)(mi.Invoke(Player, Array.Empty<object>()) ?? false);
            return ok;
        }

        // fallback: si StatPoints a un getter public, on check au moins
        if (Player.StatPoints <= 0) return false;

        // si pas de méthode => on ne modifie pas (setter privé)
        return false;
    }

    public void ApplyUpgrade(int index)
    {
        // 0 PV max (+2), 1 ATK (+1), 2 ARM (+1), 3 CRIT (+2), 4 VOL (+2)
        // On évite les noms spécifiques => reflection sur méthodes existantes.
        switch (index)
        {
            case 0:
                InvokePlayerIntMethod(new[] { "IncreaseMaxHp", "AddMaxHp", "IncreaseHpMax", "UpgradeMaxHp" }, 2);
                break;

            case 1:
                InvokePlayerIntMethod(new[] { "ModifyAttack", "AddAttack", "IncreaseAttack", "UpgradeAttack" }, 1);
                break;

            case 2:
                InvokePlayerIntMethod(new[] { "ModifyArmor", "AddArmor", "IncreaseArmor", "UpgradeArmor" }, 1);
                break;

            case 3:
                InvokePlayerIntMethod(new[] { "ModifyCrit", "AddCrit", "IncreaseCrit", "UpgradeCritChance" }, 2);
                break;

            case 4:
                InvokePlayerIntMethod(new[] { "ModifyLifeSteal", "AddLifeSteal", "IncreaseLifeSteal", "UpgradeLifeSteal" }, 2);
                break;
        }
    }

    private void InvokePlayerIntMethod(string[] names, int value)
    {
        foreach (var name in names)
        {
            var mi = Player.GetType().GetMethod(name, new[] { typeof(int) });
            if (mi is null) continue;
            mi.Invoke(Player, new object[] { value });
            return;
        }

        // Si aucune méthode trouvée => log clair
        PushLog($"[DEV] Méthode Player introuvable pour appliquer upgrade ({value}).", LogKind.Warning);
    }
    public void ClearLog()
    {
        _log.Clear();
        LastMessage = "";
    }

}
