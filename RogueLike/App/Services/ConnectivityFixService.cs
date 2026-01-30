namespace RogueLike.App.Services;

using RogueLike.App;
using RogueLike.Domain;

public static class ConnectivityFixService
{
    /// <summary>
    /// Garantit que toutes les sorties (TileType.Exit) sont atteignables depuis start.
    /// Si une sortie est isolée, on "creuse" un couloir minimal (L-shape) en Floor.
    /// </summary>
    public static void EnsureAllExitsReachable(GameContext ctx, Position start)
    {
        var exits = FindAllExits(ctx);
        if (exits.Count == 0) return;

        foreach (var exit in exits)
        {
            if (IsReachable(ctx, start, exit)) continue;

            // 1) si c'est juste une porte fermée qui bloque, on tente d'ouvrir le chemin
            // (mais si c'est une île complète de murs, ça ne suffira pas)
            TryOpenDoorsOnDirectLine(ctx, start, exit);

            // re-check
            if (IsReachable(ctx, start, exit)) continue;

            // 2) fallback sûr: on creuse un couloir minimal
            DigLCorridor(ctx, start, exit);

            // re-check final
            if (!IsReachable(ctx, start, exit))
            {
                // en dernier recours, on dig en “Manhattan full” (plus agressif)
                DigManhattan(ctx, start, exit);
            }
        }
    }

    private static List<Position> FindAllExits(GameContext ctx)
    {
        var res = new List<Position>();
        for (int y = 0; y < ctx.Map.Height; y++)
        {
            for (int x = 0; x < ctx.Map.Width; x++)
            {
                var p = new Position(x, y);
                if (ctx.Map.GetTile(p) == TileType.Exit)
                    res.Add(p);
            }
        }
        return res;
    }

    private static bool IsReachable(GameContext ctx, Position start, Position target)
    {
        if (!InBounds(ctx, start) || !InBounds(ctx, target)) return false;

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

                // On considère walkable (Floor / Exit / etc.). DoorClosed bloque.
                if (!ctx.Map.IsWalkable(n)) continue;
                if (ctx.IsDoorClosed(n)) continue;

                seen.Add(n);
                q.Enqueue(n);
            }
        }

        return false;
    }

    private static void TryOpenDoorsOnDirectLine(GameContext ctx, Position a, Position b)
    {
        // petit truc: ouvre les DoorClosed sur un L path
        foreach (var p in LPath(a, b))
        {
            if (ctx.IsDoorClosed(p)) ctx.OpenDoor(p);
        }
    }

    private static void DigLCorridor(GameContext ctx, Position a, Position b)
    {
        foreach (var p in LPath(a, b))
            DigCell(ctx, p);
    }

    private static void DigManhattan(GameContext ctx, Position a, Position b)
    {
        // Creuse plus large : marche vers b en pas unitaires
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

    private static IEnumerable<Position> LPath(Position a, Position b)
    {
        // a -> (b.X, a.Y) -> b
        int sx = Math.Sign(b.X - a.X);
        int sy = Math.Sign(b.Y - a.Y);

        var cur = a;

        while (cur.X != b.X)
        {
            cur = new Position(cur.X + sx, cur.Y);
            yield return cur;
        }

        while (cur.Y != b.Y)
        {
            cur = new Position(cur.X, cur.Y + sy);
            yield return cur;
        }
    }

    private static void DigCell(GameContext ctx, Position p)
    {
        if (!InBounds(ctx, p)) return;

        // ouvre une porte si besoin
        if (ctx.IsDoorClosed(p))
        {
            ctx.OpenDoor(p);
            return;
        }

        // si c'est un mur, on le transforme en sol
        if (ctx.Map.GetTile(p) == TileType.Wall)
        {
            // >>> IMPORTANT : il faut que ton GameMap ait SetTile <<<
            ctx.Map.SetTile(p, TileType.Floor);
            return;
        }

        // si autre, on touche pas
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
}
