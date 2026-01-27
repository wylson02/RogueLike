namespace RogueLike.Domain.Items;

using RogueLike.Domain.Entities;

public abstract class Item
{
    public Position Position { get; }
    public abstract char Glyph { get; }
    public abstract string Name { get; }
    public abstract string Description { get; }

    public virtual bool AutoApplyOnPickup => true;

    protected Item(Position position)
    {
        Position = position;
    }

    public abstract void Apply(Player player);

    public virtual IEnumerable<string> GetStatsLines()
    {
        yield break;
    }
}
