namespace RogueLike.App.States;

using RogueLike.App;
using RogueLike.Domain.Entities;
using RogueLike.UI;
using System.Xml;

public sealed class CombatState : IGameState
{
    public string Name => "Combat";
    private readonly Monster _enemy;
    private readonly List<string> _log = new();
    private bool _entered;

    public CombatState(Monster enemy)
    {
        _enemy = enemy;
    }

    public void Update(GameContext ctx)
    {
        if (!_entered)
        {
            _entered = true;
            CombatTransition.Play($"COMBAT : {_enemy.Name} !");
            _log.Add($"Un {_enemy.Name} surgit devant toi !");
            _log.Add("Tu dégaines ton arme...");
        }

        CombatScreen.Draw(ctx.Player, _enemy, _log);
        WaitEnter();

        int dmgToEnemy = Math.Max(1, ctx.Player.Attack);
        _enemy.TakeDamage(dmgToEnemy);
        _log.Add($"Tu frappes {_enemy.Name} et infliges {dmgToEnemy} dégâts.");

        if (_enemy.IsDead)
        {
            _log.Add($"{_enemy.Name} est vaincu !");
            CombatScreen.Draw(ctx.Player, _enemy, _log);
            WaitEnter();

            Console.Clear();
            ctx.State = new ExplorationState();
            return;
        }

        int dmgToPlayer = Math.Max(1, _enemy.Attack);
        ctx.Player.TakeDamage(dmgToPlayer);
        _log.Add($"{_enemy.Name} riposte ! Tu perds {dmgToPlayer} PV.");

        if (ctx.Player.IsDead)
        {
            _log.Add("Tu t’effondres...");
            CombatScreen.Draw(ctx.Player, _enemy, _log);
            WaitEnter();

            Console.Clear();
            ctx.State = new EndState(victory: false);
        }
    }

    private static void WaitEnter()
    {
        ConsoleKey k;
        do { k = Console.ReadKey(true).Key; }
        while (k != ConsoleKey.Enter);
    }
}
