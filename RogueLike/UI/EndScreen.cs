namespace RogueLike.UI;

using RogueLike.App;

public static class EndScreen
{
    public static void Play(GameContext ctx, bool victory)
    {
        Console.CursorVisible = false;
        Console.Clear();

        if (victory)
        {
            FlashBackground(times: 2, delayMs: 60);
            Fireworks(durationMs: 1200);
        }
        else
        {
            Glitch(durationMs: 650);
        }

        Console.Clear();
        DrawFrame();

        if (victory) DrawVictory(ctx);
        else DrawDefeat(ctx);

        DrawFooter(victory);

        while (Console.KeyAvailable) Console.ReadKey(true);
        Console.ReadKey(true);
    }

    private static void DrawVictory(GameContext ctx)
    {
        var title = new[]
        {
            @"██╗   ██╗██╗ ██████╗████████╗ ██████╗ ██╗██████╗ ███████╗",
            @"██║   ██║██║██╔════╝╚══██╔══╝██╔═══██╗██║██╔══██╗██╔════╝",
            @"██║   ██║██║██║        ██║   ██║   ██║██║██████╔╝█████╗  ",
            @"╚██╗ ██╔╝██║██║        ██║   ██║   ██║██║██╔══██╗██╔══╝  ",
            @" ╚████╔╝ ██║╚██████╗   ██║   ╚██████╔╝██║██║  ██║███████╗",
            @"  ╚═══╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝╚═╝  ╚═╝╚══════╝"
        };

        int topY = 3;
        WriteCenteredBlock(title, topY, rainbow: true);

        Console.ForegroundColor = ConsoleColor.Yellow;
        WriteCentered("✨ TU AS TRIOMPHÉ DU TEMPLE — LA LAME T’ACCEPTE ✨", topY + title.Length + 1);
        Console.ResetColor();

        DrawStatsBox(ctx, y: topY + title.Length + 3);
    }

    private static void DrawDefeat(GameContext ctx)
    {
        var title = new[]
        {
            @" ██████╗  █████╗ ███╗   ███╗███████╗",
            @"██╔════╝ ██╔══██╗████╗ ████║██╔════╝",
            @"██║  ███╗███████║██╔████╔██║█████╗  ",
            @"██║   ██║██╔══██║██║╚██╔╝██║██╔══╝  ",
            @"╚██████╔╝██║  ██║██║ ╚═╝ ██║███████╗",
            @" ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝",
            @"",
            @" ██████╗ ██╗   ██╗███████╗██████╗ ",
            @"██╔═══██╗██║   ██║██╔════╝██╔══██╗",
            @"██║   ██║██║   ██║█████╗  ██████╔╝",
            @"██║   ██║╚██╗ ██╔╝██╔══╝  ██╔══██╗",
            @"╚██████╔╝ ╚████╔╝ ███████╗██║  ██║",
            @" ╚═════╝   ╚═══╝  ╚══════╝╚═╝  ╚═╝"
        };

        int topY = 3;
        Console.ForegroundColor = ConsoleColor.Red;
        WriteCenteredBlock(title, topY, rainbow: false, color: ConsoleColor.Red);

        Console.ForegroundColor = ConsoleColor.DarkGray;
        WriteCentered("Le donjon garde ses secrets… mais tu reviendras.", topY + title.Length + 1);
        Console.ResetColor();

        DrawStatsBox(ctx, y: topY + title.Length + 3);
    }

    private static void DrawStatsBox(GameContext ctx, int y)
    {
        int w = Math.Min(Console.WindowWidth - 4, 66);
        w = Math.Max(48, w);
        int x = (Console.WindowWidth - w) / 2;

        int hpShown = Math.Max(0, ctx.Player.Hp); // ✅ pas de PV négatifs affichés
        string[] lines =
        {
            $"Niveau : {ctx.Player.Level}".PadRight(w - 4),
            $"PV : {hpShown}/{ctx.Player.MaxHp}".PadRight(w - 4),
            $"ATK : {ctx.Player.Attack}   ARM : {ctx.Player.Armor}".PadRight(w - 4),
            $"CRIT : {ctx.Player.CritChancePercent}%   VOL : {ctx.Player.LifeStealPercent}%".PadRight(w - 4),
            $"OR : {ctx.Player.Gold}".PadRight(w - 4),
        };

        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.SetCursorPosition(x, y);
        Console.Write("╔" + new string('═', w - 2) + "╗");

        Console.SetCursorPosition(x, y + 1);
        Console.Write("║");
        Console.ForegroundColor = ConsoleColor.Cyan;
        WriteFitCentered("RÉCAP", w - 2);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write("║");

        Console.SetCursorPosition(x, y + 2);
        Console.Write("╠" + new string('═', w - 2) + "╣");

        for (int i = 0; i < lines.Length; i++)
        {
            Console.SetCursorPosition(x, y + 3 + i);
            Console.ForegroundColor = ConsoleColor.DarkGray;
            Console.Write("║ ");
            Console.ResetColor();
            Console.Write(lines[i][..Math.Min(lines[i].Length, w - 4)]);
            Console.ForegroundColor = ConsoleColor.DarkGray;
            Console.Write(" ║");
        }

        Console.SetCursorPosition(x, y + 3 + lines.Length);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write("╚" + new string('═', w - 2) + "╝");
        Console.ResetColor();
    }

    private static void DrawFooter(bool victory)
    {
        Console.ForegroundColor = ConsoleColor.DarkGray;
        string msg = victory
            ? "ENTRÉE : relancer une run (démo)."
            : "ENTRÉE : réessayer.";

        WriteCentered(msg, Console.WindowHeight - 2);
        Console.ResetColor();
    }

    // ========== FX ==========

    private static void Fireworks(int durationMs)
    {
        var rnd = new Random();
        var colors = new[]
        {
            ConsoleColor.Cyan, ConsoleColor.Yellow, ConsoleColor.Magenta,
            ConsoleColor.Green, ConsoleColor.White, ConsoleColor.Red
        };

        int w = Math.Max(20, Console.WindowWidth);
        int h = Math.Max(10, Console.WindowHeight);

        int end = Environment.TickCount + durationMs;

        while (Environment.TickCount < end)
        {
            int x = rnd.Next(2, Math.Max(3, w - 2));
            int y = rnd.Next(2, Math.Max(3, h - 3));

            Console.ForegroundColor = colors[rnd.Next(colors.Length)];
            Console.SetCursorPosition(x, y);
            Console.Write(rnd.Next(0, 4) switch
            {
                0 => '*',
                1 => '✦',
                2 => '✺',
                _ => '•'
            });

            Thread.Sleep(8);
        }

        Console.ResetColor();
    }

    private static void FlashBackground(int times, int delayMs)
    {
        var prevBg = Console.BackgroundColor;
        var prevFg = Console.ForegroundColor;

        for (int i = 0; i < times; i++)
        {
            Console.BackgroundColor = ConsoleColor.DarkBlue;
            Console.ForegroundColor = ConsoleColor.White;
            Console.Clear();
            Thread.Sleep(delayMs);

            Console.BackgroundColor = ConsoleColor.Black;
            Console.ForegroundColor = ConsoleColor.Gray;
            Console.Clear();
            Thread.Sleep(delayMs);
        }

        Console.BackgroundColor = prevBg;
        Console.ForegroundColor = prevFg;
        Console.Clear();
    }

    private static void Glitch(int durationMs)
    {
        var rnd = new Random();
        int end = Environment.TickCount + durationMs;

        while (Environment.TickCount < end)
        {
            Console.Clear();
            Console.ForegroundColor = ConsoleColor.DarkRed;

            for (int i = 0; i < 12; i++)
            {
                int y = rnd.Next(1, Math.Max(2, Console.WindowHeight - 2));
                Console.SetCursorPosition(0, y);
                Console.Write(new string(rnd.NextDouble() < 0.5 ? '█' : '▒', Math.Max(10, Console.WindowWidth - 1)));
            }

            Console.ResetColor();
            Thread.Sleep(45);
        }
        Console.Clear();
    }

    private static void DrawFrame()
    {
        int w = Console.WindowWidth;
        int h = Console.WindowHeight;
        if (w < 20 || h < 10) return;

        Console.ForegroundColor = ConsoleColor.DarkGray;

        Console.SetCursorPosition(0, 0);
        Console.Write('╔' + new string('═', w - 2) + '╗');

        for (int y = 1; y < h - 2; y++)
        {
            Console.SetCursorPosition(0, y);
            Console.Write('║');
            Console.SetCursorPosition(w - 1, y);
            Console.Write('║');
        }

        Console.SetCursorPosition(0, h - 2);
        Console.Write('╚' + new string('═', w - 2) + '╝');

        Console.ResetColor();
    }

    // ========== Helpers ==========

    private static void WriteCentered(string text, int y)
    {
        int w = Console.WindowWidth;
        if (w <= 0) return;

        text = text.Length > w - 2 ? text[..(w - 3)] + "…" : text;
        int x = Math.Max(0, (w - text.Length) / 2);
        y = Math.Clamp(y, 0, Math.Max(0, Console.WindowHeight - 1));

        Console.SetCursorPosition(x, y);
        Console.Write(text);
    }

    private static void WriteCenteredBlock(string[] lines, int topY, bool rainbow, ConsoleColor color = ConsoleColor.Cyan)
    {
        for (int i = 0; i < lines.Length; i++)
        {
            if (rainbow)
            {
                Console.ForegroundColor = (i % 6) switch
                {
                    0 => ConsoleColor.Cyan,
                    1 => ConsoleColor.Yellow,
                    2 => ConsoleColor.Magenta,
                    3 => ConsoleColor.Green,
                    4 => ConsoleColor.White,
                    _ => ConsoleColor.Cyan
                };
            }
            else
            {
                Console.ForegroundColor = color;
            }

            WriteCentered(lines[i], topY + i);
        }

        Console.ResetColor();
    }

    private static void WriteFitCentered(string text, int width)
    {
        if (width <= 0) return;
        if (text.Length > width) text = text[..(width - 1)] + "…";

        int left = (width - text.Length) / 2;
        Console.Write(new string(' ', Math.Max(0, left)));
        Console.Write(text);
        Console.Write(new string(' ', Math.Max(0, width - left - text.Length)));
    }
}
