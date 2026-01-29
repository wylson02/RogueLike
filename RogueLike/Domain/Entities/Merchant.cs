namespace RogueLike.Domain.Entities;

using RogueLike.Domain;

public sealed class Merchant
{
    public Position Pos { get; }
    public string Name { get; }
    public char Glyph => '¢';

    public Merchant(Position pos, string name = "Marchand")
    {
        Pos = pos;
        Name = name;
    }
}
