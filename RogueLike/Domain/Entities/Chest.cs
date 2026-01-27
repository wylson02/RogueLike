namespace RogueLike.Domain.Entities;

using RogueLike.Domain;

public sealed class Chest
{
    public Position Pos { get; private set; }
    public bool IsOpened { get; private set; }

    public char Glyph => IsOpened ? 'o' : 'C';

    public Chest(Position pos)
    {
        Pos = pos;
    }

    public void Open() => IsOpened = true;
}
