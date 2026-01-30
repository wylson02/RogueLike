namespace RogueLike.App.States;

using RogueLike.App;
using RogueLike.UI;

public sealed class EndState : IGameState
{
    public string Name => "Fin";

    private readonly bool _victory;
    private bool _played;

    public EndState(bool victory) => _victory = victory;

    public void Update(GameContext ctx)
    {
        if (_played) return;
        _played = true;

        EndScreen.Play(ctx, _victory);

        Console.ResetColor();
        Console.Clear();
        Console.SetCursorPosition(0, 0);

        ctx.LoadLevel(1);
        ctx.State = new ExplorationState();
    }
}
