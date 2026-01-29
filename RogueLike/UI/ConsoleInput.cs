namespace RogueLike.UI;

using RogueLike.Domain;

public static class ConsoleInput
{
    public static ExplorationCommand ReadExplorationCommand()
    {
        var key = Console.ReadKey(true).Key;

        // DEV
        if (key == ConsoleKey.F3)
            return ExplorationCommand.DevLoadLevel3();

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
    public bool DevLoadLevel3Requested { get; }

    private ExplorationCommand(Direction direction, bool inventoryRequested, bool progressionRequested, bool devLoadLevel3Requested)
    {
        Direction = direction;
        InventoryRequested = inventoryRequested;
        ProgressionRequested = progressionRequested;
        DevLoadLevel3Requested = devLoadLevel3Requested;
    }

    public static ExplorationCommand Move(Direction d) => new(d, false, false, false);
    public static ExplorationCommand OpenInventory() => new(Direction.None, true, false, false);
    public static ExplorationCommand OpenProgression() => new(Direction.None, false, true, false);

    public static ExplorationCommand DevLoadLevel3() => new(Direction.None, false, false, true);
}
