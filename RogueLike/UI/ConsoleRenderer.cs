namespace RogueLike.UI;

using RogueLike.App;
using RogueLike.Domain;

public static class ConsoleRenderer
{
    public static void Draw(GameContext ctx, string stateName)
    {
        Console.CursorVisible = false;
        Console.SetCursorPosition(0, 0);

        for (int y = 0; y < ctx.Map.Height; y++)
        {
            for (int x = 0; x < ctx.Map.Width; x++)
            {
                var p = new Position(x, y);

                char c = ctx.Map.GetTile(p) switch
                {
                    TileType.Wall => '#',
                    TileType.Exit => 'E',
                    _ => '.'
                };

                var item = ctx.ItemAt(p);
                if (item is not null)
                    c = item.Glyph;

                if (ctx.MonsterAt(p) is not null)
                    c = 'M';

                if (ctx.Player.Pos == p)
                    c = '@';

                Console.Write(c);
            }
            Console.WriteLine();
        }

        Console.WriteLine($"State: {stateName} | PV: {ctx.Player.Hp}/{ctx.Player.MaxHp} | ATK: {ctx.Player.Attack} | ARM: {ctx.Player.Armor}");

        DrawTimeBar(ctx);
        Console.WriteLine("Flèches ou ZQSD pour bouger.");
        Console.WriteLine(ctx.LastMessage);

    }

    private static void DrawTimeBar(GameContext ctx)
    {
        bool night = ctx.Time.IsNight;
        string icon = night ? "🌙" : "☀️";
        string phase = night ? "NUIT" : "JOUR";

        int barLen = 24;
        int filled = (int)Math.Round(ctx.Time.Progress01 * barLen);
        filled = Math.Clamp(filled, 0, barLen);

        string bar = "[" + new string('=', filled) + new string(' ', barLen - filled) + "]";

        Console.WriteLine($"{icon} Temps: {phase} {bar}  {ctx.Time.TickInPhase}/{ctx.Time.PhaseLength}  (t={ctx.Time.Tick})");
    }
}
