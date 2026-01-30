namespace RogueLike.App.Services;

using RogueLike.App;
using RogueLike.Domain;

public sealed class SafeZoneService
{
    public bool IsSafeZone(GameContext ctx, Position p)
    {
        // Map3 : salle marchand (doit matcher MapCatalog.Level3)
        if (ctx.CurrentLevel == 3)
        {
            if (p.X >= 35 && p.X <= 42 && p.Y >= 5 && p.Y <= 10)
                return true;
        }
        return false;
    }
}
