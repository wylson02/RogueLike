namespace RogueLike.UI;

using RogueLike.App.Combat;
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

        int max = Math.Max(0, Console.WindowHeight - 10);
        foreach (var line in logLines.TakeLast(max))
            Console.WriteLine(line);

        Console.WriteLine();
    }

    // ✅ UI gère les touches (pas dans App)
    public static ICombatAction ReadAction(CombatContext ctx, IReadOnlyList<ICombatAction> actions)
    {
        while (true)
        {
            var menu = BuildMenuLines(ctx, actions);
            Draw(ctx.Player, ctx.Enemy, menu);

            var key = Console.ReadKey(true).Key;

            // mapping ici (OK: UI)
            switch (key)
            {
                case ConsoleKey.D1:
                case ConsoleKey.NumPad1:
                case ConsoleKey.A:
                    return actions[0];

                case ConsoleKey.D2:
                case ConsoleKey.NumPad2:
                case ConsoleKey.H:
                    return actions[1];

                case ConsoleKey.D3:
                case ConsoleKey.NumPad3:
                case ConsoleKey.E:
                    return actions[2];

                case ConsoleKey.D4:
                case ConsoleKey.NumPad4:
                case ConsoleKey.F:
                    return actions[3];

                default:
                    break;
            }
        }
    }

    private static IReadOnlyList<string> BuildMenuLines(CombatContext ctx, IReadOnlyList<ICombatAction> actions)
    {
        var lines = new List<string>(ctx.Log);

        lines.Add("");
        lines.Add("Actions :");
        foreach (var a in actions)
            lines.Add(a.GetLabel(ctx));
        lines.Add("");
        lines.Add("Choisis 1-4 (ou A/H/E/F).");

        return lines;
    }

    public static void WaitEnter()
    {
        Console.WriteLine("[Entrée] pour continuer");
        ConsoleKey k;
        do { k = Console.ReadKey(true).Key; }
        while (k != ConsoleKey.Enter);
    }
}
