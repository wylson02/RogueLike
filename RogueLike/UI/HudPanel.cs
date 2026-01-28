namespace RogueLike.UI;

using RogueLike.Domain.Entities;

public static class HudPanel
{
    public static void Draw(Player p, int x, int y, int width, string title = "STATUS")
    {
        width = Math.Max(34, width);

        BoxTop(x, y, width, title);

        BoxLine(x, y + 1, width, $"PV {p.Hp}/{p.MaxHp}", ConsoleColor.White);
        BarLine(x, y + 2, width, "❤", p.MaxHp == 0 ? 0 : (double)p.Hp / p.MaxHp,
            p.Hp >= p.MaxHp * 0.6 ? ConsoleColor.Green : p.Hp >= p.MaxHp * 0.3 ? ConsoleColor.Yellow : ConsoleColor.Red);

        BoxLine(x, y + 3, width, $"XP {p.Xp}/{p.XpToNext}  (Lv {p.Level})", ConsoleColor.White);
        BarLine(x, y + 4, width, "★", p.XpToNext == 0 ? 0 : (double)p.Xp / p.XpToNext, ConsoleColor.Cyan);

        BoxKeyValues(x, y + 5, width,
            ("ATK", p.Attack.ToString(), ConsoleColor.Cyan),
            ("ARM", p.Armor.ToString(), ConsoleColor.Cyan),
            ("GOLD", p.Gold.ToString(), ConsoleColor.Yellow));

        BoxKeyValues(x, y + 6, width,
            ("CRIT", $"{p.CritChancePercent}%", ConsoleColor.Cyan),
            ("VOL", $"{p.LifeStealPercent}%", ConsoleColor.Red),
            ("PTS", p.StatPoints.ToString(), p.StatPoints > 0 ? ConsoleColor.Green : ConsoleColor.DarkGray));

        BoxBottom(x, y + 7, width);
    }


    private static void BoxTop(int x, int y, int w, string title)
    {
        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('┌' + new string('─', w - 2) + '┐');
        Console.ResetColor();

        Console.SetCursorPosition(x + 2, y);
        Write(title, ConsoleColor.Black, ConsoleColor.DarkGray);
    }

    private static void BoxBottom(int x, int y, int w)
    {
        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('└' + new string('─', w - 2) + '┘');
        Console.ResetColor();
    }

    private static void BoxLine(int x, int y, int w, string text, ConsoleColor fg)
    {
        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('│');
        Console.ResetColor();

        string inner = Fit(text, w - 2);
        Write(inner, fg);

        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('│');
        Console.ResetColor();
    }

    private static void BarLine(int x, int y, int w, string icon, double value01, ConsoleColor color)
    {
        value01 = Math.Clamp(value01, 0, 1);

        int innerW = w - 2;
        int barW = innerW - 4;

        int filled = (int)Math.Round(barW * value01);
        filled = Math.Clamp(filled, 0, barW);

        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('│');
        Console.ResetColor();

        Write($"{icon} ", ConsoleColor.White);
        Write(new string('█', filled), color);
        Write(new string('░', barW - filled), ConsoleColor.DarkGray);

        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('│');
        Console.ResetColor();
    }

    private static void BoxKeyValues(
        int x, int y, int w,
        (string k, string v, ConsoleColor col) a,
        (string k, string v, ConsoleColor col) b,
        (string k, string v, ConsoleColor col) c)
    {
        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('│');
        Console.ResetColor();

        int innerW = w - 2;
        int colW = innerW / 3;

        WriteKV($"{a.k}:{a.v}", colW, a.col);
        WriteKV($"{b.k}:{b.v}", colW, b.col);
        WriteKV($"{c.k}:{c.v}", innerW - colW - colW, c.col);

        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('│');
        Console.ResetColor();
    }

    private static void WriteKV(string text, int width, ConsoleColor valueColor)
    {
        int idx = text.IndexOf(':');
        if (idx <= 0)
        {
            Write(Fit(text, width), ConsoleColor.Gray);
            return;
        }

        string k = text[..(idx + 1)];
        string v = text[(idx + 1)..];

        string total = k + v;
        if (total.Length > width)
        {
            int allowedV = Math.Max(0, width - k.Length);
            v = Fit(v, allowedV);
        }

        Write(k, ConsoleColor.DarkGray);
        Write(v, valueColor);

        int pad = width - (k.Length + v.Length);
        if (pad > 0) Console.Write(new string(' ', pad));
    }

    private static void Write(string text, ConsoleColor fg)
    {
        var prev = Console.ForegroundColor;
        Console.ForegroundColor = fg;
        Console.Write(text);
        Console.ForegroundColor = prev;
    }

    private static void Write(string text, ConsoleColor fg, ConsoleColor bg)
    {
        var pf = Console.ForegroundColor;
        var pb = Console.BackgroundColor;
        Console.ForegroundColor = fg;
        Console.BackgroundColor = bg;
        Console.Write(text);
        Console.ForegroundColor = pf;
        Console.BackgroundColor = pb;
    }

    private static string Fit(string s, int max)
    {
        if (max <= 0) return "";
        if (s.Length <= max) return s.PadRight(max);
        if (max <= 1) return s[..max];
        return (s[..(max - 1)] + "…");
    }
}
