namespace RogueLike.UI;

using RogueLike.Domain.Entities;

public enum ProgressionAction
{
    None,
    Close,
    SpendPoint
}

public readonly struct ProgressionScreenResult
{
    public ProgressionAction Action { get; }
    public int SelectedIndex { get; }

    public ProgressionScreenResult(ProgressionAction action, int selectedIndex)
    {
        Action = action;
        SelectedIndex = selectedIndex;
    }

    public static ProgressionScreenResult Close(int idx) => new(ProgressionAction.Close, idx);
    public static ProgressionScreenResult Spend(int idx) => new(ProgressionAction.SpendPoint, idx);
    public static ProgressionScreenResult None(int idx) => new(ProgressionAction.None, idx);
}

public static class ProgressionScreen
{
    private static readonly (string Name, string Desc)[] Upgrades =
    {
        ("PV Max",      "+2 PV max"),
        ("Attaque",     "+1 ATK"),
        ("Armure",      "+1 ARM"),
        ("Critique",    "+2% CRIT"),
        ("Vol de vie",  "+2% VOL")
    };

    public static ProgressionScreenResult Show(Player p, int selectedIndex)
    {
        Console.CursorVisible = false;

        int selected = Math.Clamp(selectedIndex, 0, Upgrades.Length - 1);

        while (true)
        {
            Draw(p, selected);

            var key = Console.ReadKey(true).Key;

            if (key == ConsoleKey.P || key == ConsoleKey.Escape || key == ConsoleKey.Enter)
                return ProgressionScreenResult.Close(selected);

            if (key == ConsoleKey.Spacebar)
                return ProgressionScreenResult.Spend(selected);

            if (key == ConsoleKey.UpArrow || key == ConsoleKey.Z)
                selected = Math.Max(0, selected - 1);

            if (key == ConsoleKey.DownArrow || key == ConsoleKey.S)
                selected = Math.Min(Upgrades.Length - 1, selected + 1);
        }
    }

    private static void Draw(Player p, int selected)
    {
        Console.SetCursorPosition(0, 0);
        Console.Clear();

        int w = Math.Max(72, Console.WindowWidth - 1);
        int h = Math.Max(24, Console.WindowHeight - 1);

        WriteTopBar(w, "PROGRESSION");

        // Layout
        int leftW = Math.Clamp(w / 2, 34, 46);
        int rightW = w - leftW - 3;
        int startY = 2;

        DrawBox(0, startY, leftW, h - startY - 4, "RÉCAP");
        DrawBox(leftW + 2, startY, rightW, h - startY - 4, "AMÉLIORATIONS");

        DrawFooter(w, h);

        // --- Left: level/xp + stats
        int lx = 2;
        int ly = startY + 2;

        Console.SetCursorPosition(lx, ly);
        Console.ForegroundColor = ConsoleColor.White;
        Console.Write($"Niveau {p.Level}");
        Console.ResetColor();

        Console.SetCursorPosition(lx, ly + 1);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write($"Points à dépenser : ");
        Console.ForegroundColor = p.StatPoints > 0 ? ConsoleColor.Green : ConsoleColor.Gray;
        Console.Write(p.StatPoints);
        Console.ResetColor();

        // Bars
        int barW = leftW - 6;
        DrawBar(lx, ly + 3, barW, $"PV {p.Hp}/{p.MaxHp}", p.MaxHp <= 0 ? 0 : (double)p.Hp / p.MaxHp,
            p.Hp >= p.MaxHp * 0.6 ? ConsoleColor.Green : p.Hp >= p.MaxHp * 0.3 ? ConsoleColor.Yellow : ConsoleColor.Red);

        DrawBar(lx, ly + 5, barW, $"XP {p.Xp}/{p.XpToNext}", p.XpToNext <= 0 ? 0 : (double)p.Xp / p.XpToNext,
            ConsoleColor.Cyan);

        // Stats table
        int sy = ly + 8;
        Console.SetCursorPosition(lx, sy);
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.Write("STATS");
        Console.ResetColor();

        sy += 2;
        WriteStatLine(lx, sy++, "ATK", p.Attack.ToString(), ConsoleColor.White);
        WriteStatLine(lx, sy++, "ARM", p.Armor.ToString(), ConsoleColor.White);
        WriteStatLine(lx, sy++, "CRIT", $"{p.CritChancePercent}%", ConsoleColor.Cyan);
        WriteStatLine(lx, sy++, "VOL", $"{p.LifeStealPercent}%", ConsoleColor.Red);
        WriteStatLine(lx, sy++, "OR", p.Gold.ToString(), ConsoleColor.Yellow);

        // --- Right: upgrades list + preview
        int rx = leftW + 4;
        int ry = startY + 2;

        Console.SetCursorPosition(rx, ry);
        Console.ForegroundColor = ConsoleColor.White;
        Console.Write("Choisis une amélioration");
        Console.ResetColor();

        ry += 2;

        for (int i = 0; i < Upgrades.Length; i++)
        {
            bool isSel = i == selected;
            var (name, desc) = Upgrades[i];

            Console.SetCursorPosition(rx, ry + i);

            if (isSel)
            {
                Console.BackgroundColor = ConsoleColor.DarkGray;
                Console.ForegroundColor = ConsoleColor.Black;
                Console.Write("▶ ");
                Console.Write(Fit(name, 14).PadRight(14));
                Console.Write("  ");
                Console.ForegroundColor = ConsoleColor.Black;
                Console.Write(Fit(desc, rightW - 8).PadRight(rightW - 8));
                Console.ResetColor();
            }
            else
            {
                Console.ForegroundColor = ConsoleColor.Gray;
                Console.Write("  ");
                Console.Write(Fit(name, 14).PadRight(14));
                Console.Write("  ");
                Console.Write(Fit(desc, rightW - 8).PadRight(rightW - 8));
                Console.ResetColor();
            }
        }

        // Preview box
        int py = ry + Upgrades.Length + 2;
        DrawMiniBox(rx - 2, py, rightW, 8, "APERÇU");

        int px = rx;
        int pyy = py + 2;

        var preview = GetPreview(p, selected);

        Console.SetCursorPosition(px, pyy++);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write("Avant  →  Après");
        Console.ResetColor();

        foreach (var line in preview)
        {
            if (pyy >= py + 7) break;
            Console.SetCursorPosition(px, pyy++);
            Console.Write(line);
        }

        // Hint
        Console.SetCursorPosition(rx, h - 5);
        Console.ForegroundColor = p.StatPoints > 0 ? ConsoleColor.Green : ConsoleColor.DarkGray;
        Console.Write(p.StatPoints > 0
            ? "ESPACE : dépenser 1 point"
            : "Gagne des niveaux pour obtenir des points");
        Console.ResetColor();
    }

    // ================= Helpers =================

    private static List<string> GetPreview(Player p, int selected)
    {
        int atk = p.Attack, arm = p.Armor, crit = p.CritChancePercent, ls = p.LifeStealPercent, maxHp = p.MaxHp;

        int atk2 = atk, arm2 = arm, crit2 = crit, ls2 = ls, maxHp2 = maxHp;

        switch (selected)
        {
            case 0: maxHp2 += 2; break;
            case 1: atk2 += 1; break;
            case 2: arm2 += 1; break;
            case 3: crit2 += 2; break;
            case 4: ls2 += 2; break;
        }

        return new List<string>
        {
            StatPreview("PV MAX", maxHp, maxHp2, ConsoleColor.Green),
            StatPreview("ATK", atk, atk2, ConsoleColor.White),
            StatPreview("ARM", arm, arm2, ConsoleColor.White),
            StatPreview("CRIT", crit, crit2, ConsoleColor.Cyan, suffix:"%"),
            StatPreview("VOL", ls, ls2, ConsoleColor.Red, suffix:"%")
        };
    }

    private static string StatPreview(string name, int before, int after, ConsoleColor col, string suffix = "")
    {
        string b = $"{before}{suffix}".PadLeft(5);
        string a = $"{after}{suffix}".PadLeft(5);
        string arrow = after > before ? "  ➜  " : "  •  ";
        // color handled in render, we embed minimal formatting using padding
        return $"{name.PadRight(8)} {b}{arrow}{a}";
    }

    private static void WriteTopBar(int w, string title)
    {
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("┌" + new string('─', w - 2) + "┐");
        Console.Write("│ ");
        Console.ForegroundColor = ConsoleColor.Magenta;
        Console.Write(title);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write(new string(' ', Math.Max(0, w - 3 - title.Length)));
        Console.WriteLine("│");
        Console.WriteLine("└" + new string('─', w - 2) + "┘");
        Console.ResetColor();
    }

    private static void DrawFooter(int w, int h)
    {
        int y = h - 2;
        Console.SetCursorPosition(0, y);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine(new string('─', Math.Max(0, w)));
        Console.SetCursorPosition(0, y + 1);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write("↑↓/ZS: naviguer   ESPACE: dépenser   P/Entrée/Echap: retour");
        Console.ResetColor();
    }

    private static void DrawBox(int x, int y, int w, int h, string title)
    {
        w = Math.Max(24, w);
        h = Math.Max(8, h);

        Console.ForegroundColor = ConsoleColor.DarkGray;

        Console.SetCursorPosition(x, y);
        Console.Write("┌" + new string('─', w - 2) + "┐");

        Console.SetCursorPosition(x + 2, y);
        Console.ForegroundColor = ConsoleColor.Black;
        Console.BackgroundColor = ConsoleColor.DarkGray;
        Console.Write($" {title} ");
        Console.ResetColor();

        Console.ForegroundColor = ConsoleColor.DarkGray;
        for (int i = 1; i < h - 1; i++)
        {
            Console.SetCursorPosition(x, y + i);
            Console.Write('│');
            Console.SetCursorPosition(x + w - 1, y + i);
            Console.Write('│');
        }

        Console.SetCursorPosition(x, y + h - 1);
        Console.Write("└" + new string('─', w - 2) + "┘");
        Console.ResetColor();
    }

    private static void DrawMiniBox(int x, int y, int w, int h, string title)
    {
        w = Math.Max(24, w);
        h = Math.Max(6, h);

        Console.ForegroundColor = ConsoleColor.DarkGray;

        Console.SetCursorPosition(x, y);
        Console.Write("┌" + new string('─', w - 2) + "┐");

        Console.SetCursorPosition(x + 2, y);
        Console.ForegroundColor = ConsoleColor.Black;
        Console.BackgroundColor = ConsoleColor.DarkGray;
        Console.Write($" {title} ");
        Console.ResetColor();

        Console.ForegroundColor = ConsoleColor.DarkGray;
        for (int i = 1; i < h - 1; i++)
        {
            Console.SetCursorPosition(x, y + i);
            Console.Write('│');
            Console.SetCursorPosition(x + w - 1, y + i);
            Console.Write('│');
        }

        Console.SetCursorPosition(x, y + h - 1);
        Console.Write("└" + new string('─', w - 2) + "┘");
        Console.ResetColor();
    }

    private static void DrawBar(int x, int y, int w, string label, double value01, ConsoleColor barColor)
    {
        value01 = Math.Clamp(value01, 0, 1);
        int barW = Math.Max(12, w - 18);

        int filled = (int)Math.Round(barW * value01);
        filled = Math.Clamp(filled, 0, barW);

        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = ConsoleColor.Gray;
        Console.Write(Fit(label, 14).PadRight(14));
        Console.ResetColor();

        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('[');
        Console.ResetColor();

        Console.ForegroundColor = barColor;
        Console.Write(new string('█', filled));
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write(new string('░', barW - filled));
        Console.Write(']');
        Console.ResetColor();
    }

    private static void WriteStatLine(int x, int y, string k, string v, ConsoleColor vcol)
    {
        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write($"{k.PadRight(5)} : ");
        Console.ForegroundColor = vcol;
        Console.Write(v);
        Console.ResetColor();
    }

    private static string Fit(string s, int max)
    {
        if (max <= 0) return "";
        if (string.IsNullOrEmpty(s)) return "";
        if (s.Length <= max) return s;
        if (max <= 1) return s[..max];
        return s[..(max - 1)] + "…";
    }
}
