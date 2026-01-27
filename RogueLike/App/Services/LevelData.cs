namespace RogueLike.App.Services;

using RogueLike.Domain;
using RogueLike.Domain.Entities;
using RogueLike.Domain.Items;

public sealed class LevelData
{
    public GameMap Map { get; init; } = null!;
    public Position PlayerStart { get; init; }

    public List<Monster> Monsters { get; init; } = new();
    public List<Item> Items { get; init; } = new();
    public List<Chest> Chests { get; init; } = new();
}
