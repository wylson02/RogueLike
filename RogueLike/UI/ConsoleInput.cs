namespace RogueLike.UI;

using RogueLike.Domain;

public static class ConsoleInput
{
    public static ExplorationCommand ReadExplorationCommand()
    {
        var key = Console.ReadKey(true).Key;

        if (key == ConsoleKey.I)
            return ExplorationCommand.OpenInventory();

        if (key == ConsoleKey.P)
            return ExplorationCommand.OpenProgression();

        var dir = key switch
        {
            ConsoleKey.UpArrow => Direction.Up,
            ConsoleKey.DownArrow => Direction.Down,
            ConsoleKey.LeftArrow => Direction.Left,
            ConsoleKey.RightArrow => Direction.Right,

            ConsoleKey.Z => Direction.Up,
            ConsoleKey.S => Direction.Down,
            ConsoleKey.Q => Direction.Left,
            ConsoleKey.D => Direction.Right,

            _ => Direction.None
        };

        return ExplorationCommand.Move(dir);
    }
}

public readonly struct ExplorationCommand
{
    public Direction Direction { get; }
    public bool InventoryRequested { get; }
    public bool ProgressionRequested { get; }

    private ExplorationCommand(Direction direction, bool inventoryRequested, bool progressionRequested)
    {
        Direction = direction;
        InventoryRequested = inventoryRequested;
        ProgressionRequested = progressionRequested;
    }

    public static ExplorationCommand Move(Direction d) => new(d, false, false);
    public static ExplorationCommand OpenInventory() => new(Direction.None, true, false);
    public static ExplorationCommand OpenProgression() => new(Direction.None, false, true);
}
