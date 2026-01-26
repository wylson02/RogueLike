namespace RogueLike.UI;

using System.Threading;

public static class CombatTransition
{
    public static void Play(string title = "COMBAT")
    {
        Console.CursorVisible = false;

        int w = Console.WindowWidth;
        int h = Console.WindowHeight;

        for (int step = 0; step < 12; step++)
        {
            Console.Clear();

            int margin = Math.Max(0, (12 - step));
            for (int y = 0; y < h - 1; y++)
            {
                int left = Math.Min(w - 1, margin * 2);
                int right = Math.Max(0, w - left);

                Console.SetCursorPosition(0, y);
                Console.Write(new string(' ', left));
                Console.Write(new string('#', Math.Max(0, right - left)));
            }

            WriteCentered(h / 2, $"{title}");
            Thread.Sleep(50);
        }

        for (int i = 3; i >= 1; i--)
        {
            Console.Clear();
            WriteCentered(h / 2, i.ToString());
            Thread.Sleep(350);
        }

        Console.Clear();
    }

    private static void WriteCentered(int y, string text)
    {
        int w = Console.WindowWidth;
        int x = Math.Max(0, (w - text.Length) / 2);
        Console.SetCursorPosition(x, Math.Clamp(y, 0, Console.WindowHeight - 1));
        Console.Write(text);
    }
}
