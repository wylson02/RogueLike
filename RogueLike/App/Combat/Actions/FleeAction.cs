namespace RogueLike.App.Combat.Actions;

using RogueLike.App.Combat;

public sealed class FleeAction : ICombatAction
{
    public string GetLabel(CombatContext ctx) => "4) Fuir       (F)";
    public bool CanExecute(CombatContext ctx) => true;

    public CombatActionResult Execute(CombatContext ctx)
    {
        bool success = ctx.Roll(ctx.FleeChancePercent);

        if (success)
        {
            ctx.SetFled();
            return new CombatActionResult
            {
                LogLine = "Tu prends la fuite !",
                EndCombat = true,
                PlayerFled = true
            };
        }

        return new CombatActionResult
        {
            LogLine = "Tu essaies de fuir... ÉCHEC !"
        };
    }
}
