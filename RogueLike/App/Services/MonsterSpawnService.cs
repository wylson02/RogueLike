namespace RogueLike.App.Services;

using RogueLike.App;
using RogueLike.Domain;
using RogueLike.Domain.Catalogs;
using System.Linq;

public sealed class MonsterSpawnService
{
    private const int MaxAliveMonsters = 10;
    private const int MaxNightSpawnsPerNight = 2;

    private int _nightSpawnedThisNight = 0;
    private bool _nightBuffApplied = false;
    private int _noNightSpawnTicks = 0;

    private readonly SafeZoneService _safeZone;

    public MonsterSpawnService(SafeZoneService safeZone) => _safeZone = safeZone;

    public void ResetForNewLevel()
    {
        _nightSpawnedThisNight = 0;
        _nightBuffApplied = false;
        _noNightSpawnTicks = 0;
    }

    public void BlockNightSpawnsForTicks(int ticks)
        => _noNightSpawnTicks = Math.Max(_noNightSpawnTicks, Math.Max(0, ticks));

    public void AdvanceTimeAfterPlayerMove(GameContext ctx)
    {
        bool phaseChanged = ctx.Time.Advance();

        if (phaseChanged)
        {
            if (ctx.Time.IsNight) ApplyNightStart(ctx);
            else ApplyDayStart(ctx);
        }

        if (ctx.Time.IsNight && ctx.Time.Tick % 10 == 0)
            TrySpawnNightMonster(ctx);
    }

    private void ApplyNightStart(GameContext ctx)
    {
        _nightSpawnedThisNight = 0;

        if (_nightBuffApplied) return;
        _nightBuffApplied = true;

        foreach (var m in ctx.Monsters.Where(m => !m.IsDead))
            m.ModifyAttack(+2);
    }

    private void ApplyDayStart(GameContext ctx)
    {
        if (!_nightBuffApplied) return;
        _nightBuffApplied = false;

        foreach (var m in ctx.Monsters.Where(m => !m.IsDead))
            m.ModifyAttack(-2);
    }

    private void TrySpawnNightMonster(GameContext ctx)
    {
        if (_noNightSpawnTicks > 0)
        {
            _noNightSpawnTicks--;
            return;
        }

        int alive = ctx.Monsters.Count(m => !m.IsDead);
        if (alive >= MaxAliveMonsters) return;
        if (_nightSpawnedThisNight >= MaxNightSpawnsPerNight) return;

        for (int tries = 0; tries < 60; tries++)
        {
            var p = new Position(ctx.Rng.Next(1, ctx.Map.Width - 1), ctx.Rng.Next(1, ctx.Map.Height - 1));

            if (_safeZone.IsSafeZone(ctx, p)) continue;
            if (!ctx.Map.IsWalkable(p)) continue;
            if (p == ctx.Player.Pos) continue;
            if (ctx.MonsterAt(p) is not null) continue;

            ctx.Monsters.Add(MonsterCatalog.NightSlime(p));
            _nightSpawnedThisNight++;
            return;
        }
    }
}
