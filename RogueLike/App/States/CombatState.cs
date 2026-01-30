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

    // Boss finale : phase 2
    private bool _bossPhase2 = false;
    private int _bossPhase2AtkBonus = 5;
    private int _bossPhase2ArmBonus = 2;
    private int _bossPhase2CritBonus = 15;
    private int _bossPhase2CritMulBonus = 50; // +50% => 250%->300% etc
    private int _bossPhase2Heal = 18;
    private bool _phase2Triggered = false;

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

            // Intro plus épique si Boss
            if (_enemy.Rank == MonsterRank.Boss)
            {
                CombatTransition.Play($"BOSS : {_enemy.Name.ToUpper()} !");
                _combat.AddLog("L'air se déchire. Un pas. Puis un autre.");
                _combat.AddLog($"{_enemy.Name} se lève de son trône.");
                _combat.AddLog("Le temple retient son souffle…");
            }
            else
            {
                CombatTransition.Play($"COMBAT : {_enemy.Name} !");
                _combat.AddLog($"Un {_enemy.Name} surgit !");
            }

            if (ctx.LegendaryEmpowerNextFight)
            {
                ctx.ConsumeLegendaryEmpower();
                ctx.Player.ModifyAttack(_empowerAtkBonus);
                _empowerApplied = true;
                _combat.AddLog("La lame pulse : vos coups sont renforcés !");
            }
        }

        if (_combat == null) return;

        var action = CombatScreen.ReadAction(_combat, _actions);
        var result = CombatActionExecute(_combat, action);

        // ===================== BOSS PHASE 2 =====================
        if (_combat.Enemy.Rank == MonsterRank.Boss && !_bossPhase2 && !_combat.Enemy.IsDead)
        {
            if (_combat.Enemy.Hp <= _combat.Enemy.MaxHp / 2)
            {
                _bossPhase2 = true;

                CombatTransition.Play("PHASE 2 : L'ABÎME S'ÉVEILLE");
                CombatScreen.FxLine("⚠  L'ABÎME DÉCHAÎNE SA FUREUR !");

                _combat.Enemy.Heal(_bossPhase2Heal);
                _combat.Enemy.ModifyAttack(_bossPhase2AtkBonus);
                _combat.Enemy.AddArmor(_bossPhase2ArmBonus);
                _combat.Enemy.ModifyCritChance(_bossPhase2CritBonus);
                _combat.Enemy.ModifyCritMultiplierPercent(_bossPhase2CritMulBonus);

                _combat.AddLog("Le trône se fissure… des ombres s'enroulent autour du roi.");
                _combat.AddLog($"{_combat.Enemy.Name} rugit : \"Je suis le dernier sceau.\"");
                _combat.AddLog("Ses coups deviennent plus rapides. Plus lourds.");
            }
        }

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

            if (_enemy.Rank == MonsterRank.Boss)
            {
                _combat.AddLog("Le silence tombe… puis la lumière revient.");
                ctx.PushLog("Le boss est vaincu !", GameContext.LogKind.System);
            }
        }

        if (result.EndCombat || _combat.IsOver || _combat.PlayerFled)
        {
            CombatScreen.Draw(_combat.Player, _combat.Enemy, _combat.Log);
            CombatScreen.WaitEnter();

            Console.ResetColor();
            Console.Clear();
            Console.SetCursorPosition(0, 0);

            if (_combat.Player.IsDead)
            {
                ctx.State = new EndState(victory: false);
                return;
            }

            // ✅ Boss final : victoire = écran de fin
            if (_combat.Enemy.IsDead && _combat.Enemy.Rank == MonsterRank.Boss)
            {
                if (_empowerApplied)
                {
                    ctx.Player.ModifyAttack(-_empowerAtkBonus);
                    _empowerApplied = false;
                }

                ctx.State = new EndState(victory: true);
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
        TryTriggerPhase2(ctx);
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
    private void TryTriggerPhase2(GameContext ctx)
    {
        if (_combat is null) return;
        if (_phase2Triggered) return;

        // uniquement boss
        if (_enemy.Rank != MonsterRank.Boss) return;

        // seuil 50%
        if (_enemy.MaxHp <= 0) return;
        if (_enemy.Hp > (_enemy.MaxHp / 2)) return;

        _phase2Triggered = true;

        // Cinématique
        BossPhase2CinematicScreen.Play(_enemy.Name.ToUpperInvariant());

        // Buff boss (simple, efficace)
        _enemy.ModifyAttack(+2);
        _enemy.AddArmor(1);
        _enemy.ModifyCritChance(+10);

        _combat.AddLog("Le Roi de l'Abîme se brise… et renaît plus violent.");
        _combat.AddLog("PHASE II — ses coups deviennent implacables !");
    }

}
