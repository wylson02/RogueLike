namespace RogueLike.App.States;

using RogueLike.App;
using RogueLike.Domain.Entities;
using RogueLike.UI;

public sealed class ProgressionState : IGameState
{
    public string Name => "Progression";

    private readonly IGameState _previous;
    private int _selectedIndex = 0;

    public ProgressionState(IGameState previous) => _previous = previous;

    public void Update(GameContext ctx)
    {
        var res = ProgressionScreen.Show(ctx.Player, _selectedIndex);
        _selectedIndex = res.SelectedIndex;

        if (res.Action == ProgressionAction.Close)
        {
            Console.ResetColor();
            Console.Clear();
            Console.SetCursorPosition(0, 0);

            ctx.State = _previous;
            return;
        }

        if (res.Action == ProgressionAction.SpendPoint)
        {
            if (ctx.Player.StatPoints <= 0)
            {
                ctx.PushLog("Pas de points à dépenser.", GameContext.LogKind.Warning);
                return;
            }

            // ✅ mapping UI -> StatType (PLAYER gère la dépense + l'application)
            var stat = _selectedIndex switch
            {
                0 => StatType.MaxHp,
                1 => StatType.Attack,
                2 => StatType.Armor,
                3 => StatType.CritChance,
                4 => StatType.LifeSteal,
                _ => StatType.Attack
            };

            bool ok = ctx.Player.SpendStatPoint(stat);
            if (!ok)
            {
                ctx.PushLog("Impossible de dépenser un point.", GameContext.LogKind.Warning);
                return;
            }

            ctx.PushLog("Point dépensé !", GameContext.LogKind.System);
            ctx.ShowToast("+1 amélioration !", ConsoleColor.Black, ConsoleColor.Green, 900);
        }
    }
}
