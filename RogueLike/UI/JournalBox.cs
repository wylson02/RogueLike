namespace RogueLike.UI;

using RogueLike.App;

public static class JournalBox
{
    public static void Draw(GameContext ctx, int x, int y, int width, int lines = 4)
    {
        width = Math.Max(50, width);
        int w = Math.Min(width, Console.WindowWidth - 1);
        int innerW = w - 2;
        int h = lines + 2;

        if (y < 0) y = 0;
        if (y + h >= Console.WindowHeight) y = Math.Max(0, Console.WindowHeight - h - 1);

        var wrapped = BuildWrappedLines(ctx, innerW);

        int start = Math.Max(0, wrapped.Count - lines);

        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('┌' + new string('─', w - 2) + '┐');
        Console.ResetColor();

        Console.SetCursorPosition(x + 2, y);
        Write(" JOURNAL ", ConsoleColor.Black, ConsoleColor.DarkGray);

        for (int i = 0; i < lines; i++)
        {
            Console.SetCursorPosition(x, y + 1 + i);
            Console.ForegroundColor = ConsoleColor.DarkGray;
            Console.Write('│');
            Console.ResetColor();

            if (start + i < wrapped.Count)
            {
                bool isLastLine = (start + i == wrapped.Count - 1);
                var line = wrapped[start + i];
                RenderLine(line, innerW, isLastLine);
            }
            else
            {
                Console.Write(new string(' ', innerW));
            }

            Console.ForegroundColor = ConsoleColor.DarkGray;
            Console.Write('│');
            Console.ResetColor();
        }

        Console.SetCursorPosition(x, y + h - 1);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write('└' + new string('─', w - 2) + '┘');
        Console.ResetColor();
    }

    private readonly record struct WrappedLine(string Text, ConsoleColor Color);

    private static List<WrappedLine> BuildWrappedLines(GameContext ctx, int innerW)
    {
        var list = new List<WrappedLine>();

        var entries = ctx.LogEntries;

        if (entries.Count == 0 && !string.IsNullOrWhiteSpace(ctx.LastMessage))
            entries = new List<GameContext.LogEntry> { new(GameContext.LogKind.Info, ctx.LastMessage) };

        foreach (var e in entries)
        {
            var (icon, col) = e.Kind switch
            {
                GameContext.LogKind.Loot => ("✦", ConsoleColor.Yellow),
                GameContext.LogKind.Combat => ("⚔", ConsoleColor.Red),
                GameContext.LogKind.Warning => ("!", ConsoleColor.Yellow),
                GameContext.LogKind.System => ("■", ConsoleColor.Cyan),
                _ => ("•", ConsoleColor.Gray),
            };

            string raw = $"{icon} {e.Text}";
            var wrappedTextLines = Wrap(raw, innerW);

            for (int i = 0; i < wrappedTextLines.Count; i++)
            {
                string t = wrappedTextLines[i];
                if (i > 0)
                {
                    t = "  " + t;
                }

                list.Add(new WrappedLine(Fit(t, innerW), col));
            }
        }

        if (list.Count > 0 && list.Count < 3)
        {
            list.Insert(0, new WrappedLine(new string(' ', innerW), ConsoleColor.DarkGray));
        }

        if (list.Count > 200)
            list = list.Skip(list.Count - 200).ToList();

        return list;
    }

    private static void RenderLine(WrappedLine line, int innerW, bool isLastLine)
    {
        var color = isLastLine ? line.Color : ConsoleColor.DarkGray;

        Write(line.Text, color);

        int pad = innerW - line.Text.Length;
        if (pad > 0) Console.Write(new string(' ', pad));
    }

    private static List<string> Wrap(string text, int width)
    {
        var result = new List<string>();
        if (string.IsNullOrWhiteSpace(text))
        {
            result.Add("");
            return result;
        }

        var words = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        string current = "";

        foreach (var w in words)
        {
            if (current.Length == 0)
            {
                current = w;
                continue;
            }

            if (current.Length + 1 + w.Length <= width)
            {
                current += " " + w;
            }
            else
            {
                result.Add(current);
                current = w;
            }
        }

        if (current.Length > 0)
            result.Add(current);

        for (int i = 0; i < result.Count; i++)
        {
            if (result[i].Length > width)
                result[i] = result[i].Substring(0, width);
        }

        return result;
    }

    private static string Fit(string s, int max)
    {
        if (max <= 0) return "";
        if (s.Length <= max) return s.PadRight(max);
        if (max <= 1) return s[..max];
        return s[..(max - 1)] + "…";
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
}
