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

    private static void Draw(Player player, int selected)
    {
        Console.Clear();

        Console.WriteLine("===== INVENTAIRE =====");
        Console.WriteLine($"PV: {player.Hp}/{player.MaxHp} | ATK: {player.Attack} | ARM: {player.Armor}");
        Console.WriteLine($"Équipé: Arme={player.EquippedWeapon?.Name ?? "Aucune"} | Armure={player.EquippedArmor?.Name ?? "Aucune"} | Accessoire={player.EquippedAccessory?.Name ?? "Aucun"}");

        Console.WriteLine(new string('-', 70));

        int leftWidth = 30;

        var leftLines = BuildLeftList(player, selected, leftWidth);
        var rightLines = BuildRightPanel(player, selected);

        int lines = Math.Max(leftLines.Count, rightLines.Count);
        for (int i = 0; i < lines; i++)
        {
            string left = i < leftLines.Count ? leftLines[i] : "".PadRight(leftWidth);
            string right = i < rightLines.Count ? rightLines[i] : "";
            Console.WriteLine(left + " | " + right);
        }

        Console.WriteLine(new string('-', 70));
        Console.WriteLine("↑↓ / ZS : naviguer   |   U : équiper/utiliser   |   I / Entrée / Echap : revenir");
    }

    private static List<string> BuildLeftList(Player player, int selected, int width)
    {
        var lines = new List<string> { "Objets :" };

        if (player.Inventory.Count == 0)
        {
            lines.Add("(vide)");
            return lines.Select(l => Pad(l, width)).ToList();
        }

        for (int i = 0; i < player.Inventory.Count; i++)
        {
            var it = player.Inventory[i];
            string prefix = (i == selected) ? "> " : "  ";
            lines.Add(prefix + it.Name);
        }

        return lines.Select(l => Pad(l, width)).ToList();
    }

    private static List<string> BuildRightPanel(Player player, int selected)
    {
        var lines = new List<string>();

        if (player.Inventory.Count == 0)
        {
            lines.Add("Sélection :");
            lines.Add("Aucun objet.");
            return lines;
        }

        selected = Math.Clamp(selected, 0, player.Inventory.Count - 1);
        Item it = player.Inventory[selected];

        lines.Add("Sélection :");
        lines.Add(it.Name);
        lines.Add("");
        lines.Add(it.Description);

        var stats = it.GetStatsLines().ToList();
        if (stats.Count > 0)
        {
            lines.Add("");
            lines.Add("Stats :");
            foreach (var s in stats)
                lines.Add("- " + s);
        }

        return lines;
    }

    private static string Pad(string s, int width)
    {
        if (s.Length >= width) return s.Substring(0, width);
        return s.PadRight(width);
    }
}
