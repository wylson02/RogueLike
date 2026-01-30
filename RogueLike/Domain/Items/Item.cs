namespace RogueLike.Domain.Items;

using RogueLike.Domain.Entities;
using System.Collections.Generic;

public abstract class Item
{
    public Position Position { get; }
    public abstract char Glyph { get; }
    public abstract string Name { get; }
    public abstract string Description { get; }

    public virtual bool AutoApplyOnPickup => true;

    /// <summary>Item vendable chez le marchand.</summary>
    public virtual bool CanSell => true;

    /// <summary>Si true, l'item est équipé immédiatement au ramassage (si equipable).</summary>
    public virtual bool AutoEquipOnPickup => false;

    protected Item(Position position)
    {
        Position = position;
    }

    public abstract void Apply(Player player);

    /// <summary>
    /// Hook Visitor (progressif) : permet de centraliser l'application côté App plus tard.
    /// </summary>
    public virtual void Accept(IItemVisitor visitor) => visitor.Visit(this);

    public virtual IEnumerable<string> GetStatsLines()
    {
        yield break;
    }
}
