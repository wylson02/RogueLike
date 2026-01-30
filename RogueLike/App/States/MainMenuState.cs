namespace RogueLike.App.States;

using RogueLike.App;
using RogueLike.UI;

public sealed class MainMenuState : IGameState
{
    public string Name => "Menu";

    private int _selected = 0;
    private DateTime _lastBlink = DateTime.UtcNow;
    private bool _blink = true;

    private readonly string[] _items =
    {
        "▶ Lancer l'aventure",
        "⚙ Options (bientôt)",
        "✦ Crédits",
        "⏻ Quitter"
    };

    public void Update(GameContext ctx)
    {
        Draw();

        // blink “Press Enter”
        if ((DateTime.UtcNow - _lastBlink).TotalMilliseconds > 380)
        {
            _lastBlink = DateTime.UtcNow;
            _blink = !_blink;
            Draw();
        }

        // input
        while (Console.KeyAvailable) Console.ReadKey(true);
        var key = Console.ReadKey(true).Key;

        if (key is ConsoleKey.UpArrow or ConsoleKey.W)
        {
            _selected = (_selected - 1 + _items.Length) % _items.Length;
            Draw(selectFx: true);
            return;
        }

        if (key is ConsoleKey.DownArrow or ConsoleKey.S)
        {
            _selected = (_selected + 1) % _items.Length;
            Draw(selectFx: true);
            return;
        }

        if (key is ConsoleKey.Enter or ConsoleKey.Spacebar)
        {
            Activate(ctx);
            return;
        }

        if (key is ConsoleKey.Escape)
        {
            Environment.Exit(0);
        }
    }

    private void Activate(GameContext ctx)
    {
        switch (_selected)
        {
            case 0:
                // CINÉ + START GAME
                IntroCinematicScreen.Play();

                Console.ResetColor();
                Console.Clear();
                Console.SetCursorPosition(0, 0);

                ctx.ClearLog();
                ctx.PushLog("Tu entres dans les ruines. Le silence est lourd.", GameContext.LogKind.System);

                ctx.LoadLevel(1);
                ctx.State = new ExplorationState();
                return;

            case 1:
                MiniPopup("OPTIONS", new[]
                {
                    "Pas encore implémenté.",
                    "Mais la base est prête."
                });
                return;

            case 2:
                MiniPopup("CRÉDITS", new[]
                {
                    "RogueLike Console",
                    "Code & Game Feel : Wylson, Baptiste, Ebubekir",
                    "",
                    "Merci d'avoir joué."
                });
                return;

            case 3:
                Environment.Exit(0);
                return;
        }
    }

    // ===================== RENDER =====================

    private void Draw(bool selectFx = false)
    {
        Console.CursorVisible = false;
        Console.ResetColor();
        Console.SetCursorPosition(0, 0);
        Console.Clear();

        int w = Math.Max(80, Console.WindowWidth - 1);
        int h = Math.Max(28, Console.WindowHeight - 1);

        // background "vibes" (dégradé ASCII)
        DrawBackdrop(w, h);

        // logo
        DrawLogoCentered(w, y: 3);

        // subtitle
        WriteCentered(w, 11, "Un roguelike console — brutal, stylé, rapide.", ConsoleColor.DarkGray);

        // menu box
        int boxW = Math.Min(w - 10, 54);
        int boxX = Math.Max(0, (w - boxW) / 2);
        int boxY = 13;

        Box(boxX, boxY, boxW, 9, "MENU");

        for (int i = 0; i < _items.Length; i++)
        {
            bool sel = i == _selected;
            string line = _items[i];

            int y = boxY + 2 + i;
            Console.SetCursorPosition(boxX + 2, y);

            if (sel)
            {
                Console.BackgroundColor = ConsoleColor.DarkRed;
                Console.ForegroundColor = ConsoleColor.White;
                Console.Write("  " + Fit(line, boxW - 6) + "  ");
                Console.ResetColor();

                if (selectFx) SmallShakeLine(boxX + 2, y, boxW - 4);
            }
            else
            {
                Console.ForegroundColor = ConsoleColor.Gray;
                Console.Write("  " + Fit(line, boxW - 6) + "  ");
                Console.ResetColor();
            }
        }

        // prompt bas
        string prompt = _blink ? "ENTRÉE : sélectionner   ↑↓ : naviguer   ESC : quitter" : "";
        WriteCentered(w, h - 2, prompt, ConsoleColor.DarkGray);
    }

    private static void DrawBackdrop(int w, int h)
    {
        var chars = new[] { ' ', '░', '▒' };
        var rng = new Random(12345); // stable (pas de flicker)
        for (int y = 0; y < h; y++)
        {
            Console.SetCursorPosition(0, y);
            for (int x = 0; x < w; x++)
            {
                // bruit léger
                int v = (x + y * 3) % 9;
                char c = v < 6 ? chars[0] : (v < 8 ? chars[1] : chars[2]);

                // touches rouges discrètes
                if ((x + y) % 67 == 0) c = '·';

                Console.ForegroundColor = ConsoleColor.DarkGray;
                Console.Write(c);
            }
        }
        Console.ResetColor();
    }

    private static void DrawLogoCentered(int w, int y)
    {
        string[] logo =
        {
            "██████╗  ██████╗  ██████╗ ██╗   ██╗███████╗",
            "██╔══██╗██╔═══██╗██╔════╝ ██║   ██║██╔════╝",
            "██████╔╝██║   ██║██║  ███╗██║   ██║█████╗  ",
            "██╔══██╗██║   ██║██║   ██║██║   ██║██╔══╝  ",
            "██║  ██║╚██████╔╝╚██████╔╝╚██████╔╝███████╗",
            "╚═╝  ╚═╝ ╚═════╝  ╚═════╝  ╚═════╝ ╚══════╝",
        };

        int startY = y;
        foreach (var line in logo)
        {
            int x = Math.Max(0, (w - line.Length) / 2);
            Console.SetCursorPosition(x, startY++);
            Console.ForegroundColor = ConsoleColor.DarkRed;
            Console.Write(line);
        }

        Console.ResetColor();
        WriteCentered(w, startY + 1, "TEMPLE OF SEALS", ConsoleColor.Gray);
    }

    private static void Box(int x, int y, int w, int h, string title)
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

    private static void WriteCentered(int w, int y, string text, ConsoleColor col)
    {
        if (string.IsNullOrEmpty(text)) return;
        int x = Math.Max(0, (w - text.Length) / 2);
        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = col;
        Console.Write(text);
        Console.ResetColor();
    }

    private static void MiniPopup(string title, string[] lines)
    {
        Console.ResetColor();
        Console.Clear();

        int w = Math.Max(70, Console.WindowWidth - 1);
        int boxW = Math.Min(w - 10, 62);
        int boxX = Math.Max(0, (w - boxW) / 2);
        int boxY = 6;

        Box(boxX, boxY, boxW, 8, title);

        int y = boxY + 2;
        foreach (var l in lines)
        {
            Console.SetCursorPosition(boxX + 2, y++);
            Console.ForegroundColor = ConsoleColor.Gray;
            Console.Write(Fit(l, boxW - 4));
        }

        Console.SetCursorPosition(boxX + 2, boxY + 6);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write("ENTRÉE : retour");
        Console.ResetColor();

        while (Console.KeyAvailable) Console.ReadKey(true);
        Console.ReadKey(true);
    }

    private static void SmallShakeLine(int x, int y, int w)
    {
        // micro shake “physique” sans redessiner tout
        // (ça donne un feeling bouton)
        int dx = 1;
        Console.SetCursorPosition(x + dx, y);
        Thread.Sleep(10);
    }

    private static string Fit(string s, int max)
    {
        if (max <= 0) return "";
        if (s.Length <= max) return s.PadRight(max);
        if (max <= 1) return s[..max];
        return s[..(max - 1)] + "…";
    }
}
