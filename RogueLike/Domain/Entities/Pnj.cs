namespace RogueLike.Domain.Entities;

using RogueLike.Domain;

public sealed class Pnj : Entity
{
    public string Name { get; }
    public string Message { get; private set; }
    public bool HasGivenGift { get; private set; }
    public string GiftName { get; }
    public override char Glyph => 'p';

    public Pnj(Position pos, string name, string message, string giftName) : base(pos)
    {
        Name = name;
        Message = message;
        GiftName = giftName ?? "";
        HasGivenGift = false;
    }

    // ✅ Overload pratique si le PNJ n’a pas de cadeau
    public Pnj(Position pos, string name, string message) : this(pos, name, message, "")
    {
    }

    public string Talk() => Message;

    public void SetMessage(string message) => Message = message;

    public string? GiveGift()
    {
        if (HasGivenGift) return null;
        if (string.IsNullOrWhiteSpace(GiftName)) return null;

        HasGivenGift = true;
        return GiftName;
    }
}
