namespace RogueLike.App.States;

using RogueLike.App;
using RogueLike.UI;

public sealed class ProgressionState : IGameState
{
    public string Name => "Progression";
    private readonly IGameState _previous;

    public ProgressionState(IGameState previous)
    {
        _previous = previous;
    }

    public void Update(GameContext ctx)
    {
        ProgressionScreen.Show(ctx.Player);
        ctx.State = _previous;
    }
}
