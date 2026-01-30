namespace RogueLike.UI;

using RogueLike.Domain.Entities;

public static class BossIntroScreen
{
    public static void Play(Player player, string bossName)
    {
        Console.CursorVisible = false;
        Console.ResetColor();
        Console.Clear();
        Console.SetCursorPosition(0, 0);

        int w = Math.Max(78, Console.WindowWidth - 1);
        int h = Math.Max(26, Console.WindowHeight - 1);

        // 1) rideau + pause
        Curtain(w, h, steps: 12, delayMs: 20);
        Thread.Sleep(180);

        Console.Clear();
        CenterBox(w, y: 2, title: "DERNIÈRE PORTE");

        var lines = new[]
        {
            "Le temple se tait.",
            "Ton souffle résonne contre la pierre.",
            "La Lame de Légende vibre… comme si elle reconnaissait un nom.",
            "",
            $"— {bossName} —",
            "",
            "Au bout du couloir : un trône fissuré.",
            "Si tu avances… il n’y aura plus de retour.",
            "",
            "ENTRÉE : franchir le seuil."
        };

        WriteCenteredLines(w, startY: 6, lines);

        // 2) pulse lisible
        PulseLine(w, y: h - 6, text: "LA LAME PULSE…", pulses: 4);

        // 3) attendre le joueur (IMPORTANT pour lire)
        WaitEnter();

        // 4) flash + shake + petit suspense
        Console.Clear();
        Flash(title: "⚔  BOSS FINAL  ⚔", fg: ConsoleColor.Black, bg: ConsoleColor.DarkRed, ms: 520);
        ShakeWhole(shakes: 10, delayMs: 16);
        Thread.Sleep(180);

        Console.ResetColor();
        Console.Clear();
        CenterBox(w, y: 2, title: "PRÉPARE-TOI");

        var recap = new[]
        {
            $"PV : {player.Hp}/{player.MaxHp}",
            $"ATK: {player.Attack}   ARM: {player.Armor}",
            $"CRIT: {player.CritChancePercent}%   VOL: {player.LifeStealPercent}%",
            "",
            "ENTRÉE : commencer le combat."
        };

        WriteCenteredLines(w, startY: 7, recap);

        WaitEnter();

        Console.ResetColor();
        Console.Clear();
        Console.SetCursorPosition(0, 0);
    }

    private static void WaitEnter()
    {
        while (Console.KeyAvailable) Console.ReadKey(true);
        Console.ReadKey(true);
        while (Console.KeyAvailable) Console.ReadKey(true);
    }

    private static void Curtain(int w, int h, int steps, int delayMs)
    {
        for (int s = 0; s < steps; s++)
        {
            Console.Clear();
            int filled = (int)Math.Round((double)(s + 1) / steps * h);

            Console.BackgroundColor = ConsoleColor.Black;
            for (int y = 0; y < filled; y++)
            {
                Console.SetCursorPosition(0, y);
                Console.Write(new string(' ', w));
            }
            Console.ResetColor();
            Thread.Sleep(delayMs);
        }
    }

    private static void CenterBox(int w, int y, string title)
    {
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.SetCursorPosition(0, y);
        Console.WriteLine("┌" + new string('─', Math.Max(0, w - 2)) + "┐");

        Console.SetCursorPosition(0, y + 1);
        Console.Write("│");
        Console.SetCursorPosition(w - 1, y + 1);
        Console.WriteLine("│");

        string t = $" {title} ";
        int x = Math.Max(1, (w - t.Length) / 2);
        Console.SetCursorPosition(x, y + 1);
        Console.ForegroundColor = ConsoleColor.Black;
        Console.BackgroundColor = ConsoleColor.DarkGray;
        Console.Write(t);
        Console.ResetColor();

        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.SetCursorPosition(0, y + 2);
        Console.WriteLine("└" + new string('─', Math.Max(0, w - 2)) + "┘");
        Console.ResetColor();
    }

    private static void WriteCenteredLines(int w, int startY, IEnumerable<string> lines)
    {
        int y = startY;
        foreach (var l in lines)
        {
            var txt = l ?? "";
            int x = Math.Max(0, (w - txt.Length) / 2);
            Console.SetCursorPosition(x, y++);

            if (txt.StartsWith("—") && txt.EndsWith("—"))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.Write(txt);
                Console.ResetColor();
            }
            else if (txt.StartsWith("ENTRÉE"))
            {
                Console.ForegroundColor = ConsoleColor.DarkGray;
                Console.Write(txt);
                Console.ResetColor();
            }
            else
            {
                Console.ForegroundColor = ConsoleColor.Gray;
                Console.Write(txt);
                Console.ResetColor();
            }
        }
    }

    private static void PulseLine(int w, int y, string text, int pulses)
    {
        int x = Math.Max(0, (w - text.Length) / 2);

        for (int i = 0; i < pulses; i++)
        {
            Console.SetCursorPosition(x, y);
            Console.ForegroundColor = ConsoleColor.DarkRed;
            Console.Write(text);
            Console.ResetColor();
            SafeBeep(650, 45);
            Thread.Sleep(120);

            Console.SetCursorPosition(x, y);
            Console.ForegroundColor = ConsoleColor.Red;
            Console.Write(text);
            Console.ResetColor();
            SafeBeep(900, 45);
            Thread.Sleep(180);
        }
    }

    private static void Flash(string title, ConsoleColor fg, ConsoleColor bg, int ms)
    {
        int w = Math.Max(30, Math.Min(Console.WindowWidth - 1, title.Length + 10));
        int x = Math.Max(0, (Console.WindowWidth - w) / 2);
        int y = 1;

        Console.BackgroundColor = bg;
        Console.ForegroundColor = fg;

        Console.SetCursorPosition(x, y);
        Console.Write(new string(' ', w));
        Console.SetCursorPosition(x, y + 1);
        Console.Write(Center(title, w));
        Console.SetCursorPosition(x, y + 2);
        Console.Write(new string(' ', w));

        Console.ResetColor();
        Thread.Sleep(ms);
    }

    private static void ShakeWhole(int shakes, int delayMs)
    {
        int w = Console.WindowWidth - 1;
        for (int i = 0; i < shakes; i++)
        {
            int dx = (i % 2 == 0) ? 1 : -1;
            Console.Clear();
            Console.SetCursorPosition(Math.Max(0, dx), 2);
            Console.ForegroundColor = ConsoleColor.DarkRed;
            Console.Write(new string('▓', Math.Max(0, w - 2)));
            Console.ResetColor();
            Thread.Sleep(delayMs);
        }
        Console.Clear();
    }

    private static void SafeBeep(int freq, int ms)
    {
        try
        {
            Console.Beep(freq, ms);
        }
        catch { }
    }

    private static string Center(string s, int w)
    {
        if (string.IsNullOrEmpty(s)) return new string(' ', w);
        if (s.Length >= w) return s[..w];

        int pad = w - s.Length;
        int left = pad / 2;
        int right = pad - left;
        return new string(' ', left) + s + new string(' ', right);
    }
}
