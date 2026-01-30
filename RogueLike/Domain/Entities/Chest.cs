namespace RogueLike.Domain.Entities;

using RogueLike.Domain;

public sealed class Chest


{
    public enum ChestType
    {
        Normal,
        TorchOnly,
        Legendary,
        LanternChest
    }
    public Position Pos { get; private set; }
    public bool IsOpened { get; private set; }

    public char Glyph => IsOpened ? 'o' : 'C';

    public ChestType Type { get; }

    public Chest(Position pos, ChestType type = ChestType.Normal)
    {
        Pos = pos;
        Type = type;
    }

    public void Open() => IsOpened = true;
}
