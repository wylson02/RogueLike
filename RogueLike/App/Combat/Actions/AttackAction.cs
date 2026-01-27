namespace RogueLike.App.Combat.Actions;

using RogueLike.App.Combat;

public sealed class AttackAction : ICombatAction
{
    public string GetLabel(CombatContext ctx) => "1) Attaquer   (A)";
    public bool CanExecute(CombatContext ctx) => true;

    public CombatActionResult Execute(CombatContext ctx)
    {
        int baseDmg = Math.Max(1, ctx.Player.Attack);

        bool crit = ctx.Roll(ctx.Player.CritChancePercent);
        int dmg = baseDmg;

        if (crit)
        {
            dmg = (int)Math.Round(baseDmg * (ctx.Player.CritMultiplierPercent / 100.0));
            dmg = Math.Max(dmg, baseDmg + 1);
        }

        ctx.Enemy.TakeDamage(dmg);

        int heal = 0;
        if (ctx.Player.LifeStealPercent > 0 && dmg > 0)
        {
            heal = (int)Math.Floor(dmg * (ctx.Player.LifeStealPercent / 100.0));
            if (heal > 0)
                ctx.Player.Heal(heal);
        }

        string log = crit
            ? $"CRIT ! Tu infliges {dmg} dégâts."
            : $"Tu attaques et infliges {dmg} dégâts.";

        if (heal > 0)
            log += $" Vol de vie: +{heal} PV.";

        return new CombatActionResult
        {
            LogLine = log,
            EndCombat = ctx.Enemy.IsDead
        };
    }
}
