namespace RogueLike.Domain.Items;

public interface IItemVisitor
{
    void Visit(Item item);
}
