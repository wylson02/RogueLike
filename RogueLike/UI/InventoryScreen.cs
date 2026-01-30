namespace RogueLike.UI;

using RogueLike.Domain.Entities;
using RogueLike.Domain.Items;

public enum InventoryAction
{
    None,
    Close,
    UseSelected
}

public readonly struct InventoryScreenResult
{
    public InventoryAction Action { get; }
    public int SelectedIndex { get; }

    public InventoryScreenResult(InventoryAction action, int selectedIndex)
    {
        Action = action;
        SelectedIndex = selectedIndex;
    }

    public static InventoryScreenResult Close(int idx) => new(InventoryAction.Close, idx);
    public static InventoryScreenResult Use(int idx) => new(InventoryAction.UseSelected, idx);
    public static InventoryScreenResult None(int idx) => new(InventoryAction.None, idx);
}

public static class InventoryScreen
{
    public static InventoryScreenResult Show(Player player, int selectedIndex)
    {
        Console.CursorVisible = false;

        int selected = selectedIndex;
        if (player.Inventory.Count == 0) selected = 0;
        else selected = Math.Clamp(selected, 0, player.Inventory.Count - 1);

        while (true)
        {
            Draw(player, selected);

            var key = Console.ReadKey(true).Key;

            if (key == ConsoleKey.I || key == ConsoleKey.Escape || key == ConsoleKey.Enter)
                return InventoryScreenResult.Close(selected);

            if (key == ConsoleKey.U)
                return InventoryScreenResult.Use(selected);

            if (key == ConsoleKey.UpArrow || key == ConsoleKey.Z)
                selected = Math.Max(0, selected - 1);

            if (key == ConsoleKey.DownArrow || key == ConsoleKey.S)
                selected = Math.Min(Math.Max(0, player.Inventory.Count - 1), selected + 1);

            if (player.Inventory.Count == 0)
                selected = 0;
        }
    }

    private static void Draw(Player p, int selected)
    {
        Console.SetCursorPosition(0, 0);
        Console.Clear();

        int w = Math.Max(70, Console.WindowWidth - 1);
        int h = Math.Max(24, Console.WindowHeight - 1);

        // ===== Header =====
        WriteTopBar(w, "INVENTAIRE");

        // Layout
        int leftW = Math.Clamp(w / 2, 34, 44);
        int rightW = w - leftW - 3;

        int startY = 2;

        DrawBox(0, startY, leftW, h - startY - 4, "SAC");
        DrawBox(leftW + 2, startY, rightW, h - startY - 4, "DÉTAIL");

        DrawFooter(w, h);

        // ===== Left panel : list =====
        int listX = 2;
        int listY = startY + 2;
        int listMax = h - startY - 8;

        if (p.Inventory.Count == 0)
        {
            Console.SetCursorPosition(listX, listY);
            Console.ForegroundColor = ConsoleColor.DarkGray;
            Console.Write("(vide)");
            Console.ResetColor();
        }
        else
        {
            int start = 0;
            if (selected >= listMax) start = selected - listMax + 1;

            for (int i = 0; i < listMax && (start + i) < p.Inventory.Count; i++)
            {
                int idx = start + i;
                var it = p.Inventory[idx];

                Console.SetCursorPosition(listX, listY + i);

                bool isSel = idx == selected;
                if (isSel)
                {
                    Console.BackgroundColor = ConsoleColor.DarkGray;
                    Console.ForegroundColor = ConsoleColor.Black;
                    Console.Write("▶ ");
                    Console.Write(Fit(it.Name, leftW - 6).PadRight(leftW - 6));
                    Console.ResetColor();
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Gray;
                    Console.Write("  ");
                    Console.Write(Fit(it.Name, leftW - 6).PadRight(leftW - 6));
                    Console.ResetColor();
                }
            }
        }

        // Equipped quick view
        int eqY = startY + (h - startY - 4) - 7;
        DrawEquipPanel(p, 2, eqY, leftW - 4);

        // ===== Right panel : selected detail =====
        int rx = leftW + 4;
        int ry = startY + 2;

        DrawPlayerSummary(p, rx, ry, rightW - 4);
        ry += 5;

        if (p.Inventory.Count == 0)
        {
            Console.SetCursorPosition(rx, ry);
            Console.ForegroundColor = ConsoleColor.DarkGray;
            Console.Write("Aucun objet sélectionné.");
            Console.ResetColor();
            return;
        }

        selected = Math.Clamp(selected, 0, p.Inventory.Count - 1);
        var sel = p.Inventory[selected];

        // Title
        Console.SetCursorPosition(rx, ry);
        Console.ForegroundColor = ConsoleColor.White;
        Console.Write(sel.Name);
        Console.ResetColor();
        ry += 2;

        // Description
        foreach (var line in Wrap(sel.Description ?? "", rightW - 4))
        {
            Console.SetCursorPosition(rx, ry++);
            Console.ForegroundColor = ConsoleColor.Gray;
            Console.Write(line);
            Console.ResetColor();
            if (ry > h - 6) break;
        }

        // Stats
        var stats = sel.GetStatsLines().ToList();
        if (stats.Count > 0 && ry < h - 6)
        {
            ry++;
            Console.SetCursorPosition(rx, ry++);
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.Write("STATS");
            Console.ResetColor();

            foreach (var s in stats)
            {
                if (ry > h - 6) break;
                Console.SetCursorPosition(rx, ry++);
                Console.ForegroundColor = ConsoleColor.White;
                Console.Write("• ");
                Console.ForegroundColor = ConsoleColor.Cyan;
                Console.Write(s);
                Console.ResetColor();
            }
        }
    }

    // ================= UI helpers =================

    private static void WriteTopBar(int w, string title)
    {
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("┌" + new string('─', w - 2) + "┐");
        Console.Write("│ ");
        Console.ForegroundColor = ConsoleColor.Yellow;
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
        Console.Write("↑↓/ZS: naviguer   U: équiper/utiliser   I/Entrée/Echap: retour");
        Console.ResetColor();
    }

    private static void DrawBox(int x, int y, int w, int h, string title)
    {
        w = Math.Max(20, w);
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

    private static void DrawPlayerSummary(Player p, int x, int y, int w)
    {
        // PV bar
        string hpLabel = $"PV {p.Hp}/{p.MaxHp}";
        double hp01 = p.MaxHp <= 0 ? 0 : Math.Clamp((double)p.Hp / p.MaxHp, 0, 1);

        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write("STATUS");
        Console.ResetColor();

        DrawBar(x, y + 1, w, hpLabel, hp01,
            hp01 >= 0.6 ? ConsoleColor.Green : hp01 >= 0.3 ? ConsoleColor.Yellow : ConsoleColor.Red);

        Console.SetCursorPosition(x, y + 3);
        Console.ForegroundColor = ConsoleColor.Gray;
        Console.Write($"ATK {p.Attack}   ARM {p.Armor}   CRIT {p.CritChancePercent}%   VOL {p.LifeStealPercent}%");
        Console.ResetColor();
    }

    private static void DrawEquipPanel(Player p, int x, int y, int w)
    {
        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write("ÉQUIPÉ");
        Console.ResetColor();

        string wpn = p.EquippedWeapon?.Name ?? "Aucune";
        string arm = p.EquippedArmor?.Name ?? "Aucune";
        string acc = p.EquippedAccessory?.Name ?? "Aucun";

        WriteEqLine(x, y + 1, w, "Arme", wpn, ConsoleColor.Cyan);
        WriteEqLine(x, y + 2, w, "Armure", arm, ConsoleColor.Cyan);
        WriteEqLine(x, y + 3, w, "Access.", acc, ConsoleColor.Cyan);
    }

    private static void WriteEqLine(int x, int y, int w, string k, string v, ConsoleColor vcol)
    {
        Console.SetCursorPosition(x, y);
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write($"{k}: ");
        Console.ForegroundColor = vcol;
        Console.Write(Fit(v, Math.Max(0, w - k.Length - 2)));
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
        Console.Write(label.PadRight(12));
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

    private static string Fit(string s, int max)
    {
        if (max <= 0) return "";
        if (string.IsNullOrEmpty(s)) return "";
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
