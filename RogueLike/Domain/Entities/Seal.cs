namespace RogueLike.Domain.Entities;

using RogueLike.Domain;

/// <summary>
/// Sceau scénarisé (Map 3) : le joueur doit activer les 3.
/// </summary>
public sealed class Seal
{
    public Position Pos { get; }
    public int Id { get; }
    public bool IsActivated { get; private set; }

    public char Glyph => IsActivated ? 's' : 'S';

    public Seal(int id, Position pos)
    {
        Id = id;
        Pos = pos;
    }

    public void Activate()
        => IsActivated = true;
}
