namespace RogueLike.App.States;

using RogueLike.App;

public sealed class EndState : IGameState
{
    public string Name => "Fin";
    private readonly bool _victory;

    public EndState(bool victory)
    {
        _victory = victory;
    }

    public void Update(GameContext ctx)
    {
        Console.Clear();
        Console.WriteLine(_victory ? "VICTOIRE ✅" : "GAME OVER 💀");
        Console.WriteLine("Appuie sur une touche pour quitter.");
        Console.ReadKey(true);
        Environment.Exit(0);
    }
}
