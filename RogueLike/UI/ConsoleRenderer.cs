namespace RogueLike.UI;

using RogueLike.App;
using RogueLike.Domain;
using static RogueLike.App.GameContext;

public static class ConsoleRenderer
{
    private const int HudHeight = 9;
    private const int Gap = 2; 

    public static void Draw(GameContext ctx, string stateName)
    {
        Console.CursorVisible = false;

        Console.SetCursorPosition(0, 0);

        int mapW = ctx.Map.Width;
        int mapH = ctx.Map.Height;

        bool sideHud = Console.WindowWidth >= mapW + Gap + 34 && Console.WindowHeight >= Math.Max(mapH, HudHeight) + 2;

        if (sideHud)
        {
            DrawMap(ctx, 0, 0);
            DrawHud(ctx, stateName, mapW + Gap, 0, width: 34);
            DrawFooter(ctx, 0, mapH + 1, mapW + Gap + 34);
        }
        else
        {
            DrawMap(ctx, 0, 0);
            DrawHud(ctx, stateName, 0, mapH + 1, width: Math.Min(Console.WindowWidth - 1, 60));
            DrawFooter(ctx, 0, mapH + HudHeight + 2, Math.Min(Console.WindowWidth - 1, 60));
        }

        Console.ResetColor();
    }

    // ===================== MAP =====================

    private static void DrawMap(GameContext ctx, int ox, int oy)
    {
        for (int y = 0; y < ctx.Map.Height; y++)
        {
            Console.SetCursorPosition(ox, oy + y);

            for (int x = 0; x < ctx.Map.Width; x++)
            {
                var p = new Position(x, y);

                if (ctx.Player.Pos == p)
                {
                    WriteColored('@', ConsoleColor.White, ConsoleColor.DarkBlue);
                    continue;
                }

                if (!ctx.DiscoveredTiles.Contains(p))
                {
                    Console.Write(' ');
                    continue;
                }

                char c = ctx.Map.GetTile(p) switch
                {
                    TileType.Wall => '#',
                    TileType.Exit => 'E',
                    _ => '.'
                };

                var chest = ctx.Chests.FirstOrDefault(ch => ch.Pos == p);
                if (chest is not null) c = chest.Glyph;

                var item = ctx.ItemAt(p);
                if (item is not null) c = item.Glyph;

                if (ctx.MonsterAt(p) is not null) c = 'M';

                if (c == '#') WriteColored('#', ConsoleColor.DarkGray);
                else if (c == '.') WriteColored('.', ConsoleColor.DarkGray);
                else if (c == 'E') WriteColored('E', ConsoleColor.Green);
                else if (c == 'M') WriteColored('M', ConsoleColor.Red);
                else if (c == 'C') WriteColored('C', ConsoleColor.Yellow);
                else WriteColored(c, ConsoleColor.Cyan);
            }
        }
    }

    // ===================== HUD =====================

    private static void DrawHud(GameContext ctx, string stateName, int ox, int oy, int width)
    {
        width = Math.Max(28, width);

        BoxTop(ox, oy, width, "STATUS");
        BoxLine(ox, oy + 1, width, $"Mode : {stateName}", ConsoleColor.White, ConsoleColor.Black);

        string hpLabel = $"PV {ctx.Player.Hp}/{ctx.Player.MaxHp}";
        double hp01 = ctx.Player.MaxHp <= 0 ? 0 : (double)ctx.Player.Hp / ctx.Player.MaxHp;
        var hpColor = hp01 >= 0.60 ? ConsoleColor.Green : hp01 >= 0.30 ? ConsoleColor.Yellow : ConsoleColor.Red;
        BoxBar(ox, oy + 2, width, "❤", hpLabel, hp01, hpColor);

        string xpLabel = $"XP {ctx.Player.Xp}/{ctx.Player.XpToNext}  (Lv {ctx.Player.Level})";
        double xp01 = ctx.Player.XpToNext <= 0 ? 0 : (double)ctx.Player.Xp / ctx.Player.XpToNext;
        BoxBar(ox, oy + 3, width, "★", xpLabel, xp01, ConsoleColor.Cyan);

        bool night = ctx.Time.IsNight;
        string phase = night ? "NUIT" : "JOUR";
        string icon = night ? "🌙" : "☀";
        BoxBar(ox, oy + 4, width, icon, $"Temps : {phase} {ctx.Time.TickInPhase}/{ctx.Time.PhaseLength}", ctx.Time.Progress01,
            night ? ConsoleColor.Magenta : ConsoleColor.Yellow);

        var atkCol = ctx.Player.Attack >= 10 ? ConsoleColor.Cyan : ConsoleColor.White;
        var armCol = ctx.Player.Armor >= 5 ? ConsoleColor.Cyan : ConsoleColor.White;

        BoxKeyValues(
            ox, oy + 5, width,
            ("ATK", ctx.Player.Attack.ToString(), atkCol),
            ("ARM", ctx.Player.Armor.ToString(), armCol),
            ("GOLD", ctx.Player.Gold.ToString(), ConsoleColor.Yellow)
        );

        BoxKeyValues(
            ox, oy + 6, width,
            ("CRIT", $"{ctx.Player.CritChancePercent}%", ConsoleColor.Cyan),
            ("VOL", $"{ctx.Player.LifeStealPercent}%", ConsoleColor.Red),
            ("PTS", ctx.Player.StatPoints.ToString(), ctx.Player.StatPoints > 0 ? ConsoleColor.Green : ConsoleColor.DarkGray)
        );

        BoxLine(ox, oy + 7, width, "I: Inventaire   P: Progression", ConsoleColor.DarkGray, ConsoleColor.Black);
        BoxBottom(ox, oy + 8, width);
    }

    private static void DrawFooter(GameContext ctx, int ox, int oy, int width)
    {
        width = Math.Max(40, width);
        int w = Math.Min(width, Console.WindowWidth - 1);

        Console.SetCursorPosition(ox, oy);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('┌' + new string('─', w - 2) + '┐');
        Console.ResetColor();

        Console.SetCursorPosition(ox + 2, oy);
        WriteColored(" JOURNAL ", ConsoleColor.Black, ConsoleColor.DarkGray);

        var lines = ctx.LogEntries.ToList();
        int start = Math.Max(0, lines.Count - 3);
        int row = 1;

        for (int i = 0; i < 3; i++)
        {
            Console.SetCursorPosition(ox, oy + row);
            Console.ForegroundColor = ConsoleColor.DarkGray;
            Console.Write('│');
            Console.ResetColor();

            string content = "";
            LogKind kind = LogKind.Info;

            if (start + i < lines.Count)
            {
                kind = lines[start + i].Kind;
                content = lines[start + i].Text;
            }

            var (icon, col) = kind switch
            {
                LogKind.Loot => ("✦", ConsoleColor.Yellow),
                LogKind.Combat => ("⚔", ConsoleColor.Red),
                LogKind.Warning => ("!", ConsoleColor.Yellow),
                LogKind.System => ("■", ConsoleColor.Cyan),
                _ => ("•", ConsoleColor.Gray),
            };

            string text = $"{icon} {content}";
            text = Fit(text, w - 2);

            WriteColored(text, col);

            int pad = (w - 2) - text.Length;
            if (pad > 0) Console.Write(new string(' ', pad));

            Console.ForegroundColor = ConsoleColor.DarkGray;
            Console.Write('│');
            Console.ResetColor();

            row++;
        }

        Console.SetCursorPosition(ox, oy + 4);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('└' + new string('─', w - 2) + '┘');
        Console.ResetColor();
    }


    // ===================== BOX HELPERS =====================

    private static void BoxTop(int x, int y, int w, string title)
    {
        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('┌' + new string('─', w - 2) + '┐');
        Console.ResetColor();

        int titleX = x + 2;
        Console.SetCursorPosition(titleX, y);
        WriteColored($" {title} ", ConsoleColor.Black, ConsoleColor.DarkGray);
    }

    private static void BoxBottom(int x, int y, int w)
    {
        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('└' + new string('─', w - 2) + '┘');
        Console.ResetColor();
    }

    private static void BoxLine(int x, int y, int w, string text, ConsoleColor fg, ConsoleColor bg)
    {
        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('│');
        Console.ResetColor();

        string inner = Fit(text, w - 2);
        WriteColored(inner, fg, bg);

        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('│');
        Console.ResetColor();
    }

    private static void BoxBar(int x, int y, int w, string icon, string label, double value01, ConsoleColor barColor)
    {
        value01 = Math.Clamp(value01, 0, 1);

        int innerW = w - 2;
        int barW = Math.Max(12, innerW - 16);

        string left = $"{icon} ";
        string right = Fit(label, innerW - (left.Length + barW + 3));

        int filled = (int)Math.Round(barW * value01);
        filled = Math.Clamp(filled, 0, barW);

        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('│');
        Console.ResetColor();

        WriteColored(left, ConsoleColor.White);

        WriteColored("[", ConsoleColor.DarkGray);
        WriteColored(new string('█', filled), barColor);
        WriteColored(new string('░', barW - filled), ConsoleColor.DarkGray);
        WriteColored("]", ConsoleColor.DarkGray);

        WriteColored(" ", ConsoleColor.DarkGray);
        WriteColored(right, ConsoleColor.Gray);

        int used = left.Length + 2 + barW + 2 + right.Length;
        int pad = Math.Max(0, innerW - used);
        Console.Write(new string(' ', pad));

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
        string part1 = $"{a.k}:{a.v}";
        string part2 = $"{b.k}:{b.v}";
        string part3 = $"{c.k}:{c.v}";

        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('│');
        Console.ResetColor();

        int innerW = w - 2;

        int colW = innerW / 3;

        WriteKV(part1, colW, a.col);
        WriteKV(part2, colW, b.col);
        WriteKV(part3, innerW - colW - colW, c.col);

        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('│');
        Console.ResetColor();
    }

    private static void WriteKV(string text, int width, ConsoleColor valueColor)
    {
        int idx = text.IndexOf(':');
        if (idx <= 0)
        {
            WriteColored(Fit(text, width), ConsoleColor.Gray);
            return;
        }

        string k = text[..(idx + 1)];
        string v = text[(idx + 1)..];

        string kFit = k;
        string vFit = v;

        string total = kFit + vFit;
        if (total.Length > width)
        {
            int allowedV = Math.Max(0, width - kFit.Length);
            vFit = Fit(vFit, allowedV);
            total = kFit + vFit;
        }

        total = total.PadRight(width);

        WriteColored(kFit, ConsoleColor.DarkGray);
        WriteColored(vFit, valueColor);

        int remain = width - (kFit.Length + vFit.Length);
        if (remain > 0) Console.Write(new string(' ', remain));
    }

    // ===================== LOW LEVEL =====================

    private static void WriteColored(char c, ConsoleColor fg)
    {
        var prev = Console.ForegroundColor;
        Console.ForegroundColor = fg;
        Console.Write(c);
        Console.ForegroundColor = prev;
    }

    private static void WriteColored(char c, ConsoleColor fg, ConsoleColor bg)
    {
        var prevFg = Console.ForegroundColor;
        var prevBg = Console.BackgroundColor;
        Console.ForegroundColor = fg;
        Console.BackgroundColor = bg;
        Console.Write(c);
        Console.ForegroundColor = prevFg;
        Console.BackgroundColor = prevBg;
    }

    private static void WriteColored(string text, ConsoleColor fg)
    {
        var prev = Console.ForegroundColor;
        Console.ForegroundColor = fg;
        Console.Write(text);
        Console.ForegroundColor = prev;
    }

    private static void WriteColored(string text, ConsoleColor fg, ConsoleColor bg)
    {
        var prevFg = Console.ForegroundColor;
        var prevBg = Console.BackgroundColor;
        Console.ForegroundColor = fg;
        Console.BackgroundColor = bg;
        Console.Write(text);
        Console.ForegroundColor = prevFg;
        Console.BackgroundColor = prevBg;
    }

    private static string Fit(string s, int max)
    {
        if (max <= 0) return "";
        if (s.Length <= max) return s.PadRight(max);
        if (max <= 1) return s[..max];
        return (s[..(max - 1)] + "…");
    }
}
