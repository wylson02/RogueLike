namespace RogueLike.App.Services;

using RogueLike.App;
using RogueLike.Domain;

public sealed class DoorService
{
    public bool IsDoorClosed(GameContext ctx, Position pos)
        => ctx.Map.InBounds(pos) && ctx.Map.GetTile(pos) == TileType.DoorClosed;

    public void OpenDoor(GameContext ctx, Position pos)
    {
        if (!ctx.Map.InBounds(pos)) return;
        if (ctx.Map.GetTile(pos) == TileType.DoorClosed)
            ctx.Map.SetTile(pos, TileType.DoorOpen);
    }

    public void CloseDoor(GameContext ctx, Position pos)
    {
        if (!ctx.Map.InBounds(pos)) return;
        if (ctx.Map.GetTile(pos) == TileType.DoorOpen)
            ctx.Map.SetTile(pos, TileType.DoorClosed);
    }
}
