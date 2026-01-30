namespace RogueLike.App.Services;

using RogueLike.App;
using RogueLike.Domain;

public sealed class VisionService
{
    public void Update(GameContext ctx)
    {
        int radius = Math.Max(1, ctx.Player.VisionRadius + ctx.Player.LightBonus);

        ctx.VisibleTiles.Clear();

        for (int dy = -radius; dy <= radius; dy++)
            for (int dx = -radius; dx <= radius; dx++)
            {
                int x = ctx.Player.Pos.X + dx;
                int y = ctx.Player.Pos.Y + dy;

                if (dx * dx + dy * dy > radius * radius) continue;
                if (x < 0 || y < 0 || x >= ctx.Map.Width || y >= ctx.Map.Height) continue;

                var p = new Position(x, y);
                ctx.VisibleTiles.Add(p);
                ctx.DiscoveredTiles.Add(p);
            }

        ctx.VisibleTiles.Add(ctx.Player.Pos);
        ctx.DiscoveredTiles.Add(ctx.Player.Pos);
    }
}
