namespace RogueLike.App.Combat;

public sealed class CombatActionResult
{
    public bool EndCombat { get; init; }
    public bool PlayerFled { get; init; }
    public string? LogLine { get; init; }
}
