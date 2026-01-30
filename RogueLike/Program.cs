using RogueLike.App;
using RogueLike.App.Services;
using RogueLike.App.States;
using RogueLike.Domain;
using RogueLike.Domain.Catalogs;
using RogueLike.Domain.Entities;
using RogueLike.UI;

// === CONFIG CONSOLE (AVANT TOUT) ===
Console.CursorVisible = false;

if (OperatingSystem.IsWindows())
{
    try
    {
        Console.SetWindowSize(120, 40);
        Console.SetBufferSize(120, 40);
    }
    catch
    {
        // Ignore si la taille n'est pas supportée
    }
}

Console.Clear();

// === INIT JEU ===
var ctx = new GameContext(
    MapCatalog.Level1(),
    new Player(new Position(14, 8)),
    new ExplorationState()
);

ctx.LoadLevel(1);

while (true)
{
    ConsoleRenderer.Draw(ctx, ctx.State.Name);
    ctx.State.Update(ctx);
}
