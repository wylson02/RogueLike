namespace RogueLike.UI;

public static class IntroCinematicScreen
{
    public static void Play()
    {
        Console.CursorVisible = false;
        Console.ResetColor();
        Console.Clear();
        Console.SetCursorPosition(0, 0);

        int w = Math.Max(80, Console.WindowWidth - 1);
        int h = Math.Max(26, Console.WindowHeight - 1);

        // Acte 0 : blackout + pulse
        Blackout(w, h, 240);
        TypeCentered(w, h / 2 - 2, "…", ConsoleColor.DarkGray, speedMs: 180);
        Thread.Sleep(300);

        // Acte 1 : prologue (typing + pauses)
        Console.Clear();
        TypeCentered(w, 6, "On raconte que trois sceaux dorment sous la pierre.", ConsoleColor.Gray, 18);
        Thread.Sleep(300);
        TypeCentered(w, 8, "Que personne ne doit les réveiller.", ConsoleColor.Gray, 18);
        Thread.Sleep(450);

        // Acte 2 : “seals” appear as runes (ASCII)
        RuneBurst(w, h);

        // Acte 3 : la phrase qui claque
        Console.Clear();
        TypeCentered(w, h / 2 - 2, "Mais tu es entré.", ConsoleColor.White, 22);
        Thread.Sleep(350);
        TypeCentered(w, h / 2, "Et le temple t'a reconnu.", ConsoleColor.DarkRed, 22);
        Thread.Sleep(500);

        // Acte 4 : porte + tremblement
        DoorScene(w, h);

        // Acte 5 : call to action
        Console.Clear();
        CenterBadge(w, 3, "PROLOGUE");
        TypeCentered(w, 9, "Trouve les sorties.", ConsoleColor.Gray, 16);
        TypeCentered(w, 11, "Survis.", ConsoleColor.Gray, 16);
        TypeCentered(w, 13, "Et ne réveille pas ce qui attend derrière la dernière porte.", ConsoleColor.DarkGray, 14);

        WriteCentered(w, h - 3, "ENTRÉE : commencer", ConsoleColor.DarkGray);
        WaitEnter();

        Console.ResetColor();
        Console.Clear();
        Console.SetCursorPosition(0, 0);
    }

    // ===================== SCENES =====================

    private static void DoorScene(int w, int h)
    {
        Console.Clear();

        string[] door =
        {
            "          ██████████████          ",
            "        ███            ███        ",
            "      ███                ███      ",
            "     ██        ██         ██      ",
            "     ██        ██         ██      ",
            "     ██                   ██      ",
            "     ██      ██████       ██      ",
            "     ██      ██  ██       ██      ",
            "     ██      ██████       ██      ",
            "      ███                ███      ",
            "        ███            ███        ",
            "          ██████████████          ",
        };

        int y0 = Math.Max(2, (h - door.Length) / 2);
        for (int i = 0; i < door.Length; i++)
        {
            int x = Math.Max(0, (w - door[i].Length) / 2);
            Console.SetCursorPosition(x, y0 + i);
            Console.ForegroundColor = ConsoleColor.DarkGray;
            Console.Write(door[i]);
        }
        Console.ResetColor();

        // tremblements + “cracks”
        for (int k = 0; k < 9; k++)
        {
            ShakeFull(w, h, intensity: 1);
            DrawCrack(w, y0 + 5 + (k % 3));
            SafeBeep(250 + k * 40, 25);
            Thread.Sleep(55);
        }

        Thread.Sleep(240);

        // flash
        Flash(w, h, ConsoleColor.White, 60);
        Console.Clear();
        TypeCentered(w, h - 4, "La porte cède…", ConsoleColor.DarkRed, 16);
        Thread.Sleep(420);
    }

    private static void RuneBurst(int w, int h)
    {
        Console.Clear();
        CenterBadge(w, 3, "LES SCEAUX");

        // 3 runes “wow”
        DrawRune(w, 9, "⟟", ConsoleColor.DarkRed);
        Thread.Sleep(180);
        DrawRune(w, 11, "⟠", ConsoleColor.Red);
        Thread.Sleep(180);
        DrawRune(w, 13, "⟡", ConsoleColor.DarkRed);
        Thread.Sleep(280);

        WriteCentered(w, h - 3, "…", ConsoleColor.DarkGray);
        Thread.Sleep(220);
    }

    // ===================== FX HELPERS =====================

    private static void Blackout(int w, int h, int ms)
    {
        Console.BackgroundColor = ConsoleColor.Black;
        Console.Clear();
        Console.ResetColor();
        Thread.Sleep(ms);
    }

    private static void Flash(int w, int h, ConsoleColor bg, int ms)
    {
        var prevBg = Console.BackgroundColor;
        Console.BackgroundColor = bg;
        Console.Clear();
        Console.BackgroundColor = prevBg;
        Thread.Sleep(ms);
    }

    private static void ShakeFull(int w, int h, int intensity)
    {
        // simple illusion : redraw a few glyphs offset
        int dx = (DateTime.UtcNow.Millisecond % 2 == 0) ? intensity : -intensity;
        int dy = (DateTime.UtcNow.Millisecond % 3 == 0) ? intensity : 0;

        Console.SetCursorPosition(Math.Max(0, dx), Math.Max(0, dy));
    }

    private static void DrawCrack(int w, int y)
    {
        string crack = "  ╱╲  ╱╲   ╱╲  ";
        int x = Math.Max(0, (w - crack.Length) / 2);
        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = ConsoleColor.DarkRed;
        Console.Write(crack);
        Console.ResetColor();
    }

    private static void DrawRune(int w, int y, string rune, ConsoleColor col)
    {
        string s = $"   {rune}   ";
        int x = Math.Max(0, (w - s.Length) / 2);
        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = col;
        Console.Write(s);
        Console.ResetColor();
    }

    private static void CenterBadge(int w, int y, string text)
    {
        string t = $" {text} ";
        int x = Math.Max(0, (w - t.Length) / 2);
        Console.SetCursorPosition(x, y);
        Console.BackgroundColor = ConsoleColor.DarkGray;
        Console.ForegroundColor = ConsoleColor.Black;
        Console.Write(t);
        Console.ResetColor();
    }

    private static void TypeCentered(int w, int y, string text, ConsoleColor col, int speedMs)
    {
        int x = Math.Max(0, (w - text.Length) / 2);
        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = col;

        foreach (var ch in text)
        {
            Console.Write(ch);
            Thread.Sleep(speedMs);
        }

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
}
