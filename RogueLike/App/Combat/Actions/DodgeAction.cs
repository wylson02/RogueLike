namespace RogueLike.App.Combat.Actions;

using RogueLike.App.Combat;

public sealed class DodgeAction : ICombatAction
{
    public string GetLabel(CombatContext ctx)
        => ctx.DodgeTurnsLeft > 0
            ? $"3) Esquiver (E) [BUFF actif {ctx.DodgeTurnsLeft} tour(s)]"
            : "3) Esquiver (E) [buff 2 tours]";

    public bool CanExecute(CombatContext ctx) => true;

    public CombatActionResult Execute(CombatContext ctx)
    {
        ctx.ActivateDodgeBuff(turns: 2);

        return new CombatActionResult
        {
            LogLine = $"Tu te mets en garde : +{ctx.DodgeChancePercent}% d’esquive pendant 2 tours."
        };
    }
}
