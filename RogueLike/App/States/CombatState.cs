namespace RogueLike.App.States;

using RogueLike.App;
using RogueLike.App.Combat;
using RogueLike.App.Combat.Actions;
using RogueLike.App.Services;
using RogueLike.Domain.Entities;
using RogueLike.UI;

public sealed class CombatState : IGameState
{
    public string Name => "Combat";

    private readonly Monster _enemy;
    private CombatContext? _combat;
    private bool _entered;
    private bool _empowerApplied = false;
    private int _empowerAtkBonus = 2;
    private bool _rewardGiven = false;

    private readonly List<ICombatAction> _actions = new()
    {
        new AttackAction(),
        new HealAction(),
        new DodgeAction(),
        new FleeAction(),
    };

    public CombatState(Monster enemy) => _enemy = enemy;

    public void Update(GameContext ctx)
    {
        if (!_entered)
        {
            _entered = true;

            _combat = new CombatContext(ctx.Player, _enemy, ctx.Rng);
            CombatTransition.Play($"COMBAT : {_enemy.Name} !");
            _combat.AddLog($"Un {_enemy.Name} surgit !");

            if (ctx.LegendaryEmpowerNextFight)
            {
                ctx.ConsumeLegendaryEmpower();
                ctx.Player.ModifyAttack(_empowerAtkBonus);
                _empowerApplied = true;
                _combat.AddLog("La lame pulse : vos coups sont renforcés !");
            }

            // ⚠️ plus besoin d’ajouter le prompt ici : CombatScreen le gère proprement
        }

        if (_combat == null) return;

        var action = CombatScreen.ReadAction(_combat, _actions);
        var result = CombatActionExecute(_combat, action);

        if (_combat.Enemy.IsDead && !_rewardGiven && !_combat.PlayerFled)
        {
            _rewardGiven = true;

            int xp = _enemy.RollXp(ctx.Rng);
            int gold = _enemy.RollGold(ctx.Rng);

            ctx.Player.GainXp(xp);
            ctx.Player.AddGold(gold);

            _combat.AddLog($"+{xp} XP, +{gold} or !");
            ctx.AddMessage($"+{xp} XP, +{gold} or !");

            if (_enemy.Rank == MonsterRank.MiniBoss)
                Map3Scripting.OnMiniBossDefeated(ctx);
        }

        if (result.EndCombat || _combat.IsOver || _combat.PlayerFled)
        {
            CombatScreen.Draw(_combat.Player, _combat.Enemy, _combat.Log);
            CombatScreen.WaitEnter();

            // ✅ reset hard pour éviter superposition en retour exploration
            Console.ResetColor();
            Console.Clear();
            Console.SetCursorPosition(0, 0);

            if (_combat.Player.IsDead)
            {
                ctx.State = new EndState(victory: false);
                return;
            }

            if (_empowerApplied)
            {
                ctx.Player.ModifyAttack(-_empowerAtkBonus);
                _empowerApplied = false;
            }

            ctx.State = new ExplorationState();
            return;
        }

        ResolveEnemyTurn(_combat);
        _combat.TickEndOfRound();

        if (_combat.Player.IsDead)
        {
            _combat.AddLog("Tu t’effondres...");
            CombatScreen.Draw(_combat.Player, _combat.Enemy, _combat.Log);
            CombatScreen.WaitEnter();

            Console.ResetColor();
            Console.Clear();
            Console.SetCursorPosition(0, 0);

            ctx.State = new EndState(victory: false);
        }
    }

    private static CombatActionResult CombatActionExecute(CombatContext combat, ICombatAction action)
    {
        if (!action.CanExecute(combat))
            return new CombatActionResult { LogLine = "Action impossible." };

        var res = action.Execute(combat);
        if (!string.IsNullOrWhiteSpace(res.LogLine))
            combat.AddLog(res.LogLine);

        if (combat.Enemy.IsDead)
        {
            combat.AddLog($"{combat.Enemy.Name} est vaincu !");
            return new CombatActionResult { EndCombat = true };
        }

        return res;
    }

    private static void ResolveEnemyTurn(CombatContext combat)
    {
        if (combat.Enemy.IsDead) return;

        if (combat.DodgeTurnsLeft > 0)
        {
            bool dodged = combat.Roll(combat.DodgeChancePercent);
            if (dodged)
            {
                combat.AddLog($"{combat.Enemy.Name} attaque... mais tu esquives !");
                return;
            }
            combat.AddLog($"{combat.Enemy.Name} attaque... tu n’arrives pas à esquiver !");
        }

        int dmg = Math.Max(1, combat.Enemy.Attack);

        CombatScreen.Draw(combat.Player, combat.Enemy, combat.Log);

        CombatScreen.FxLine($"{combat.Enemy.Name} frappe !");

        combat.Player.TakeDamage(dmg);
        combat.AddLog($"Tu perds {dmg} PV.");
    }
}
