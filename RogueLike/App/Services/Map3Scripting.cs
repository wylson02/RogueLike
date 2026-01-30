namespace RogueLike.App.Services;

using RogueLike.App;
using RogueLike.Domain;
using RogueLike.Domain.Catalogs;
using RogueLike.Domain.Entities;

public static class Map3Scripting
{
    private static readonly Position[] CentralDoors =
    {
        new Position(18, 6),
        new Position(25, 6),
        new Position(21, 4),
        new Position(21, 9),
    };

    private static readonly Position[] ExitDoors =
    {
        new Position(35, 7),
        new Position(35, 11),
    };

    public static void OpenCentralDoors(GameContext ctx)
    {
        foreach (var p in CentralDoors)
            ctx.OpenDoor(p);
    }

    public static void CloseCentralDoors(GameContext ctx)
    {
        foreach (var p in CentralDoors)
            ctx.CloseDoor(p);
    }

    public static void OpenExitDoors(GameContext ctx)
    {
        foreach (var p in ExitDoors)
            ctx.OpenDoor(p);
    }

    public static void CloseExitDoors(GameContext ctx)
    {
        foreach (var p in ExitDoors)
            ctx.CloseDoor(p);
    }

    public static void TriggerLegendarySwordEvent(GameContext ctx, Position fromPos)
    {
        if (ctx.CurrentLevel != 3) return;
        if (!ctx.HasLegendarySword) return;

        CloseCentralDoors(ctx);
        CloseExitDoors(ctx);

        ctx.PushLog("Quand vos doigts se referment sur la garde, la pierre gronde...", GameContext.LogKind.System);
        ctx.PushLog("Les portes claquent. Un froid ancien traverse la salle.", GameContext.LogKind.System);

        var spawn = FindSpawnBehind(ctx, fromPos);

        bool enraged = ctx.Rng.Next(0, 100) < 10;
        var warden = enraged
            ? MonsterCatalog.SealWardenMiniBossEnraged(spawn)
            : MonsterCatalog.SealWardenMiniBoss(spawn);

        ctx.Monsters.Add(warden);

        if (enraged)
            ctx.PushLog("Le sol se fissure. Le Gardien hurle : il est ENRAGÉ.", GameContext.LogKind.System);

        ctx.PushLog("Une silhouette se détache des ombres : le Gardien des Sceaux.", GameContext.LogKind.Combat);
        ctx.PushLog("\"Rends-la... ou sois le dernier à tomber ici.\"", GameContext.LogKind.System);

        ctx.UpdateVision();
    }

    public static void OnMiniBossDefeated(GameContext ctx)
    {
        if (ctx.CurrentLevel != 3) return;
        if (!ctx.HasLegendarySword) return;

        ctx.MarkMiniBossDefeated();

        OpenCentralDoors(ctx);
        OpenExitDoors(ctx);

        ctx.PushLog("Le Gardien s'effondre, et les verrous se relâchent.", GameContext.LogKind.System);
        ctx.PushLog("Les portes se rouvrent. Le chemin est libre.", GameContext.LogKind.System);

        int heal = 4;
        ctx.Player.Heal(heal);
        ctx.BlockNightSpawnsForTicks(30);

        ctx.PushLog($"Vous reprenez votre souffle. +{heal} PV.", GameContext.LogKind.Info);
        ctx.PushLog("Le temple se tait… pour l’instant.", GameContext.LogKind.System);
    }

    private static Position FindSpawnBehind(GameContext ctx, Position preferred)
    {
        if (ctx.Map.IsWalkable(preferred) && ctx.MonsterAt(preferred) is null && preferred != ctx.Player.Pos)
            return preferred;

        var around = new[]
        {
            ctx.Player.Pos.Move(Direction.Left),
            ctx.Player.Pos.Move(Direction.Right),
            ctx.Player.Pos.Move(Direction.Up),
            ctx.Player.Pos.Move(Direction.Down),
        };

        foreach (var p in around)
            if (ctx.Map.IsWalkable(p) && ctx.MonsterAt(p) is null && p != ctx.Player.Pos)
                return p;

        return preferred;
    }
}
