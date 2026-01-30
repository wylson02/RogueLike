namespace RogueLike.App.Services;

using RogueLike.App;
using RogueLike.Domain;
using RogueLike.Domain.Entities;

public static class BossSpawnFixService
{
    /// <summary>
    /// Garantit que le boss est attaquable :
    /// - au moins une case adjacente walkable autour du boss
    /// - et un chemin atteignable depuis le joueur (si besoin on creuse).
    /// </summary>
    public static void EnsureBossReachable(GameContext ctx)
    {
        var boss = FindBoss(ctx);
        if (boss is null) return;

        var b = boss.Pos;

        // 1) Ouvre au moins une sortie autour du boss si il est enfermé
        if (!HasAnyWalkableNeighbor(ctx, b))
        {
            CarveOneNeighbor(ctx, b);
        }

        // 2) Si toujours pas atteignable -> creuse un chemin vers le joueur
        if (!IsReachable(ctx, ctx.Player.Pos, b))
        {
            DigManhattan(ctx, ctx.Player.Pos, b);
        }
    }

    private static Monster? FindBoss(GameContext ctx)
    {
        // Si tu as un MonsterRank.Boss => prioritaire
        var byRank = ctx.Monsters.FirstOrDefault(m => !m.IsDead && m.Rank == MonsterRank.Boss);
        if (byRank is not null) return byRank;

        // fallback : le monstre le plus "fort" ou le dernier ajouté
        return ctx.Monsters.LastOrDefault(m => !m.IsDead);
    }

    private static bool HasAnyWalkableNeighbor(GameContext ctx, Position p)
    {
        foreach (var n in Neigh4(p))
        {
            if (!InBounds(ctx, n)) continue;

            // walkable + pas door closed
            if (ctx.Map.IsWalkable(n) && !ctx.IsDoorClosed(n))
                return true;
        }
        return false;
    }

    private static void CarveOneNeighbor(GameContext ctx, Position bossPos)
    {
        // On choisit le mur le plus "vers le joueur" pour être logique
        var pp = ctx.Player.Pos;

        var candidates = Neigh4(bossPos)
            .Where(n => InBounds(ctx, n))
            .OrderBy(n => DistManhattan(n, pp))
            .ToList();

        foreach (var n in candidates)
        {
            // si porte fermée -> ouvrir
            if (ctx.IsDoorClosed(n))
            {
                ctx.OpenDoor(n);
                return;
            }

            // si mur -> casser
            if (ctx.Map.GetTile(n) == TileType.Wall)
            {
                ctx.Map.SetTile(n, TileType.Floor);
                return;
            }
        }

        // fallback: casse quand même un mur à 2 cases
        foreach (var n in candidates)
        {
            foreach (var nn in Neigh4(n))
            {
                if (!InBounds(ctx, nn)) continue;
                if (ctx.Map.GetTile(nn) == TileType.Wall)
                {
                    ctx.Map.SetTile(nn, TileType.Floor);
                    return;
                }
            }
        }
    }

    private static bool IsReachable(GameContext ctx, Position start, Position target)
    {
        var q = new Queue<Position>();
        var seen = new HashSet<Position>();

        q.Enqueue(start);
        seen.Add(start);

        while (q.Count > 0)
        {
            var cur = q.Dequeue();
            if (cur == target) return true;

            foreach (var n in Neigh4(cur))
            {
                if (!InBounds(ctx, n)) continue;
                if (seen.Contains(n)) continue;

                if (!ctx.Map.IsWalkable(n)) continue;
                if (ctx.IsDoorClosed(n)) continue;

                // on permet de marcher sur la case boss (target) même si occupée
                // mais on empêche de traverser d'autres monstres
                if (n != target && ctx.MonsterAt(n) is not null) continue;

                seen.Add(n);
                q.Enqueue(n);
            }
        }

        return false;
    }

    private static void DigManhattan(GameContext ctx, Position a, Position b)
    {
        var cur = a;

        while (cur.X != b.X)
        {
            cur = new Position(cur.X + Math.Sign(b.X - cur.X), cur.Y);
            DigCell(ctx, cur);
        }
        while (cur.Y != b.Y)
        {
            cur = new Position(cur.X, cur.Y + Math.Sign(b.Y - cur.Y));
            DigCell(ctx, cur);
        }
    }

    private static void DigCell(GameContext ctx, Position p)
    {
        if (!InBounds(ctx, p)) return;

        if (ctx.IsDoorClosed(p))
        {
            ctx.OpenDoor(p);
            return;
        }

        if (ctx.Map.GetTile(p) == TileType.Wall)
        {
            ctx.Map.SetTile(p, TileType.Floor);
        }
    }

    private static bool InBounds(GameContext ctx, Position p)
        => p.X >= 0 && p.Y >= 0 && p.X < ctx.Map.Width && p.Y < ctx.Map.Height;

    private static IEnumerable<Position> Neigh4(Position p)
    {
        yield return new Position(p.X + 1, p.Y);
        yield return new Position(p.X - 1, p.Y);
        yield return new Position(p.X, p.Y + 1);
        yield return new Position(p.X, p.Y - 1);
    }

    private static int DistManhattan(Position a, Position b)
        => Math.Abs(a.X - b.X) + Math.Abs(a.Y - b.Y);
}
