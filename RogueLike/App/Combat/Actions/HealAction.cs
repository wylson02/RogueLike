namespace RogueLike.App.Combat.Actions;

using RogueLike.App.Combat;

public sealed class HealAction : ICombatAction
{
    public string GetLabel(CombatContext ctx)
        => ctx.HealsLeft > 0
            ? $"2) Soigner x{ctx.HealsLeft} (H)"
            : "2) Soigner (H) [INDISPONIBLE]";

    public bool CanExecute(CombatContext ctx) => ctx.HealsLeft > 0;

    public CombatActionResult Execute(CombatContext ctx)
    {
        ctx.ConsumeHealCharge();
        ctx.Player.Heal(ctx.HealAmount);

        return new CombatActionResult
        {
            LogLine = $"Tu te soignes (+{ctx.HealAmount} PV)."
        };
    }
}
