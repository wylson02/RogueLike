namespace RogueLike.UI;

using RogueLike.App;

public static class ScreenFX
{
    public static void BigShake(GameContext ctx, string stateName, int shakes = 10, int delayMs = 20)
    {
        // On redessine entre chaque shake pour que ce soit visible.
        for (int i = 0; i < shakes; i++)
        {
            int dx = (i % 2 == 0) ? 1 : -1;

            Console.Clear();
            // Décalage horizontal (simple mais efficace en console)
            Console.SetCursorPosition(Math.Max(0, dx + 1), 0);
            ConsoleRenderer.Draw(ctx, stateName);

            Thread.Sleep(delayMs);
        }

        Console.Clear();
        ConsoleRenderer.Draw(ctx, stateName);
    }

    public static void Banner(string text, ConsoleColor fg, int ms = 300)
    {
        int w = Math.Min(Console.WindowWidth - 1, Math.Max(20, text.Length + 6));
        int x = Math.Max(0, (Console.WindowWidth - w) / 2);
        int y = 1;

        string top = "╔" + new string('═', w - 2) + "╗";
        string mid = "║" + Center(text, w - 2) + "║";
        string bot = "╚" + new string('═', w - 2) + "╝";

        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write(top);

        Console.SetCursorPosition(x, y + 1);
        Console.ForegroundColor = fg;
        Console.Write(mid);

        Console.SetCursorPosition(x, y + 2);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write(bot);

        Console.ResetColor();
        Thread.Sleep(ms);
    }

    private static string Center(string s, int w)
    {
        if (s.Length >= w) return s[..w];
        int pad = (w - s.Length);
        int left = pad / 2;
        int right = pad - left;
        return new string(' ', left) + s + new string(' ', right);
    }
}
