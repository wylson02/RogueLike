namespace RogueLike.App.States;

using RogueLike.App;
using RogueLike.Domain.Entities;
using RogueLike.UI;

public sealed class CombatState : IGameState
{
    public string Name => "Combat";

    private readonly Monster _enemy;
    private readonly List<string> _log = new();
    private bool _entered;

    private int _healsLeft = 2;
    private int _healAmount = 8;

    private int _dodgeTurnsLeft = 0;
    private int _dodgeChancePercent = 40;

    private int _fleeChancePercent = 55;

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
            _log.Add($"Un {_enemy.Name} surgit !");
            _log.Add("Que vas-tu faire ?");
        }

        var action = ReadAction(ctx);

        bool combatEnded = ResolvePlayerAction(ctx, action);
        if (combatEnded) return;

        ResolveEnemyTurn(ctx);

        if (_dodgeTurnsLeft > 0) _dodgeTurnsLeft--;

        if (ctx.Player.IsDead)
        {
            _log.Add("Tu t’effondres...");
            CombatScreen.Draw(ctx.Player, _enemy, _log);
            WaitEnter();
            Console.Clear();
            ctx.State = new EndState(victory: false);
        }
    }

    private CombatAction ReadAction(GameContext ctx)
    {
        while (true)
        {
            CombatScreen.Draw(ctx.Player, _enemy, BuildMenuLog(ctx));
            ConsoleKey key = Console.ReadKey(true).Key;

            switch (key)
            {
                case ConsoleKey.D1:
                case ConsoleKey.NumPad1:
                case ConsoleKey.A:
                    return CombatAction.Attack;

                case ConsoleKey.D2:
                case ConsoleKey.NumPad2:
                case ConsoleKey.H:
                    return CombatAction.Heal;

                case ConsoleKey.D3:
                case ConsoleKey.NumPad3:
                case ConsoleKey.E:
                    return CombatAction.Dodge;

                case ConsoleKey.D4:
                case ConsoleKey.NumPad4:
                case ConsoleKey.F:
                    return CombatAction.Flee;

                default:
                    break;
            }
        }
    }

    private IReadOnlyList<string> BuildMenuLog(GameContext ctx)
    {
        var lines = new List<string>(_log);

        lines.Add("");
        lines.Add("Actions :");
        lines.Add("1) Attaquer   (A)");
        lines.Add(_healsLeft > 0 ? $"2) Soigner x{_healsLeft} (H)" : "2) Soigner (H) [INDISPONIBLE]");
        lines.Add(_dodgeTurnsLeft > 0
            ? $"3) Esquiver (E) [BUFF actif {_dodgeTurnsLeft} tour(s)]"
            : "3) Esquiver (E) [buff 2 tours]");
        lines.Add("4) Fuir       (F)");
        lines.Add("");
        lines.Add("Choisis 1-4 (ou A/H/E/F).");

        return lines;
    }

    private bool ResolvePlayerAction(GameContext ctx, CombatAction action)
    {
        switch (action)
        {
            case CombatAction.Attack:
                PlayerAttack(ctx);
                if (_enemy.IsDead)
                {
                    _log.Add($"{_enemy.Name} est vaincu !");
                    CombatScreen.Draw(ctx.Player, _enemy, _log);
                    WaitEnter();

                    Console.Clear();
                    ctx.State = new ExplorationState();
                    return true;
                }
                return false;

            case CombatAction.Heal:
                if (_healsLeft <= 0)
                {
                    _log.Add("Tu n’as plus de soin !");
                    return false;
                }
                _healsLeft--;
                ctx.Player.Heal(_healAmount);
                _log.Add($"Tu te soignes (+{_healAmount} PV).");
                return false;

            case CombatAction.Dodge:
                _dodgeTurnsLeft = 2;
                _log.Add($"Tu te mets en garde : +{_dodgeChancePercent}% d’esquive pendant 2 tours.");
                return false;

            case CombatAction.Flee:
                bool success = Roll(ctx, _fleeChancePercent);
                if (success)
                {
                    _log.Add("Tu prends la fuite !");
                    CombatScreen.Draw(ctx.Player, _enemy, _log);
                    WaitEnter();

                    Console.Clear();
                    ctx.State = new ExplorationState();
                    return true;
                }

                _log.Add("Tu essaies de fuir... ÉCHEC !");
                return false;

            default:
                return false;
        }
    }

    private void PlayerAttack(GameContext ctx)
    {
        CombatAnimations.Flash(times: 1, delayMs: 45);

        int dmg = Math.Max(1, ctx.Player.Attack);
        _enemy.TakeDamage(dmg);

        _log.Add($"Tu attaques : {_enemy.Name} perd {dmg} PV.");
    }

    private void ResolveEnemyTurn(GameContext ctx)
    {
        if (_enemy.IsDead) return;

        if (_dodgeTurnsLeft > 0)
        {
            bool dodged = Roll(ctx, _dodgeChancePercent);
            if (dodged)
            {
                _log.Add($"{_enemy.Name} attaque... mais tu esquives !");
                return;
            }
            _log.Add($"{_enemy.Name} attaque... tu n’arrives pas à esquiver !");
        }

        int dmg = Math.Max(1, _enemy.Attack);

        Console.Clear();
        CombatScreen.Draw(ctx.Player, _enemy, _log);
        CombatAnimations.Shake($"{_enemy.Name} frappe !", shakes: 6, delayMs: 20);

        ctx.Player.TakeDamage(dmg);
        _log.Add($"Tu perds {dmg} PV.");
    }

    private static bool Roll(GameContext ctx, int chancePercent)
    {
        int r = ctx.Rng.Next(0, 100);
        return r < chancePercent;
    }

    private static void WaitEnter()
    {
        ConsoleKey k;
        do { k = Console.ReadKey(true).Key; }
        while (k != ConsoleKey.Enter);
    }
}
