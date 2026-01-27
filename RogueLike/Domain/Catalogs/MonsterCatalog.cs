namespace RogueLike.Domain.Catalogs;

using RogueLike.Domain.AI;
using RogueLike.Domain.Builders;
using RogueLike.Domain.Entities;

public static class MonsterCatalog
{
    public static Monster Slime(Position pos)
        => new MonsterBuilder()
            .Named("Slime")
            .At(pos)
            .WithHp(6)
            .WithAttack(5)
            .WithAi(new AggroWithinRangeStrategy(range: 3))
            .Build();

    public static Monster Golem(Position pos)
        => new MonsterBuilder()
            .Named("Golem")
            .At(pos)
            .WithHp(20)
            .WithAttack(1)
            .WithAi(new AggroWithinRangeStrategy(range: 3))
            .Build();
}
