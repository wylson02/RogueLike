namespace RogueLike.Domain.Entities;

using System.Reflection.Metadata.Ecma335;
using RogueLike.Domain;

public sealed class Pnj : Entity
{
    public string Name { get; }
    public string Message { get; }
    public bool HasGivenGift { get; private set; }
    public string GiftName { get; }
    public override char Glyph => 'p';

    public Pnj(Position pos, string name, string message, string giftName) : base(pos)
    {
        Name = name;
        Message = message;
        GiftName = giftName;
        HasGivenGift = false;
    }

    public string Talk()
    {
        return Message;
    }

    public string? GiveGift()
    {
        if (HasGivenGift)
            return null;

        HasGivenGift = true;
        return GiftName;
    }
}