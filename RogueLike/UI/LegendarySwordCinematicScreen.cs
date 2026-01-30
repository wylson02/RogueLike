namespace RogueLike.UI;

public static class LegendarySwordCinematicScreen
{
    /// <summary>
    /// Cinématique fullscreen : le héros arrache la lame du socle.
    /// 100% console: ASCII + timing + shake + flash.
    /// </summary>
    public static void Play(string swordName = "ÉPÉE DE LÉGENDE")
    {
        Console.CursorVisible = false;
        Console.ResetColor();
        HardClear();

        int w = Math.Max(80, Console.WindowWidth - 1);
        int h = Math.Max(26, Console.WindowHeight - 1);

        // Acte 0: silence
        Blackout(220);

        // Acte 1: salle / socle
        DrawPedestalScene(w, h, swordRaised: false);
        TypeCentered(w, y: 3, "Le socle attend…", ConsoleColor.DarkGray, speedMs: 18);
        Thread.Sleep(320);

        // Acte 2: main sur la garde
        TypeCentered(w, y: 5, "Tu poses ta main sur la garde.", ConsoleColor.Gray, 16);
        Thread.Sleep(260);

        // micro pulse runique
        RunePulse(w, h, pulses: 2);

        // Acte 3: extraction (animation 6 frames)
        for (int i = 0; i < 6; i++)
        {
            DrawPedestalScene(w, h, swordRaised: true, raiseStep: i);
            SmallShake(shakes: 5, delayMs: 16);
            SafeBeep(260 + i * 40, 18);
        }

        // Acte 4: flash + reveal du nom
        Flash(bg: ConsoleColor.White, ms: 40);
        Flash(bg: ConsoleColor.Black, ms: 60);

        HardClear();
        DrawReveal(w, h, swordName);

        // Acte 5: final prompt
        WriteCentered(w, h - 3, "ENTRÉE : reprendre", ConsoleColor.DarkGray);
        WaitEnter();

        Console.ResetColor();
        HardClear();
    }

    // -------------------- SCENES --------------------

    private static void DrawPedestalScene(int w, int h, bool swordRaised, int raiseStep = 0)
    {
        HardClear();

        // vignette sombre
        FillBackground(w, h, ConsoleColor.Black);

        // cadre
        int boxW = Math.Min(w - 8, 64);
        int boxH = Math.Min(h - 6, 18);
        int ox = Math.Max(0, (w - boxW) / 2);
        int oy = Math.Max(0, (h - boxH) / 2);

        DrawFrame(ox, oy, boxW, boxH, title: "RELlQUE");

        // socle + lame (centre)
        int cx = ox + boxW / 2;
        int baseY = oy + boxH - 5;

        // runes au sol
        Console.ForegroundColor = ConsoleColor.DarkRed;
        Console.SetCursorPosition(cx - 10, baseY + 2);
        Console.Write("⟠ ⟟ ⟡    ⟡ ⟟ ⟠");
        Console.ResetColor();

        // socle
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.SetCursorPosition(cx - 7, baseY);
        Console.Write("╔══════════════╗");
        Console.SetCursorPosition(cx - 7, baseY + 1);
        Console.Write("║   SOCLE      ║");
        Console.SetCursorPosition(cx - 7, baseY + 2);
        Console.Write("╚══════════════╝");
        Console.ResetColor();

        // lame
        int bladeTopY = baseY - 8;

        if (!swordRaised)
        {
            DrawSword(cx, bladeTopY, length: 8);
        }
        else
        {
            // raiseStep 0..5 -> monte progressivement
            int offset = raiseStep * 1; // 1 ligne par frame
            DrawSword(cx, bladeTopY - offset, length: 8 + raiseStep / 2);
        }

        // bras / main (illusion)
        Console.ForegroundColor = ConsoleColor.Gray;
        Console.SetCursorPosition(cx - 15, baseY - 2);
        Console.Write("(@)───╮");
        Console.SetCursorPosition(cx - 15, baseY - 1);
        Console.Write("  ╰───╯");
        Console.ResetColor();

        // texte bas
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.SetCursorPosition(ox + 2, oy + boxH - 2);
        Console.Write(Fit("La pierre gronde. Le métal répond.", boxW - 4));
        Console.ResetColor();
    }

    private static void DrawSword(int cx, int topY, int length)
    {
        // pointe
        Console.ForegroundColor = ConsoleColor.White;
        Console.SetCursorPosition(cx, topY);
        Console.Write("▲");

        // lame
        for (int i = 1; i <= length; i++)
        {
            Console.SetCursorPosition(cx, topY + i);
            Console.ForegroundColor = (i % 2 == 0) ? ConsoleColor.Gray : ConsoleColor.White;
            Console.Write("│");
        }

        // garde
        Console.ForegroundColor = ConsoleColor.DarkYellow;
        Console.SetCursorPosition(cx - 2, topY + length + 1);
        Console.Write("═╬═");
        Console.SetCursorPosition(cx, topY + length + 2);
        Console.ForegroundColor = ConsoleColor.DarkYellow;
        Console.Write("╫");
        Console.ResetColor();
    }

    private static void DrawReveal(int w, int h, string swordName)
    {
        FillBackground(w, h, ConsoleColor.Black);

        // gros titre
        string title = "LÉGENDAIRE OBTENUE";
        CenterBadge(w, 3, title, fg: ConsoleColor.Black, bg: ConsoleColor.DarkRed);

        // lame géante
        int cx = w / 2;
        int top = 6;

        Console.ForegroundColor = ConsoleColor.White;
        Console.SetCursorPosition(cx, top);
        Console.Write("▲");
        for (int i = 1; i <= 12; i++)
        {
            Console.SetCursorPosition(cx, top + i);
            Console.ForegroundColor = (i % 2 == 0) ? ConsoleColor.Gray : ConsoleColor.White;
            Console.Write("│");
        }

        Console.ForegroundColor = ConsoleColor.DarkYellow;
        Console.SetCursorPosition(cx - 5, top + 13);
        Console.Write("═════╬═════");
        Console.SetCursorPosition(cx, top + 14);
        Console.Write("╫");
        Console.ResetColor();

        // runes autour
        Console.ForegroundColor = ConsoleColor.DarkRed;
        WriteCentered(w, top + 16, "⟠  ⟟  ⟡     ⟡  ⟟  ⟠", ConsoleColor.DarkRed);

        // nom + punchline
        WriteCentered(w, top + 18, swordName.ToUpperInvariant(), ConsoleColor.White);
        WriteCentered(w, top + 20, "La lame s'éveille. Tu sens le temple retenir son souffle.", ConsoleColor.Gray);
        Console.ResetColor();
    }

    private static void RunePulse(int w, int h, int pulses)
    {
        for (int i = 0; i < pulses; i++)
        {
            WriteCentered(w, h - 6, "⟠ ⟟ ⟡", ConsoleColor.DarkRed);
            SafeBeep(520, 25);
            Thread.Sleep(90);
            WriteCentered(w, h - 6, "⟠ ⟟ ⟡", ConsoleColor.Red);
            SafeBeep(760, 25);
            Thread.Sleep(110);
        }
    }

    // -------------------- FX HELPERS --------------------

    private static void SmallShake(int shakes, int delayMs)
    {
        // micro illusion: on bouge le curseur, puis redraw partiel implicite
        for (int i = 0; i < shakes; i++)
        {
            int dx = (i % 2 == 0) ? 1 : -1;
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

    private static void FillBackground(int w, int h, ConsoleColor bg)
    {
        var prevBg = Console.BackgroundColor;
        Console.BackgroundColor = bg;
        Console.Clear();
        Console.BackgroundColor = prevBg;
    }

    private static void Blackout(int ms)
    {
        Console.BackgroundColor = ConsoleColor.Black;
        Console.Clear();
        Console.ResetColor();
        Thread.Sleep(ms);
    }

    private static void DrawFrame(int x, int y, int w, int h, string title)
    {
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.SetCursorPosition(x, y);
        Console.Write('┌' + new string('─', w - 2) + '┐');

        for (int i = 1; i < h - 1; i++)
        {
            Console.SetCursorPosition(x, y + i);
            Console.Write('│' + new string(' ', w - 2) + '│');
        }

        Console.SetCursorPosition(x, y + h - 1);
        Console.Write('└' + new string('─', w - 2) + '┘');
        Console.ResetColor();

        Console.SetCursorPosition(x + 2, y);
        Console.BackgroundColor = ConsoleColor.DarkGray;
        Console.ForegroundColor = ConsoleColor.Black;
        Console.Write($" {title} ");
        Console.ResetColor();
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

    private static void HardClear()
    {
        Console.ResetColor();
        Console.Clear();
        Console.SetCursorPosition(0, 0);
    }

    private static string Fit(string s, int max)
    {
        if (max <= 0) return "";
        if (s.Length <= max) return s.PadRight(max);
        if (max <= 1) return s[..max];
        return s[..(max - 1)] + "…";
    }
}
