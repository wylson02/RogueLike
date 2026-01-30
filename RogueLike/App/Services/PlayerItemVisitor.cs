namespace RogueLike.App.Services;

using RogueLike.Domain.Entities;
using RogueLike.Domain.Items;

/// <summary>
/// Visitor appliquant les effets d'un Item sur un Player.
/// (Pour l'instant, on réutilise Item.Apply(player) pour garder la compatibilité.)
/// </summary>
public sealed class PlayerItemVisitor : IItemVisitor
{
    private readonly Player _player;

    public PlayerItemVisitor(Player player) => _player = player;

    public void Visit(Item item)
        => item.Apply(_player);
}
