namespace RogueLike.UI;

using RogueLike.Domain.Entities;

public static class CombatScreen
{
    public static void Draw(Player player, Monster enemy, IReadOnlyList<string> logLines)
    {
        Console.CursorVisible = false;
        Console.Clear();

        Console.WriteLine("===== COMBAT =====");
        Console.WriteLine($"Toi   (@) PV: {player.Hp}/{player.MaxHp}  ATK: {player.Attack}");
        Console.WriteLine($"{enemy.Name} (M) PV: {enemy.Hp}/{enemy.MaxHp}  ATK: {enemy.Attack}");
        Console.WriteLine(new string('-', Math.Min(Console.WindowWidth - 1, 40)));

        int max = Math.Max(0, Console.WindowHeight - 8);
        foreach (var line in logLines.TakeLast(max))
            Console.WriteLine(line);

        Console.WriteLine();
        Console.WriteLine("[Entrée] pour continuer");
    }
}
