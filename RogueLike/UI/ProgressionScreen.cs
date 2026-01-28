namespace RogueLike.UI;

using RogueLike.Domain.Entities;

public static class ProgressionScreen
{
    private static readonly (StatType stat, string label, string gain)[] _entries =
    {
        (StatType.MaxHp,      "PV Max",   "+2 PV max"),
        (StatType.Attack,     "Attaque",  "+1 ATK"),
        (StatType.Armor,      "Armure",   "+1 ARM"),
        (StatType.CritChance, "Critique", "+2% CRIT"),
        (StatType.LifeSteal,  "Vol de vie","+2% VOL"),
    };

    public static void Show(Player player)
    {
        Console.CursorVisible = false;
        int selected = 0;

        while (true)
        {
            Draw(player, selected);

            var key = Console.ReadKey(true).Key;

            if (key == ConsoleKey.P || key == ConsoleKey.Escape || key == ConsoleKey.Enter)
                return;

            if (key == ConsoleKey.UpArrow || key == ConsoleKey.Z)
                selected = Math.Max(0, selected - 1);

            if (key == ConsoleKey.DownArrow || key == ConsoleKey.S)
                selected = Math.Min(_entries.Length - 1, selected + 1);

            if (key == ConsoleKey.Spacebar)
            {
                if (player.StatPoints <= 0) continue;

                var stat = _entries[selected].stat;
                player.SpendStatPoint(stat);
            }
        }
    }

    private static void Draw(Player p, int selected)
    {
        Console.Clear();

        Console.WriteLine("===== PROGRESSION =====");
        Console.WriteLine($"Niveau: {p.Level}");
        Console.WriteLine($"XP: {p.Xp}/{p.XpToNext}");
        Console.WriteLine($"Points à dépenser: {p.StatPoints}");
        Console.WriteLine($"Or: {p.Gold}");
        Console.WriteLine();

        Console.WriteLine("Stats:");
        Console.WriteLine($"PV  : {p.Hp}/{p.MaxHp}");
        Console.WriteLine($"ATK : {p.Attack}");
        Console.WriteLine($"ARM : {p.Armor}");
        Console.WriteLine($"CRIT: {p.CritChancePercent}%");
        Console.WriteLine($"VOL : {p.LifeStealPercent}%");
        Console.WriteLine(new string('-', 50));

        for (int i = 0; i < _entries.Length; i++)
        {
            var (stat, label, gain) = _entries[i];
            string prefix = (i == selected) ? "> " : "  ";

            Console.WriteLine($"{prefix}{label,-12} ({gain})");
        }

        Console.WriteLine(new string('-', 50));
        Console.WriteLine("↑↓ / ZS : naviguer | ESPACE : dépenser | P/Echap/Entrée : revenir");
    }
}
