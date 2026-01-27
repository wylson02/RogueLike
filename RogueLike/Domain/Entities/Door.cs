namespace RogueLike.Domain.Entities;

using RogueLike.Domain;
using RogueLike.Domain.Items;

public sealed class Door : Entity
{
    // Affichage : porte fermée ou ouverte
    public override char Glyph => IsOpen ? '/' : '|';

    // Quelle clé ouvre cette porte
    public KeyQuestType RequiredKey { get; }

    // Etat
    public bool IsOpen { get; private set; }

    public Door(Position pos, KeyQuestType requiredKey, bool isOpen = false)
        : base(pos)
    {
        RequiredKey = requiredKey;
        IsOpen = isOpen;
    }

    public bool TryOpen(Func<KeyQuestType, bool> playerHasKey)
    {
        if (IsOpen) return true;

        if (!playerHasKey(RequiredKey))
            return false;

        IsOpen = true;
        return true;
    }
}
