namespace RogueLike.App.Services;

using RogueLike.App;
using RogueLike.Domain;
using RogueLike.Domain.Catalogs;
using RogueLike.Domain.Entities;

public sealed class MonsterSpawnService
{
    private readonly SafeZoneService _safeZones;

    private int _nightSpawnBlockUntilTick = 0;

    public MonsterSpawnService(SafeZoneService safeZones)
    {
        _safeZones = safeZones;
    }

    public void ResetForNewLevel()
    {
        _nightSpawnBlockUntilTick = 0;
    }

    public void BlockNightSpawnsForTicks(int ticks)
    {
        // compat: si appelé sans ctx, noop (géré dans la surcharge avec ctx si besoin)
    }

    public void BlockNightSpawnsForTicks(int ticks, GameContext ctx)
    {
        _nightSpawnBlockUntilTick = Math.Max(_nightSpawnBlockUntilTick, ctx.Time.Tick + Math.Max(0, ticks));
    }

    /// <summary>
    /// IMPORTANT : ici on NE touche PAS au TimeSystem (pas de TickOnce),
    /// parce que ton GameContext gère déjà le tick dans AdvanceTimeAfterPlayerMove().
    /// Ce service ne fait que réagir à l'état actuel (jour/nuit) + spawn.
    /// </summary>
    public void AdvanceTimeAfterPlayerMove(GameContext ctx)
    {
        // buff nocturne (à chaque move)
        if (ctx.Time.IsNight)
        {
            foreach (var m in ctx.Monsters)
            {
                if (!m.IsDead) m.ModifyAttack(+1);
            }
        }

        // spawn nocturne
        TryNightSpawn(ctx);
    }

    private void TryNightSpawn(GameContext ctx)
    {
        if (!ctx.Time.IsNight) return;
        if (ctx.Time.Tick < _nightSpawnBlockUntilTick) return;

        int alive = ctx.Monsters.Count(m => !m.IsDead);
        if (alive >= 10) return;

        // 20% chance
        if (ctx.Rng.Next(0, 100) > 20) return;

        var pos = FindSpawnCell(ctx);
        if (pos is null) return;

        var mob = MonsterCatalog.NightSlime(pos.Value);

        ctx.Monsters.Add(mob);
        ctx.PushLog("Une présence nocturne se matérialise…", GameContext.LogKind.Warning);
    }

    // ===================== SPAWN SAFETY =====================

    private Position? FindSpawnCell(GameContext ctx)
    {
        // marge: empêche les spawns collés aux bords
        const int margin = 1;

        for (int i = 0; i < 80; i++)
        {
            int x = ctx.Rng.Next(margin, ctx.Map.Width - margin);
            int y = ctx.Rng.Next(margin, ctx.Map.Height - margin);
            var p = new Position(x, y);

            if (!IsValidSpawnCell(ctx, p)) continue;

            return p;
        }

        // fallback scan sûr
        for (int y = margin; y < ctx.Map.Height - margin; y++)
        {
            for (int x = margin; x < ctx.Map.Width - margin; x++)
            {
                var p = new Position(x, y);
                if (IsValidSpawnCell(ctx, p)) return p;
            }
        }

        return null;
    }

    private bool IsValidSpawnCell(GameContext ctx, Position p)
    {
        if (!ctx.Map.IsWalkable(p)) return false;
        if (p == ctx.Player.Pos) return false;

        if (ctx.MonsterAt(p) is not null) return false;
        if (ctx.ItemAt(p) is not null) return false;
        if (ctx.ChestAt(p) is not null) return false;
        if (ctx.SealAt(p) is not null) return false;
        if (ctx.IsMerchantAt(p)) return false;

        if (_safeZones.IsSafeZone(ctx, p)) return false;

        // évite les cases collées aux murs
        if (TouchesWall(ctx, p)) return false;

        return true;
    }

    private bool TouchesWall(GameContext ctx, Position p)
    {
        var n = new[]
        {
            new Position(p.X+1, p.Y),
            new Position(p.X-1, p.Y),
            new Position(p.X, p.Y+1),
            new Position(p.X, p.Y-1),
        };

        foreach (var q in n)
        {
            if (q.X < 0 || q.Y < 0 || q.X >= ctx.Map.Width || q.Y >= ctx.Map.Height) return true;
            if (ctx.Map.GetTile(q) == TileType.Wall) return true;
        }

        return false;
    }
}
