namespace RogueLike.App.Combat;

public interface ICombatAction
{
    string GetLabel(CombatContext ctx);
    bool CanExecute(CombatContext ctx);
    CombatActionResult Execute(CombatContext ctx);
}
