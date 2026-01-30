using RogueLike.App;
using RogueLike.App.Services;
using RogueLike.App.States;
using RogueLike.Domain;
using RogueLike.Domain.Entities;
using RogueLike.UI;

internal static class Program
{
    private static void Main()
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        Console.Title = "RogueLike";

        // Boot minimal (level 1 par défaut)
        var level1 = LevelCatalog.CreateLevel(1);

        var player = new Player(level1.PlayerStart);
        var ctx = new GameContext(level1.Map, player, initialState: new MainMenuState());

        // On charge proprement le niveau 1 (spawn, items, coffres, mobs, log, vision...)
        // MAIS on reste sur MainMenuState jusqu'à "Lancer"
        ctx.LoadLevel(1);
        ctx.State = new MainMenuState();

        // Loop
        while (true)
        {
            // draw (menu rend lui-même; sinon renderer normal)
            if (ctx.State is MainMenuState)
            {
                ctx.State.Update(ctx);
                continue;
            }

            // rendu normal gameplay
            ConsoleRenderer.Draw(ctx, ctx.State.Name);

            ctx.State.Update(ctx);
        }
    }
}
