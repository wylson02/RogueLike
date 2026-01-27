namespace RogueLike.App.Combat.Actions;

using RogueLike.App.Combat;

public sealed class AttackAction : ICombatAction
{
    public string GetLabel(CombatContext ctx) => "1) Attaquer   (A)";
    public bool CanExecute(CombatContext ctx) => true;

    public CombatActionResult Execute(CombatContext ctx)
    {
        int dmg = Math.Max(1, ctx.Player.Attack);
        ctx.Enemy.TakeDamage(dmg);

        return new CombatActionResult
        {
            LogLine = $"Tu attaques : {ctx.Enemy.Name} perd {dmg} PV.",
            EndCombat = ctx.Enemy.IsDead
        };
    }
}
