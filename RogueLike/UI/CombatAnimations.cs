namespace RogueLike.UI;

public static class CombatAnimations
{
    public static void TypeLine(string text, int delayMs = 12)
    {
        foreach (char c in text)
        {
            Console.Write(c);
            Thread.Sleep(delayMs);
        }
        Console.WriteLine();
    }

    public static void Flash(int times = 2, int delayMs = 60)
    {
        for (int i = 0; i < times; i++)
        {
            Console.BackgroundColor = ConsoleColor.White;
            Console.ForegroundColor = ConsoleColor.Black;
            Console.Clear();
            Thread.Sleep(delayMs);

            Console.ResetColor();
            Console.Clear();
            Thread.Sleep(delayMs);
        }
    }

    /// <summary>
    /// Shake “non-scrolling” : écrit sur une ligne donnée sans ajouter de newline.
    /// </summary>
    public static void ShakeAt(int x, int y, string line, int shakes = 6, int delayMs = 25)
    {
        if (Console.WindowWidth <= 0 || Console.WindowHeight <= 0) return;

        int maxW = Math.Max(0, Console.WindowWidth - 1);
        line = line.Length > maxW ? line[..maxW] : line;

        int clampedY = Math.Clamp(y, 0, Math.Max(0, Console.WindowHeight - 1));
        int clampedX = Math.Clamp(x, 0, Math.Max(0, Console.WindowWidth - 1));

        for (int i = 0; i < shakes; i++)
        {
            int offset = (i % 2 == 0) ? 1 : 0;
            int xx = Math.Clamp(clampedX + offset, 0, Math.Max(0, Console.WindowWidth - 1));

            Console.SetCursorPosition(xx, clampedY);
            Console.Write(line.PadRight(maxW));
            Thread.Sleep(delayMs);
        }

        Console.SetCursorPosition(clampedX, clampedY);
        Console.Write(line.PadRight(maxW));
    }
}
