namespace RogueLike.UI;

using RogueLike.App.Combat;
using RogueLike.Domain.Entities;

public static class CombatScreen
{
    private const int HeaderH = 9;
    private const int FooterH = 3;

    public static void Draw(Player player, Monster enemy, IReadOnlyList<string> logLines)
    {
        Console.CursorVisible = false;
        Console.SetCursorPosition(0, 0);
        Console.Clear();

        int w = Math.Max(50, Console.WindowWidth - 1);
        int h = Math.Max(20, Console.WindowHeight - 1);

        DrawHeader(player, enemy, w);
        DrawLogPanel(logLines, w, h);

        ClearFrom(Console.CursorTop);
        Console.SetCursorPosition(0, Math.Min(h, Console.WindowHeight - 1));
    }

    public static ICombatAction ReadAction(CombatContext ctx, IReadOnlyList<ICombatAction> actions)
    {
        while (true)
        {
            var lines = BuildLines(ctx);
            Draw(ctx.Player, ctx.Enemy, lines);

            var key = Console.ReadKey(true).Key;

            ICombatAction? act = key switch
            {
                ConsoleKey.D1 or ConsoleKey.NumPad1 or ConsoleKey.A => actions[0],
                ConsoleKey.D2 or ConsoleKey.NumPad2 or ConsoleKey.H => actions[1],
                ConsoleKey.D3 or ConsoleKey.NumPad3 or ConsoleKey.D => actions[2],
                ConsoleKey.D4 or ConsoleKey.NumPad4 or ConsoleKey.F => actions[3],
                _ => null
            };

            if (act is not null) return act;
        }
    }

    public static void WaitEnter()
    {
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine();
        Console.WriteLine("ENTRÉE : continuer…");
        Console.ResetColor();
        while (Console.KeyAvailable) Console.ReadKey(true);
        Console.ReadKey(true);
    }

    public static void FxLine(string text)
    {
        int y = Math.Max(0, Console.WindowHeight - 2);
        Console.ForegroundColor = ConsoleColor.Red;
        CombatAnimations.ShakeAt(0, y, Fit(text, Console.WindowWidth - 1), shakes: 6, delayMs: 18);
        Console.ResetColor();
    }

    // ------------------- RENDER -------------------

    private static void DrawHeader(Player p, Monster e, int w)
    {
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("┌" + new string('─', w - 2) + "┐");

        Console.Write("│ ");
        Console.ForegroundColor = ConsoleColor.White;
        Console.Write("⚔ COMBAT");
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine(new string(' ', Math.Max(0, w - 3 - "⚔ COMBAT".Length)) + "│");

        Console.WriteLine("├" + new string('─', w - 2) + "┤");
        Console.ResetColor();

        WriteFighterLine("TOI", '@', p.Hp, p.MaxHp, ConsoleColor.Cyan, p.Attack, p.Armor, w);
        WriteFighterLine(e.Name.ToUpper(), 'M', e.Hp, e.MaxHp, ConsoleColor.Red, e.Attack, 0, w);

        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("└" + new string('─', w - 2) + "┘");
        Console.ResetColor();
    }

    private static void WriteFighterLine(string name, char glyph, int hp, int maxHp, ConsoleColor nameColor, int atk, int arm, int w)
    {
        int innerW = w - 2;

        string left = $"{glyph} {name}";
        string right = $"ATK {atk} ARM {arm}";

        int barW = Math.Max(16, innerW - left.Length - right.Length - 10);
        double hp01 = maxHp <= 0 ? 0 : Math.Clamp((double)hp / maxHp, 0, 1);
        int filled = (int)Math.Round(barW * hp01);

        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write("│ ");
        Console.ResetColor();

        Console.ForegroundColor = nameColor;
        Console.Write(left);
        Console.ResetColor();

        Console.Write(" HP ");

        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('[');
        Console.ResetColor();

        var barColor = hp01 >= 0.6 ? ConsoleColor.Green : hp01 >= 0.3 ? ConsoleColor.Yellow : ConsoleColor.Red;
        Console.ForegroundColor = barColor;
        Console.Write(new string('█', filled));
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write(new string('░', barW - filled));
        Console.Write(']');
        Console.ResetColor();

        Console.Write($" {Math.Max(0, hp)}/{maxHp} ");

        Console.ForegroundColor = ConsoleColor.Gray;
        Console.Write(right);
        Console.ResetColor();

        int usedApprox = 2 + left.Length + 4 + 1 + barW + 1 + 1 + $" {Math.Max(0, hp)}/{maxHp} ".Length + right.Length;
        int pad = Math.Max(0, innerW - usedApprox);
        Console.Write(new string(' ', pad));

        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("│");
        Console.ResetColor();
    }

    private static void DrawLogPanel(IReadOnlyList<string> lines, int w, int h)
    {
        int logTop = HeaderH;
        int logH = Math.Max(8, h - HeaderH - FooterH);
        int innerW = w - 2;
        int innerH = logH - 2;

        var prepared = new List<string>();
        foreach (var l in lines)
            prepared.AddRange(Wrap(l, innerW));

        int start = Math.Max(0, prepared.Count - innerH);

        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.SetCursorPosition(0, logTop);
        Console.WriteLine("┌" + new string('─', w - 2) + "┐");
        Console.SetCursorPosition(2, logTop);
        Console.ForegroundColor = ConsoleColor.Black;
        Console.BackgroundColor = ConsoleColor.DarkGray;
        Console.Write(" JOURNAL ");
        Console.ResetColor();

        for (int i = 0; i < innerH; i++)
        {
            Console.SetCursorPosition(0, logTop + 1 + i);
            Console.ForegroundColor = ConsoleColor.DarkGray;
            Console.Write('│');
            Console.ResetColor();

            string content = (start + i < prepared.Count) ? prepared[start + i] : "";
            content = content.PadRight(innerW);

            bool isLast = (start + i == prepared.Count - 1) && prepared.Count > 0;
            Console.ForegroundColor = isLast ? ConsoleColor.White : ConsoleColor.Gray;
            Console.Write(content);
            Console.ResetColor();

            Console.ForegroundColor = ConsoleColor.DarkGray;
            Console.Write('│');
            Console.ResetColor();
        }

        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.SetCursorPosition(0, logTop + logH - 1);
        Console.WriteLine("└" + new string('─', w - 2) + "┘");
        Console.ResetColor();

        Console.SetCursorPosition(0, logTop + logH);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("A/1 Attaquer H/2 Soin D/3 Garde F/4 Fuir");
        Console.ResetColor();
    }

    private static List<string> BuildLines(CombatContext ctx)
    {
        var res = new List<string>(ctx.Log);

        // prompt unique
        string prompt = "Que vas-tu faire ?";
        if (res.Count == 0 || res[^1] != prompt)
        {
            // évite le doublon si déjà présent
            if (!res.Contains(prompt))
            {
                res.Add("");
                res.Add(prompt);
            }
        }

        if (ctx.DodgeTurnsLeft > 0)
            res.Add($"(Garde active : {ctx.DodgeTurnsLeft} tour(s))");

        return res;
    }

    private static void ClearFrom(int y)
    {
        int h = Console.WindowHeight;
        for (int i = y; i < h - 1; i++)
        {
            Console.SetCursorPosition(0, i);
            Console.Write(new string(' ', Math.Max(0, Console.WindowWidth - 1)));
        }
    }

    private static string Fit(string s, int max)
    {
        if (max <= 0) return "";
        if (s.Length <= max) return s;
        if (max <= 1) return s[..max];
        return s[..(max - 1)] + "…";
    }

    private static IEnumerable<string> Wrap(string s, int width)
    {
        if (string.IsNullOrEmpty(s)) { yield return ""; yield break; }
        if (width <= 0) { yield return ""; yield break; }

        int i = 0;
        while (i < s.Length)
        {
            int take = Math.Min(width, s.Length - i);
            yield return s.Substring(i, take);
            i += take;
        }
    }
}