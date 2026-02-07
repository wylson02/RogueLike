namespace RogueLike.UI;

public static class BossPhase2CinematicScreen
{
    /// <summary>
    /// Transition fullscreen “PHASE II” : freeze -> glitch -> reprise combat.
    /// Appelée au moment exact où le boss passe sous un seuil (ex 50%).
    /// </summary>
    public static void Play(string bossName = "ROI DE L'ABÎME")
    {
        Console.CursorVisible = false;
        Console.ResetColor();
        HardClear();

        int w = Math.Max(80, Console.WindowWidth - 1);
        int h = Math.Max(26, Console.WindowHeight - 1);

        // freeze noir
        Blackout(120);

        // glitch title
        for (int i = 0; i < 6; i++)
        {
            HardClear();
            FillNoise(w, h, density: 9 + i);

            string t1 = (i % 2 == 0) ? bossName : Scramble(bossName);
            string t2 = (i % 2 == 0) ? "PHASE II" : "PHΛSE II";

            CenterBadge(w, 5, t1, fg: ConsoleColor.Black, bg: ConsoleColor.DarkRed);
            CenterBadge(w, 8, t2, fg: ConsoleColor.Black, bg: ConsoleColor.Red);

            WriteCentered(w, h - 4, "Le trône se fissure. Quelque chose se réveille.", ConsoleColor.Gray);

            SafeBeep(420 + i * 60, 22);
            Thread.Sleep(70);
        }

        // impact
        Flash(ConsoleColor.White, 35);
        Flash(ConsoleColor.Black, 60);
        MegaShake(shakes: 12, delayMs: 14);

        HardClear();
        CenterBadge(w, 6, bossName, fg: ConsoleColor.Black, bg: ConsoleColor.DarkRed);
        CenterBadge(w, 9, "PHASE II", fg: ConsoleColor.Black, bg: ConsoleColor.Red);

        WriteCentered(w, 13, "Ses yeux s'ouvrent pour de bon.", ConsoleColor.White);
        WriteCentered(w, h - 3, "ENTRÉE : continuer", ConsoleColor.DarkGray);

        WaitEnter();

        Console.ResetColor();
        HardClear();
    }

    // ----------------- helpers -----------------

    private static void FillNoise(int w, int h, int density)
    {
        var rng = new Random(1337 + density);
        char[] noise = new[] { ' ', '░', '▒', '▓' };

        Console.ForegroundColor = ConsoleColor.DarkGray;
        for (int y = 0; y < h; y++)
        {
            Console.SetCursorPosition(0, y);
            for (int x = 0; x < w; x++)
            {
                int r = rng.Next(0, 100);
                char c = r < density ? noise[rng.Next(noise.Length)] : ' ';
                Console.Write(c);
            }
        }
        Console.ResetColor();
    }

    private static string Scramble(string s)
    {
        if (string.IsNullOrEmpty(s)) return s;
        var rng = new Random(DateTime.UtcNow.Millisecond);
        var chars = s.ToCharArray();
        for (int i = 0; i < chars.Length; i++)
        {
            if (chars[i] == ' ') continue;
            if (rng.Next(0, 100) < 22)
                chars[i] = (char)('A' + rng.Next(0, 26));
        }
        return new string(chars);
    }

    private static void MegaShake(int shakes, int delayMs)
    {
        for (int i = 0; i < shakes; i++)
        {
            int dx = (i % 2 == 0) ? 2 : -2;
            int dy = (i % 3 == 0) ? 1 : 0;
            Console.SetCursorPosition(Math.Max(0, dx), Math.Max(0, dy));
            Thread.Sleep(delayMs);
        }
    }

    private static void Flash(ConsoleColor bg, int ms)
    {
        var prevBg = Console.BackgroundColor;
        Console.BackgroundColor = bg;
        Console.Clear();
        Console.BackgroundColor = prevBg;
        Thread.Sleep(ms);
    }

    private static void Blackout(int ms)
    {
        Console.BackgroundColor = ConsoleColor.Black;
        Console.Clear();
        Console.ResetColor();
        Thread.Sleep(ms);
    }

    private static void CenterBadge(int w, int y, string text, ConsoleColor fg, ConsoleColor bg)
    {
        int x = Math.Max(0, (w - (text.Length + 2)) / 2);
        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = fg;
        Console.BackgroundColor = bg;
        Console.Write($" {text} ");
        Console.ResetColor();
    }

    private static void WriteCentered(int w, int y, string text, ConsoleColor col)
    {
        int x = Math.Max(0, (w - text.Length) / 2);
        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = col;
        Console.Write(text);
        Console.ResetColor();
    }

    private static void WaitEnter()
    {
        while (Console.KeyAvailable) Console.ReadKey(true);
        Console.ReadKey(true);
        while (Console.KeyAvailable) Console.ReadKey(true);
    }

    private static void SafeBeep(int freq, int ms)
    {
        try { Console.Beep(freq, ms); } catch { }
    }

    private static void HardClear()
    {
        Console.ResetColor();
        Console.Clear();
        Console.SetCursorPosition(0, 0);
    }
}
