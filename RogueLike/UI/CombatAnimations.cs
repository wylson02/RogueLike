namespace RogueLike.UI;

using System.Threading;

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

    public static void Shake(string line, int shakes = 6, int delayMs = 25)
    {
        int y = Console.CursorTop;
        for (int i = 0; i < shakes; i++)
        {
            int offset = (i % 2 == 0) ? 1 : 0;
            Console.SetCursorPosition(offset, y);
            Console.Write(line.PadRight(Math.Max(0, Console.WindowWidth - 1)));
            Thread.Sleep(delayMs);
        }
        Console.SetCursorPosition(0, y);
        Console.Write(line.PadRight(Math.Max(0, Console.WindowWidth - 1)));
        Console.WriteLine();
    }
}
